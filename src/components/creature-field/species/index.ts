import { butterflySpecies } from './butterfly.ts'
import { dragonflySpecies } from './dragonfly.ts'
import { fishSchoolSpecies } from './fish-school.ts'
import { jellyfishSpecies } from './jellyfish.ts'
import { koiSpecies } from './koi.ts'
import { mantaSpecies } from './manta.ts'
import type { SpeciesDefinition, SpeciesId } from './types.ts'

export const SPECIES_LIST: readonly SpeciesDefinition[] = [
  koiSpecies,
  butterflySpecies,
  jellyfishSpecies,
  dragonflySpecies,
  mantaSpecies,
  fishSchoolSpecies,
]

export const ALL_SPECIES: readonly SpeciesId[] = SPECIES_LIST.map((s) => s.id)

export const SPECIES_BY_ID: Readonly<Record<SpeciesId, SpeciesDefinition>> = Object.fromEntries(
  SPECIES_LIST.map((s) => [s.id, s]),
) as Record<SpeciesId, SpeciesDefinition>

export function isValidSpeciesId(value: string | null | undefined): value is SpeciesId {
  return Boolean(value && Object.prototype.hasOwnProperty.call(SPECIES_BY_ID, value))
}

export function getSpeciesDefinition(id: SpeciesId): SpeciesDefinition {
  return SPECIES_BY_ID[id] ?? koiSpecies
}

export type {
  AvoidRect,
  Creature,
  FoodPellet,
  NeighborQueryResult,
  PlotCellFn,
  RippleEffect,
  SimulationEnv,
  SpeciesDefinition,
  SpeciesId,
  WakeChar,
  WakeGlyph,
} from './types.ts'
