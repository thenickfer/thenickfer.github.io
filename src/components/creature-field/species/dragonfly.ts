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

export const dragonflySpecies: SpeciesDefinition = {
  id: 'dragonfly',
  countRange: [5, 8],
  speedRange: [150, 300],
  defaultClickBehavior: 'scatter',
  getRamps: (palette) => [palette.cobaltLight, palette.cobalt, palette.text],

  spawn(count, width, height, cell, scale, avoidRects, rng) {
    const speedScale = cell / 8
    const sizeScale = Math.max(0.5, scale)
    const creatures: Creature[] = []
    for (let i = 0; i < count; i++) {
      const lengthCells = Math.max(12, Math.round((18 + Math.floor(rng() * 5)) * sizeScale)) // 18 to 22 cells long
      const widthCells = Math.max(12, Math.round((18 + Math.floor(rng() * 5)) * sizeScale)) // 18 to 22 cells wingspan
      const collisionRadius = Math.max(lengthCells, widthCells) * 0.48 * cell
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
      const minSpeed = 150 * speedScale
      const maxSpeed = 300 * speedScale
      const baseSpeed = minSpeed + rng() * (maxSpeed - minSpeed)
      // Distribute initial states across hover (0), cruise (1), and dart (2)
      const initialMode = i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0
      const initialSpeed =
        initialMode === 2 ? baseSpeed : initialMode === 1 ? minSpeed * 0.72 : minSpeed * 0.1

      creatures.push({
        id: i,
        species: 'dragonfly',
        x: pos.x,
        y: pos.y,
        vx: Math.cos(heading) * initialSpeed,
        vy: Math.sin(heading) * initialSpeed,
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
        phaseSpeed: 28 + rng() * 8,
        lengthCells,
        widthCells,
        seed: Math.floor(rng() * 100000),
        schoolId: 0,
        fearTimer: 0,
        fearDuration: 0,
        recoveryTimer: 0,
        fearPeakSpeed: maxSpeed,
        stateTimer: initialMode === 2 ? 0.55 + rng() * 0.45 : 0.6 + rng() * 1.0,
        stateMode: initialMode, // 0: hover, 1: cruise, 2: dart
        auxTimer: 0.04,
        spineX: new Float32Array(0),
        spineY: new Float32Array(0),
      })
    }
    return creatures
  },

  onScatterCreature(c, rng) {
    // Enter fast dart state and set desiredHeading to the scatter escape direction
    c.stateMode = 2
    c.stateTimer = 0.85 + rng() * 0.55
    c.desiredHeading = Math.atan2(c.vy, c.vx)
  },

  update(creatures, dt, env) {
    const { width, height, cell, scale, time } = env
    const sizeScale = Math.max(0.75, scale)
    const margin = cell * 11 * sizeScale

    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i]!
      c.phase += dt * c.phaseSpeed

      if (c.fearTimer > 0) {
        c.stateMode = 2
      } else {
        c.stateTimer -= dt
        if (c.stateTimer <= 0) {
          if (c.stateMode === 0) {
            // Hover -> Cruise or Curved Dart
            const nextIsDart = env.rng() < 0.65
            c.stateMode = nextIsDart ? 2 : 1
            c.stateTimer = nextIsDart ? 0.5 + env.rng() * 0.55 : 0.45 + env.rng() * 0.5
            const turn = (env.rng() - 0.5) * Math.PI * (nextIsDart ? 0.95 : 0.6)
            c.desiredHeading = normalizeAngle(c.heading + turn)
            c.baseSpeed = c.minSpeed + env.rng() * (c.maxSpeed - c.minSpeed)
          } else if (c.stateMode === 1) {
            // Cruise -> Dart or Hover
            const nextIsDart = env.rng() < 0.55
            c.stateMode = nextIsDart ? 2 : 0
            c.stateTimer = nextIsDart ? 0.5 + env.rng() * 0.5 : 0.6 + env.rng() * 1.15
            if (nextIsDart) {
              const turn = (env.rng() - 0.5) * Math.PI * 0.75
              c.desiredHeading = normalizeAngle(c.heading + turn)
              c.baseSpeed = c.minSpeed + env.rng() * (c.maxSpeed - c.minSpeed)
            }
          } else {
            // Dart -> Cruise or Hover (smooth deceleration)
            const nextIsCruise = env.rng() < 0.42
            c.stateMode = nextIsCruise ? 1 : 0
            c.stateTimer = nextIsCruise ? 0.38 + env.rng() * 0.42 : 0.55 + env.rng() * 1.25
            if (nextIsCruise) {
              c.desiredHeading = normalizeAngle(c.heading + (env.rng() - 0.5) * 0.65)
            }
          }
        }
      }

      // Gentle curvature variation during cruise and dart so flight paths form graceful arcs
      const curveWeave =
        valueNoise2D(time * 0.9 + i * 5.1, c.seed * 0.01, c.seed) *
        (c.stateMode === 2 ? 0.75 : c.stateMode === 1 ? 1.1 : 0.35)

      // Smooth inward steering near viewport boundaries so heading curves away from walls
      let boundAx = 0
      let boundAy = 0
      if (c.x < margin) boundAx = ((margin - c.x) / margin) * c.maxSpeed * 2.4
      else if (c.x > width - margin) boundAx = -((c.x - (width - margin)) / margin) * c.maxSpeed * 2.4
      if (c.y < margin) boundAy = ((margin - c.y) / margin) * c.maxSpeed * 2.4
      else if (c.y > height - margin) boundAy = -((c.y - (height - margin)) / margin) * c.maxSpeed * 2.4

      const plateAvoid = env.computeAvoidance(
        c.x,
        c.y,
        c.vx,
        c.vy,
        c.maxSpeed,
        c.collisionRadius,
      )
      const creatureAvoid = env.computeCreatureAvoidance(i, creatures, 0.38)
      const avoidAx = plateAvoid.ax * 1.25 + creatureAvoid.ax + boundAx
      const avoidAy = plateAvoid.ay * 1.25 + creatureAvoid.ay + boundAy

      let targetHeading = normalizeAngle(c.desiredHeading + curveWeave * dt)
      if (Math.hypot(avoidAx, avoidAy) > c.minSpeed * 0.25) {
        const avoidAngle = Math.atan2(c.vy + avoidAy * 0.25, c.vx + avoidAx * 0.25)
        const diff = normalizeAngle(avoidAngle - targetHeading)
        targetHeading = normalizeAngle(targetHeading + diff * Math.min(1, dt * 4.5))
        c.desiredHeading = targetHeading
      }

      // Critically damped angular steering: limits angular velocity so darts curve smoothly
      const maxTurnRate = c.fearTimer > 0 ? 4.2 : c.stateMode === 2 ? 3.2 : c.stateMode === 1 ? 2.6 : 1.8
      const turnResponsiveness = c.stateMode === 2 ? 4.5 : 3.4
      steerAngleDamped(c, targetHeading, maxTurnRate, turnResponsiveness, dt)

      // Target cruising/darting/hovering speed with smooth state transitions
      let rawTargetSpeed: number
      if (c.fearTimer > 0) {
        rawTargetSpeed = c.maxSpeed * 2.5
      } else if (c.stateMode === 2) {
        rawTargetSpeed = c.baseSpeed
      } else if (c.stateMode === 1) {
        rawTargetSpeed = c.minSpeed * 0.72
      } else {
        rawTargetSpeed = c.minSpeed * 0.07
      }

      const targetSpeed = applyFearAndRecoverySpeed(c, rawTargetSpeed, dt)

      let desiredVx: number
      let desiredVy: number
      if (c.stateMode === 0 && c.fearTimer <= 0) {
        // Hover with subtle positional micro-corrections and smooth deceleration from prior flight
        const hoverDriftVx =
          Math.cos(time * 2.6 + c.seed) * c.minSpeed * 0.065 +
          Math.cos(c.heading) * c.minSpeed * 0.04
        const hoverDriftVy =
          Math.sin(time * 3.1 + c.seed * 0.7) * c.minSpeed * 0.065 +
          Math.sin(c.heading) * c.minSpeed * 0.04
        desiredVx = hoverDriftVx
        desiredVy = hoverDriftVy
      } else {
        desiredVx = Math.cos(c.heading) * targetSpeed
        desiredVy = Math.sin(c.heading) * targetSpeed
      }

      const maxSteerSpeed = c.fearTimer > 0 ? c.maxSpeed * 2.85 : c.maxSpeed * 1.05
      const maxAccel =
        c.fearTimer > 0
          ? c.maxSpeed * 5.2
          : c.stateMode === 2
            ? c.maxSpeed * 3.6
            : c.stateMode === 1
              ? c.maxSpeed * 2.8
              : c.maxSpeed * 3.1
      const gain = c.stateMode === 0 ? 4.2 : 4.6

      applySteeringForce(
        c,
        desiredVx,
        desiredVy,
        maxAccel,
        maxSteerSpeed,
        gain,
        dt,
        avoidAx,
        avoidAy,
      )

      wrapOrBounceBounds(c, width, height, margin, dt)

      const curSpeed = Math.hypot(c.vx, c.vy)
      const cap = c.fearTimer > 0 ? c.maxSpeed * 2.85 : c.maxSpeed * 1.05
      if (curSpeed > cap && curSpeed > 0) {
        c.vx = (c.vx / curSpeed) * cap
        c.vy = (c.vy / curSpeed) * cap
      }

      // Gently align body heading with actual velocity vector during high-speed flight without snapping
      if (curSpeed > c.minSpeed * 0.35) {
        const velAngle = Math.atan2(c.vy, c.vx)
        steerAngleDamped(c, velAngle, maxTurnRate, 3.8, dt * 0.55)
      }

      c.x += c.vx * dt
      c.y += c.vy * dt

      // Fading trail of dim characters reflecting the actual curved flight trajectory
      if (curSpeed > c.minSpeed * 0.42) {
        c.auxTimer -= dt
        if (c.auxTimer <= 0) {
          c.auxTimer = 0.042 + env.rng() * 0.026
          const tailOffset = (c.lengthCells * 0.62) * cell
          const velAngle = Math.atan2(c.vy, c.vx)
          const tailX = c.x - Math.cos(velAngle) * tailOffset
          const tailY = c.y - Math.sin(velAngle) * tailOffset
          const glyphs = ['-', ':', '.', '+'] as const
          const glyph = glyphs[Math.floor(env.rng() * glyphs.length)]!
          env.emitWake(tailX, tailY, glyph, 0.62)
        }
      }
    }
  },

  renderCreature(c, cell, scale, _time, plotCell: PlotCellFn) {
    const cx = c.x / cell
    const cy = c.y / cell
    const cosH = Math.cos(c.heading)
    const sinH = Math.sin(c.heading)
    const sizeScale = Math.max(0.5, scale)

    const headFront = 4.2 * sizeScale
    const tailBack = -(c.lengthCells - headFront)
    const halfSpan = c.widthCells * 0.5 // 9..11 cells per side at scale 1
    const hindSpan = halfSpan * 0.86

    const radius = Math.ceil(Math.max(Math.abs(tailBack), halfSpan, headFront)) + 2
    const gxMin = Math.floor(cx - radius)
    const gxMax = Math.ceil(cx + radius)
    const gyMin = Math.floor(cy - radius)
    const gyMax = Math.ceil(cy + radius)

    // Two distinct white eye cells (rampIndex = 2) at the head
    const eyeFwd = headFront - 0.35 * sizeScale
    const eyeLat = 0.78 * sizeScale
    const eye1Gx = Math.floor(cx + eyeFwd * cosH - (-eyeLat) * sinH)
    const eye1Gy = Math.floor(cy + eyeFwd * sinH + (-eyeLat) * cosH)
    const eye2Gx = Math.floor(cx + eyeFwd * cosH - eyeLat * sinH)
    const eye2Gy = Math.floor(cy + eyeFwd * sinH + eyeLat * cosH)
    plotCell(eye1Gx, eye1Gy, 2, 1.0, 1.0, hashCreatureLocalGlyph(c.id, 40, -2))
    plotCell(eye2Gx, eye2Gy, 2, 1.0, 1.0, hashCreatureLocalGlyph(c.id, 40, 2))

    for (let gy = gyMin; gy <= gyMax; gy++) {
      const dy = gy + 0.5 - cy
      for (let gx = gxMin; gx <= gxMax; gx++) {
        if ((gx === eye1Gx && gy === eye1Gy) || (gx === eye2Gx && gy === eye2Gy)) continue
        const dx = gx + 0.5 - cx
        // lx: forward along heading, ly: lateral across wings
        const lx = dx * cosH + dy * sinH
        const ly = -dx * sinH + dy * cosH
        const absY = Math.abs(ly)
        const glyphHash = hashCreatureLocalGlyph(c.id, Math.round(lx * 2), Math.round(ly * 2))

        // Thorax (wider muscular section behind head, lx in [0.4*s, headFront - 0.5*s])
        if (lx >= 0.4 * sizeScale && lx <= headFront - 0.4 * sizeScale && absY <= 1.05 * sizeScale) {
          const isCore = absY <= 0.52 * sizeScale
          plotCell(gx, gy, 0, isCore ? 0.96 : 0.74, 1.0, glyphHash)
          continue
        }

        // Long segmented abdomen in two alternating shades (lx from tailBack to 0.4*s)
        if (lx >= tailBack && lx < 0.4 * sizeScale && absY <= 0.62 * sizeScale) {
          const segIndex = Math.floor((lx - tailBack) / (1.45 * sizeScale))
          const isAltLight = (segIndex & 1) === 0
          const isTailTip = lx < tailBack + 1.4 * sizeScale
          const shade = isTailTip ? 0.58 : isAltLight ? 0.92 : 0.52
          const rampIndex = isAltLight ? 0 : 1
          plotCell(gx, gy, rampIndex, shade, isTailTip ? 0.85 : 1.0, glyphHash)
          continue
        }

        // Four dim wings (2 forewings + 2 hindwings) each with a light leading vein line
        if (absY >= 0.85 * sizeScale && absY <= halfSpan + 0.4) {
          const foreNorm = Math.min(1.2, (absY - 0.8 * sizeScale) / Math.max(1, halfSpan - 0.8 * sizeScale))
          const foreCenter = (2.15 + foreNorm * 1.55) * sizeScale
          const foreHalfChord = (1.42 * (1 - 0.36 * foreNorm)) * sizeScale
          const inForewing =
            absY <= halfSpan && Math.abs(lx - foreCenter) <= foreHalfChord

          const hindNorm = Math.min(1.2, (absY - 0.8 * sizeScale) / Math.max(1, hindSpan - 0.8 * sizeScale))
          const hindCenter = (-0.65 - hindNorm * 1.65) * sizeScale
          const hindHalfChord = (1.55 * (1 - 0.38 * hindNorm)) * sizeScale
          const inHindwing =
            absY <= hindSpan && Math.abs(lx - hindCenter) <= hindHalfChord

          if (inForewing) {
            const veinLine = foreCenter + foreHalfChord * 0.42
            const isLightVein = Math.abs(lx - veinLine) <= 0.48
            if (isLightVein) {
              plotCell(gx, gy, 0, 0.74, 0.96, glyphHash)
            } else {
              plotCell(gx, gy, 0, 0.28, 0.8, glyphHash)
            }
            continue
          }

          if (inHindwing) {
            const veinLine = hindCenter + hindHalfChord * 0.42
            const isLightVein = Math.abs(lx - veinLine) <= 0.48
            if (isLightVein) {
              plotCell(gx, gy, 0, 0.72, 0.94, glyphHash)
            } else {
              plotCell(gx, gy, 1, 0.28, 0.78, glyphHash)
            }
          }
        }
      }
    }
  },
}
