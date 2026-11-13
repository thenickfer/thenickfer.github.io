import { GrainGradient } from '@paper-design/shaders-react'
import { useEffect, useRef, useState } from 'react'

const THERMAL_TOKENS = [
  '--ds-color-surface-sunk',
  '--ds-color-cobalt-deep',
  '--ds-color-cobalt',
  '--ds-color-thermal-violet',
  '--ds-color-oxide',
  '--ds-color-thermal-hot',
]

const HERO_GRADIENT_SETTINGS = {
  intensity: 0.3,
  noise: 0.22,
  shape: 'wave' as const,
  softness: 0.72,
  speed: 0.78,
  maxPixelsDesktop: 640_000,
  maxPixelsPhone: 320_000,
}

function useShaderEnvironment() {
  const [environment, setEnvironment] = useState({ reducedMotion: false, isPhone: false, webgl: false })

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const phoneQuery = window.matchMedia('(max-width: 767px)')
    const canvas = document.createElement('canvas')
    const webgl = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
    const update = () =>
      setEnvironment({
        reducedMotion: reducedMotionQuery.matches,
        isPhone: phoneQuery.matches,
        webgl,
      })

    update()
    reducedMotionQuery.addEventListener('change', update)
    phoneQuery.addEventListener('change', update)
    return () => {
      reducedMotionQuery.removeEventListener('change', update)
      phoneQuery.removeEventListener('change', update)
    }
  }, [])

  return environment
}

export function ThermalGradientFallback() {
  return (
    <svg className="hero-gradient-fallback" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="thermal-fallback-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--ds-color-surface-sunk)" />
          <stop offset="30%" stopColor="var(--ds-color-cobalt-deep)" />
          <stop offset="52%" stopColor="var(--ds-color-cobalt)" />
          <stop offset="70%" stopColor="var(--ds-color-thermal-violet)" />
          <stop offset="86%" stopColor="var(--ds-color-oxide)" />
          <stop offset="100%" stopColor="var(--ds-color-thermal-hot)" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#thermal-fallback-gradient)" />
    </svg>
  )
}

export function GrainGradientBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(true)
  const [colors] = useState<string[] | undefined>(() => {
    if (typeof document === 'undefined') return undefined
    return THERMAL_TOKENS.map((token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim())
  })
  const environment = useShaderEnvironment()

  useEffect(() => {
    if (!containerRef.current || !('IntersectionObserver' in window)) {
      setNearViewport(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry?.isIntersecting ?? false), { rootMargin: '200px' })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const branch = !environment.webgl
    ? 'fallback: no WebGL context'
    : environment.reducedMotion
      ? 'fallback: prefers-reduced-motion'
      : !colors
        ? 'fallback: shader colors unavailable'
        : !nearViewport
          ? 'paused: outside viewport'
          : 'animated GrainGradient shader'
  const canRenderShader = environment.webgl && !environment.reducedMotion && Boolean(colors)
  const maxPixelCount = environment.isPhone
    ? HERO_GRADIENT_SETTINGS.maxPixelsPhone
    : HERO_GRADIENT_SETTINGS.maxPixelsDesktop

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info(`[Cobalt shader] hero gradient branch: ${branch}`)
    }
  }, [branch])

  return (
    <div ref={containerRef} className="hero-gradient" aria-hidden="true">
      {!canRenderShader ? <ThermalGradientFallback /> : null}
      {canRenderShader && colors ? (
        <GrainGradient
          className="hero-gradient-live"
          colorBack={colors[0]}
          colors={colors}
          intensity={HERO_GRADIENT_SETTINGS.intensity}
          maxPixelCount={maxPixelCount}
          minPixelRatio={1}
          noise={HERO_GRADIENT_SETTINGS.noise}
          shape={HERO_GRADIENT_SETTINGS.shape}
          softness={HERO_GRADIENT_SETTINGS.softness}
          speed={nearViewport ? HERO_GRADIENT_SETTINGS.speed : 0}
        />
      ) : null}
    </div>
  )
}
