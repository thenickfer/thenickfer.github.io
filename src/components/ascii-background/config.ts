import type { Piece } from 'ascii.rest'

import * as aurora from 'ascii.rest/pieces/aurora'
import * as contourMap from 'ascii.rest/pieces/contour-map'
import * as galaxy from 'ascii.rest/pieces/galaxy'
import * as lorenz from 'ascii.rest/pieces/lorenz'
import * as plasma from 'ascii.rest/pieces/plasma'

import {
  edgeOrbit,
  briansBrain,
  solarCorona,
  starryRidge,
} from './pieces/custom'
import { asciiTokens } from './tokens'

export type AsciiPieceId =
  | 'starry-ridge'
  | 'thermal-plasma'
  | 'aurora-drift'
  | 'deep-ocean'
  | 'nebula-clouds'
  | 'topographic-flow'
  | 'solar-corona'
  | 'brians-brain'
  | 'lorenz-butterfly'
  | 'edge-orbit'

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
  'deep-ocean': configured(
    'deep ocean',
    'Deep ocean',
    'slow currents and dim drifting particles',
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
  'topographic-flow': configured(
    'topographic flow',
    'Topographic flow',
    'animated contour lines on a quiet surface',
    contourMap,
    [asciiTokens.surface, asciiTokens.cobalt, asciiTokens.cobaltLight],
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
  'edge-orbit': {
    label: 'Edge orbit',
    description: 'quiet curved particle paths around the viewport edges',
    piece: edgeOrbit,
    palette: edgeOrbit.meta.palette ?? [],
  },
}

export const ASCII_PIECE_IDS = Object.keys(ASCII_PIECES) as AsciiPieceId[]
