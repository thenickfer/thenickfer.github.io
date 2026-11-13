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

function useShaderEnvironment() {
  const [environment, setEnvironment] = useState({ reducedMotion: false, smallScreen: false, webgl: false })

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const smallScreenQuery = window.matchMedia('(max-width: 639px)')
    const canvas = document.createElement('canvas')
    const webgl = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
    const update = () =>
      setEnvironment({
        reducedMotion: reducedMotionQuery.matches,
        smallScreen: smallScreenQuery.matches,
        webgl,
      })

    update()
    reducedMotionQuery.addEventListener('change', update)
    smallScreenQuery.addEventListener('change', update)
    return () => {
      reducedMotionQuery.removeEventListener('change', update)
      smallScreenQuery.removeEventListener('change', update)
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
        <filter id="thermal-fallback-grain">
          <feTurbulence baseFrequency=".8" numOctaves="2" stitchTiles="stitch" type="fractalNoise" />
          <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 .16 0" />
        </filter>
      </defs>
      <rect width="1600" height="900" fill="url(#thermal-fallback-gradient)" />
      <rect width="1600" height="900" filter="url(#thermal-fallback-grain)" opacity=".35" />
    </svg>
  )
}

export function GrainGradientBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [nearViewport, setNearViewport] = useState(false)
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

  const canRenderShader = nearViewport && environment.webgl && !environment.reducedMotion && !environment.smallScreen && colors

  return (
    <div ref={containerRef} className="hero-gradient" aria-hidden="true">
      <ThermalGradientFallback />
      {canRenderShader ? (
        <GrainGradient
          className="hero-gradient-live"
          colorBack={colors[0]}
          colors={colors}
          intensity={0.28}
          maxPixelCount={1_500_000}
          minPixelRatio={1}
          noise={0.24}
          shape="wave"
          softness={0.7}
          speed={0.08}
        />
      ) : null}
    </div>
  )
}
