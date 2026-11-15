import type { CreatureFieldPalette, TokenRamp } from '../palette.ts'

export type SpeciesId = 'koi' | 'butterfly' | 'jellyfish' | 'dragonfly' | 'manta' | 'fish-school'

export type WakeGlyph = '.' | ':' | '-' | '+'

export interface AvoidRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface FoodPellet {
  active: boolean
  x: number
  y: number
  age: number
  maxAge: number
}

export interface WakeChar {
  active: boolean
  gx: number
  gy: number
  glyphIndex: number // 0: '.', 1: ':', 2: '-', 3: '+'
  age: number
  maxAge: number
}

export interface RippleEffect {
  active: boolean
  x: number
  y: number
  radius: number
  maxRadius: number
  age: number
  maxAge: number
  rampIndex: number
}

export interface Creature {
  id: number
  species: SpeciesId
  x: number
  y: number
  vx: number
  vy: number
  ax: number
  ay: number
  heading: number
  desiredHeading: number
  angularVel: number
  baseSpeed: number
  minSpeed: number
  maxSpeed: number
  collisionRadius: number
  phase: number
  phaseSpeed: number
  lengthCells: number
  widthCells: number
  seed: number
  schoolId: number
  // Scatter / fear timers
  fearTimer: number
  fearDuration: number
  recoveryTimer: number
  fearPeakSpeed: number
  // Species-specific timers/modes
  stateTimer: number
  stateMode: number
  auxTimer: number
  // Undulating spine or delayed tentacle trail coordinates in world px
  spineX: Float32Array
  spineY: Float32Array
}

export interface NeighborQueryResult {
  readonly indices: Int32Array
  readonly count: number
}

export interface SimulationEnv {
  width: number
  height: number
  cell: number
  scale: number
  time: number
  rng: () => number
  avoidRects: readonly AvoidRect[]
  foodPellets: FoodPellet[]
  emitWake: (x: number, y: number, glyph: WakeGlyph, maxAge?: number) => void
  computeAvoidance: (
    x: number,
    y: number,
    vx: number,
    vy: number,
    vmax: number,
    creatureRadiusPx?: number,
  ) => { ax: number; ay: number }
  queryNeighbors: (
    x: number,
    y: number,
    radius: number,
    excludeIndex?: number,
  ) => NeighborQueryResult
  computeCreatureAvoidance: (
    selfIndex: number,
    creatures: readonly Creature[],
    lookaheadSec?: number,
  ) => { ax: number; ay: number }
}

export type PlotCellFn = (
  gx: number,
  gy: number,
  rampIndex: number,
  shade: number,
  coverage: number,
  glyphHash: number,
) => void

export interface SpeciesDefinition {
  id: SpeciesId
  countRange: readonly [number, number]
  speedRange: readonly [number, number]
  defaultClickBehavior: 'scatter' | 'feed'
  getRamps: (palette: CreatureFieldPalette) => TokenRamp[]
  spawn: (
    count: number,
    width: number,
    height: number,
    cell: number,
    scale: number,
    avoidRects: readonly AvoidRect[],
    rng: () => number,
  ) => Creature[]
  update: (creatures: Creature[], dt: number, env: SimulationEnv) => void
  renderCreature: (
    creature: Creature,
    cell: number,
    scale: number,
    time: number,
    plotCell: PlotCellFn,
  ) => void
  onScatterCreature?: (creature: Creature, rng: () => number) => void
}

/**
 * Deterministic hash from creature ID and creature-local cell coordinates.
 * Guarantees each cell's ASCII glyph stays locked to the creature body without shimmering.
 */
export function hashCreatureLocalGlyph(
  creatureId: number,
  localX: number,
  localY: number,
): number {
  let h =
    (Math.imul(creatureId + 1, 374761393) +
      Math.imul(localX | 0, 668265263) +
      Math.imul(localY | 0, 2147483647)) |
    0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

export function normalizeAngle(angle: number): number {
  let a = angle % (Math.PI * 2)
  if (a > Math.PI) a -= Math.PI * 2
  if (a < -Math.PI) a += Math.PI * 2
  return a
}

export function lerpAngle(from: number, to: number, t: number): number {
  const diff = normalizeAngle(to - from)
  return normalizeAngle(from + diff * t)
}

export function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2
}

/**
 * Critically/smoothly damped angular steering with bounded turn rate and angular inertia.
 * Prevents instantaneous heading snaps when desiredHeading changes abruptly.
 */
export function steerAngleDamped(
  creature: Creature,
  targetHeading: number,
  maxTurnRate: number,
  responsiveness: number,
  dt: number,
): void {
  creature.desiredHeading = normalizeAngle(targetHeading)
  const err = normalizeAngle(creature.desiredHeading - creature.heading)
  const desiredOmega = Math.max(-maxTurnRate, Math.min(maxTurnRate, err * responsiveness))
  const alpha = 1 - Math.exp(-responsiveness * 2.1 * dt)
  creature.angularVel += (desiredOmega - creature.angularVel) * alpha
  if (creature.angularVel > maxTurnRate) creature.angularVel = maxTurnRate
  if (creature.angularVel < -maxTurnRate) creature.angularVel = -maxTurnRate
  creature.heading = normalizeAngle(creature.heading + creature.angularVel * dt)
}

