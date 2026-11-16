import { Ascii } from 'ascii.rest/react'
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

import { ASCII_PIECES, type AsciiPieceId } from './config'

interface AsciiBackgroundProps {
  piece: AsciiPieceId
  className?: string
  style?: CSSProperties
}

export function AsciiBackground({ piece, className, style }: AsciiBackgroundProps) {
  const config = ASCII_PIECES[piece]
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = rootRef.current?.querySelector('canvas')
    if (!canvas) return
    canvas.setAttribute('aria-hidden', 'true')
    canvas.tabIndex = -1
  }, [piece])

  return (
    <div ref={rootRef} className={`ascii-background ${className ?? ''}`} data-ascii-piece={piece} style={style}>
      <Ascii
        piece={config.piece}
        options={config.options}
        label={config.label}
        className="ascii-background__canvas"
      />
      <div className="ascii-background__grain" aria-hidden="true" />
    </div>
  )
}
