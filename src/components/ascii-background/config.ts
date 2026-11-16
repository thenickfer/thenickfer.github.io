import type { Piece } from 'ascii.rest'

import * as aurora from 'ascii.rest/pieces/aurora'
import * as galaxy from 'ascii.rest/pieces/galaxy'
import * as lorenz from 'ascii.rest/pieces/lorenz'
import * as plasma from 'ascii.rest/pieces/plasma'
import * as oceanSunset from  'ascii.rest/pieces/ocean-sunset'
import * as desertNight from  'ascii.rest/pieces/desert-night'
import * as auroraFjord from  'ascii.rest/pieces/aurora-fjord'
import * as alpineDawn from 'ascii.rest/pieces/alpine-dawn'
import * as kyotoDusk from 'ascii.rest/pieces/kyoto-dusk'
import {
  briansBrain,
  solarCorona,
  starryRidge,
} from './pieces/custom'
import { asciiTokens } from './tokens'


export type AsciiPieceId =
  | 'starry-ridge'
  | 'thermal-plasma'
  | 'aurora-drift'
  | 'galaxy'
  | 'nebula-clouds'
  | 'solar-corona'
  | 'brians-brain'
  | 'lorenz-butterfly'
  | 'aurora-fjord'
  | 'ocean-sunset'
  | 'desert-night'
  | 'alpine-dawn'
  | 'kyoto-dusk'

export interface AsciiPieceConfig {
  label: string
  description: string
  piece: Piece
  options?: Record<string, unknown>
  palette: readonly string[]
}

const cold = [
  asciiTokens.surfaceSunk,
  asciiTokens.cobaltDeep,
  asciiTokens.violet,
  asciiTokens.cobalt,
  asciiTokens.cobaltLight,
]
const thermal = [
  asciiTokens.surfaceSunk,
  asciiTokens.cobaltDeep,
  asciiTokens.cobalt,
  asciiTokens.violet,
  asciiTokens.oxide,
  asciiTokens.cream,
]

function configured(
  name: string,
  label: string,
  description: string,
  source: Piece,
  palette: readonly string[],
  options?: Record<string, unknown>,
): AsciiPieceConfig {
  const sourceCols = source.meta.cols
  const sourceRows = source.meta.rows
  const cols = sourceCols * 2
  const rows = sourceRows * 2
  const piece: Piece = {
    meta: {
      ...source.meta,
      name,
      note: description,
      cols,
      rows,
      fps: Math.min(source.meta.fps, 12),
      ground: asciiTokens.surfaceSunk,
      palette,
      options,
    },
    default: (overrides?: Record<string, unknown>) => {
      const frame = source.default(overrides)
      return (t, env) => {
        const sourceText = frame(t)
        const sourceRowsText = sourceText.split('\n')
        const output: string[] = []
        if (env?.color) {
          env.color.fill(0)
        }
        for (let sourceY = 0; sourceY < sourceRows; sourceY += 1) {
          const sourceRow = sourceRowsText[sourceY] ?? ''
          const expandedRow = Array.from({ length: cols }, (_, x) => sourceRow[Math.floor(x / 2)] ?? ' ').join('')
          output.push(expandedRow, expandedRow)
          if (env?.color) {
            for (let sourceX = 0; sourceX < sourceCols; sourceX += 1) {
              const rampIndex = ' .:-=+*#%@'.indexOf(sourceRow[sourceX] ?? ' ')
              const color = Math.max(0, Math.min(palette.length - 1, Math.round((Math.max(0, rampIndex) / 9) * (palette.length - 1))))
              const index = sourceY * 2 * cols + sourceX * 2
              env.color[index] = color
              env.color[index + 1] = color
              env.color[index + cols] = color
              env.color[index + cols + 1] = color
            }
          }
        }
        return output.join('\n')
      }
    },
  }

  return { label, description, piece, options, palette }
}

export const ASCII_PIECES: Record<AsciiPieceId, AsciiPieceConfig> = {
  'starry-ridge': {
    label: 'Starry ridge',
    description: 'a sparse star field above a distant irregular ridge',
    piece: starryRidge,
    palette: starryRidge.meta.palette ?? [],
  },
  'thermal-plasma': configured(
    'thermal plasma',
    'Thermal plasma',
    'soft overlapping thermal plasma blobs',
    plasma,
    thermal,
    { fps: 12 },
  ),
  'aurora-drift': configured(
    'aurora drift',
    'Aurora drift',
    'flowing curtains of light over a dark sky',
    aurora,
    [asciiTokens.surfaceSunk, asciiTokens.cobaltDeep, asciiTokens.cobalt, asciiTokens.cobaltLight, asciiTokens.violet],
    { fps: 12 },
  ),
  'galaxy': configured(
    'galaxy',
    'Galaxy',
    'dim drifting particles',
    galaxy,
    cold,
    { fps: 10 },
  ),
  'nebula-clouds': configured(
    'nebula clouds',
    'Nebula clouds',
    'slowly evolving dust and energy clouds',
    galaxy,
    [asciiTokens.surfaceSunk, asciiTokens.cobaltDeep, asciiTokens.violet, asciiTokens.cobaltLight],
    { fps: 10 },
  ),
  'solar-corona': {
    label: 'Solar corona',
    description: 'radiating energy with a slowly shifting outer corona',
    piece: solarCorona,
    palette: solarCorona.meta.palette ?? [],
  },
  'brians-brain': {
    label: "Brian's Brain",
    description: "Brian's Brain cellular automaton with firing and refractory states",
    piece: briansBrain,
    palette: briansBrain.meta.palette ?? [],
  },
  'lorenz-butterfly': configured(
    'lorenz butterfly',
    'Lorenz butterfly',
    'a continuous fading trail through the Lorenz attractor',
    lorenz,
    [asciiTokens.cobaltDeep, asciiTokens.cobalt, asciiTokens.cobaltLight, asciiTokens.violet],
    { fps: 12 },
  ),
  'ocean-sunset': {
    label: 'Ocean Sunset',
    description: 'the sun sets past a pine headland, lit cloud, glitter on rolling sea',
    piece: oceanSunset,
    palette: [],
  },
  'desert-night': {
    label: 'Desert Night',
    description: 'the milky way over a lone acacia on moonless dunes, meteors falling',
    piece: desertNight,
    palette: [],
  },
  'aurora-fjord': {
    label: 'Aurora Fjord',
    description: 'aurora curtains rippling over a still fjord, a cabin lit on the shore',
    piece: auroraFjord,
    palette: [],
  },
  'alpine-dawn': {
    label: 'Alpine Dawn',
    description: 'snow peaks catching first light above a still, misty mountain lake',
    piece: alpineDawn,
    palette: [],
  },
  'kyoto-dusk': {
    label: 'Kyoto Dusk',
    description: 'a pagoda at dusk behind a cherry tree lit by a stone lantern',
    piece: kyotoDusk,
    palette: [],
  },
}

export const ASCII_PIECE_IDS = Object.keys(ASCII_PIECES) as AsciiPieceId[]
export const ASCII_SCENERY_IDS = [ 'ocean-sunset', 'desert-night','aurora-fjord', 'alpine-dawn', 'kyoto-dusk' ] as AsciiPieceId[]