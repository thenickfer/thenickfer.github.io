import { useEffect, useState } from 'react'

import { AsciiBackground } from '../components/ascii-background/AsciiBackground'
import { ASCII_PIECE_IDS, ASCII_PIECES, type AsciiPieceId } from '../components/ascii-background/config'
import '../styles/ascii-background.css'

export function AsciiBackgroundDemo() {
  const [selected, setSelected] = useState<AsciiPieceId>('starry-ridge')
  const [cycling, setCycling] = useState(true)

  useEffect(() => {
    if (!cycling) return
    const timer = window.setInterval(() => {
      setSelected((current) => {
        const index = ASCII_PIECE_IDS.indexOf(current)
        const next = ASCII_PIECE_IDS[(index + 1) % ASCII_PIECE_IDS.length]
        return next ?? current
      })
    }, 8000)
    return () => window.clearInterval(timer)
  }, [cycling])

  return (
    <main className="ascii-demo">
      <AsciiBackground piece={selected} />
      <section className="ascii-demo__plate">
        <p className="ascii-demo__eyebrow">ASCII background collection</p>
        <h1>{ASCII_PIECES[selected].label}</h1>
        <p>{ASCII_PIECES[selected].description}. Each piece is a full-viewport background with a quiet foreground plate.</p>
        <div className="ascii-demo__controls" aria-label="Background selector">
          {ASCII_PIECE_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={selected === id} onClick={() => { setSelected(id); setCycling(false) }}>
              {ASCII_PIECES[id].label}
            </button>
          ))}
        </div>
        <button className="ascii-demo__cycle" type="button" onClick={() => setCycling((value) => !value)}>
          {cycling ? 'Pause cycle' : 'Resume cycle'}
        </button>
      </section>
    </main>
  )
}

export default AsciiBackgroundDemo
