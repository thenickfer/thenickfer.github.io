import type { CreatureFieldPalette, TokenRamp } from './palette.ts'
import { FlatQuadtree } from './spatial.ts'
import {
  ALL_SPECIES,
  getSpeciesDefinition,
  isValidSpeciesId,
  type AvoidRect,
  type Creature,
  type FoodPellet,
  type RippleEffect,
  type SpeciesDefinition,
  type SpeciesId,
  type WakeChar,
  type WakeGlyph,
} from './species/index.ts'
import { computeInterCreatureAvoidance, easeInOutCubic } from './species/types.ts'

export const FIXED_DT = 1 / 60
export const MAX_WAKE_CHARS = 300
export const MAX_CURSOR_TRAIL = 72
export const MAX_RIPPLES = 12
export const MAX_TOTAL_CELLS = 19_500
const MAX_FOOD_PELLETS = 32
const WAKE_GLYPHS: readonly WakeGlyph[] = ['.', ':', '-', '+']
const WAKE_ALPHA_STEPS = 4

/**
 * ASCII glyphs for the 3 brightness levels of creature cells:
 * - Level 0 (dim, ~45% tint): ': . , \''
 * - Level 1 (middle, 100% palette color, no tile): '* + = x o'
 * - Level 2 (brightest, solid palette tile + dark surface glyph): '# @ % &'
 */
export const DIM_CELL_GLYPHS = [':', '.', ',', "'"] as const
export const MID_CELL_GLYPHS = ['*', '+', '=', 'x', 'o'] as const
export const BRIGHT_CELL_GLYPHS = ['#', '@', '%', '&'] as const
const ATLAS_COLS =
  DIM_CELL_GLYPHS.length + MID_CELL_GLYPHS.length + BRIGHT_CELL_GLYPHS.length // 13 columns
const MAX_ATLAS_BUCKETS = 4 * ATLAS_COLS // 52 buckets
const MAX_CELLS_PER_BUCKET = 2048

const IGNORED_INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, label, [role="button"], [data-creature-ignore]'

export function shouldIgnorePointerTarget(target: EventTarget | null): boolean {
  if (!target || typeof Element === 'undefined' || !(target instanceof Element)) {
    return false
  }
  return Boolean(target.closest(IGNORED_INTERACTIVE_SELECTOR))
}

/**
 * 4x4 ordered Bayer threshold matrix normalized to (0, 1)
 */
export const BAYER_4X4: readonly number[] = [
  0.5 / 16,
  8.5 / 16,
  2.5 / 16,
  10.5 / 16,
  12.5 / 16,
  4.5 / 16,
  14.5 / 16,
  6.5 / 16,
  3.5 / 16,
  11.5 / 16,
  1.5 / 16,
  9.5 / 16,
  15.5 / 16,
  7.5 / 16,
  13.5 / 16,
  5.5 / 16,
]

export function createSeededRng(seed = Date.now()): () => number {
  let state = (seed >>> 0) || 0x6d2b79f5
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function snapCellSize(cell = 8): number {
  if (!Number.isFinite(cell) || cell <= 4) return 4
  return Math.max(4, Math.round(cell / 4) * 4)
}

export function clampScale(scale = 1): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1
  return Math.max(0.5, Math.min(3, scale))
}

/**
 * Count formula: count = clamp(round(base * viewportArea / 1_300_000), min, max)
 * where base is the midpoint of [min, max].
 */
export function computeSpeciesCount(
  min: number,
  max: number,
  viewportWidth: number,
  viewportHeight: number,
  overrideCount?: number,
): number {
  if (overrideCount !== undefined && Number.isFinite(overrideCount)) {
    return Math.max(0, Math.min(500, Math.round(overrideCount)))
  }
  const base = (min + max) * 0.5
  const viewportArea = Math.max(0, viewportWidth * viewportHeight)
  const scaled = Math.round((base * viewportArea) / 1_300_000)
  return Math.max(min, Math.min(max, scaled))
}

export interface SelectSpeciesOptions {
  species?: SpeciesId | 'random'
  pool?: readonly SpeciesId[]
  lastSpecies?: SpeciesId | null
  devQuerySpecies?: string | null
  isDev?: boolean
  rng?: () => number
}

export function selectSpecies(options: SelectSpeciesOptions = {}): SpeciesId {
  const {
    species = 'random',
    pool = ALL_SPECIES,
    lastSpecies = null,
    devQuerySpecies = null,
    isDev = false,
    rng = Math.random,
  } = options

  if (species && species !== 'random' && isValidSpeciesId(species)) {
    return species
  }

  if (isDev && devQuerySpecies && isValidSpeciesId(devQuerySpecies)) {
    return devQuerySpecies
  }

  const validPool = pool.filter((item) => isValidSpeciesId(item))
  const effectivePool = validPool.length > 0 ? validPool : ALL_SPECIES
  const candidates =
    effectivePool.length > 1 && lastSpecies
      ? effectivePool.filter((item) => item !== lastSpecies)
      : effectivePool
  const finalList = candidates.length > 0 ? candidates : effectivePool
  const index = Math.min(finalList.length - 1, Math.max(0, Math.floor(rng() * finalList.length)))
  return finalList[index]!
}

export interface ScatterImpulseResult {
  triggered: boolean
  distance: number
  radius: number
  falloff: number
  impulseMag: number
  impulseX: number
  impulseY: number
  fearDuration: number
}

/**
 * Scatter math: every creature within R = 0.45 * viewportDiagonal gets a fear timer
 * of 1.2 to 2 s and an impulse away from p of vmax * 2.5 * (1 - d / R)^2.
 */
export function computeScatterImpulse(
  creatureX: number,
  creatureY: number,
  clickX: number,
  clickY: number,
  viewportWidth: number,
  viewportHeight: number,
  vmax: number,
  rng: () => number = Math.random,
): ScatterImpulseResult {
  const diagonal = Math.hypot(viewportWidth, viewportHeight)
  const radius = 0.45 * diagonal
  const dx = creatureX - clickX
  const dy = creatureY - clickY
  const distance = Math.hypot(dx, dy)

  if (radius <= 0 || distance >= radius) {
    return {
      triggered: false,
      distance,
      radius,
      falloff: 0,
      impulseMag: 0,
      impulseX: 0,
      impulseY: 0,
      fearDuration: 0,
    }
  }

  const normalized = 1 - distance / radius
  const falloff = normalized * normalized
  const impulseMag = vmax * 2.5 * falloff
  let ux: number
  let uy: number
  if (distance > 1e-4) {
    ux = dx / distance
    uy = dy / distance
  } else {
    const angle = rng() * Math.PI * 2
    ux = Math.cos(angle)
    uy = Math.sin(angle)
  }

  return {
    triggered: true,
    distance,
    radius,
    falloff,
    impulseMag,
    impulseX: ux * impulseMag,
    impulseY: uy * impulseMag,
    fearDuration: 1.2 + rng() * 0.8,
  }
}

