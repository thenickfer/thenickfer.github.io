import { useEffect, useRef, useState } from 'react'

import { PixelLoader } from './PixelLoader'

type OrganizationLogoProps = {
  src?: string
  alt: string
  size?: 'small' | 'large'
}

export function OrganizationLogo({ src, alt, size = 'small' }: OrganizationLogoProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!src) return
    const img = imgRef.current
    if (!img || !img.complete) return
    const id = window.requestAnimationFrame(() => {
      setLoadedSrc(src)
    })
    return () => window.cancelAnimationFrame(id)
  }, [src])

  if (!src) return null

  const loaded = loadedSrc === src

  return (
    <div className={`logo-frame logo-frame-${size} relative`} aria-busy={!loaded}>
      <PixelLoader
        variant="inline"
        size="sm"
        label={`Loading ${alt} logo`}
        delayMs={120}
        active={!loaded}
      />
      <img
        ref={imgRef}
        src={src}
        alt={`${alt} logo`}
        onLoad={() => setLoadedSrc(src)}
        onError={() => setLoadedSrc(src)}
      />
    </div>
  )
}
