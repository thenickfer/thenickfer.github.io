import { ReactLenis } from 'lenis/react'
import type { ReactNode } from 'react'

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reducedMotion) return children

  return (
    <ReactLenis root options={{ lerp: 0.1, autoRaf: true, anchors: true }}>
      {children}
    </ReactLenis>
  )
}
