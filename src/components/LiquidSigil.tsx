import { LiquidMetal } from '@paper-design/shaders-react'
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import maskUrl from '../assets/liquid-sigil-mask.svg'

const LIQUID_SIGIL_START_VALUES = {
  colorBackToken: '--ds-color-transparent',
  colorTintToken: '--ds-color-iridescent-violet',
  shiftRed: 0.3,
  shiftBlue: 0.3,
  repetition: 2,
  softness: 0.1,
  distortion: 0.07,
  contour: 0.4,
  angle: 70,
  scale: 0.6,
  speed: 0.4,
  fit: 'contain' as const,
}

type LiquidSigilProps = {
  size?: number
  decorative?: boolean
  label?: string
  className?: string
}

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

function useNearViewport(ref: RefObject<HTMLDivElement | null>) {
  const [nearViewport, setNearViewport] = useState(false)

  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) {
      setNearViewport(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => setNearViewport(entry?.isIntersecting ?? false), { rootMargin: '200px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return nearViewport
}

function resolveToken(token: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

function IridescentFallback({ decorative, label }: Pick<LiquidSigilProps, 'decorative' | 'label'>) {
  return (
    <svg
      aria-hidden={decorative}
      aria-label={decorative ? undefined : label}
      className="liquid-sigil-fallback"
      role={decorative ? undefined : 'img'}
      viewBox="0 0 100 100"
    >
      <defs>
        <linearGradient id="liquid-sigil-iridescence" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--ds-color-iridescent-cyan)" />
          <stop offset="35%" stopColor="var(--ds-color-iridescent-violet)" />
          <stop offset="68%" stopColor="var(--ds-color-iridescent-pink)" />
          <stop offset="100%" stopColor="var(--ds-color-iridescent-yellow)" />
        </linearGradient>
      </defs>
      <path d="M50 4 59 39 96 50 59 61 50 96 41 61 4 50 41 39 50 4Z" fill="url(#liquid-sigil-iridescence)" />
    </svg>
  )
}

export function LiquidSigil({ size = 240, decorative = true, label = 'Nícolas Ferreira', className = '' }: LiquidSigilProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nearViewport = useNearViewport(containerRef)
  const environment = useShaderEnvironment()
  const [colors] = useState<{ colorBack: string; colorTint: string } | undefined>(() => {
    if (typeof document === 'undefined') return undefined
    return {
      colorBack: resolveToken(LIQUID_SIGIL_START_VALUES.colorBackToken),
      colorTint: resolveToken(LIQUID_SIGIL_START_VALUES.colorTintToken),
    }
  })
  const clampedSize = Math.min(Math.max(size, 96), 480)
  const canRenderShader = nearViewport && environment.webgl && !environment.reducedMotion && !environment.smallScreen

  return (
    <div
      ref={containerRef}
      className={`liquid-sigil ${className}`}
      style={{ width: clampedSize, height: clampedSize }}
      aria-hidden={decorative}
    >
      <IridescentFallback decorative={decorative} label={label} />
      {canRenderShader && colors ? (
        <LiquidMetal
          aria-hidden={decorative}
          className="liquid-sigil-live"
          colorBack={colors.colorBack}
          colorTint={colors.colorTint}
          contour={LIQUID_SIGIL_START_VALUES.contour}
          distortion={LIQUID_SIGIL_START_VALUES.distortion}
          fit={LIQUID_SIGIL_START_VALUES.fit}
          image={maskUrl}
          maxPixelCount={1_000_000}
          minPixelRatio={1.5}
          repetition={LIQUID_SIGIL_START_VALUES.repetition}
          scale={LIQUID_SIGIL_START_VALUES.scale}
          shiftBlue={LIQUID_SIGIL_START_VALUES.shiftBlue}
          shiftRed={LIQUID_SIGIL_START_VALUES.shiftRed}
          softness={LIQUID_SIGIL_START_VALUES.softness}
          speed={nearViewport ? LIQUID_SIGIL_START_VALUES.speed : 0}
        />
      ) : null}
    </div>
  )
}