export function applyScatterVelocity(
  vx: number,
  vy: number,
  impulseX: number,
  impulseY: number,
  vmax: number,
): { vx: number; vy: number; speed: number } {
  let nextVx = vx + impulseX
  let nextVy = vy + impulseY
  const cap = vmax * 3
  let speed = Math.hypot(nextVx, nextVy)
  if (speed > cap && speed > 0) {
    nextVx = (nextVx / speed) * cap
    nextVy = (nextVy / speed) * cap
    speed = cap
  }
  return { vx: nextVx, vy: nextVy, speed }
}

/**
 * Soft repulsion field around avoid rectangles so creatures steer smoothly
 * around plates or forms without crossing their interiors.
 */
export function computeAvoidanceForce(
  x: number,
  y: number,
  vx: number,
  vy: number,
  avoidRects: readonly AvoidRect[],
  cell: number,
  vmax: number,
): { ax: number; ay: number } {
  let totalAx = 0
  let totalAy = 0
  const margin = Math.max(cell * 8, 64)

  for (let i = 0; i < avoidRects.length; i++) {
    const rect = avoidRects[i]!
    const cx = (rect.left + rect.right) * 0.5
    const cy = (rect.top + rect.bottom) * 0.5
    const nearestX = Math.max(rect.left, Math.min(rect.right, x))
    const nearestY = Math.max(rect.top, Math.min(rect.bottom, y))
    const dx = x - nearestX
    const dy = y - nearestY
    const dist = Math.hypot(dx, dy)

    if (dist === 0) {
      // Inside the rectangle: push strongly outward toward the nearest edge
      const distLeft = Math.abs(x - rect.left)
      const distRight = Math.abs(rect.right - x)
      const distTop = Math.abs(y - rect.top)
      const distBottom = Math.abs(rect.bottom - y)
      const minEdge = Math.min(distLeft, distRight, distTop, distBottom)
      const force = vmax * 14
      if (minEdge === distLeft) totalAx -= force
      else if (minEdge === distRight) totalAx += force
      else if (minEdge === distTop) totalAy -= force
      else totalAy += force
    } else if (dist < margin) {
      const t = 1 - dist / margin
      const falloff = t * t
      const nx = dx / dist
      const ny = dy / dist
      // Normal repulsion away from the rectangle
      let ax = nx * vmax * 7.5 * falloff
      let ay = ny * vmax * 7.5 * falloff

      // Tangential steering so creatures glide around corners smoothly
      const tx = -ny
      const ty = nx
      const dot = vx * tx + vy * ty
      const tangentSign = dot >= 0 ? 1 : -1
      ax += tx * tangentSign * vmax * 3.0 * falloff
      ay += ty * tangentSign * vmax * 3.0 * falloff

      // Extra push away from rectangle center
      const fromCenterX = x - cx
      const fromCenterY = y - cy
      const fromCenterDist = Math.hypot(fromCenterX, fromCenterY) || 1
      ax += (fromCenterX / fromCenterDist) * vmax * 1.4 * falloff
      ay += (fromCenterY / fromCenterDist) * vmax * 1.4 * falloff

      totalAx += ax
      totalAy += ay
    }
  }

  return { ax: totalAx, ay: totalAy }
}

export interface EngineOptions {
  species: SpeciesId
  palette: CreatureFieldPalette
  width: number
  height: number
  dpr?: number
  cell?: number
  scale?: number
  count?: number
  seed?: number
  clickMode?: 'auto' | 'scatter'
  grid?: boolean
  avoidRects?: AvoidRect[]
}

export interface EngineMetrics {
  species: SpeciesId
  creatureCount: number
  activeCellCount: number
  activeWakeCount: number
  activeFoodCount: number
  activeRippleCount: number
  activeTrailCount: number
  neighborQueryCount: number
  quadtreeNodeCount: number
  avgSpatialMs: number
  frameCount: number
  fps: number
  avgFrameMs: number
  p95FrameMs: number
  maxFrameMs: number
}

export class CreatureFieldEngine {
  public readonly speciesDef: SpeciesDefinition
  public readonly quadtree = new FlatQuadtree()
  public palette: CreatureFieldPalette
  public width: number
  public height: number
  public dpr: number
  public cell: number
  public scale: number
  public clickMode: 'auto' | 'scatter'
  public grid: boolean
  public avoidRects: AvoidRect[]
  public creatures: Creature[] = []
  public readonly foodPellets: FoodPellet[] = []
  public readonly wakeChars: WakeChar[] = []
  public readonly cursorTrail: WakeChar[] = []
  public readonly ripples: RippleEffect[] = []

  private readonly rng: () => number
  private readonly overrideCount: number | undefined
  private simTime = 0
  private accumulator = 0
  private lastRafTime = -1
  private wakeCursor = 0
  private trailCursor = 0
  private rippleCursor = 0
  private lastTrailX = -9999
  private lastTrailY = -9999
  private frameId = 1
  private activeCellCount = 0
  private lastNeighborQueries = 0

  private speciesRamps: TokenRamp[] = []
  private atlasPatterns: (CanvasPattern | null)[] = []
  private readonly atlasBucketData: Int32Array[] = []
  private readonly atlasBucketCounts = new Int32Array(MAX_ATLAS_BUCKETS)
  private cellStamp = new Int32Array(0)
  private cols = 0
  private rows = 0

  // Dirty bounding-box tracking (4 ints per rect: x, y, w, h in cell units)
  private needsFullRedraw = true
  private readonly prevDirtyRects = new Int32Array(
    (512 + MAX_WAKE_CHARS + MAX_CURSOR_TRAIL + MAX_FOOD_PELLETS + MAX_RIPPLES * 4) * 4,
  )
  private prevDirtyCount = 0
  private gridPattern: CanvasPattern | null = null
  private wakeAtlas: HTMLCanvasElement | null = null
  public cellAtlas: HTMLCanvasElement | null = null

