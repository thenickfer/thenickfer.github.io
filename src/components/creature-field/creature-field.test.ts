import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  BRIGHT_CELL_GLYPHS,
  CreatureFieldEngine,
  DIM_CELL_GLYPHS,
  MAX_CURSOR_TRAIL,
  MAX_RIPPLES,
  MAX_TOTAL_CELLS,
  MID_CELL_GLYPHS,
  applyScatterVelocity,
  clampScale,
  computeAvoidanceForce,
  computeScatterImpulse,
  computeSpeciesCount,
  createSeededRng,
  easeInOutCubic,
  selectSpecies,
  snapCellSize,
} from './engine.ts'
import { readPaletteFromTokens } from './palette.ts'
import { FlatQuadtree, FlatSpatialGrid, queryNaiveRadiusInto } from './spatial.ts'
import { ALL_SPECIES, SPECIES_BY_ID } from './species/index.ts'
import { hashCreatureLocalGlyph, normalizeAngle } from './species/types.ts'

describe('CreatureField pure logic', () => {
  describe('count formula, scale prop, and cell budget', () => {
    it('computes clamp(round(base * viewportArea / 1_300_000), min, max) for all species', () => {
      // 1440x900 = 1,296,000 (~1.0x reference area) with ~1/3 reduced counts for larger creatures
      assert.equal(computeSpeciesCount(5, 8, 1440, 900), 6)
      assert.equal(computeSpeciesCount(9, 16, 1440, 900), 12)
      assert.equal(computeSpeciesCount(4, 7, 1440, 900), 5)
      assert.equal(computeSpeciesCount(5, 8, 1440, 900), 6)
      assert.equal(computeSpeciesCount(2, 4, 1440, 900), 3)
      assert.equal(computeSpeciesCount(1, 2, 1440, 900), 1)

      // 390x844 phone = 329,160 -> clamps to min
      for (const speciesId of ALL_SPECIES) {
        const [min, max] = SPECIES_BY_ID[speciesId].countRange
        assert.equal(computeSpeciesCount(min, max, 390, 844), min)
      }

      // 2560x1080 ultrawide = 2,764,800 -> clamps to max
      for (const speciesId of ALL_SPECIES) {
        const [min, max] = SPECIES_BY_ID[speciesId].countRange
        assert.equal(computeSpeciesCount(min, max, 2560, 1080), max)
      }
    })

    it('honors count override, snaps cell size to a multiple of 4, and scales creature size in cells', () => {
      assert.equal(computeSpeciesCount(5, 8, 1440, 900, 10), 10)
      assert.equal(snapCellSize(8), 8)
      assert.equal(snapCellSize(7), 8)
      assert.equal(snapCellSize(10), 12)
      assert.equal(snapCellSize(2), 4)
      assert.equal(clampScale(1), 1)
      assert.equal(clampScale(1.5), 1.5)

      const palette = readPaletteFromTokens(null)
      const baseEngine = new CreatureFieldEngine({
        species: 'koi',
        palette,
        width: 1440,
        height: 900,
        cell: 8,
        scale: 1,
        seed: 77,
      })
      const scaledEngine = new CreatureFieldEngine({
        species: 'koi',
        palette,
        width: 1440,
        height: 900,
        cell: 8,
        scale: 1.5,
        seed: 77,
      })
      assert.equal(baseEngine.cell, 8)
      assert.equal(scaledEngine.cell, 8)
      const baseSpineLen = Math.hypot(
        baseEngine.creatures[0]!.spineX[8]! - baseEngine.creatures[0]!.spineX[0]!,
        baseEngine.creatures[0]!.spineY[8]! - baseEngine.creatures[0]!.spineY[0]!,
      )
      const scaledSpineLen = Math.hypot(
        scaledEngine.creatures[0]!.spineX[8]! - scaledEngine.creatures[0]!.spineX[0]!,
        scaledEngine.creatures[0]!.spineY[8]! - scaledEngine.creatures[0]!.spineY[0]!,
      )
      assert.ok(scaledSpineLen > baseSpineLen * 1.4)
    })

    it('derives deterministic creature-local glyph hashes that do not depend on screen position', () => {
      assert.equal(DIM_CELL_GLYPHS.length, 4)
      assert.equal(MID_CELL_GLYPHS.length, 5)
      assert.equal(BRIGHT_CELL_GLYPHS.length, 4)

      const h1 = hashCreatureLocalGlyph(3, 5, -2)
      const h2 = hashCreatureLocalGlyph(3, 5, -2)
      const h3 = hashCreatureLocalGlyph(3, 6, -2)
      assert.equal(h1, h2)
      assert.notEqual(h1, h3)
    })

    it('keeps total cell count on a 390x844 phone and 1440x900 desktop under 20,000', () => {
      const palette = readPaletteFromTokens(null)
      for (const species of ALL_SPECIES) {
        const engine = new CreatureFieldEngine({
          species,
          palette,
          width: 390,
          height: 844,
          cell: 8,
          seed: 42,
        })
        engine.step()
        const gridCells = Math.ceil(390 / 8) * Math.ceil(844 / 8)
        assert.ok(gridCells < 20_000, `Phone grid cells ${gridCells} must be < 20,000`)
        assert.ok(MAX_TOTAL_CELLS < 20_000)
        assert.ok(engine.creatures.length > 0)
      }
    })
  })

  describe('species selection (no repeats)', () => {
    it('never picks the same species twice in a row when pool has at least 2 species', () => {
      const rng = createSeededRng(1337)
      let lastSpecies = selectSpecies({ rng })
      for (let i = 0; i < 200; i++) {
        const nextSpecies = selectSpecies({ lastSpecies, rng })
        assert.notEqual(nextSpecies, lastSpecies, `Repeated species ${nextSpecies} at step ${i}`)
        lastSpecies = nextSpecies
      }
    })

    it('respects custom pool, species prop priority, and dev query parameter', () => {
      const rng = createSeededRng(99)
      for (let i = 0; i < 20; i++) {
        const chosen = selectSpecies({
          pool: ['manta', 'jellyfish'],
          lastSpecies: 'manta',
          rng,
        })
        assert.equal(chosen, 'jellyfish')
      }

      // Explicit species prop always wins over devQuerySpecies and lastSpecies
      assert.equal(
        selectSpecies({
          species: 'dragonfly',
          lastSpecies: 'dragonfly',
          devQuerySpecies: 'koi',
          isDev: true,
        }),
        'dragonfly',
      )

      // Dev query parameter overrides 'random' only when isDev is true
      assert.equal(
        selectSpecies({
          species: 'random',
          lastSpecies: 'koi',
          devQuerySpecies: 'koi',
          isDev: true,
        }),
        'koi',
      )
      assert.notEqual(
        selectSpecies({
          species: 'random',
          lastSpecies: 'koi',
          devQuerySpecies: 'koi',
          isDev: false,
          rng: () => 0,
        }),
        'koi',
      )
    })
  })

  describe('scatter falloff and recovery math', () => {
    it('applies R = 0.45 * diagonal, quadratic falloff vmax * 2.5 * (1 - d/R)^2, and 3x speed cap', () => {
      const width = 1440
      const height = 900
      const diagonal = Math.hypot(width, height)
      const expectedR = 0.45 * diagonal
      const vmax = 100
      const rng = createSeededRng(7)

      // At d = 0: full impulse = 2.5 * vmax
      const atCenter = computeScatterImpulse(500, 500, 500, 500, width, height, vmax, rng)
      assert.equal(atCenter.triggered, true)
      assert.ok(Math.abs(atCenter.radius - expectedR) < 1e-6)
      assert.ok(Math.abs(atCenter.impulseMag - 250) < 1e-6)
      assert.ok(atCenter.fearDuration >= 1.2 && atCenter.fearDuration <= 2.0)

      // At d = 0.5 * R: falloff = 0.25 -> impulse = 2.5 * 0.25 * vmax = 62.5
      const halfDist = expectedR * 0.5
      const atHalf = computeScatterImpulse(500 + halfDist, 500, 500, 500, width, height, vmax, rng)
      assert.equal(atHalf.triggered, true)
      assert.ok(Math.abs(atHalf.falloff - 0.25) < 1e-6)
      assert.ok(Math.abs(atHalf.impulseX - 62.5) < 1e-5)
      assert.ok(Math.abs(atHalf.impulseY) < 1e-6)

      // At d >= R: not triggered
      const outside = computeScatterImpulse(
        500 + expectedR + 1,
        500,
        500,
        500,
        width,
        height,
        vmax,
        rng,
      )
      assert.equal(outside.triggered, false)
      assert.equal(outside.impulseMag, 0)

      // Speed cap at 3x vmax
      const capped = applyScatterVelocity(100, 0, 250, 0, vmax)
      assert.ok(Math.abs(capped.speed - 300) < 1e-6)
      assert.ok(Math.abs(capped.vx - 300) < 1e-6)

      // Ease-in-out cubic boundary and midpoint checks
      assert.equal(easeInOutCubic(0), 0)
      assert.equal(easeInOutCubic(0.5), 0.5)
      assert.equal(easeInOutCubic(1), 1)
    })
  })

  describe('steering, avoidance, and koi feeding', () => {
    it('steers creatures around avoid rectangles without crossing their interior', () => {
      const rect = { left: 400, top: 300, right: 600, bottom: 420 }
      // Point just to the left of the rectangle, moving right
      const force = computeAvoidanceForce(385, 360, 60, 0, [rect], 8, 80)
      assert.ok(force.ax < 0, `Expected leftward repulsion ax < 0, got ${force.ax}`)
      assert.ok(Math.abs(force.ay) > 0, 'Expected tangential steering component ay != 0')

      // Simulate a creature approaching the avoid plate and verify it steers around
      const palette = readPaletteFromTokens(null)
      const engine = new CreatureFieldEngine({
        species: 'manta',
        palette,
        width: 1000,
        height: 700,
        cell: 8,
        count: 1,
        seed: 101,
        avoidRects: [rect],
      })
      const c = engine.creatures[0]!
      c.x = 340
      c.y = 360
      c.heading = 0
      c.vx = c.baseSpeed
      c.vy = 0

      for (let step = 0; step < 180; step++) {
        engine.step()
        const strictlyInside =
          c.x > rect.left + 8 && c.x < rect.right - 8 && c.y > rect.top + 8 && c.y < rect.bottom - 8
        assert.equal(
          strictlyInside,
          false,
          `Creature crossed inside avoid plate at step ${step}: (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`,
        )
      }
    })

    it('drops food for koi in auto mode and koi swim to eat it, or scatters when clickMode is scatter', () => {
      const palette = readPaletteFromTokens(null)
      const engine = new CreatureFieldEngine({
        species: 'koi',
        palette,
        width: 1000,
        height: 700,
        cell: 8,
        count: 2,
        seed: 55,
      })

      const koi = engine.creatures[0]!
      koi.x = 460
      koi.y = 350
      koi.heading = Math.PI // initially facing away from (500, 350)

      const mode = engine.handlePointerTrigger(500, 350)
      assert.equal(mode, 'feed')
      const initialFood = engine.getMetrics().activeFoodCount
      assert.ok(initialFood >= 3 && initialFood <= 5, `Expected 3..5 food pellets, got ${initialFood}`)

      // Step simulation for 2.5 seconds; koi should turn toward food and eat at least one pellet
      for (let i = 0; i < 150; i++) {
        engine.step()
      }
      const remainingFood = engine.getMetrics().activeFoodCount
      assert.ok(
        remainingFood < initialFood,
        `Expected koi to eat food (initial ${initialFood}, remaining ${remainingFood})`,
      )

      // When clickMode is forced to 'scatter', koi scatter instead of feeding
      engine.setClickMode('scatter')
      const scatterResult = engine.handlePointerTrigger(koi.x + 10, koi.y + 10)
      assert.equal(scatterResult, 'scatter')
      assert.ok(koi.fearTimer > 0, 'Expected koi fearTimer > 0 after forced scatter')
    })

    it('clamps creatures inside new bounds on resize', () => {
      const palette = readPaletteFromTokens(null)
      const engine = new CreatureFieldEngine({
        species: 'butterfly',
        palette,
        width: 1440,
        height: 900,
        cell: 8,
        seed: 22,
      })
      engine.creatures[0]!.x = 1380
      engine.creatures[0]!.y = 850

      engine.resize(390, 844, 1.5)
      for (const c of engine.creatures) {
        assert.ok(c.x >= 0 && c.x <= 390, `Creature x=${c.x} out of resized width 390`)
        assert.ok(c.y >= 0 && c.y <= 844, `Creature y=${c.y} out of resized height 844`)
      }
    })
  })

  describe('smooth motion, spatial partitioning, ripple, and cursor trail', () => {
    it('enforces bounded angular and speed transitions for jellyfish, dragonfly, manta, and fish-school', () => {
      const palette = readPaletteFromTokens(null)
      for (const species of ['jellyfish', 'dragonfly', 'manta', 'fish-school'] as const) {
        const engine = new CreatureFieldEngine({
          species,
          palette,
          width: 1440,
          height: 900,
          cell: 8,
          seed: 42,
        })
        const prevH = engine.creatures.map((c) => c.heading)
        const prevS = engine.creatures.map((c) => Math.hypot(c.vx, c.vy))
        let maxDegStep = 0
        let maxSpeedStep = 0

        for (let step = 0; step < 300; step++) {
          engine.step()
          for (let i = 0; i < engine.creatures.length; i++) {
            const c = engine.creatures[i]!
            const dDeg = (Math.abs(normalizeAngle(c.heading - prevH[i]!)) * 180) / Math.PI
            const curS = Math.hypot(c.vx, c.vy)
            const dSpd = Math.abs(curS - prevS[i]!)
            if (dDeg > maxDegStep) maxDegStep = dDeg
            if (dSpd > maxSpeedStep) maxSpeedStep = dSpd
            prevH[i] = c.heading
            prevS[i] = curS
          }
        }

        assert.ok(
          maxDegStep < 6.0,
          `Expected smooth angular steps < 6 deg/frame for ${species}, got ${maxDegStep.toFixed(2)}`,
        )
        assert.ok(
          maxSpeedStep < 32.0,
          `Expected smooth speed steps < 32 px/s per frame for ${species}, got ${maxSpeedStep.toFixed(2)}`,
        )
      }
    })

    it('matches exact neighbor query sets between FlatQuadtree, FlatSpatialGrid, and Naive pairwise', () => {
      const palette = readPaletteFromTokens(null)
      const engine = new CreatureFieldEngine({
        species: 'fish-school',
        palette,
        width: 1440,
        height: 900,
        cell: 8,
        count: 60,
        seed: 88,
      })
      for (let i = 0; i < 30; i++) engine.step()

      const qt = new FlatQuadtree()
      const grid = new FlatSpatialGrid(1024)
      qt.rebuild(engine.creatures, 1440, 900)
      grid.rebuild(engine.creatures, 1440, 900, 128)

      const qtOut = new Int32Array(512)
      const gridOut = new Int32Array(512)
      const naiveOut = new Int32Array(512)

      for (let i = 0; i < engine.creatures.length; i++) {
        const c = engine.creatures[i]!
        const cQt = qt.queryRadiusInto(c.x, c.y, 180, qtOut, i, true)
        const cGrid = grid.queryRadiusInto(c.x, c.y, 180, gridOut, i, true)
        const cNaive = queryNaiveRadiusInto(engine.creatures, c.x, c.y, 180, naiveOut, i, true)

        const sortedQt = Array.from(qtOut.subarray(0, cQt)).sort((a, b) => a - b)
        const sortedGrid = Array.from(gridOut.subarray(0, cGrid)).sort((a, b) => a - b)
        const sortedNaive = Array.from(naiveOut.subarray(0, cNaive)).sort((a, b) => a - b)

        assert.deepEqual(sortedQt, sortedNaive)
        assert.deepEqual(sortedGrid, sortedNaive)
      }
    })

    it('separates approaching creatures smoothly via anticipatory inter-creature avoidance', () => {
      const palette = readPaletteFromTokens(null)
      const engine = new CreatureFieldEngine({
        species: 'manta',
        palette,
        width: 1440,
        height: 900,
        cell: 8,
        count: 2,
        seed: 19,
      })
      const a = engine.creatures[0]!
      const b = engine.creatures[1]!
      a.x = 560
      a.y = 450
      a.heading = 0
      a.desiredHeading = 0
      a.vx = a.baseSpeed
      a.vy = 0

      b.x = 840
      b.y = 456
      b.heading = Math.PI
      b.desiredHeading = Math.PI
      b.vx = -b.baseSpeed
      b.vy = 0

      let minDistance = Infinity
      for (let step = 0; step < 240; step++) {
        engine.step()
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d < minDistance) minDistance = d
      }

      // Two 24..32 cell mantas approaching nearly head-on (6 px y-offset) should steer around each other
      assert.ok(
        minDistance > 95,
        `Expected head-on mantas to steer around each other (minDistance=${minDistance.toFixed(1)} px)`,
      )
    })

    it('spawns bounded expanding ripples on click and distance-throttled cursor trails on pointer move', () => {
      const palette = readPaletteFromTokens(null)
      const engine = new CreatureFieldEngine({
        species: 'dragonfly',
        palette,
        width: 1440,
        height: 900,
        cell: 8,
        seed: 31,
      })

      engine.handlePointerTrigger(500, 400)
      assert.equal(engine.getMetrics().activeRippleCount, 1)
      const r0 = engine.ripples[0]!.radius
      engine.step()
      assert.ok(engine.ripples[0]!.radius > r0, 'Expected ripple radius to expand smoothly')

      // Spawn more than MAX_RIPPLES to verify bounded pool reuse
      for (let i = 0; i < MAX_RIPPLES + 5; i++) {
        engine.handlePointerTrigger(200 + i * 20, 300)
      }
      assert.equal(engine.getMetrics().activeRippleCount, MAX_RIPPLES)

      // Cursor trail minimum distance threshold & 400–700 ms decay
      const emitted1 = engine.handlePointerMove(300, 300)
      assert.equal(emitted1, true)
      // Tiny move (< 11 px) should be ignored
      const emittedTiny = engine.handlePointerMove(305, 304)
      assert.equal(emittedTiny, false)

      engine.step(0.03)
      const emitted2 = engine.handlePointerMove(330, 300)
      assert.equal(emitted2, true)
      assert.ok(engine.getMetrics().activeTrailCount >= 2)
      assert.ok(MAX_CURSOR_TRAIL <= 96)

      // Step past 700 ms -> all cursor trail chars and ripples expire cleanly
      for (let s = 0; s < 60; s++) engine.step()
      assert.equal(engine.getMetrics().activeTrailCount, 0)
      assert.equal(engine.getMetrics().activeRippleCount, 0)
    })
  })
})
