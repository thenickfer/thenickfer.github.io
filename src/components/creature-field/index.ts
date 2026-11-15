export { CreatureField } from './CreatureField.tsx'
export type { CanvasWithEngine, CreatureFieldProps } from './CreatureField.tsx'
export {
  BAYER_4X4,
  CreatureFieldEngine,
  FIXED_DT,
  MAX_CURSOR_TRAIL,
  MAX_RIPPLES,
  MAX_TOTAL_CELLS,
  MAX_WAKE_CHARS,
  applyScatterVelocity,
  computeAvoidanceForce,
  computeScatterImpulse,
  computeSpeciesCount,
  createSeededRng,
  easeInOutCubic,
  selectSpecies,
  shouldIgnorePointerTarget,
  snapCellSize,
} from './engine.ts'
export type { EngineMetrics, EngineOptions, ScatterImpulseResult, SelectSpeciesOptions } from './engine'
export { FlatQuadtree, FlatSpatialGrid, queryNaiveRadiusInto } from './spatial.ts'
export { buildTokenRamp, formatRgb, mixWithSurface, parseCssColor, readPaletteFromTokens } from './palette'
export type { CreatureFieldPalette, RgbColor, TokenRamp } from './palette'
export {
  ALL_SPECIES,
  SPECIES_BY_ID,
  SPECIES_LIST,
  getSpeciesDefinition,
  isValidSpeciesId,
} from './species'
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
} from './species'
export { useReducedMotion } from './useReducedMotion'
