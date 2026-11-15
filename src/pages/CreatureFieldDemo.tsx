import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  CreatureField,
  isValidSpeciesId,
  type CanvasWithEngine,
  type SpeciesId,
} from '../components/creature-field'

const PILL_OPTIONS: readonly { id: 'random' | SpeciesId; label: string }[] = [
  { id: 'random', label: 'Random' },
  { id: 'koi', label: 'koi' },
  { id: 'butterfly', label: 'butterfly' },
  { id: 'jellyfish', label: 'jellyfish' },
  { id: 'dragonfly', label: 'dragonfly' },
  { id: 'manta', label: 'manta' },
  { id: 'fish-school', label: 'fish-school' },
]

interface ParsedLabParams {
  creature: SpeciesId | 'random'
  scale: number
  debug: boolean
  seed?: number
  count?: number
  cell?: number
  clickMode?: 'auto' | 'scatter'
  paused?: boolean
  grid?: boolean
}

function parseLabParams(routerSearch: string): ParsedLabParams {
  if (typeof window === 'undefined') {
    return { creature: 'random', scale: 1, debug: false }
  }
  const merged = new URLSearchParams(window.location.search)
  const fromRouter = new URLSearchParams(routerSearch)
  fromRouter.forEach((value, key) => {
    merged.set(key, value)
  })
  const hash = window.location.hash
  const qIdx = hash.indexOf('?')
  if (qIdx !== -1) {
    const hashParams = new URLSearchParams(hash.slice(qIdx + 1))
    hashParams.forEach((value, key) => {
      merged.set(key, value)
    })
  }

  const rawCreature = merged.get('creature') ?? merged.get('species')
  const creature: SpeciesId | 'random' =
    rawCreature && isValidSpeciesId(rawCreature) ? rawCreature : 'random'

  const scaleParam = merged.get('scale')
  const parsedScale = scaleParam !== null && scaleParam !== '' ? Number(scaleParam) : 1
  const scale = Number.isFinite(parsedScale) && parsedScale > 0 ? parsedScale : 1

  const debugParam = merged.get('debug')
  const debug = debugParam === '1' || debugParam === 'true'

  const seedParam = merged.get('seed')
  const countParam = merged.get('count')
  const cellParam = merged.get('cell')
  const clickModeParam = merged.get('clickMode')
  const pausedParam = merged.get('paused')
  const gridParam = merged.get('grid')

  return {
    creature,
    scale,
    debug,
    seed: seedParam !== null && seedParam !== '' ? Number(seedParam) : undefined,
    count: countParam !== null && countParam !== '' ? Number(countParam) : undefined,
    cell: cellParam !== null && cellParam !== '' ? Number(cellParam) : undefined,
    clickMode:
      clickModeParam === 'scatter' || clickModeParam === 'auto' ? clickModeParam : undefined,
    paused: pausedParam === '1' || pausedParam === 'true',
    grid: gridParam === '0' || gridParam === 'false' ? false : true,
  }
}

