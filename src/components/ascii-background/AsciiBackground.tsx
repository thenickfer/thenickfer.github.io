import { Ascii } from 'ascii.rest/react'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { ASCII_PIECE_IDS, ASCII_PIECES, type AsciiPieceId } from './config'

interface AsciiBackgroundProps {
  piece?: AsciiPieceId
  className?: string
  style?: CSSProperties
}

export function AsciiBackground({ piece, className, style }: AsciiBackgroundProps) {
  const [selectedPiece] = useState<AsciiPieceId>(() => {
    if (piece != null) return piece
    const randomIndex = Math.floor(Math.random() * ASCII_PIECE_IDS.length)
    return ASCII_PIECE_IDS[randomIndex]!
  })

  const activePiece = piece ?? selectedPiece
  const config = ASCII_PIECES[activePiece]
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = rootRef.current?.querySelector('canvas')
    if (!canvas) return
    canvas.setAttribute('aria-hidden', 'true')
    canvas.tabIndex = -1
  }, [piece])

  return (
    <div
      ref={rootRef}
      className={`ascii-background ${className ?? ''}`}
      data-ascii-piece={piece}
      aria-hidden="true"
      style={style}
    >
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