/**
 * Applies a bounded steering force toward (desiredVx, desiredVy), updating
 * creature.ax, creature.ay, creature.vx, and creature.vy smoothly with inertia.
 */
export function applySteeringForce(
  creature: Creature,
  desiredVx: number,
  desiredVy: number,
  maxAccel: number,
  maxSpeed: number,
  gain: number,
  dt: number,
  extraAx = 0,
  extraAy = 0,
): void {
  let ax = (desiredVx - creature.vx) * gain + extraAx
  let ay = (desiredVy - creature.vy) * gain + extraAy
  const accelMag = Math.hypot(ax, ay)
  if (accelMag > maxAccel && accelMag > 0) {
    const scale = maxAccel / accelMag
    ax *= scale
    ay *= scale
  }

  // Smooth acceleration state for continuous inertia
  const damp = 1 - Math.exp(-10 * dt)
  creature.ax += (ax - creature.ax) * damp
  creature.ay += (ay - creature.ay) * damp

  creature.vx += creature.ax * dt
  creature.vy += creature.ay * dt

  const speed = Math.hypot(creature.vx, creature.vy)
  if (speed > maxSpeed && speed > 0) {
    creature.vx = (creature.vx / speed) * maxSpeed
    creature.vy = (creature.vy / speed) * maxSpeed
  }
}

/**
 * Effective orientation-aware visual bounding radius along a unit vector (ux, uy).
 * Accounts for elongated bodies (e.g. koi, dragonfly) vs wide bodies (manta, butterfly).
 */
export function getOrientedCreatureRadius(
  creature: Creature,
  ux: number,
  uy: number,
  cell: number,
  scale: number,
): number {
  const cosH = Math.cos(creature.heading)
  const sinH = Math.sin(creature.heading)
  const along = ux * cosH + uy * sinH
  const across = -ux * sinH + uy * cosH
  const halfLen = Math.max(2, creature.lengthCells * 0.48) * cell * scale
  const halfWid = Math.max(2, creature.widthCells * 0.48) * cell * scale
  return Math.sqrt(along * along * halfLen * halfLen + across * across * halfWid * halfWid)
}

/**
 * Soft, anticipatory inter-creature avoidance force using neighbor indices from the spatial index.
 * Steers creatures around one another (repulsion + tangential bypass) without hard collision snaps.
 */
export function computeInterCreatureAvoidance(
  selfIndex: number,
  creatures: readonly Creature[],
  neighborIndices: Int32Array,
  neighborCount: number,
  cell: number,
  scale: number,
  lookaheadSec = 0.4,
): { ax: number; ay: number } {
  const self = creatures[selfIndex]
  if (!self || neighborCount === 0) return { ax: 0, ay: 0 }

  let totalAx = 0
  let totalAy = 0

  // Allow temporary overlap during early scatter burst, then smoothly restore full separation
  const scatterSuppression =
    self.fearTimer > 0.35
      ? 0.35
      : self.fearTimer > 0
        ? 0.35 + 0.65 * (1 - self.fearTimer / 0.35)
        : 1.0

  const selfFutureX = self.x + self.vx * lookaheadSec
  const selfFutureY = self.y + self.vy * lookaheadSec
  const padPx = cell * 1.6 * scale

  for (let k = 0; k < neighborCount; k++) {
    const otherIdx = neighborIndices[k]!
    if (otherIdx === selfIndex) continue
    const other = creatures[otherIdx]
    if (!other) continue

    const curDx = self.x - other.x
    const curDy = self.y - other.y
    const curDist = Math.hypot(curDx, curDy)

    const futDx = selfFutureX - (other.x + other.vx * lookaheadSec)
    const futDy = selfFutureY - (other.y + other.vy * lookaheadSec)
    const futDist = Math.hypot(futDx, futDy)

    // Use the tighter of current or anticipated separation
    const useFuture = futDist < curDist
    const dx = useFuture ? futDx : curDx
    const dy = useFuture ? futDy : curDy
    const dist = Math.min(curDist, futDist)

    let ux: number
    let uy: number
    if (dist > 1e-3) {
      ux = dx / dist
      uy = dy / dist
    } else {
      const fallbackAngle = ((self.id * 1.618 + other.id * 2.718) % 1) * Math.PI * 2
      ux = Math.cos(fallbackAngle)
      uy = Math.sin(fallbackAngle)
    }

    const rSelf = getOrientedCreatureRadius(self, ux, uy, cell, scale)
    const rOther = getOrientedCreatureRadius(other, ux, uy, cell, scale)
    const comfortRadius = rSelf + rOther + padPx

    if (dist < comfortRadius) {
      const t = 1 - dist / comfortRadius
      const falloff = t * t * (1.35 + 1.15 * t)
      const strength = self.maxSpeed * 5.4 * falloff * scatterSuppression

      // Radial soft push away from neighbor
      totalAx += ux * strength
      totalAy += uy * strength

      // Tangential steering so creatures curve gracefully around each other
      const tx = -uy
      const ty = ux
      const relVx = self.vx - other.vx
      const relVy = self.vy - other.vy
      const dot = relVx * tx + relVy * ty
      const sign = dot >= 0 ? 1 : -1
      totalAx += tx * sign * strength * 0.58
      totalAy += ty * sign * strength * 0.58
    }
  }

  return { ax: totalAx, ay: totalAy }
}

