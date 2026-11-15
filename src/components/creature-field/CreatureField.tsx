import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import {
  CreatureFieldEngine,
  clampScale,
  createSeededRng,
  selectSpecies,
  shouldIgnorePointerTarget,
  snapCellSize,
} from './engine.ts'
import { readPaletteFromTokens } from './palette.ts'
import { ALL_SPECIES, type AvoidRect, type SpeciesId } from './species/index.ts'
import { useReducedMotion } from './useReducedMotion.ts'

export type CreatureFieldProps = {
  species?: SpeciesId | 'random'
  pool?: SpeciesId[]
  seed?: number
  count?: number
  cell?: number
  scale?: number
  avoid?: RefObject<HTMLElement | null>[]
  avoidSelector?: string
  clickMode?: 'auto' | 'scatter'
  interactive?: boolean
  paused?: boolean
  grid?: boolean
  fixed?: boolean
  className?: string
}

const SESSION_STORAGE_KEY = 'cobalt-creature-field-last-species'
const RESIZE_DEBOUNCE_MS = 150
const TOUCH_TAP_MAX_MS = 250
const TOUCH_TAP_MAX_DIST_PX = 10

function readCreatureQueryParam(): string | null {
  if (typeof window === 'undefined') return null
  const searchParams = new URLSearchParams(window.location.search)
  const fromSearch = searchParams.get('creature')
  if (fromSearch) return fromSearch

  const hash = window.location.hash
  const qIdx = hash.indexOf('?')
  if (qIdx !== -1) {
    const hashParams = new URLSearchParams(hash.slice(qIdx + 1))
    return hashParams.get('creature')
  }
  return null
}

function getEffectiveDpr(): number {
  if (typeof window === 'undefined') return 1
  const isPhone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 767px), (pointer: coarse)').matches
  const maxDpr = isPhone ? 1.5 : 2
  return Math.min(window.devicePixelRatio || 1, maxDpr)
}

export interface CanvasWithEngine extends HTMLCanvasElement {
  __creatureFieldEngine?: CreatureFieldEngine
}