export function CreatureFieldDemo() {
  const pillBarRef = useRef<HTMLElement | null>(null)
  const debugRef = useRef<HTMLDivElement | null>(null)
  const mainRef = useRef<HTMLElement | null>(null)
  const location = useLocation()
  const urlParams = useMemo(() => parseLabParams(location.search), [location.search])

  const [pillOverride, setPillOverride] = useState<{
    search: string
    pill: SpeciesId | 'random'
    rollKey: number
  } | null>(null)

  const selectedPill =
    pillOverride && pillOverride.search === location.search
      ? pillOverride.pill
      : urlParams.creature
  const rollKey =
    pillOverride && pillOverride.search === location.search ? pillOverride.rollKey : 0

  const [debugStats, setDebugStats] = useState<{
    fps: number
    creatureCount: number
    species: string
  }>({
    fps: 60,
    creatureCount: 0,
    species: selectedPill,
  })

  // Inject <meta name="robots" content="noindex,nofollow"> while on this route
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex,nofollow'
    document.head.appendChild(meta)
    return () => {
      meta.remove()
    }
  }, [])

  // Poll FPS and creature count when ?debug=1 is active
  useEffect(() => {
    if (!urlParams.debug) return
    const updateStats = () => {
      const canvas = mainRef.current?.querySelector('canvas') as CanvasWithEngine | null
      const engine = canvas?.__creatureFieldEngine
      if (engine) {
        const m = engine.getMetrics()
        setDebugStats({
          fps: m.fps,
          creatureCount: m.creatureCount,
          species: m.species,
        })
      }
    }
    updateStats()
    const timer = window.setInterval(updateStats, 200)
    return () => {
      window.clearInterval(timer)
    }
  }, [urlParams.debug, selectedPill, rollKey, urlParams.scale])

  const handleSelectPill = (optionId: SpeciesId | 'random') => {
    setPillOverride((prev) => ({
      search: location.search,
      pill: optionId,
      rollKey: optionId === 'random' ? (prev?.rollKey ?? 0) + 1 : prev?.rollKey ?? 0,
    }))

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.hash.startsWith('#/')) {
        const [hashPath, hashQuery = ''] = url.hash.split('?')
        const params = new URLSearchParams(hashQuery)
        if (optionId === 'random') {
          params.delete('creature')
        } else {
          params.set('creature', optionId)
        }
        const qs = params.toString()
        window.history.replaceState(
          null,
          '',
          `${url.pathname}${url.search}${hashPath}${qs ? `?${qs}` : ''}`,
        )
      } else {
        if (optionId === 'random') {
          url.searchParams.delete('creature')
        } else {
          url.searchParams.set('creature', optionId)
        }
        window.history.replaceState(null, '', url.toString())
      }
    }
  }

  const avoidRefs = useMemo(
    () => (urlParams.debug ? [pillBarRef, debugRef] : [pillBarRef]),
    [urlParams.debug],
  )

  return (
    <main
      ref={mainRef}
      className="relative isolate flex min-h-dvh w-full flex-col items-center justify-between overflow-hidden bg-background p-4"
    >
      <CreatureField
        key={rollKey}
        species={selectedPill}
        scale={urlParams.scale}
        seed={urlParams.seed}
        count={urlParams.count}
        cell={urlParams.cell}
        clickMode={urlParams.clickMode}
        paused={urlParams.paused}
        grid={urlParams.grid}
        avoid={avoidRefs}
      />

      <nav
        ref={pillBarRef}
        aria-label="Species selector"
        data-creature-ignore=""
        className="plate z-10 flex max-w-full flex-wrap items-center justify-center gap-2 rounded-lg border border-border p-2"
      >
        {PILL_OPTIONS.map((option) => {
          const isActive = selectedPill === option.id
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSelectPill(option.id)}
              className={`min-h-11 min-w-11 cursor-pointer rounded-sm border px-3.5 py-2 font-mono text-xs tracking-[0.06em] transition-colors duration-100 ${
                isActive
                  ? 'border-accent bg-cobalt font-semibold text-text-primary'
                  : 'border-border bg-surface text-text-secondary hover:border-accent hover:text-text-primary'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </nav>

      {urlParams.debug ? (
        <div
          ref={debugRef}
          data-creature-ignore=""
          data-testid="creature-debug"
          className="plate z-10 self-end rounded-md border border-border px-3 py-2 font-mono text-xs tabular-nums text-text-primary"
        >
          <span>{debugStats.fps} FPS</span>
          <span className="mx-2 text-text-muted">·</span>
          <span>{debugStats.creatureCount} creatures</span>
          <span className="mx-2 text-text-muted">·</span>
          <span className="text-text-secondary">{debugStats.species}</span>
        </div>
      ) : null}
    </main>
  )
}

export default CreatureFieldDemo
