import { LiquidMetal } from '@paper-design/shaders-react'
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import maskUrl from '../assets/liquid-sigil-mask.svg'
import fallbackUrl from '../assets/star-sigil-fallback.svg'

const LIQUID_SIGIL_START_VALUES = {
  colorBackToken: '--ds-color-transparent',
  colorTintToken: '--ds-color-iridescent-violet',
  shiftRed: 0.5,
  shiftBlue: 0.5,
  repetition: 3,
  softness: 0.06,
  distortion: 0.07,
  contour: 0.18,
  angle: 70,
  scale: 0.97,
  speed: 0.5,
  fit: 'contain' as const,
  maskResolution: 512,
}

type LiquidSigilProps = {
  size?: number
  decorative?: boolean
  label?: string
  className?: string
}

function useShaderEnvironment() {
  const [environment, setEnvironment] = useState({ reducedMotion: false, webgl: false })

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const canvas = document.createElement('canvas')
    const webgl = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
    const update = () =>
      setEnvironment({
        reducedMotion: reducedMotionQuery.matches,
        webgl,
      })

    update()
    reducedMotionQuery.addEventListener('change', update)
    return () => {
      reducedMotionQuery.removeEventListener('change', update)
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
    <img
      alt={decorative ? '' : label}
      className="liquid-sigil-fallback"
      src={fallbackUrl}
    />
  )
}

export function LiquidSigil({ size = 240, decorative = true, label = 'Nícolas Ferreira', className = '' }: LiquidSigilProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nearViewport = useNearViewport(containerRef)
  const environment = useShaderEnvironment()
  const [maskImageSrc, setMaskImageSrc] = useState<string | null>(null)
  const [colors] = useState<{ colorBack: string; colorTint: string } | undefined>(() => {
    if (typeof document === 'undefined') return undefined
    return {
      colorBack: resolveToken(LIQUID_SIGIL_START_VALUES.colorBackToken),
      colorTint: resolveToken(LIQUID_SIGIL_START_VALUES.colorTintToken),
    }
  })
  const clampedSize = Math.min(Math.max(size, 96), 480)
  useEffect(() => {
    let active = true
    const image = new Image()
    image.onload = () => {
      if (!active) return
      const canvas = document.createElement('canvas')
      canvas.width = LIQUID_SIGIL_START_VALUES.maskResolution
      canvas.height = LIQUID_SIGIL_START_VALUES.maskResolution
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setMaskImageSrc(maskUrl)
        return
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      setMaskImageSrc(canvas.toDataURL('image/png'))
    }
    image.onerror = () => {
      if (active) setMaskImageSrc(null)
    }
    image.src = maskUrl
    return () => {
      active = false
    }
  }, [])

  const maskLoaded = Boolean(maskImageSrc)
  const branch = !environment.webgl
    ? 'fallback: no WebGL context'
    : environment.reducedMotion
      ? 'fallback: prefers-reduced-motion'
      : !maskLoaded
        ? 'fallback: sigil mask failed to load'
        : !nearViewport
          ? 'paused: outside viewport'
          : 'animated LiquidMetal shader'
  const canRenderShader = environment.webgl && !environment.reducedMotion && maskLoaded

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info(`[Cobalt shader] liquid sigil branch: ${branch}`)
    }
  }, [branch])

  return (
    <div
      ref={containerRef}
      className={`liquid-sigil ${className}`}
      style={{ width: clampedSize, height: clampedSize }}
      aria-hidden={decorative}
    >
      <IridescentFallback decorative={decorative} label={label} />
      {canRenderShader && colors && maskImageSrc ? (
        <LiquidMetal
          angle={LIQUID_SIGIL_START_VALUES.angle}
          aria-hidden={decorative}
          className="liquid-sigil-live"
          colorBack={colors.colorBack}
          colorTint={colors.colorTint}
          contour={LIQUID_SIGIL_START_VALUES.contour}
          distortion={LIQUID_SIGIL_START_VALUES.distortion}
          fit={LIQUID_SIGIL_START_VALUES.fit}
          image={maskImageSrc}
          maxPixelCount={Math.max(Math.ceil(clampedSize * clampedSize * 2.25), LIQUID_SIGIL_START_VALUES.maskResolution * LIQUID_SIGIL_START_VALUES.maskResolution)}
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