  // Frame and spatial time ring buffers for performance measurement
  private readonly frameSamples = new Float64Array(1024)
  private readonly spatialSamples = new Float64Array(1024)
  private readonly fpsIntervalSamples = new Float64Array(120)
  private readonly sortScratch = new Float64Array(1024)
  private frameSampleCount = 0
  private frameSampleCursor = 0
  private spatialSampleCount = 0
  private spatialSampleCursor = 0
  private fpsSampleCount = 0
  private fpsSampleCursor = 0

  constructor(options: EngineOptions) {
    this.speciesDef = getSpeciesDefinition(options.species)
    this.palette = options.palette
    this.width = Math.max(1, options.width)
    this.height = Math.max(1, options.height)
    this.dpr = options.dpr ?? 1
    this.cell = snapCellSize(options.cell ?? 8)
    this.scale = clampScale(options.scale ?? 1)
    this.clickMode = options.clickMode ?? 'auto'
    this.grid = options.grid ?? true
    this.avoidRects = options.avoidRects ? [...options.avoidRects] : []
    this.overrideCount = options.count
    this.rng = createSeededRng(options.seed ?? Date.now())

    for (let i = 0; i < MAX_FOOD_PELLETS; i++) {
      this.foodPellets.push({ active: false, x: 0, y: 0, age: 0, maxAge: 6.0 })
    }
    for (let i = 0; i < MAX_WAKE_CHARS; i++) {
      this.wakeChars.push({ active: false, gx: 0, gy: 0, glyphIndex: 0, age: 0, maxAge: 0.6 })
    }
    for (let i = 0; i < MAX_CURSOR_TRAIL; i++) {
      this.cursorTrail.push({ active: false, gx: 0, gy: 0, glyphIndex: 0, age: 0, maxAge: 0.55 })
    }
    for (let i = 0; i < MAX_RIPPLES; i++) {
      this.ripples.push({
        active: false,
        x: 0,
        y: 0,
        radius: 0,
        maxRadius: 112,
        age: 0,
        maxAge: 0.85,
        rampIndex: 0,
      })
    }
    for (let b = 0; b < MAX_ATLAS_BUCKETS; b++) {
      this.atlasBucketData.push(new Int32Array(MAX_CELLS_PER_BUCKET))
    }

    this.rebuildPaletteAndAtlases()
    this.updateGridDimensions()
    this.spawnInitialCreatures()
  }

  public rebuildPaletteAndAtlases(): void {
    this.speciesRamps = this.speciesDef.getRamps(this.palette)
    this.buildResources()
    this.needsFullRedraw = true
  }

  private buildResources(): void {
    if (typeof document === 'undefined') return

    const pxCell = Math.max(4, Math.round(this.cell * this.dpr))
    // Use Paper Mono at ~10 px for an 8 px cell, scaled proportionally with cell and DPR
    const fontPx = Math.max(8, Math.round(this.cell * 1.2 * this.dpr))

    // 1. Build cell-aligned square dot grid pattern
    const tile = document.createElement('canvas')
    tile.width = pxCell
    tile.height = pxCell
    const tCtx = tile.getContext('2d')
    if (tCtx) {
      tCtx.fillStyle = this.palette.surfaceCss
      tCtx.fillRect(0, 0, pxCell, pxCell)
      tCtx.fillStyle = this.palette.gridDotCss
      const dotSize = Math.max(1, Math.round(1.25 * this.dpr))
      tCtx.fillRect(0, 0, dotSize, dotSize)
      this.gridPattern = tCtx.createPattern(tile, 'repeat')
    }

    // 2. Build pre-rendered wake glyph atlas for ('.', ':', '-', '+') at 4 fade steps
    const wakeCanvas = document.createElement('canvas')
    wakeCanvas.width = pxCell * WAKE_GLYPHS.length
    wakeCanvas.height = pxCell * WAKE_ALPHA_STEPS
    const wCtx = wakeCanvas.getContext('2d')
    if (wCtx) {
      const baseRgb = this.speciesRamps[0]?.rgbTints[2] ?? this.palette.muted.rgbTints[2]
      wCtx.font = `500 ${Math.max(8, Math.round(this.cell * 1.1 * this.dpr))}px ${this.palette.monoFont}`
      wCtx.textAlign = 'center'
      wCtx.textBaseline = 'middle'

      for (let step = 0; step < WAKE_ALPHA_STEPS; step++) {
        const alpha = (1 - step / WAKE_ALPHA_STEPS) * 0.72
        wCtx.fillStyle = `rgb(${baseRgb.r} ${baseRgb.g} ${baseRgb.b} / ${alpha.toFixed(2)})`
        for (let g = 0; g < WAKE_GLYPHS.length; g++) {
          const cx = (g + 0.5) * pxCell
          const cy = (step + 0.5) * pxCell
          wCtx.fillText(WAKE_GLYPHS[g]!, cx, cy)
        }
      }
      this.wakeAtlas = wakeCanvas
    }

    // 3. Build pre-rendered ASCII creature cell atlas:
    //    One row per species ramp + 1 extra row for 'hot' food pellets.
    //    13 columns per row:
    //    - cols 0..3: Level 0 (dim, 45% tint) glyphs ': . , \''
    //    - cols 4..8: Level 1 (middle, 100% tint, no tile) glyphs '* + = x o'
    //    - cols 9..12: Level 2 (brightest, solid tile in 100% tint + surface glyph) '# @ % &'
    const allRamps: TokenRamp[] = [...this.speciesRamps, this.palette.hot]
    const cellCanvas = document.createElement('canvas')
    cellCanvas.width = pxCell * ATLAS_COLS
    cellCanvas.height = pxCell * allRamps.length
    const cCtx = cellCanvas.getContext('2d')
    if (cCtx) {
      cCtx.font = `600 ${fontPx}px ${this.palette.monoFont}`
      cCtx.textAlign = 'center'
      cCtx.textBaseline = 'middle'

      const gapPx = Math.max(1, Math.round(this.dpr * 0.75))
      const tileSize = Math.max(3, pxCell - gapPx)
      const tileInset = Math.floor((pxCell - tileSize) * 0.5)

      for (let r = 0; r < allRamps.length; r++) {
        const ramp = allRamps[r]!
        const rowY = r * pxCell
        const cy = rowY + pxCell * 0.53

        // Level 0 (Dim cells): small glyph at ~45% tint from ': . , \''
        cCtx.fillStyle = ramp.tints[2]
        for (let i = 0; i < DIM_CELL_GLYPHS.length; i++) {
          const col = i
          const cx = (col + 0.5) * pxCell
          cCtx.fillText(DIM_CELL_GLYPHS[i]!, cx, cy)
        }

        // Level 1 (Middle cells): no tile, glyph in full palette color from '* + = x o'
        cCtx.fillStyle = ramp.tints[0]
        for (let i = 0; i < MID_CELL_GLYPHS.length; i++) {
          const col = DIM_CELL_GLYPHS.length + i
          const cx = (col + 0.5) * pxCell
          cCtx.fillText(MID_CELL_GLYPHS[i]!, cx, cy)
        }

        // Level 2 (Brightest cells): solid tile in palette color + dark surface glyph from '# @ % &'
        const brightOffset = DIM_CELL_GLYPHS.length + MID_CELL_GLYPHS.length
        for (let i = 0; i < BRIGHT_CELL_GLYPHS.length; i++) {
          const col = brightOffset + i
          const cellX = col * pxCell
          cCtx.fillStyle = ramp.tints[0]
          cCtx.fillRect(cellX + tileInset, rowY + tileInset, tileSize, tileSize)
          cCtx.fillStyle = this.palette.surfaceCss
          cCtx.fillText(BRIGHT_CELL_GLYPHS[i]!, cellX + pxCell * 0.5, cy)
        }
      }
      this.cellAtlas = cellCanvas

      // Pre-slice each (ramp, col) entry into a repeating CanvasPattern so
      // grid-aligned cells can be batch-blitted in one path per glyph entry.
      this.atlasPatterns = []
      const spriteCanvas = document.createElement('canvas')
      spriteCanvas.width = pxCell
      spriteCanvas.height = pxCell
      const sCtx = spriteCanvas.getContext('2d')
      for (let r = 0; r < allRamps.length; r++) {
        for (let col = 0; col < ATLAS_COLS; col++) {
          if (sCtx) {
            sCtx.clearRect(0, 0, pxCell, pxCell)
            sCtx.drawImage(
              cellCanvas,
              col * pxCell,
              r * pxCell,
              pxCell,
              pxCell,
              0,
              0,
              pxCell,
              pxCell,
            )
            this.atlasPatterns.push(cCtx.createPattern(spriteCanvas, 'repeat'))
          } else {
            this.atlasPatterns.push(null)
          }
        }
      }
    }
  }

