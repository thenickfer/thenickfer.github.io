import type { Creature, PlotCellFn, SpeciesDefinition } from './types.ts'
import {
  applyFearAndRecoverySpeed,
  applySteeringForce,
  hashCreatureLocalGlyph,
  pickSafeSpawnPosition,
  steerAngleDamped,
  valueNoise2D,
  wrapOrBounceBounds,
} from './types.ts'

const TENTACLE_TRAIL_NODES = 7

export const jellyfishSpecies: SpeciesDefinition = {
  id: 'jellyfish',
  countRange: [4, 7],
  speedRange: [15, 40],
  defaultClickBehavior: 'scatter',
  getRamps: (palette) => [palette.violet],

  spawn(count, width, height, cell, scale, avoidRects, rng) {
    const speedScale = cell / 8
    const sizeScale = Math.max(0.5, scale)
    const creatures: Creature[] = []
    for (let i = 0; i < count; i++) {
      const widthCells = 12 + Math.floor(rng() * 3) // 12 to 14 cells wide bell
      const numTentacles = 5 + Math.floor(rng() * 4) // 5 to 8 tentacles
      const collisionRadius = widthCells * 0.72 * cell * sizeScale
      const pos = pickSafeSpawnPosition(
        width,
        height,
        cell,
        avoidRects,
        rng,
        Math.ceil(widthCells * 0.95 * sizeScale),
        creatures,
      )
      const heading = -Math.PI * 0.5 + (rng() - 0.5) * 0.45
      const minSpeed = 15 * speedScale
      const maxSpeed = 40 * speedScale
      const baseSpeed = minSpeed + rng() * (maxSpeed - minSpeed)

      const spineX = new Float32Array(TENTACLE_TRAIL_NODES)
      const spineY = new Float32Array(TENTACLE_TRAIL_NODES)
      const stepPx = 1.65 * cell * sizeScale
      const cosH = Math.cos(heading)
      const sinH = Math.sin(heading)
      for (let s = 0; s < TENTACLE_TRAIL_NODES; s++) {
        spineX[s] = pos.x - cosH * (1.2 + s * 1.65) * cell * sizeScale
        spineY[s] = pos.y - sinH * (1.2 + s * 1.65) * cell * sizeScale + s * stepPx * 0.05
      }

      creatures.push({
        id: i,
        species: 'jellyfish',
        x: pos.x,
        y: pos.y,
        vx: cosH * baseSpeed * 0.65,
        vy: sinH * baseSpeed * 0.65,
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
        phaseSpeed: (Math.PI * 2) / 2.5,
        lengthCells: 18,
        widthCells,
        seed: Math.floor(rng() * 100000),
        schoolId: numTentacles,
        fearTimer: 0,
        fearDuration: 0,
        recoveryTimer: 0,
        fearPeakSpeed: baseSpeed,
        stateTimer: 0,
        stateMode: 0,
        auxTimer: rng() * 0.35,
        spineX,
        spineY,
      })
    }
    return creatures
  },

  onScatterCreature(c) {
    // Store escape heading in desiredHeading so the bell curves smoothly toward escape direction
    c.desiredHeading = Math.atan2(c.vy, c.vx)
  },

  update(creatures, dt, env) {
    const { width, height, cell, scale, time } = env
    const speedScale = cell / 8
    const sizeScale = Math.max(0.5, scale)

    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i]!
      // Bell animation remains periodic and independent of horizontal steering;
      // faster pulse while fleeing, smoothly easing back to normal cadence
      const fearBlend =
        c.fearTimer > 0 ? Math.min(1, c.fearTimer / Math.max(0.4, c.fearDuration * 0.5)) : 0
      const pulseMultiplier = 1.0 + 1.55 * fearBlend
      c.phase = (c.phase + dt * c.phaseSpeed * pulseMultiplier) % (Math.PI * 2)

      const wave = Math.sin(c.phase)
      // Smooth continuous contraction envelope (C1 smooth at wave = 0)
      const contraction = wave > 0 ? Math.pow(wave, 1.35) : 0
      const relaxation = wave < 0 ? Math.pow(-wave, 1.15) : 0

      // Smooth horizontal drift and gentle bell tilt
      const driftNoise = valueNoise2D(time * 0.16 + i * 2.3, c.seed * 0.01, c.seed)
      const secondaryDrift = Math.sin(time * 0.28 + c.seed * 0.1) * 0.25
      const horizontalDriftVx = (driftNoise * 0.75 + secondaryDrift) * c.minSpeed * 0.95

      let desiredVx: number
      let desiredVy: number
      let targetHeading: number

      if (c.fearTimer <= 0) {
        // Gentle bell tilt loosely tracks horizontal drift while staying mostly upright
        const tiltAngle = (driftNoise * 0.32 + secondaryDrift * 0.22)
        targetHeading = -Math.PI * 0.5 + tiltAngle
        steerAngleDamped(c, targetHeading, 0.95, 2.0, dt)

        // Continuous vertical cycle: gradual upward propulsion during bell contraction,
        // slow sinking between contractions
        const upwardThrust =
          (c.minSpeed * 0.35 + (c.maxSpeed * 1.08 - c.minSpeed * 0.35) * contraction) *
          contraction
        const slowSink = (7.5 + 6.5 * relaxation) * speedScale * (1 - contraction * 0.85)

        const rawVx = Math.cos(c.heading) * upwardThrust + horizontalDriftVx * (0.55 + 0.45 * relaxation)
        const rawVy = Math.sin(c.heading) * upwardThrust + slowSink
        const rawSpeed = Math.hypot(rawVx, rawVy) || 1
        const recoveredSpeed = applyFearAndRecoverySpeed(c, rawSpeed, dt)
        const scaleRatio = recoveredSpeed / rawSpeed
        desiredVx = rawVx * scaleRatio
        desiredVy = rawVy * scaleRatio
      } else {
        // Gradual fleeing acceleration with faster pulse modulation
        const fleeSpeed =
          applyFearAndRecoverySpeed(c, c.maxSpeed * 1.95, dt) * (0.82 + 0.32 * contraction)
        const fleeHeading = c.desiredHeading
        steerAngleDamped(c, fleeHeading, 2.2, 3.2, dt)
        desiredVx = Math.cos(c.heading) * fleeSpeed
        desiredVy = Math.sin(c.heading) * fleeSpeed
      }

      // Soft plate avoidance + soft inter-creature avoidance
      const plateAvoid = env.computeAvoidance(
        c.x,
        c.y,
        c.vx,
        c.vy,
        c.maxSpeed,
        c.collisionRadius,
      )
      const creatureAvoid = env.computeCreatureAvoidance(i, creatures, 0.55)
      const totalExtraAx = plateAvoid.ax + creatureAvoid.ax
      const totalExtraAy = plateAvoid.ay + creatureAvoid.ay

      const maxSteerSpeed = c.fearTimer > 0 ? c.maxSpeed * 2.8 : c.maxSpeed * 1.15
      const maxAccel = c.fearTimer > 0 ? c.maxSpeed * 4.2 : c.maxSpeed * 2.1
      const gain = c.fearTimer > 0 ? 3.4 : 2.3

      applySteeringForce(
        c,
        desiredVx,
        desiredVy,
        maxAccel,
        maxSteerSpeed,
        gain,
        dt,
        totalExtraAx,
        totalExtraAy,
      )

      wrapOrBounceBounds(c, width, height, cell * 10 * sizeScale, dt)

      const curSpeed = Math.hypot(c.vx, c.vy)
      const cap = c.fearTimer > 0 ? c.maxSpeed * 2.8 : c.maxSpeed * 1.15
      if (curSpeed > cap && curSpeed > 0) {
        c.vx = (c.vx / curSpeed) * cap
        c.vy = (c.vy / curSpeed) * cap
      }

      c.x += c.vx * dt
      c.y += c.vy * dt

      // Update delayed tentacle trail spine behind the bell rim so tentacles lag and curve organically
      const cosH = Math.cos(c.heading)
      const sinH = Math.sin(c.heading)
      const bellRimOffset = (-1.2 - contraction * 0.3) * cell * sizeScale
      c.spineX[0] = c.x + cosH * bellRimOffset
      c.spineY[0] = c.y + sinH * bellRimOffset

      const segDist = 1.65 * cell * sizeScale
      for (let s = 1; s < TENTACLE_TRAIL_NODES; s++) {
        const prevX = c.spineX[s - 1]!
        const prevY = c.spineY[s - 1]!
        // Desired rest point slightly behind prev node along current bell axis
        const restX = prevX - cosH * segDist
        const restY = prevY - sinH * segDist + 0.18 * segDist
        const followAlpha = 1 - Math.exp(-(7.5 - s * 0.65) * dt)
        c.spineX[s] = c.spineX[s]! + (restX - c.spineX[s]!) * followAlpha
        c.spineY[s] = c.spineY[s]! + (restY - c.spineY[s]!) * followAlpha

        // Enforce soft segment tether length so tentacles don't stretch unnaturally
        const dx = c.spineX[s]! - prevX
        const dy = c.spineY[s]! - prevY
        const d = Math.hypot(dx, dy) || 1
        if (d > segDist * 1.25 || d < segDist * 0.65) {
          const clampedD = Math.max(segDist * 0.65, Math.min(segDist * 1.25, d))
          c.spineX[s] = prevX + (dx / d) * clampedD
          c.spineY[s] = prevY + (dy / d) * clampedD
        }
      }

      c.auxTimer -= dt
      if (c.auxTimer <= 0) {
        c.auxTimer = 0.28 + env.rng() * 0.24
        const tailIdx = TENTACLE_TRAIL_NODES - 1
        const tipX =
          (c.spineX[tailIdx] ?? c.x) + (env.rng() - 0.5) * cell * 3.5 * sizeScale
        const tipY = c.spineY[tailIdx] ?? c.y
        const glyphs = ['.', ':', '-', '+'] as const
        const glyph = glyphs[Math.floor(env.rng() * glyphs.length)]!
        env.emitWake(tipX, tipY, glyph, 0.6)
      }
    }
  },

  renderCreature(c, cell, scale, time, plotCell: PlotCellFn) {
    const cx = c.x / cell
    const cy = c.y / cell
    const cosH = Math.cos(c.heading)
    const sinH = Math.sin(c.heading)

    const contraction = Math.max(0, Math.sin(c.phase))
    // Bell 12 to 14 cells wide (half-width 6.0 to 7.0 cells), contracting slightly on thrust
    const bellHalfW = (c.widthCells * 0.5) * (1.04 - contraction * 0.18)
    const bellTop = 5.8 + contraction * 0.7
    const bellRim = -1.2 - contraction * 0.3
    const numTentacles = Math.max(5, Math.min(8, c.schoolId))
    const nx = -sinH
    const ny = cosH

    // 1. Scan only the bell bounding box (much tighter than full tentacle reach)
    const bellRadius = Math.ceil((bellHalfW + 1.5) * scale)
    const gxMin = Math.floor(cx - bellRadius)
    const gxMax = Math.ceil(cx + bellRadius)
    const gyMin = Math.floor(cy - bellRadius)
    const gyMax = Math.ceil(cy + bellRadius)

    for (let gy = gyMin; gy <= gyMax; gy++) {
      const dy = (gy + 0.5 - cy) / scale
      for (let gx = gxMin; gx <= gxMax; gx++) {
        const dx = (gx + 0.5 - cx) / scale
        // lx: forward toward bell apex, ly: lateral across bell width
        const lx = dx * cosH + dy * sinH
        const ly = -dx * sinH + dy * cosH
        const absY = Math.abs(ly)
        if (absY > bellHalfW + 0.4) continue

        // Frilled lower edge wave along the bottom of the bell
        const frillWave = Math.sin(ly * 1.85 + c.seed) * 0.58
        const effectiveRim = bellRim + frillWave * 0.6

        if (lx >= effectiveRim && lx <= bellTop) {
          const hNorm = Math.max(0, Math.min(1, (lx - bellRim) / (bellTop - bellRim)))
          const allowedHalfW = bellHalfW * Math.sqrt(Math.max(0, 1 - Math.pow(hNorm, 1.85)))

          if (absY <= allowedHalfW + 0.35) {
            const glyphHash = hashCreatureLocalGlyph(c.id, Math.round(lx), Math.round(ly))
            const distFromOuterArch = allowedHalfW - absY
            const distFromLowerFrill = lx - effectiveRim

            // Lighter rim around dome perimeter and frilled lower edge; darker core inside
            const isLighterRim =
              (distFromOuterArch <= 1.65 && hNorm >= 0.14) || distFromLowerFrill <= 1.25
            const isOuterDitherEdge = distFromOuterArch < 0.25 || distFromLowerFrill < 0.35

            const coverage = isOuterDitherEdge ? 0.68 : 1.0
            let shade: number
            if (isLighterRim) {
              // Brightest solid tile rim & frilled lower margin
              shade = distFromOuterArch < 0.35 ? 0.72 : 0.94
            } else {
              // Darker translucent core inside the bell
              const coreDepth = Math.min(1, distFromOuterArch / Math.max(1.5, bellHalfW * 0.7))
              shade = Math.max(0.28, 0.56 - coreDepth * 0.22)
            }

            plotCell(gx, gy, 0, shade, coverage, glyphHash)
          }
        }
      }
    }

    // 2. Plot 5 to 8 thin tentacles following the delayed spine trail with wave-like response
    const tentacleHalfSpan = bellHalfW * 0.54
    const hasTrail = c.spineX.length >= TENTACLE_TRAIL_NODES

    for (let t = 0; t < numTentacles; t++) {
      const tRatio = numTentacles > 1 ? t / (numTentacles - 1) : 0.5
      const baseY = (tRatio * 2 - 1) * tentacleHalfSpan
      // Deterministic varied length per tentacle (6.5 to 12.0 cells)
      const tLen = 6.5 + ((c.seed + t * 19) % 6)
      const stepIncrement = 0.82 / Math.max(0.5, scale)

      for (let depth = 0.5; depth <= tLen; depth += stepIncrement) {
        const depthRatio = depth / tLen
        const sway =
          Math.sin(time * 2.5 - depth * 0.52 + t * 0.85 + (c.seed % 13)) *
          (0.32 + depthRatio * 0.62)

        let worldX: number
        let worldY: number
        if (hasTrail) {
          const trailFloat = Math.min(
            TENTACLE_TRAIL_NODES - 1.001,
            (depth / 12.0) * (TENTACLE_TRAIL_NODES - 1),
          )
          const idx = Math.floor(trailFloat)
          const frac = trailFloat - idx
          const sx = c.spineX[idx]! + (c.spineX[idx + 1]! - c.spineX[idx]!) * frac
          const sy = c.spineY[idx]! + (c.spineY[idx + 1]! - c.spineY[idx]!) * frac
          const lyPx = (baseY + sway) * scale * cell
          worldX = sx + nx * lyPx
          worldY = sy + ny * lyPx
        } else {
          const lx = (bellRim - depth) * scale
          const ly = (baseY + sway) * scale
          worldX = (cx + cosH * lx + nx * ly) * cell
          worldY = (cy + sinH * lx + ny * ly) * cell
        }

        const gx = Math.floor(worldX / cell)
        const gy = Math.floor(worldY / cell)
        const glyphHash = hashCreatureLocalGlyph(c.id, -Math.round(depth) - 10, t)
        const shade = depthRatio < 0.45 ? 0.58 : 0.3
        const coverage = depthRatio > 0.82 ? 0.65 : 0.95
        plotCell(gx, gy, 0, shade, coverage, glyphHash)
      }
    }
  },
}
