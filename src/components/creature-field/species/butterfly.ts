import type { Creature, PlotCellFn, SpeciesDefinition } from './types.ts'
import {
  applyFearAndRecoverySpeed,
  hashCreatureLocalGlyph,
  normalizeAngle,
  pickSafeSpawnPosition,
  valueNoise2D,
  wrapOrBounceBounds,
} from './types.ts'

export const butterflySpecies: SpeciesDefinition = {
  id: 'butterfly',
  countRange: [9, 16],
  speedRange: [60, 120],
  defaultClickBehavior: 'scatter',
  getRamps: (palette) => [palette.cobalt, palette.cobaltLight],

  spawn(count, width, height, cell, scale, avoidRects, rng) {
    const speedScale = cell / 8
    const creatures: Creature[] = []
    for (let i = 0; i < count; i++) {
      const widthCells = 12 + Math.floor(rng() * 5) // 12 to 16 cells across
      const collisionRadius = widthCells * 0.52 * cell * scale
      const pos = pickSafeSpawnPosition(
        width,
        height,
        cell,
        avoidRects,
        rng,
        Math.ceil(widthCells * 0.72 * scale),
        creatures,
      )
      const heading = rng() * Math.PI * 2 - Math.PI
      const minSpeed = 60 * speedScale
      const maxSpeed = 120 * speedScale
      const baseSpeed = minSpeed + rng() * (maxSpeed - minSpeed)

      creatures.push({
        id: i,
        species: 'butterfly',
        x: pos.x,
        y: pos.y,
        vx: Math.cos(heading) * baseSpeed,
        vy: Math.sin(heading) * baseSpeed,
        ax: 0,
        ay: 0,
        heading,
        desiredHeading: heading,
        angularVel: 0,
        baseSpeed,
        minSpeed,
        maxSpeed,
        collisionRadius,
        phase: rng() * 12,
        phaseSpeed: 8.5 + rng() * 3.5,
        lengthCells: 10,
        widthCells,
        seed: Math.floor(rng() * 100000),
        schoolId: 0,
        fearTimer: 0,
        fearDuration: 0,
        recoveryTimer: 0,
        fearPeakSpeed: baseSpeed,
        stateTimer: 0.6 + rng() * 1.1,
        stateMode: rng() < 0.25 ? 1 : 0, // 0: erratic flutter, 1: short glide
        auxTimer: rng() * 0.4,
        spineX: new Float32Array(0),
        spineY: new Float32Array(0),
      })
    }
    return creatures
  },

  update(creatures, dt, env) {
    const { width, height, cell, scale, time } = env

    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i]!

      c.stateTimer -= dt
      if (c.stateTimer <= 0) {
        if (c.stateMode === 0 && c.fearTimer <= 0) {
          c.stateMode = 1
          c.stateTimer = 0.35 + env.rng() * 0.45
        } else {
          c.stateMode = 0
          c.stateTimer = 0.8 + env.rng() * 1.3
        }
      }

      const isGliding = c.stateMode === 1 && c.fearTimer <= 0
      const flapMult = c.fearTimer > 0 ? 1.8 : isGliding ? 0.15 : 1.0
      c.phase += dt * c.phaseSpeed * flapMult

      const n1 = valueNoise2D(time * 1.8 + i * 7.3, c.seed * 0.01, c.seed)
      const n2 = valueNoise2D(c.x * 0.012, c.y * 0.012 + time * 0.8, c.seed + 19)
      const turnRate = isGliding ? n1 * 1.3 : n1 * 4.5 + n2 * 2.4

      if (c.fearTimer <= 0) {
        c.heading = normalizeAngle(c.heading + turnRate * dt)
        c.desiredHeading = c.heading
      }

      const speedWave = 0.82 + 0.32 * Math.sin(c.phase * 0.9)
      const rawDesiredSpeed = isGliding
        ? c.minSpeed * 1.1
        : Math.max(c.minSpeed, Math.min(c.maxSpeed, c.baseSpeed * speedWave))

      const targetSpeed = applyFearAndRecoverySpeed(c, rawDesiredSpeed, dt)
      if (c.fearTimer > 0) {
        c.heading = normalizeAngle(Math.atan2(c.vy, c.vx) + n1 * 1.8 * dt)
      }
      c.vx = Math.cos(c.heading) * targetSpeed
      c.vy = Math.sin(c.heading) * targetSpeed

      const bodyRadiusPx = c.widthCells * 0.65 * cell * scale
      const avoid = env.computeAvoidance(c.x, c.y, c.vx, c.vy, c.maxSpeed, bodyRadiusPx)
      const creatureAvoid = env.computeCreatureAvoidance(i, creatures, 0.38)
      c.ax = avoid.ax + creatureAvoid.ax
      c.ay = avoid.ay + creatureAvoid.ay
      c.vx += c.ax * dt
      c.vy += c.ay * dt
      wrapOrBounceBounds(c, width, height, cell * 8 * scale, dt)

      const curSpeed = Math.hypot(c.vx, c.vy)
      const cap = c.fearTimer > 0 ? c.maxSpeed * 3 : c.maxSpeed
      if (curSpeed > cap) {
        c.vx = (c.vx / curSpeed) * cap
        c.vy = (c.vy / curSpeed) * cap
      }

      c.heading = Math.atan2(c.vy, c.vx)
      c.x += c.vx * dt
      c.y += c.vy * dt

      c.auxTimer -= dt
      if (c.auxTimer <= 0) {
        c.auxTimer = 0.35 + env.rng() * 0.35
        env.emitWake(
          c.x - Math.cos(c.heading) * cell * 3 * scale,
          c.y - Math.sin(c.heading) * cell * 3 * scale,
          '.',
          0.52,
        )
      }
    }
  },

  renderCreature(c, cell, scale, _time, plotCell: PlotCellFn) {
    const cx = c.x / cell
    const cy = c.y / cell
    const cosH = Math.cos(c.heading)
    const sinH = Math.sin(c.heading)

    // 3 discrete flap frames (0: open, 1: half-flap, 2: raised/closed)
    const cycleStep = Math.floor(c.phase) & 3
    const flapFrame =
      c.stateMode === 1 && c.fearTimer <= 0 ? 0 : cycleStep === 3 ? 1 : cycleStep
    const halfSpan = c.widthCells * 0.5 // 6.0 to 8.0 cells per side (12 to 16 cells across)
    const wingScale = flapFrame === 0 ? 1.0 : flapFrame === 1 ? 0.72 : 0.44
    const maxW = Math.max(2.5, halfSpan * wingScale)

    const radius = Math.ceil((halfSpan + 2) * scale)
    const gxMin = Math.floor(cx - radius)
    const gxMax = Math.ceil(cx + radius)
    const gyMin = Math.floor(cy - radius)
    const gyMax = Math.ceil(cy + radius)

    for (let gy = gyMin; gy <= gyMax; gy++) {
      const dy = (gy + 0.5 - cy) / scale
      for (let gx = gxMin; gx <= gxMax; gx++) {
        const dx = (gx + 0.5 - cx) / scale
        // lx: forward along heading, ly: lateral across wings
        const lx = dx * cosH + dy * sinH
        const ly = -dx * sinH + dy * cosH
        const absY = Math.abs(ly)

        // Unflapped local Y so wing spot glyphs stay locked to the wing as it flaps
        const localWingY = ly / wingScale
        const glyphHash = hashCreatureLocalGlyph(c.id, Math.round(lx), Math.round(localWingY))

        // Two antenna cells ahead of the head (lx in [3.5, 5.5])
        if (lx >= 3.5 && lx <= 5.5) {
          const antY = 0.65 + (lx - 3.5) * 0.85
          if (Math.abs(absY - antY) <= 0.55) {
            plotCell(gx, gy, 1, 0.85, 1.0, glyphHash)
            continue
          }
        }

        // Thin central thorax and abdomen body (absY <= 0.62, lx in [-4.5, +3.5])
        if (absY <= 0.62 && lx >= -4.5 && lx <= 3.5) {
          const isHeadOrThorax = lx >= 0.5
          plotCell(gx, gy, isHeadOrThorax ? 1 : 0, isHeadOrThorax ? 0.92 : 0.65, 1.0, glyphHash)
          continue
        }

        if (absY > maxW + 0.4) continue

        // Forewing and hindwing lobes
        const u = absY / maxW // 0 at body, 1 at wingtip
        const foreCenter = 1.15 + u * 1.35
        const foreHalfLen = 3.1 * (1 - u * 0.28)
        const foreDist = Math.abs(lx - foreCenter) / Math.max(0.5, foreHalfLen)
        const inForewing = foreDist <= 1.0

        const hindCenter = -2.1 - u * 0.55
        const hindHalfLen = 2.45 * (1 - u * 0.34)
        const hindDist = Math.abs(lx - hindCenter) / Math.max(0.5, hindHalfLen)
        const inHindwing = u <= 0.86 && hindDist <= 1.0

        if (inForewing || inHindwing) {
          const wingEdgeMetric = inForewing
            ? Math.max(u, foreDist)
            : Math.max(u / 0.86, hindDist)

          // Lighter inner spots on forewing and hindwing
          const foreSpotDist = Math.hypot((u - 0.46) / 0.24, (lx - (1.15 + 0.46 * 1.35)) / 1.35)
          const hindSpotDist = Math.hypot((u - 0.42) / 0.22, (lx - (-2.1 - 0.42 * 0.55)) / 1.1)
          const isInnerSpot =
            (inForewing && foreSpotDist <= 1.0) || (inHindwing && hindSpotDist <= 1.0)

          // Darker outer border along the wing perimeter
          const isOuterBorder = wingEdgeMetric >= 0.74

          const coverage = wingEdgeMetric > 0.9 ? 0.62 : wingEdgeMetric > 0.8 ? 0.85 : 1.0
          let rampIndex: number
          let shade: number

          if (isInnerSpot && !isOuterBorder) {
            // Lighter inner spots in cobalt-light (brightest solid tile level)
            rampIndex = 1
            shade = flapFrame === 2 ? 0.72 : 0.95
          } else if (isOuterBorder) {
            // Darker outer border in cobalt (dim / mid glyph level)
            rampIndex = 0
            shade = wingEdgeMetric > 0.86 ? 0.28 : 0.46
          } else {
            // Mid-wing field in cobalt / cobalt-light
            rampIndex = 0
            shade = flapFrame === 2 ? 0.52 : 0.64
          }

          plotCell(gx, gy, rampIndex, shade, coverage, glyphHash)
        }
      }
    }
  },
}
