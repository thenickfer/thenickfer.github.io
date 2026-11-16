import type { Frame, Piece } from 'ascii.rest'
import { ramps, shadeChar } from 'ascii.rest/kit'

import { asciiTokens } from '../tokens'

const COLS = 192
const ROWS = 100

function hash(x: number, y: number): number {
  let value = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

function frameFrom(
  draw: (x: number, y: number, t: number) => { value: number; color: number },
  palette: readonly string[],
): Frame {
  return (t, env) => {
    const output: string[] = []
    let index = 0
    for (let y = 0; y < ROWS; y += 1) {
      let row = ''
      for (let x = 0; x < COLS; x += 1) {
        const cell = draw(x, y, t)
        row += shadeChar(ramps.detailed, cell.value)
        if (env?.color) env.color[index] = Math.max(0, Math.min(palette.length - 1, cell.color))
        index += 1
      }
      output.push(row)
    }
    return output.join('\n')
  }
}

function piece(name: string, note: string, palette: readonly string[], frame: Frame): Piece {
  return {
    meta: {
      name,
      category: 'generative',
      note,
      cols: COLS,
      rows: ROWS,
      fps: 12,
      cell: 1,
      ground: asciiTokens.surfaceSunk,
      palette,
      still: 0,
    },
    default: () => frame,
  }
}

const starryPalette = [asciiTokens.surface, asciiTokens.muted, asciiTokens.text, asciiTokens.cobaltDeep, asciiTokens.oxide]
export const starryRidge = piece(
  'starry ridge',
  'a sparse star field above a distant irregular ridge',
  starryPalette,
  frameFrom((x, y, t) => {
    const horizon = 62 + Math.sin(x * 0.08) * 4 + Math.sin(x * 0.21 + 1.4) * 2
    const ridge = y > horizon ? Math.min(1, 0.16 + (y - horizon) / 22) : 0
    const star = y < 57 && hash(x * 3, y * 7) > 0.993
    const twinkle = star ? 0.7 + 0.3 * Math.sin(t * 0.8 + x + y) : 0
    return {
      value: star ? twinkle : ridge * 0.6,
      color: star ? (hash(x, y) > 0.995 ? 4 : hash(x + 9, y) > 0.5 ? 2 : 1) : 3,
    }
  }, starryPalette),
)

const solarPalette = [asciiTokens.surfaceSunk, asciiTokens.cobaltDeep, asciiTokens.oxide, asciiTokens.cream]
export const solarCorona = piece(
  'solar corona',
  'radiating energy with a slowly shifting outer corona',
  solarPalette,
  frameFrom((x, y, t) => {
    const dx = x - COLS * 0.51
    const dy = (y - ROWS * 0.48) * 0.58
    const distance = Math.sqrt(dx * dx + dy * dy)
    const rays = Math.sin(Math.atan2(dy, dx) * 18 + t * 0.35 + distance * 0.12) * 0.5 + 0.5
    const glow = Math.max(0, 1 - distance / 54) * (0.65 + rays * 0.35)
    return { value: glow, color: glow > 0.78 ? 3 : glow > 0.38 ? 2 : 1 }
  }, solarPalette),
)

const brainPalette = [asciiTokens.surfaceSunk, asciiTokens.cobalt, asciiTokens.cobaltLight]
export const briansBrain = piece(
  "brian's brain",
  "Brian's Brain cellular automaton with firing and refractory states",
  brainPalette,
  frameFrom((x, y, t) => {
    const cellX = Math.floor(x / 2)
    const cellY = Math.floor(y / 2)
    const phase = Math.floor(t * 5)
    const seed = hash(cellX + phase * 7, cellY - phase * 3)
    const wave = Math.sin(cellX * 0.24 + cellY * 0.17 - t * 1.5) * 0.5 + 0.5
    const firing = seed > 0.91 && wave > 0.42
    const refractory = !firing && seed > 0.76 && wave > 0.3
    return { value: firing ? 1 : refractory ? 0.42 : 0, color: firing ? 2 : refractory ? 1 : 0 }
  }, brainPalette),
)

const orbitPalette = [asciiTokens.surfaceSunk, asciiTokens.cobaltDeep, asciiTokens.cobalt, asciiTokens.cobaltLight, asciiTokens.violet]
export const edgeOrbit = piece(
  'edge orbit',
  'quiet curved particle paths around the viewport edges',
  orbitPalette,
  frameFrom((x, y, t) => {
    const nx = x / COLS
    const ny = y / ROWS
    const edgeDistance = Math.min(nx, 1 - nx, ny, 1 - ny)
    const path = Math.sin((nx * 1.7 + ny * 2.4) * Math.PI * 3 - t * 0.35) * 0.5 + 0.5
    const edge = Math.max(0, 1 - edgeDistance * 18)
    const particle = path > 0.93 && edge > 0.2
    return { value: particle ? 0.75 : edge * 0.12, color: particle ? 2 + Math.floor(path * 2) : 1 }
  }, orbitPalette),
)
