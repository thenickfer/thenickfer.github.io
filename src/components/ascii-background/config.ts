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
  const piece: Piece = {
    meta: {
      ...source.meta,
      name,
      note: description,
      fps: Math.min(source.meta.fps, 12),
      ground: asciiTokens.surfaceSunk,
      palette,
      options,
    },
    default: (overrides?: Record<string, unknown>) => {
      const frame = source.default(overrides)
      return (t, env) => {
        const text = frame(t)
        if (env?.color) {
          let cell = 0
          for (const character of text) {
            if (character === '\n') continue
            const rampIndex = ' .:-=+*#%@'.indexOf(character)
            env.color[cell] = Math.max(0, Math.min(palette.length - 1, Math.round((rampIndex / 9) * (palette.length - 1))))
            cell += 1
          }
        }
        return text
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