  private updateGridDimensions(): void {
    this.cols = Math.max(1, Math.ceil(this.width / this.cell))
    this.rows = Math.max(1, Math.ceil(this.height / this.cell))
    const totalGridCells = this.cols * this.rows
    if (this.cellStamp.length < totalGridCells) {
      this.cellStamp = new Int32Array(totalGridCells)
    }
    this.needsFullRedraw = true
  }

  private spawnInitialCreatures(): void {
    const [min, max] = this.speciesDef.countRange
    const count = computeSpeciesCount(min, max, this.width, this.height, this.overrideCount)
    this.creatures = this.speciesDef.spawn(
      count,
      this.width,
      this.height,
      this.cell,
      this.scale,
      this.avoidRects,
      this.rng,
    )
    this.quadtree.rebuild(this.creatures, this.width, this.height)
  }

  public setAvoidRects(rects: AvoidRect[]): void {
    this.avoidRects = rects
  }

  public setGrid(grid: boolean): void {
    if (this.grid !== grid) {
      this.grid = grid
      this.needsFullRedraw = true
    }
  }

  public setClickMode(clickMode: 'auto' | 'scatter'): void {
    this.clickMode = clickMode
  }

  public setScale(scale: number): void {
    const nextScale = clampScale(scale)
    if (Math.abs(this.scale - nextScale) > 0.01) {
      this.scale = nextScale
      this.spawnInitialCreatures()
      this.needsFullRedraw = true
    }
  }

  public resize(newWidth: number, newHeight: number, newDpr = this.dpr): void {
    const w = Math.max(1, newWidth)
    const h = Math.max(1, newHeight)
    const dprChanged = Math.abs(newDpr - this.dpr) > 0.01
    this.width = w
    this.height = h
    this.dpr = newDpr
    this.updateGridDimensions()
    if (dprChanged) {
      this.buildResources()
    }

    // Clamp creatures and spine chains into the new bounds
    const pad = Math.min(this.cell * 2, w * 0.1, h * 0.1)
    const maxX = Math.max(pad, w - pad)
    const maxY = Math.max(pad, h - pad)

    for (let i = 0; i < this.creatures.length; i++) {
      const c = this.creatures[i]!
      const oldX = c.x
      const oldY = c.y
      c.x = Math.max(pad, Math.min(maxX, c.x))
      c.y = Math.max(pad, Math.min(maxY, c.y))
      const shiftX = c.x - oldX
      const shiftY = c.y - oldY
      for (let s = 0; s < c.spineX.length; s++) {
        c.spineX[s] = Math.max(0, Math.min(w, c.spineX[s]! + shiftX))
        c.spineY[s] = Math.max(0, Math.min(h, c.spineY[s]! + shiftY))
      }
    }

    for (let f = 0; f < this.foodPellets.length; f++) {
      const p = this.foodPellets[f]!
      if (p.active) {
        p.x = Math.max(pad, Math.min(maxX, p.x))
        p.y = Math.max(pad, Math.min(maxY, p.y))
      }
    }
    this.quadtree.rebuild(this.creatures, this.width, this.height)
    this.needsFullRedraw = true
  }

  private isCellInsideAvoidRect(gx: number, gy: number): boolean {
    if (this.avoidRects.length === 0) return false
    const x = (gx + 0.5) * this.cell
    const y = (gy + 0.5) * this.cell
    const pad = this.cell
    for (let i = 0; i < this.avoidRects.length; i++) {
      const r = this.avoidRects[i]!
      if (
        x >= r.left - pad &&
        x <= r.right + pad &&
        y >= r.top - pad &&
        y <= r.bottom + pad
      ) {
        return true
      }
    }
    return false
  }

  public emitWake = (x: number, y: number, glyph: WakeGlyph, maxAge = 0.6): void => {
    const gx = Math.floor(x / this.cell)
    const gy = Math.floor(y / this.cell)
    if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) return
    if (this.isCellInsideAvoidRect(gx, gy)) return