export function CreatureField({
  species = 'random',
  pool,
  seed,
  count,
  cell = 8,
  scale = 1,
  avoid,
  avoidSelector,
  clickMode = 'auto',
  interactive = true,
  paused = false,
  grid = true,
  fixed = false,
  className = '',
}: CreatureFieldProps) {
  const canvasRef = useRef<CanvasWithEngine | null>(null)
  const engineRef = useRef<CreatureFieldEngine | null>(null)
  const reducedMotion = useReducedMotion()
  const [contextUnavailable, setContextUnavailable] = useState(false)
  const [chosenSpecies, setChosenSpecies] = useState<SpeciesId | null>(null)

  const avoidRef = useRef(avoid)
  const avoidSelectorRef = useRef(avoidSelector)
  const interactiveRef = useRef(interactive)
  const pausedRef = useRef(paused)
  const clickModeRef = useRef(clickMode)
  const gridRef = useRef(grid)

  useEffect(() => {
    avoidRef.current = avoid
    avoidSelectorRef.current = avoidSelector
    interactiveRef.current = interactive
    pausedRef.current = paused
    clickModeRef.current = clickMode
    gridRef.current = grid
  }, [avoid, avoidSelector, interactive, paused, clickMode, grid])

  // Choose species on the client after mount (no hydration mismatch)
  useEffect(() => {
    const resolveSpecies = () => {
      let lastSpecies: SpeciesId | null = null
      try {
        const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY) as SpeciesId | null
        if (stored) lastSpecies = stored
      } catch {
        // sessionStorage may be blocked or unavailable
      }

      const rng = seed !== undefined ? createSeededRng(seed) : Math.random
      const selected = selectSpecies({
        species,
        pool: pool && pool.length > 0 ? pool : ALL_SPECIES,
        lastSpecies,
        devQuerySpecies: readCreatureQueryParam(),
        isDev: Boolean(import.meta.env.DEV),
        rng,
      })

      try {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, selected)
      } catch {
        // ignore storage errors
      }

      setChosenSpecies(selected)
    }

    resolveSpecies()

    if (import.meta.env.DEV && (!species || species === 'random')) {
      const handleUrlChange = () => {
        const devQuery = readCreatureQueryParam()
        if (devQuery) {
          resolveSpecies()
        }
      }
      window.addEventListener('hashchange', handleUrlChange)
      window.addEventListener('popstate', handleUrlChange)
      return () => {
        window.removeEventListener('hashchange', handleUrlChange)
        window.removeEventListener('popstate', handleUrlChange)
      }
    }
  }, [species, pool, seed])

  // Sync dynamic props onto active engine without recreating simulation
  useEffect(() => {
    const engine = engineRef.current
    const canvas = canvasRef.current
    if (!engine || !canvas) return
    engine.setGrid(grid)
    engine.setClickMode(clickMode)
    const ctx = canvas.getContext('2d', { alpha: false })
    if (ctx) {
      engine.render(ctx)
    }
  }, [grid, clickMode])

  useEffect(() => {
    if (!chosenSpecies || contextUnavailable) return
    const canvas = canvasRef.current
    if (!canvas) return

    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext('2d', { alpha: false })
    } catch {
      ctx = null
    }

    if (!ctx) {
      if (import.meta.env.DEV) {
        console.warn('[CreatureField] 2D canvas context is unavailable; rendering fallback.')
      }
      setContextUnavailable(true)
      return
    }

    const parent = canvas.parentElement
    const measureBounds = () => {
      const rect = (fixed ? document.documentElement : (parent ?? canvas)).getBoundingClientRect()
      const width = Math.max(1, Math.round(fixed ? window.innerWidth : rect.width || window.innerWidth))
      const height = Math.max(1, Math.round(fixed ? window.innerHeight : rect.height || window.innerHeight))
      return { width, height, canvasRect: canvas.getBoundingClientRect() }
    }

    const measureAvoidRects = (canvasRect: DOMRect): AvoidRect[] => {
      const list = avoidRef.current
      const selector = avoidSelectorRef.current
      const elements = new Set<Element>()
      if (list) {
        for (let i = 0; i < list.length; i++) {
          const el = list[i]?.current
          if (el) elements.add(el)
        }
      }
      if (selector && typeof document !== 'undefined') {
        try {
          const matched = document.querySelectorAll(selector)
          for (let i = 0; i < matched.length; i++) {
            const el = matched[i]
            if (el) elements.add(el)
          }
        } catch {
          // ignore invalid CSS selector
        }
      }
      if (elements.size === 0) return []
      const rects: AvoidRect[] = []
      for (const el of elements) {
        const r = el.getBoundingClientRect()
        if (r.width <= 0 || r.height <= 0) continue
        rects.push({
          left: r.left - canvasRect.left,
          top: r.top - canvasRect.top,
          right: r.right - canvasRect.left,
          bottom: r.bottom - canvasRect.top,
        })
      }
      return rects
    }

    const initialBounds = measureBounds()
    const dpr = getEffectiveDpr()
    canvas.width = Math.round(initialBounds.width * dpr)
    canvas.height = Math.round(initialBounds.height * dpr)

    const palette = readPaletteFromTokens(document.documentElement)
    const snappedCell = snapCellSize(cell)
    const normalizedScale = clampScale(scale)
    const initialAvoid = measureAvoidRects(initialBounds.canvasRect)

    const engine = new CreatureFieldEngine({
      species: chosenSpecies,
      palette,
      width: initialBounds.width,
      height: initialBounds.height,
      dpr,
      cell: snappedCell,
      scale: normalizedScale,
      count,
      seed,
      clickMode: clickModeRef.current,
      grid: gridRef.current,
      avoidRects: initialAvoid,
    })

    engineRef.current = engine
    canvas.__creatureFieldEngine = engine

    let disposed = false
    let fontReady = false
    let rafId = 0
    let isIntersecting = true
    let isTabHidden = typeof document !== 'undefined' ? document.hidden : false
    let resizeTimer: ReturnType<typeof setTimeout> | null = null

    const shouldRunLoop = () =>
      fontReady && !reducedMotion && !pausedRef.current && isIntersecting && !isTabHidden

    const loop = (now: number) => {
      rafId = 0
      if (!shouldRunLoop()) return
      engine.tick(now, ctx)
      if (shouldRunLoop()) {
        rafId = window.requestAnimationFrame(loop)
      }
    }

    const syncLoopState = () => {
      if (shouldRunLoop()) {
        if (rafId === 0) {
          engine.resetFrameClock()
          rafId = window.requestAnimationFrame(loop)
        }
      } else if (rafId !== 0) {
        window.cancelAnimationFrame(rafId)
        rafId = 0
      }
    }

    // Wait for Paper Mono font to load before building the final glyph atlas and first draw
    const startAfterFontReady = async () => {
      if (
        typeof document !== 'undefined' &&
        'fonts' in document &&
        document.fonts &&
        typeof document.fonts.load === 'function'
      ) {
        try {
          await Promise.race([
            document.fonts.load("600 10px 'Paper Mono'"),
            new Promise((resolve) => setTimeout(resolve, 350)),
          ])
        } catch {
          // Proceed with fallback mono if font loading fails
        }
      }
      if (disposed) return
      fontReady = true
      engine.setAvoidRects(measureAvoidRects(canvas.getBoundingClientRect()))
      engine.rebuildPaletteAndAtlases()

      if (reducedMotion) {
        engine.warmUpAndRenderStill(ctx, 3.0)
      } else {
        engine.render(ctx)
        syncLoopState()
      }
    }

    void startAfterFontReady()

    // Visibility listener (pause in hidden tabs)
    const handleVisibilityChange = () => {
      isTabHidden = document.hidden
      syncLoopState()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // IntersectionObserver (pause when canvas is off-screen)
    let intersectionObserver: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          isIntersecting = entry ? entry.isIntersecting : true
          syncLoopState()
        },
        { threshold: 0 },
      )
      intersectionObserver.observe(canvas)
    }

    // Debounced ResizeObserver (~150 ms)
    let cachedCanvasRect = initialBounds.canvasRect
    const applyResize = () => {
      if (disposed || !fontReady) return
      const nextBounds = measureBounds()
      cachedCanvasRect = nextBounds.canvasRect
      const nextDpr = getEffectiveDpr()
      canvas.width = Math.round(nextBounds.width * nextDpr)
      canvas.height = Math.round(nextBounds.height * nextDpr)
      engine.setAvoidRects(measureAvoidRects(nextBounds.canvasRect))
      engine.resize(nextBounds.width, nextBounds.height, nextDpr)
      engine.render(ctx)
    }

    let resizeObserver: ResizeObserver | null = null
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer !== null) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          resizeTimer = null
          applyResize()
        }, RESIZE_DEBOUNCE_MS)
      })
      resizeObserver.observe(parent ?? canvas)
    }

    const handleWindowResize = () => {
      if (resizeTimer !== null) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        applyResize()
      }, RESIZE_DEBOUNCE_MS)
    }
    window.addEventListener('resize', handleWindowResize, { passive: true })

    // Keep avoid rects and canvas rect fresh on scroll
    const handleScroll = () => {
      cachedCanvasRect = canvas.getBoundingClientRect()
      if ((!avoidRef.current || avoidRef.current.length === 0) && !avoidSelectorRef.current) return
      engine.setAvoidRects(measureAvoidRects(cachedCanvasRect))
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Window pointer listeners (mouse on pointerdown; touch only on tap <= 250ms & < 10px; passive pointermove trail)
    let activeTouchId: number | null = null
    let touchStartX = 0
    let touchStartY = 0
    let touchStartTime = 0
    let touchIgnored = false

    const triggerAtClientPoint = (clientX: number, clientY: number) => {
      if (!interactiveRef.current || pausedRef.current || reducedMotion || !fontReady) return
      const rect = canvas.getBoundingClientRect()
      cachedCanvasRect = rect
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return
      }
      engine.setAvoidRects(measureAvoidRects(rect))
      engine.handlePointerTrigger(clientX - rect.left, clientY - rect.top)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!interactiveRef.current || pausedRef.current || reducedMotion || !fontReady) return
      if (event.pointerType === 'touch') return
      if (shouldIgnorePointerTarget(event.target)) return
      const rect = cachedCanvasRect
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return
      }
      engine.handlePointerMove(event.clientX - rect.left, event.clientY - rect.top)
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!interactiveRef.current || pausedRef.current || reducedMotion) return
      const ignored = shouldIgnorePointerTarget(event.target)
      if (event.pointerType === 'touch') {
        activeTouchId = event.pointerId
        touchStartX = event.clientX
        touchStartY = event.clientY
        touchStartTime = performance.now()
        touchIgnored = ignored
        return
      }
      if (ignored) return
      if (event.button !== undefined && event.button !== 0) return
      triggerAtClientPoint(event.clientX, event.clientY)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || event.pointerId !== activeTouchId) return
      activeTouchId = null
      if (touchIgnored) return
      const elapsed = performance.now() - touchStartTime
      const moved = Math.hypot(event.clientX - touchStartX, event.clientY - touchStartY)
      if (elapsed <= TOUCH_TAP_MAX_MS && moved < TOUCH_TAP_MAX_DIST_PX) {
        triggerAtClientPoint(event.clientX, event.clientY)
      }
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId === activeTouchId) {
        activeTouchId = null
      }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    window.addEventListener('pointercancel', handlePointerCancel, { passive: true })

    return () => {
      disposed = true
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId)
      }
      if (resizeTimer !== null) {
        clearTimeout(resizeTimer)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('resize', handleWindowResize)
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      intersectionObserver?.disconnect()
      resizeObserver?.disconnect()
      delete canvas.__creatureFieldEngine
      engineRef.current = null
    }
  }, [chosenSpecies, cell, scale, count, seed, reducedMotion, fixed, contextUnavailable])

  // Toggle pause state reactively without remounting the engine
  useEffect(() => {
    const canvas = canvasRef.current
    const engine = engineRef.current
    if (!canvas || !engine || reducedMotion) return
    document.dispatchEvent(new Event('visibilitychange'))
  }, [paused, reducedMotion])

  if (contextUnavailable) {
    return null
  }

  const positionClass = fixed ? 'fixed inset-0' : 'absolute inset-0'

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-species={chosenSpecies ?? 'initializing'}
      data-scale={clampScale(scale)}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-avoid-selector={avoidSelector}
      className={`pointer-events-none ${positionClass} -z-10 block h-full w-full select-none ${className}`.trim()}
    />
  )
}
