import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  CreatureField,
  isValidSpeciesId,
  type CanvasWithEngine,
  type SpeciesId,
} from '../components/creature-field'
import { PixelLoader } from '../components/PixelLoader'

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
  loader?: 'page' | 'variants'
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
  const loaderParam = merged.get('loader')

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
    loader:
      loaderParam === 'page' || loaderParam === 'variants' ? loaderParam : undefined,
  }
}

export function CreatureFieldDemo() {
  const pillBarRef = useRef<HTMLElement | null>(null)
  const debugRef = useRef<HTMLDivElement | null>(null)
  const loaderPanelRef = useRef<HTMLElement | null>(null)
  const mainRef = useRef<HTMLElement | null>(null)
  const location = useLocation()
  const urlParams = useMemo(() => parseLabParams(location.search), [location.search])

  const [pillOverride, setPillOverride] = useState<{
    search: string
    pill: SpeciesId | 'random'
    rollKey: number
  } | null>(null)
  const [pendingPill, setPendingPill] = useState<SpeciesId | 'random' | null>(null)
  const [demoButtonLoading, setDemoButtonLoading] = useState(true)

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
    setPendingPill(optionId)
    window.setTimeout(() => {
      setPendingPill((current) => (current === optionId ? null : current))
    }, 160)
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
    () =>
      urlParams.loader === 'variants'
        ? urlParams.debug
          ? [pillBarRef, loaderPanelRef, debugRef]
          : [pillBarRef, loaderPanelRef]
        : urlParams.debug
          ? [pillBarRef, debugRef]
          : [pillBarRef],
    [urlParams.debug, urlParams.loader],
  )

  if (urlParams.loader === 'page') {
    return <PixelLoader variant="page" label="Loading route" testId="pixel-loader-route" />
  }

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
          const isPending = pendingPill === option.id
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isActive}
              aria-busy={isPending}
              onClick={() => handleSelectPill(option.id)}
              className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-sm border px-3.5 py-2 font-mono text-xs tracking-[0.06em] transition-colors duration-100 ${
                isActive
                  ? 'border-accent bg-cobalt font-semibold text-text-primary'
                  : 'border-border bg-surface text-text-secondary hover:border-accent hover:text-text-primary'
              }`}
            >
              <PixelLoader
                variant="button"
                label={`Switching to ${option.label}`}
                active={isPending}
              />
              <span>{option.label}</span>
            </button>
          )
        })}
      </nav>

      {urlParams.loader === 'variants' ? (
        <section
          ref={loaderPanelRef}
          aria-label="Pixel loader variants"
          data-creature-ignore=""
          data-testid="pixel-loader-variants-panel"
          className="plate z-10 my-auto grid w-full max-w-2xl gap-4 rounded-lg border border-border p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <h1 className="font-mono text-sm uppercase tracking-[0.14em] text-text-primary">
              Pixel Loader Variants
            </h1>
            <div className="inline-flex items-center gap-2 font-mono text-xs text-text-secondary">
              <PixelLoader
                variant="inline"
                label="Syncing telemetry"
                testId="pixel-loader-inline-demo"
              />
              <span>Inline status active</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div
              aria-busy="true"
              className="flex flex-col items-center justify-center rounded-sm border border-border bg-surface p-4"
            >
              <PixelLoader
                variant="section"
                label="Loading section"
                testId="pixel-loader-section-demo"
              />
            </div>

            <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-border bg-surface p-4">
              <button
                type="button"
                aria-busy={demoButtonLoading}
                onClick={() => setDemoButtonLoading((prev) => !prev)}
                data-testid="pixel-loader-button-trigger"
                className="action-primary inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2.5 rounded-sm bg-accent px-5 py-3 font-medium text-ink"
              >
                <PixelLoader
                  variant="button"
                  label="Submitting action"
                  active={demoButtonLoading}
                  testId="pixel-loader-button-demo"
                />
                <span>{demoButtonLoading ? 'Processing action' : 'Run action'}</span>
              </button>
              <p className="font-mono text-xs text-text-secondary">
                3-cell stepped button loader
              </p>
            </div>
          </div>
        </section>
      ) : null}

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