    const slot = this.wakeChars[this.wakeCursor]!
    this.wakeCursor = (this.wakeCursor + 1) % MAX_WAKE_CHARS
    slot.active = true
    slot.gx = gx
    slot.gy = gy
    slot.glyphIndex =
      glyph === '.' ? 0 : glyph === ':' ? 1 : glyph === '-' ? 2 : 3
    slot.age = 0
    slot.maxAge = maxAge
  }

  /**
   * Spawns a circular expanding click ripple at `(x, y)` in a pre-allocated bounded pool.
   */
  public spawnRipple(x: number, y: number, isFeed = false): void {
    const gx = Math.floor(x / this.cell)
    const gy = Math.floor(y / this.cell)
    if (this.isCellInsideAvoidRect(gx, gy)) return

    const slot = this.ripples[this.rippleCursor]!
    this.rippleCursor = (this.rippleCursor + 1) % MAX_RIPPLES
    slot.active = true
    slot.x = x
    slot.y = y
    slot.radius = this.cell * 1.15
    slot.maxRadius = this.cell * (isFeed ? 10.5 : 14.0) * Math.max(0.85, Math.min(1.3, this.scale))
    slot.age = 0
    slot.maxAge = isFeed ? 0.78 : 0.88
    // Use hot row for koi feeding ripple or primary species ramp for scatter ripple
    slot.rampIndex = isFeed ? this.speciesRamps.length : 0
  }

  private emitCursorTrailCell(gx: number, gy: number): void {
    if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) return
    if (this.isCellInsideAvoidRect(gx, gy)) return

    // If the most recent trail cell is already at (gx, gy), refresh its age instead of duplicating
    const prevIdx = (this.trailCursor + MAX_CURSOR_TRAIL - 1) % MAX_CURSOR_TRAIL
    const prevSlot = this.cursorTrail[prevIdx]
    if (prevSlot && prevSlot.active && prevSlot.gx === gx && prevSlot.gy === gy) {
      prevSlot.age = 0
      return
    }

    const slot = this.cursorTrail[this.trailCursor]!
    const seqIdx = this.trailCursor
    this.trailCursor = (this.trailCursor + 1) % MAX_CURSOR_TRAIL
    slot.active = true
    slot.gx = gx
    slot.gy = gy
    // Cycle subtly across dim monospace glyphs '.', ':', '-', '+'
    slot.glyphIndex = seqIdx & 3
    slot.age = 0
    // Slightly longer tail fade (~580–700 ms)
    slot.maxAge = 0.58 + (seqIdx % 4) * 0.04
  }

  /**
   * Tracks pointer movement and spawns restrained, short-lived dim monospace characters
   * along the cursor trajectory when the pointer moves beyond a minimum distance threshold.
   */
  public handlePointerMove(x: number, y: number): boolean {
    if (x < 0 || x > this.width || y < 0 || y > this.height) return false
    const gx = Math.floor(x / this.cell)
    const gy = Math.floor(y / this.cell)
    if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) return false
    if (this.isCellInsideAvoidRect(gx, gy)) return false

    const minDistPx = Math.max(11, this.cell * 1.4)
    const prevX = this.lastTrailX
    const prevY = this.lastTrailY
    const hasPrev = prevX > -1000 && prevY > -1000
    const dist = hasPrev ? Math.hypot(x - prevX, y - prevY) : Infinity
    if (dist < minDistPx) return false

    // Interpolate up to 3 intermediate cells on fast pointer sweeps so the tail feels continuous
    if (hasPrev && dist > minDistPx * 1.6 && dist < this.cell * 28) {
      const steps = Math.min(3, Math.floor(dist / minDistPx))
      for (let s = 1; s < steps; s++) {
        const t = s / steps
        const ix = prevX + (x - prevX) * t
        const iy = prevY + (y - prevY) * t
        this.emitCursorTrailCell(Math.floor(ix / this.cell), Math.floor(iy / this.cell))
      }
    }

    this.lastTrailX = x
    this.lastTrailY = y
    this.emitCursorTrailCell(gx, gy)
    return true
  }

  public handlePointerTrigger(x: number, y: number): 'feed' | 'scatter' {
    const mode =
      this.clickMode === 'scatter' ? 'scatter' : this.speciesDef.defaultClickBehavior

    if (mode === 'feed') {
      const dropCount = 3 + Math.floor(this.rng() * 3) // 3 to 5 food cells
      let dropped = 0
      for (let i = 0; i < this.foodPellets.length && dropped < dropCount; i++) {
        const pellet = this.foodPellets[i]!
        if (!pellet.active) {
          const offsetAngle = (dropped / dropCount) * Math.PI * 2 + this.rng() * 0.5
          const offsetDist = (dropped === 0 ? 0.3 : 1.1 + this.rng() * 1.4) * this.cell
          pellet.active = true
          pellet.x = Math.max(
            this.cell,
            Math.min(this.width - this.cell, x + Math.cos(offsetAngle) * offsetDist),
          )
          pellet.y = Math.max(
            this.cell,
            Math.min(this.height - this.cell, y + Math.sin(offsetAngle) * offsetDist),
          )
          pellet.age = 0
          pellet.maxAge = 6.0
          dropped++
        }
      }
      this.spawnRipple(x, y, true)
      this.emitWake(x, y, '+', 0.55)
      return 'feed'
    }

    // Use the spatial quadtree to query creatures within scatter radius R = 0.45 * diagonal
    const diagonal = Math.hypot(this.width, this.height)
    const scatterRadius = 0.45 * diagonal
    this.quadtree.rebuild(this.creatures, this.width, this.height)
    const candidateBuf = this.quadtree.getAvoidBuffer()
    const candidateCount = this.quadtree.queryRadiusInto(
      x,
      y,
      scatterRadius,
      candidateBuf,
      -1,
      false,
    )

    const preserveInstantHeading =
      this.speciesDef.id === 'koi' || this.speciesDef.id === 'butterfly'

    for (let k = 0; k < candidateCount; k++) {
      const idx = candidateBuf[k]!
      const c = this.creatures[idx]!
      const scatter = computeScatterImpulse(
        c.x,
        c.y,
        x,
        y,
        this.width,
        this.height,
        c.maxSpeed,
        this.rng,
      )
      if (scatter.triggered) {
        const nextVel = applyScatterVelocity(
          c.vx,
          c.vy,
          scatter.impulseX,
          scatter.impulseY,
          c.maxSpeed,
        )
        const escapeHeading = Math.atan2(nextVel.vy, nextVel.vx)
        c.desiredHeading = escapeHeading
        if (preserveInstantHeading) {
          c.vx = nextVel.vx
          c.vy = nextVel.vy
          c.heading = escapeHeading
        } else {
          // Smoothly blend initial scatter impulse so heading and velocity curve organically
          // into the escape maneuver over the next few frames without a 1-frame snap
          c.vx = c.vx * 0.55 + nextVel.vx * 0.45
          c.vy = c.vy * 0.55 + nextVel.vy * 0.45
        }
        c.fearTimer = scatter.fearDuration
        c.fearDuration = scatter.fearDuration
        c.fearPeakSpeed = nextVel.speed
        c.recoveryTimer = 0
        this.speciesDef.onScatterCreature?.(c, this.rng)
      }
    }

    this.spawnRipple(x, y, false)
    this.emitWake(x, y, '+', 0.55)
    return 'scatter'
  }

  public step(dt = FIXED_DT): void {
    this.simTime += dt

    // Update food pellets (fade after 6 s)
    for (let i = 0; i < this.foodPellets.length; i++) {
      const p = this.foodPellets[i]!
      if (!p.active) continue
      p.age += dt
      if (p.age >= p.maxAge) {
        p.active = false
      }
    }

    // Update wake characters (fade over ~600 ms)
    for (let i = 0; i < this.wakeChars.length; i++) {
      const w = this.wakeChars[i]!
      if (!w.active) continue
      w.age += dt
      if (w.age >= w.maxAge) {
        w.active = false
      }
    }

    // Update cursor trail characters (fade over 400–700 ms)
    for (let i = 0; i < this.cursorTrail.length; i++) {
      const t = this.cursorTrail[i]!
      if (!t.active) continue
      t.age += dt
      if (t.age >= t.maxAge) {
        t.active = false
      }
    }

    // Update expanding click ripples
    for (let i = 0; i < this.ripples.length; i++) {
      const r = this.ripples[i]!
      if (!r.active) continue
      r.age += dt
      if (r.age >= r.maxAge) {
        r.active = false
      } else {
        const progress = Math.min(1, r.age / r.maxAge)
        const eased = 1 - Math.pow(1 - progress, 2.15)
        r.radius = this.cell * 1.15 + (r.maxRadius - this.cell * 1.15) * eased
      }
    }

    // Rebuild zero-allocation spatial quadtree and measure spatial cost
    const spatialStart = performance.now()
    this.quadtree.rebuild(this.creatures, this.width, this.height)
    const rebuildMs = performance.now() - spatialStart

    let queryMsAccum = 0

    // Step species simulation
    this.speciesDef.update(this.creatures, dt, {
      width: this.width,
      height: this.height,
      cell: this.cell,
      scale: this.scale,
      time: this.simTime,
      rng: this.rng,
      avoidRects: this.avoidRects,
      foodPellets: this.foodPellets,
      emitWake: this.emitWake,
      computeAvoidance: (x, y, vx, vy, vmax) =>
        computeAvoidanceForce(x, y, vx, vy, this.avoidRects, this.cell, vmax),
      queryNeighbors: (x, y, radius, excludeIndex = -1) => {
        const q0 = performance.now()
        const res = this.quadtree.queryNeighbors(x, y, radius, excludeIndex)
        queryMsAccum += performance.now() - q0
        return res
      },
      computeCreatureAvoidance: (selfIndex, creatures, lookaheadSec = 0.4) => {
        const self = creatures[selfIndex]
        if (!self) return { ax: 0, ay: 0 }
        const q0 = performance.now()
        const searchRadius = self.collisionRadius * 1.45 + this.cell * 3.5 * this.scale
        const res = this.quadtree.queryAvoidanceNeighbors(
          self.x,
          self.y,
          searchRadius,
          selfIndex,
        )
        const force = computeInterCreatureAvoidance(
          selfIndex,
          creatures,
          res.indices,
          res.count,
          this.cell,
          this.scale,
          lookaheadSec,
        )
        queryMsAccum += performance.now() - q0
        return force
      },
    })

    this.lastNeighborQueries = this.quadtree.queryCount
    const totalSpatialMs = rebuildMs + queryMsAccum
    this.spatialSamples[this.spatialSampleCursor] = totalSpatialMs
    this.spatialSampleCursor = (this.spatialSampleCursor + 1) % this.spatialSamples.length
    if (this.spatialSampleCount < this.spatialSamples.length) {
      this.spatialSampleCount++
    }
  }

  public warmUpAndRenderStill(ctx: CanvasRenderingContext2D, seconds = 3.0): void {
    const steps = Math.max(1, Math.round(seconds / FIXED_DT))
    for (let i = 0; i < steps; i++) {
      this.step(FIXED_DT)
    }
    this.needsFullRedraw = true
    this.render(ctx)
  }

  public tick(nowMs: number, ctx: CanvasRenderingContext2D): void {
    const startWork = performance.now()

    if (this.lastRafTime < 0) {
      this.lastRafTime = nowMs
      this.step(FIXED_DT)
    } else {
      const rawDeltaMs = nowMs - this.lastRafTime
      if (rawDeltaMs > 0 && rawDeltaMs < 250) {
        this.fpsIntervalSamples[this.fpsSampleCursor] = rawDeltaMs
        this.fpsSampleCursor = (this.fpsSampleCursor + 1) % this.fpsIntervalSamples.length
        if (this.fpsSampleCount < this.fpsIntervalSamples.length) {
          this.fpsSampleCount++
        }
      }

      const elapsedSec = Math.min(Math.max(0, rawDeltaMs / 1000), 0.1)
      this.lastRafTime = nowMs
      this.accumulator = Math.min(this.accumulator + elapsedSec, FIXED_DT * 2)
      let steps = 0
      while (this.accumulator >= FIXED_DT && steps < 1) {
        this.step(FIXED_DT)
        this.accumulator -= FIXED_DT
        steps++
      }
      if (steps === 0) {
        // Ensure smooth motion even if RAF timestamp jitter is slightly under 16.6ms
        this.step(FIXED_DT)
        this.accumulator = 0
      }
    }

    this.render(ctx)

    const workMs = performance.now() - startWork
    this.frameSamples[this.frameSampleCursor] = workMs
    this.frameSampleCursor = (this.frameSampleCursor + 1) % this.frameSamples.length
    if (this.frameSampleCount < this.frameSamples.length) {
      this.frameSampleCount++
    }
  }

  public resetFrameClock(): void {
    this.lastRafTime = -1
    this.accumulator = 0
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const dpr = this.dpr
    const cellPx = Math.max(4, Math.round(this.cell * dpr))
    const canvasW = Math.round(this.width * dpr)
    const canvasH = Math.round(this.height * dpr)

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Clear and repaint background + dot grid (full on first frame/resize, dirty bounding rects otherwise)
    const bgStyle = this.grid && this.gridPattern ? this.gridPattern : this.palette.surfaceCss
    if (this.needsFullRedraw) {
      ctx.fillStyle = bgStyle
      ctx.fillRect(0, 0, canvasW, canvasH)
      this.needsFullRedraw = false
    } else if (this.prevDirtyCount > 0) {
      ctx.fillStyle = bgStyle
      for (let i = 0; i < this.prevDirtyCount; i++) {
        const base = i * 4
        const gx = this.prevDirtyRects[base]!
        const gy = this.prevDirtyRects[base + 1]!
        const gw = this.prevDirtyRects[base + 2]!
        const gh = this.prevDirtyRects[base + 3]!
        ctx.fillRect(gx * cellPx, gy * cellPx, gw * cellPx, gh * cellPx)
      }
    }

    let nextDirtyCount = 0
    const maxDirtyRects = this.prevDirtyRects.length >> 2
    const pushDirtyRect = (gx: number, gy: number, gw: number, gh: number): void => {
      if (nextDirtyCount >= maxDirtyRects) return
      const base = nextDirtyCount * 4
      this.prevDirtyRects[base] = gx
      this.prevDirtyRects[base + 1] = gy
      this.prevDirtyRects[base + 2] = gw
      this.prevDirtyRects[base + 3] = gh
      nextDirtyCount++
    }

    // 1. Draw wake / trail / tentacle-tip monospace characters and cursor trail
    if (this.wakeAtlas) {
      for (let i = 0; i < this.wakeChars.length; i++) {
        const w = this.wakeChars[i]!
        if (!w.active) continue
        if (w.gx < 0 || w.gx >= this.cols || w.gy < 0 || w.gy >= this.rows) continue
        if (this.isCellInsideAvoidRect(w.gx, w.gy)) continue
        const step = Math.min(
          WAKE_ALPHA_STEPS - 1,
          Math.floor((w.age / Math.max(0.05, w.maxAge)) * WAKE_ALPHA_STEPS),
        )
        ctx.drawImage(
          this.wakeAtlas,
          w.glyphIndex * cellPx,
          step * cellPx,
          cellPx,
          cellPx,
          w.gx * cellPx,
          w.gy * cellPx,
          cellPx,
          cellPx,
        )
        pushDirtyRect(w.gx, w.gy, 1, 1)
      }

      // Draw restrained mouse movement trail characters across all 4 wake alpha steps
      for (let i = 0; i < this.cursorTrail.length; i++) {
        const t = this.cursorTrail[i]!
        if (!t.active) continue
        if (t.gx < 0 || t.gx >= this.cols || t.gy < 0 || t.gy >= this.rows) continue
        if (this.isCellInsideAvoidRect(t.gx, t.gy)) continue
        const step = Math.min(
          WAKE_ALPHA_STEPS - 1,
          Math.floor((t.age / Math.max(0.05, t.maxAge)) * WAKE_ALPHA_STEPS),
        )
        ctx.drawImage(
          this.wakeAtlas,
          t.glyphIndex * cellPx,
          step * cellPx,
          cellPx,
          cellPx,
          t.gx * cellPx,
          t.gy * cellPx,
          cellPx,
          cellPx,
        )
        pushDirtyRect(t.gx, t.gy, 1, 1)
      }
    }

    // 2. Blit ASCII creature cells and click ripple outlines from pre-rendered cellAtlas
    const numRamps = Math.max(1, this.speciesRamps.length)
    const totalAtlasRamps = numRamps + 1 // includes 'hot' row at index = numRamps
    const numBuckets = Math.min(MAX_ATLAS_BUCKETS, totalAtlasRamps * ATLAS_COLS)
    for (let b = 0; b < numBuckets; b++) {
      this.atlasBucketCounts[b] = 0
    }
    const atlas = this.cellAtlas
    this.frameId = (this.frameId + 1) | 0 || 1
    const currentFrameId = this.frameId
    let totalCells = 0
    let curMinGx = 99999
    let curMaxGx = -1
    let curMinGy = 99999
    let curMaxGy = -1

    // Plot thin, pixel-compatible circular click ripples first or after creatures:
    // Plotting creatures first and ripples into unoccupied cells keeps creatures crisp above the ripple wave.
    const plotCell = (
      gx: number,
      gy: number,
      rampIndex: number,
      shade: number,
      coverage: number,
      glyphHash: number,
    ): void => {
      if (totalCells >= MAX_TOTAL_CELLS) return
      if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) return
      if (this.isCellInsideAvoidRect(gx, gy)) return

      const bayer = BAYER_4X4[((gy & 3) << 2) | (gx & 3)]!
      if (coverage < 1 && coverage < bayer) return

      const cellIdx = gy * this.cols + gx
      if (this.cellStamp[cellIdx] === currentFrameId) return
      this.cellStamp[cellIdx] = currentFrameId

      const ditheredShade = shade + (bayer - 0.5) * 0.34
      const level = ditheredShade >= 0.66 ? 2 : ditheredShade >= 0.34 ? 1 : 0
      const safeRamp = Math.max(0, Math.min(totalAtlasRamps - 1, rampIndex))
      const h = glyphHash >>> 0

      // Select deterministic glyph column from creature-local glyphHash
      let col: number
      if (level === 2) {
        col = 9 + (h & 3) // '# @ % &' on solid tile
      } else if (level === 1) {
        col = 4 + (h % 5) // '* + = x o' in full palette color
      } else {
        col = h & 3 // ': . , \'' in ~45% tint
      }

      const bucketIdx = safeRamp * ATLAS_COLS + col
      const bCount = this.atlasBucketCounts[bucketIdx]!
      const packed = (gx << 16) | (gy & 0xffff)
      if (bCount < MAX_CELLS_PER_BUCKET) {
        this.atlasBucketData[bucketIdx]![bCount] = packed
        this.atlasBucketCounts[bucketIdx] = bCount + 1
      }

      if (gx < curMinGx) curMinGx = gx
      if (gx > curMaxGx) curMaxGx = gx
      if (gy < curMinGy) curMinGy = gy
      if (gy > curMaxGy) curMaxGy = gy
      totalCells++
    }

    for (let i = 0; i < this.creatures.length; i++) {
      curMinGx = 99999
      curMaxGx = -1
      curMinGy = 99999
      curMaxGy = -1
      this.speciesDef.renderCreature(
        this.creatures[i]!,
        this.cell,
        this.scale,
        this.simTime,
        plotCell,
      )
      if (curMaxGx >= curMinGx && curMaxGy >= curMinGy) {
        pushDirtyRect(curMinGx, curMinGy, curMaxGx - curMinGx + 1, curMaxGy - curMinGy + 1)
      }
    }

    // 2b. Render active expanding click ripples as a 1-cell-thick pixel-compatible outline
    for (let rIdx = 0; rIdx < this.ripples.length; rIdx++) {
      const r = this.ripples[rIdx]!
      if (!r.active) continue
      const progress = Math.min(1, r.age / Math.max(0.05, r.maxAge))
      const fade = 1 - progress
      const rCells = r.radius / this.cell
      const steps = Math.max(20, Math.min(160, Math.ceil(2 * Math.PI * rCells * 1.15)))
      const stepAngle = (Math.PI * 2) / steps

      // Shade and coverage fade smoothly as the ripple expands outward
      const shade = fade > 0.62 ? 0.56 : fade > 0.3 ? 0.34 : 0.22
      const coverage = Math.min(0.95, fade * 1.18)

      curMinGx = 99999
      curMaxGx = -1
      curMinGy = 99999
      curMaxGy = -1

      for (let s = 0; s < steps; s++) {
        const theta = s * stepAngle
        const gx = Math.floor((r.x + Math.cos(theta) * r.radius) / this.cell)
        const gy = Math.floor((r.y + Math.sin(theta) * r.radius) / this.cell)
        const glyphHash = (s * 2654435761 + rIdx * 97) >>> 0
        plotCell(gx, gy, r.rampIndex, shade, coverage, glyphHash)
      }

      if (curMaxGx >= curMinGx && curMaxGy >= curMinGy) {
        pushDirtyRect(curMinGx, curMinGy, curMaxGx - curMinGx + 1, curMaxGy - curMinGy + 1)
      }
    }

    // Batch-blit each pre-rendered (ramp, glyph) atlas entry across all matching cells
    for (let b = 0; b < numBuckets; b++) {
      const count = this.atlasBucketCounts[b]!
      if (count === 0) continue
      const data = this.atlasBucketData[b]!
      const pattern = this.atlasPatterns[b]
      if (pattern) {
        ctx.fillStyle = pattern
        ctx.beginPath()
        for (let i = 0; i < count; i++) {
          const packed = data[i]!
          const gx = packed >> 16
          const gy = packed & 0xffff
          ctx.rect(gx * cellPx, gy * cellPx, cellPx, cellPx)
        }
        ctx.fill()
      } else if (atlas) {
        const safeRamp = Math.floor(b / ATLAS_COLS)
        const col = b % ATLAS_COLS
        for (let i = 0; i < count; i++) {
          const packed = data[i]!
          const gx = packed >> 16
          const gy = packed & 0xffff
          ctx.drawImage(
            atlas,
            col * cellPx,
            safeRamp * cellPx,
            cellPx,
            cellPx,
            gx * cellPx,
            gy * cellPx,
            cellPx,
            cellPx,
          )
        }
      }
    }

    this.activeCellCount = totalCells

    // 3. Draw koi food pellets in 'hot' color row (row = numRamps)
    if (atlas) {
      const hotRow = numRamps
      for (let i = 0; i < this.foodPellets.length; i++) {
        const p = this.foodPellets[i]!
        if (!p.active) continue
        const gx = Math.floor(p.x / this.cell)
        const gy = Math.floor(p.y / this.cell)
        if (gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) continue
        if (this.isCellInsideAvoidRect(gx, gy)) continue
        const remaining = p.maxAge - p.age
        const col =
          remaining > 1.5
            ? 9 + (i & 3) // Brightest tile '# @ % &'
            : remaining > 0.7
              ? 4 + (i % 5) // Mid glyph '* + = x o'
              : i & 3 // Dim glyph ': . , \''
        ctx.drawImage(
          atlas,
          col * cellPx,
          hotRow * cellPx,
          cellPx,
          cellPx,
          gx * cellPx,
          gy * cellPx,
          cellPx,
          cellPx,
        )
        pushDirtyRect(gx, gy, 1, 1)
      }
    }

    this.prevDirtyCount = nextDirtyCount

    ctx.restore()
  }

  public getMetrics(): EngineMetrics {
    let activeWakeCount = 0
    for (let i = 0; i < this.wakeChars.length; i++) {
      if (this.wakeChars[i]!.active) activeWakeCount++
    }
    let activeTrailCount = 0
    for (let i = 0; i < this.cursorTrail.length; i++) {
      if (this.cursorTrail[i]!.active) activeTrailCount++
    }
    let activeRippleCount = 0
    for (let i = 0; i < this.ripples.length; i++) {
      if (this.ripples[i]!.active) activeRippleCount++
    }
    let activeFoodCount = 0
    for (let i = 0; i < this.foodPellets.length; i++) {
      if (this.foodPellets[i]!.active) activeFoodCount++
    }

    const n = this.frameSampleCount
    let avgFrameMs = 0
    let p95FrameMs = 0
    let maxFrameMs = 0

    if (n > 0) {
      let sum = 0
      for (let i = 0; i < n; i++) {
        const val = this.frameSamples[i]!
        sum += val
        this.sortScratch[i] = val
        if (val > maxFrameMs) maxFrameMs = val
      }
      avgFrameMs = sum / n
      const sub = this.sortScratch.subarray(0, n)
      sub.sort()
      p95FrameMs = sub[Math.min(n - 1, Math.floor(n * 0.95))]!
    }

    let avgSpatialMs = 0
    if (this.spatialSampleCount > 0) {
      let sSum = 0
      for (let i = 0; i < this.spatialSampleCount; i++) {
        sSum += this.spatialSamples[i]!
      }
      avgSpatialMs = sSum / this.spatialSampleCount
    }

    let fps = 60
    if (this.fpsSampleCount > 0) {
      let sumDelta = 0
      for (let i = 0; i < this.fpsSampleCount; i++) {
        sumDelta += this.fpsIntervalSamples[i]!
      }
      const avgDelta = sumDelta / this.fpsSampleCount
      if (avgDelta > 0) {
        fps = Math.min(120, Math.round(1000 / avgDelta))
      }
    }

    return {
      species: this.speciesDef.id,
      creatureCount: this.creatures.length,
      activeCellCount: this.activeCellCount,
      activeWakeCount,
      activeFoodCount,
      activeRippleCount,
      activeTrailCount,
      neighborQueryCount: this.lastNeighborQueries,
      quadtreeNodeCount: this.quadtree.nodeCount,
      avgSpatialMs,
      frameCount: n,
      fps,
      avgFrameMs,
      p95FrameMs,
      maxFrameMs,
    }
  }
}

export { easeInOutCubic }