export function valueNoise2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)

  const hash = (ix: number, iy: number): number => {
    let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295
  }

  const n00 = hash(xi, yi)
  const n10 = hash(xi + 1, yi)
  const n01 = hash(xi, yi + 1)
  const n11 = hash(xi + 1, yi + 1)

  const nx0 = n00 + (n10 - n00) * u
  const nx1 = n01 + (n11 - n01) * u
  return (nx0 + (nx1 - nx0) * v) * 2 - 1
}

export function pickSafeSpawnPosition(
  width: number,
  height: number,
  cell: number,
  avoidRects: readonly AvoidRect[],
  rng: () => number,
  clearanceCells = 10,
  existingCreatures?: readonly Creature[],
): { x: number; y: number } {
  const pad = Math.max(cell * 3, 24)
  const avoidPad = Math.max(cell * clearanceCells, 64)
  const safeW = Math.max(1, width - pad * 2)
  const safeH = Math.max(1, height - pad * 2)
  const minCreatureSep = cell * clearanceCells * 0.85

  for (let attempt = 0; attempt < 55; attempt++) {
    const x = pad + rng() * safeW
    const y = pad + rng() * safeH
    let insideAvoid = false
    for (let i = 0; i < avoidRects.length; i++) {
      const r = avoidRects[i]!
      if (
        x >= r.left - avoidPad &&
        x <= r.right + avoidPad &&
        y >= r.top - avoidPad &&
        y <= r.bottom + avoidPad
      ) {
        insideAvoid = true
        break
      }
    }
    if (insideAvoid) continue

    if (existingCreatures && existingCreatures.length > 0 && attempt < 42) {
      const relax = attempt > 25 ? 0.65 : 1.0
      let tooClose = false
      for (let j = 0; j < existingCreatures.length; j++) {
        const other = existingCreatures[j]!
        const reqSep = (other.collisionRadius + minCreatureSep * 0.5) * relax
        if (Math.hypot(x - other.x, y - other.y) < reqSep) {
          tooClose = true
          break
        }
      }
      if (tooClose) continue
    }
    return { x, y }
  }

  return {
    x: pad + rng() * safeW,
    y: Math.min(height - pad, Math.max(pad * 3, height * 0.5 + (rng() - 0.5) * safeH * 0.6)),
  }
}

export function wrapOrBounceBounds(
  creature: Creature,
  width: number,
  height: number,
  margin: number,
  dt: number,
): void {
  const edgePad = Math.max(margin, 36)
  const turnBase = creature.baseSpeed * 4.4 * dt

  if (creature.x < edgePad) {
    const t = Math.min(1.5, 1 - creature.x / edgePad)
    creature.vx += turnBase * (0.65 + t * 1.1)
  } else if (creature.x > width - edgePad) {
    const t = Math.min(1.5, 1 - (width - creature.x) / edgePad)
    creature.vx -= turnBase * (0.65 + t * 1.1)
  }

  if (creature.y < edgePad) {
    const t = Math.min(1.5, 1 - creature.y / edgePad)
    creature.vy += turnBase * (0.65 + t * 1.1)
  } else if (creature.y > height - edgePad) {
    const t = Math.min(1.5, 1 - (height - creature.y) / edgePad)
    creature.vy -= turnBase * (0.65 + t * 1.1)
  }

  const hardMargin = margin * 1.6
  if (creature.x < -hardMargin) creature.x = width + hardMargin * 0.5
  if (creature.x > width + hardMargin) creature.x = -hardMargin * 0.5
  if (creature.y < -hardMargin) creature.y = height + hardMargin * 0.5
  if (creature.y > height + hardMargin) creature.y = -hardMargin * 0.5
}

export function applyFearAndRecoverySpeed(
  creature: Creature,
  desiredSpeed: number,
  dt: number,
): number {
  const scaleSpeed = creature.maxSpeed * 3
  if (creature.fearTimer > 0) {
    creature.fearTimer = Math.max(0, creature.fearTimer - dt)
    if (creature.fearTimer === 0) {
      creature.recoveryTimer = 0.75
      creature.fearPeakSpeed = Math.min(Math.hypot(creature.vx, creature.vy), scaleSpeed)
    }
    return Math.min(Math.max(Math.hypot(creature.vx, creature.vy), desiredSpeed), scaleSpeed)
  }

  if (creature.recoveryTimer > 0) {
    creature.recoveryTimer = Math.max(0, creature.recoveryTimer - dt)
    const progress = 1 - creature.recoveryTimer / 0.75
    const eased = easeInOutCubic(progress)
    return creature.fearPeakSpeed + (desiredSpeed - creature.fearPeakSpeed) * eased
  }

  return desiredSpeed
}
