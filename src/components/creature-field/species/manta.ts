import type { Creature, PlotCellFn, SpeciesDefinition } from './types.ts'
import {
  applyFearAndRecoverySpeed,
  applySteeringForce,
  hashCreatureLocalGlyph,
  normalizeAngle,
  pickSafeSpawnPosition,
  steerAngleDamped,
  valueNoise2D,
  wrapOrBounceBounds,
} from './types.ts'

export const mantaSpecies: SpeciesDefinition = {
  id: 'manta',
  countRange: [2, 4],
  speedRange: [50, 90],
  defaultClickBehavior: 'scatter',
  getRamps: (palette) => [palette.cobalt, palette.cobaltLight, palette.cobaltDeep],

  spawn(count, width, height, cell, scale, avoidRects, rng) {
    const speedScale = cell / 8
    const sizeScale = Math.max(0.5, scale)
    const creatures: Creature[] = []
    for (let i = 0; i < count; i++) {
      const widthCells = Math.max(16, Math.round((24 + Math.floor(rng() * 9)) * sizeScale)) // 24 to 32 cells wide
      const lengthCells = Math.round(widthCells * 0.72)
      const collisionRadius = widthCells * 0.54 * cell
      const pos = pickSafeSpawnPosition(
        width,
        height,
        cell,
        avoidRects,
        rng,
        Math.ceil(widthCells * 0.65),
        creatures,
      )
      const heading = rng() * Math.PI * 2 - Math.PI
      const minSpeed = 50 * speedScale
      const maxSpeed = 90 * speedScale
      const baseSpeed = minSpeed + rng() * (maxSpeed - minSpeed)

      creatures.push({
        id: i,
        species: 'manta',
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
        phase: rng() * Math.PI * 2,
        phaseSpeed: (Math.PI * 2) / 3.0, // Smooth wing oscillation every ~3 s
        lengthCells,
        widthCells,
        seed: Math.floor(rng() * 100000),
        schoolId: 0,
        fearTimer: 0,
        fearDuration: 0,
        recoveryTimer: 0,
        fearPeakSpeed: baseSpeed,
        stateTimer: 0,
        stateMode: 0,
        auxTimer: rng() * 0.4,
        spineX: new Float32Array(0),
        spineY: new Float32Array(0),
      })
    }
    return creatures
  },

  onScatterCreature(c) {
    // Bank into a deliberate diving arc toward the escape vector rather than snapping heading
    c.desiredHeading = Math.atan2(c.vy, c.vx)
  },

  update(creatures, dt, env) {
    const { width, height, cell, scale, time } = env
    const sizeScale = Math.max(0.75, scale)
    const margin = cell * 14 * sizeScale

    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i]!
      // Smooth wing flap frequency transitions gently during a dive
      const fearBlend =
        c.fearTimer > 0 ? Math.min(1, c.fearTimer / Math.max(0.4, c.fearDuration * 0.5)) : 0
      const flapMult = 1.0 + 0.95 * fearBlend
      c.phase = (c.phase + dt * c.phaseSpeed * flapMult) % (Math.PI * 2)

      // Long, sweeping gliding arcs driven by very low-frequency harmonic & noise curvature
      const slowArcRate =
        valueNoise2D(time * 0.085 + i * 4.5, c.seed * 0.01, c.seed) * 0.34 +
        Math.sin(time * 0.19 + c.seed) * 0.22

      // Anticipatory boundary and obstacle steering so turns begin early with a large radius
      let boundAx = 0
      let boundAy = 0
      if (c.x < margin) boundAx = ((margin - c.x) / margin) * c.maxSpeed * 1.9
      else if (c.x > width - margin) boundAx = -((c.x - (width - margin)) / margin) * c.maxSpeed * 1.9
      if (c.y < margin) boundAy = ((margin - c.y) / margin) * c.maxSpeed * 1.9
      else if (c.y > height - margin) boundAy = -((c.y - (height - margin)) / margin) * c.maxSpeed * 1.9

      const plateAvoid = env.computeAvoidance(
        c.x,
        c.y,
        c.vx,
        c.vy,
        c.maxSpeed,
        c.collisionRadius,
      )
      const creatureAvoid = env.computeCreatureAvoidance(i, creatures, 0.85)
      const totalAvoidAx = plateAvoid.ax + creatureAvoid.ax * 1.35 + boundAx
      const totalAvoidAy = plateAvoid.ay + creatureAvoid.ay * 1.35 + boundAy

      if (c.fearTimer <= 0) {
        c.desiredHeading = normalizeAngle(c.desiredHeading + slowArcRate * dt)
      } else {
        c.desiredHeading = normalizeAngle(c.desiredHeading + slowArcRate * 0.45 * dt)
      }

      if (Math.hypot(totalAvoidAx, totalAvoidAy) > c.minSpeed * 0.12) {
        const steerGuideAngle = Math.atan2(
          c.vy + totalAvoidAy * 0.45,
          c.vx + totalAvoidAx * 0.45,
        )
        const angleDiff = normalizeAngle(steerGuideAngle - c.desiredHeading)
        c.desiredHeading = normalizeAngle(c.desiredHeading + angleDiff * Math.min(1, dt * 2.2))
      }

      // Large-radius turns via low maximum turn rate and damped angular velocity
      const maxTurnRate = c.fearTimer > 0 ? 1.45 : 0.82
      const turnResponsiveness = c.fearTimer > 0 ? 2.1 : 1.55
      steerAngleDamped(c, c.desiredHeading, maxTurnRate, turnResponsiveness, dt)

      // Smooth glide thrust coupled to wing downstroke + subtle vertical buoyancy oscillation
      const glideMod = 1 + 0.12 * Math.sin(c.phase - 0.35)
      const cruiseTarget = Math.max(c.minSpeed, Math.min(c.maxSpeed, c.baseSpeed * glideMod))
      const diveTarget = c.maxSpeed * 1.85
      const rawDesiredSpeed = c.fearTimer > 0 ? diveTarget : cruiseTarget
      const targetSpeed = applyFearAndRecoverySpeed(c, rawDesiredSpeed, dt)

      const verticalSwellVy = Math.cos(c.phase) * c.minSpeed * 0.085
      const desiredVx = Math.cos(c.heading) * targetSpeed
      const desiredVy = Math.sin(c.heading) * targetSpeed + verticalSwellVy

      const maxSteerSpeed = c.fearTimer > 0 ? c.maxSpeed * 2.4 : c.maxSpeed * 1.12
      const maxAccel = c.fearTimer > 0 ? c.maxSpeed * 2.5 : c.maxSpeed * 1.45
      const gain = c.fearTimer > 0 ? 2.2 : 1.75

      applySteeringForce(
        c,
        desiredVx,
        desiredVy,
        maxAccel,
        maxSteerSpeed,
        gain,
        dt,
        totalAvoidAx,
        totalAvoidAy,
      )

      wrapOrBounceBounds(c, width, height, margin, dt)

      const curSpeed = Math.hypot(c.vx, c.vy)
      const cap = c.fearTimer > 0 ? c.maxSpeed * 2.4 : c.maxSpeed * 1.12
      if (curSpeed > cap && curSpeed > 0) {
        c.vx = (c.vx / curSpeed) * cap
        c.vy = (c.vy / curSpeed) * cap
      }

      // Gently align body heading toward actual velocity direction with low turn rate
      if (curSpeed > c.minSpeed * 0.3) {
        const velAngle = Math.atan2(c.vy, c.vx)
        steerAngleDamped(c, velAngle, maxTurnRate, 1.8, dt * 0.45)
      }

      c.x += c.vx * dt
      c.y += c.vy * dt

      c.auxTimer -= dt
      if (c.auxTimer <= 0) {
        c.auxTimer = 0.26 + env.rng() * 0.22
        const tailDist = cell * 11 * sizeScale
        const tailX = c.x - Math.cos(c.heading) * tailDist
        const tailY = c.y - Math.sin(c.heading) * tailDist
        env.emitWake(tailX, tailY, c.fearTimer > 0 ? '-' : '.', 0.6)
      }
    }
  },

  renderCreature(c, cell, scale, _time, plotCell: PlotCellFn) {
    const cx = c.x / cell
    const cy = c.y / cell
    const cosH = Math.cos(c.heading)
    const sinH = Math.sin(c.heading)
    const sizeScale = Math.max(0.5, scale)

    const flapWave = Math.sin(c.phase)
    const isDiving = c.fearTimer > 0
    // Full wingspan is 24 to 32 cells at scale 1 (halfSpan = 12 to 16 cells)
    const halfSpan = (c.widthCells * 0.5) * (0.91 + 0.09 * flapWave) * (isDiving ? 0.9 : 1.0)
    const wingSweep = -0.85 * flapWave * sizeScale
    const halfChordBase = 5.6 * sizeScale
    const tailLen = 8.5 * sizeScale

    const radius = Math.ceil(Math.max(halfSpan, halfChordBase + tailLen)) + 2
    const gxMin = Math.floor(cx - radius)
    const gxMax = Math.ceil(cx + radius)
    const gyMin = Math.floor(cy - radius)
    const gyMax = Math.ceil(cy + radius)

    for (let gy = gyMin; gy <= gyMax; gy++) {
      const dy = gy + 0.5 - cy
      for (let gx = gxMin; gx <= gxMax; gx++) {
        const dx = gx + 0.5 - cx
        // lx: forward along heading, ly: lateral across wings
        const lx = dx * cosH + dy * sinH
        const ly = -dx * sinH + dy * cosH
        const absY = Math.abs(ly)
        const glyphHash = hashCreatureLocalGlyph(c.id, Math.round(lx * 2), Math.round(ly * 2))

        // Cephalic front lobes / horns ahead of the diamond disc
        if (
          lx >= (halfChordBase - 0.8 * sizeScale) &&
          lx <= (halfChordBase + 1.8 * sizeScale) &&
          absY >= 1.2 * sizeScale &&
          absY <= 2.4 * sizeScale
        ) {
          plotCell(gx, gy, 1, 0.9, 0.92, glyphHash)
          continue
        }

        // Thin whip tail behind the diamond body
        const tailStart = -halfChordBase + 0.6 * sizeScale
        const tailEnd = tailStart - tailLen
        if (lx < tailStart && lx >= tailEnd) {
          const tailProgress = (tailStart - lx) / tailLen // 0 at body, 1 at tip
          const tailSway = Math.sin(c.phase * 1.5 - tailProgress * 2.4) * 0.45 * tailProgress * sizeScale
          if (Math.abs(ly - tailSway) <= 0.52) {
            const tailShade = Math.max(0.28, 0.72 * (1 - tailProgress * 0.6))
            plotCell(gx, gy, 0, tailShade, 0.85, glyphHash)
            continue
          }
        }

        // Wide diamond pectoral wings (24 to 32 cells wide)
        if (absY <= halfSpan + 0.35) {
          const spanRatio = absY / Math.max(1, halfSpan) // 0 at spine, 1 at wingtip
          const centerX = spanRatio * wingSweep - spanRatio * 0.9 * sizeScale
          const halfLenAtY = halfChordBase * Math.pow(Math.max(0, 1 - spanRatio), 0.78)
          const distFromWingCenter = Math.abs(lx - centerX)

          if (distFromWingCenter <= halfLenAtY) {
            // Lighter belly / central stripe running down the middle of the manta
            const isBellyStripe =
              absY <= 1.35 * sizeScale &&
              lx >= -halfChordBase * 0.68 &&
              lx <= halfChordBase * 0.78
            if (isBellyStripe) {
              plotCell(gx, gy, 1, 0.98, 1.0, glyphHash)
              continue
            }

            const chordRatio = distFromWingCenter / Math.max(0.4, halfLenAtY)
            const edgeFactor = Math.max(spanRatio, chordRatio)
            const coverage = edgeFactor > 0.84 ? 0.64 : edgeFactor > 0.7 ? 0.84 : 1.0

            // Leading wing collar highlight vs main wing vs trailing edge
            const isLeadingCollar = lx - centerX > halfLenAtY * 0.42 && spanRatio < 0.72
            const wingShade =
              0.88 - spanRatio * 0.38 - chordRatio * 0.16 + flapWave * spanRatio * 0.16 - (isDiving ? 0.12 : 0)
            const shade = isLeadingCollar
              ? 0.92
              : Math.max(0.24, Math.min(0.82, wingShade))
            const rampIndex =
              isDiving && spanRatio > 0.58
                ? 2
                : isLeadingCollar || spanRatio < 0.22
                  ? 1
                  : 0
            plotCell(gx, gy, rampIndex, shade, coverage, glyphHash)
          }
        }
      }
    }
  },
}
