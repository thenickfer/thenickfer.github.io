import type { Creature, PlotCellFn, SpeciesDefinition } from './types.ts'
import {
  applyFearAndRecoverySpeed,
  applySteeringForce,
  easeInOutCubic,
  hashCreatureLocalGlyph,
  normalizeAngle,
  pickSafeSpawnPosition,
  steerAngleDamped,
  valueNoise2D,
  wrapOrBounceBounds,
} from './types.ts'

const MAX_SCHOOLS = 4
const schoolCentroidX = new Float32Array(MAX_SCHOOLS)
const schoolCentroidY = new Float32Array(MAX_SCHOOLS)
const schoolVelX = new Float32Array(MAX_SCHOOLS)
const schoolVelY = new Float32Array(MAX_SCHOOLS)
const schoolCountBuf = new Int32Array(MAX_SCHOOLS)
const schoolInitialized = new Uint8Array(MAX_SCHOOLS)

export const fishSchoolSpecies: SpeciesDefinition = {
  id: 'fish-school',
  countRange: [1, 2],
  speedRange: [80, 140],
  defaultClickBehavior: 'scatter',
  getRamps: (palette) => [palette.muted, palette.cobaltLight, palette.text],

  spawn(count, width, height, cell, scale, avoidRects, rng) {
    const speedScale = cell / 8
    const sizeScale = Math.max(0.5, scale)
    const areaRatio = (width * height) / 1_300_000
    const schoolCount = count <= 4 ? Math.max(1, count) : areaRatio >= 0.85 ? 2 : 1
    // Reduced by ~1/3 from 30..60 (base 45) to 20..40 (base 30) so 4-5 cell fish do not crowd the screen
    const fishPerSchool =
      count > 4
        ? Math.max(1, Math.round(count / schoolCount))
        : Math.max(20, Math.min(40, Math.round(30 * Math.max(0.68, Math.min(1.25, areaRatio)))))

    schoolInitialized.fill(0)
    const creatures: Creature[] = []
    let idCounter = 0
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))

    for (let s = 0; s < schoolCount; s++) {
      const rawCenter = pickSafeSpawnPosition(
        width,
        height,
        cell,
        avoidRects,
        rng,
        Math.ceil(18 * sizeScale),
      )
      const schoolHeading = rng() * Math.PI * 2 - Math.PI
      const spacingStep = cell * 5.2 * sizeScale
      const maxSpiralR = Math.sqrt(fishPerSchool + 1) * spacingStep + cell * 4 * sizeScale
      const centerX = Math.max(
        Math.min(width * 0.45, maxSpiralR),
        Math.min(Math.max(width * 0.55, width - maxSpiralR), rawCenter.x),
      )
      const centerY = Math.max(
        Math.min(height * 0.45, maxSpiralR),
        Math.min(Math.max(height * 0.55, height - maxSpiralR), rawCenter.y),
      )

      for (let f = 0; f < fishPerSchool; f++) {
        // Golden-angle spiral distribution so fish start well-separated within the school
        const angle = f * goldenAngle
        const dist = Math.sqrt(f + 0.75) * spacingStep
        const x = centerX + Math.cos(angle) * dist
        const y = centerY + Math.sin(angle) * dist
        const heading = normalizeAngle(schoolHeading + (rng() - 0.5) * 0.24)
        const minSpeed = 80 * speedScale
        const maxSpeed = 140 * speedScale
        const baseSpeed = minSpeed + (0.25 + 0.55 * rng()) * (maxSpeed - minSpeed)
        const lengthCells = Math.max(4, Math.round((rng() < 0.55 ? 5 : 4) * sizeScale)) // 4 to 5 cells long
        const widthCells = Math.max(2, Math.round(2 * sizeScale))
        const collisionRadius = lengthCells * 0.48 * cell

        creatures.push({
          id: idCounter++,
          species: 'fish-school',
          x,
          y,
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
          phaseSpeed: 10 + rng() * 4,
          lengthCells,
          widthCells,
          seed: Math.floor(rng() * 100000),
          schoolId: s,
          fearTimer: 0,
          fearDuration: 0,
          recoveryTimer: 0,
          fearPeakSpeed: baseSpeed,
          stateTimer: 0, // Re-form timer (3 s after burst)
          stateMode: 0,
          auxTimer: rng() * 0.8,
          spineX: new Float32Array(0),
          spineY: new Float32Array(0),
        })
      }
    }

    return creatures
  },

  onScatterCreature(c) {
    // School bursts, then gradually re-forms over about 3 seconds
    c.stateTimer = 3.0
    c.stateMode = 1
    c.desiredHeading = Math.atan2(c.vy, c.vx)
  },

  update(creatures, dt, env) {
    const { width, height, cell, scale, time } = env
    const sizeScale = Math.max(0.75, scale)
    const sepRadius = cell * 6.4 * sizeScale
    const alignRadius = cell * 16 * sizeScale
    const cohRadius = cell * 26 * sizeScale
    const margin = cell * 10 * sizeScale
    const n = creatures.length

    // 1. Compute and exponentially smooth per-school centroid and velocity to prevent sudden centroid jumps
    schoolCountBuf.fill(0)
    const rawCx = new Float32Array(MAX_SCHOOLS)
    const rawCy = new Float32Array(MAX_SCHOOLS)
    const rawVx = new Float32Array(MAX_SCHOOLS)
    const rawVy = new Float32Array(MAX_SCHOOLS)

    for (let i = 0; i < n; i++) {
      const c = creatures[i]!
      const s = Math.max(0, Math.min(MAX_SCHOOLS - 1, c.schoolId))
      rawCx[s] = rawCx[s]! + c.x
      rawCy[s] = rawCy[s]! + c.y
      rawVx[s] = rawVx[s]! + c.vx
      rawVy[s] = rawVy[s]! + c.vy
      schoolCountBuf[s] = schoolCountBuf[s]! + 1
    }

    const centroidAlpha = 1 - Math.exp(-4.5 * dt)
    for (let s = 0; s < MAX_SCHOOLS; s++) {
      const cnt = schoolCountBuf[s]!
      if (cnt > 0) {
        const cx = rawCx[s]! / cnt
        const cy = rawCy[s]! / cnt
        const vx = rawVx[s]! / cnt
        const vy = rawVy[s]! / cnt
        if (schoolInitialized[s] === 0) {
          schoolCentroidX[s] = cx
          schoolCentroidY[s] = cy
          schoolVelX[s] = vx
          schoolVelY[s] = vy
          schoolInitialized[s] = 1
        } else {
          schoolCentroidX[s] = schoolCentroidX[s]! + (cx - schoolCentroidX[s]!) * centroidAlpha
          schoolCentroidY[s] = schoolCentroidY[s]! + (cy - schoolCentroidY[s]!) * centroidAlpha
          schoolVelX[s] = schoolVelX[s]! + (vx - schoolVelX[s]!) * centroidAlpha
          schoolVelY[s] = schoolVelY[s]! + (vy - schoolVelY[s]!) * centroidAlpha
        }
      }
    }

    for (let i = 0; i < n; i++) {
      const c = creatures[i]!
      c.phase += dt * c.phaseSpeed

      if (c.stateTimer > 0) {
        c.stateTimer = Math.max(0, c.stateTimer - dt)
        if (c.stateTimer === 0) c.stateMode = 0
      }

      // Gradual 3-second reformation after scatter burst
      const reformFactor =
        c.stateTimer > 0 ? easeInOutCubic(1 - c.stateTimer / 3.0) : 1.0

      // Query nearby fish via the spatial index
      const neighbors = env.queryNeighbors(c.x, c.y, cohRadius, i)
      const nIndices = neighbors.indices
      const nCount = neighbors.count

      let sepX = 0
      let sepY = 0
      let alignVx = 0
      let alignVy = 0
      let cohX = 0
      let cohY = 0
      let alignCount = 0
      let cohCount = 0

      for (let k = 0; k < nCount; k++) {
        const j = nIndices[k]!
        const other = creatures[j]!
        const dx = other.x - c.x
        const dy = other.y - c.y
        const distSq = dx * dx + dy * dy
        if (distSq <= 1e-4) continue
        const dist = Math.sqrt(distSq)

        // 1. Separation: soft repulsion from nearby fish, steeper inside personal space
        if (dist < sepRadius) {
          const t = 1 - dist / sepRadius
          const closeBoost = dist < cell * 4.4 * sizeScale ? 2.6 : 1.0
          const weight = ((t * (1.15 + 1.25 * t)) / dist) * closeBoost
          sepX -= dx * weight
          sepY -= dy * weight
        }

        if (other.schoolId !== c.schoolId) continue

        // 2. Alignment: match neighboring fish velocities
        if (dist < alignRadius) {
          alignVx += other.vx
          alignVy += other.vy
          alignCount++
        }

        // 3. Cohesion: move toward local group center
        cohX += other.x
        cohY += other.y
        cohCount++
      }

      const s = Math.max(0, Math.min(MAX_SCHOOLS - 1, c.schoolId))
      // School-wide smooth wandering current + subtle individual variation
      const schoolWave =
        valueNoise2D(time * 0.16 + s * 11, s * 3.7, s + 7) * 0.65 +
        Math.sin(time * 0.24 + s * 2.1) * 0.35
      const individualWeave =
        Math.sin(time * 1.45 + c.seed * 0.017) * 0.14

      const schoolMeanAngle = Math.atan2(schoolVelY[s]!, schoolVelX[s]!)
      const cruiseGuideAngle = normalizeAngle(schoolMeanAngle + (schoolWave + individualWeave) * 0.35)

      let desiredVx = Math.cos(cruiseGuideAngle) * c.baseSpeed
      let desiredVy = Math.sin(cruiseGuideAngle) * c.baseSpeed

      if (c.fearTimer > 0) {
        // During scatter burst, flee smoothly along scatter velocity direction
        const fleeSpeed = applyFearAndRecoverySpeed(c, c.maxSpeed * 2.2, dt)
        desiredVx = Math.cos(c.desiredHeading) * fleeSpeed
        desiredVy = Math.sin(c.desiredHeading) * fleeSpeed
      } else {
        // Blend Alignment
        if (alignCount > 0) {
          const meanAlignVx = alignVx / alignCount
          const meanAlignVy = alignVy / alignCount
          const alignWeight = 0.62 * reformFactor
          desiredVx = desiredVx * (1 - alignWeight) + meanAlignVx * alignWeight
          desiredVy = desiredVy * (1 - alignWeight) + meanAlignVy * alignWeight
        }

        // Blend local Cohesion + smoothed school centroid pull so the school stays recognizable
        if (cohCount > 0) {
          const localCenterX = cohX / cohCount
          const localCenterY = cohY / cohCount
          const targetCenterX = localCenterX * 0.65 + schoolCentroidX[s]! * 0.35
          const targetCenterY = localCenterY * 0.65 + schoolCentroidY[s]! * 0.35
          const toCenterX = targetCenterX - c.x
          const toCenterY = targetCenterY - c.y
          const toCenterDist = Math.hypot(toCenterX, toCenterY)
          if (toCenterDist > sepRadius * 0.75) {
            const cohPull =
              Math.min(c.baseSpeed * 0.85, toCenterDist * 0.65) * reformFactor
            desiredVx += (toCenterX / toCenterDist) * cohPull
            desiredVy += (toCenterY / toCenterDist) * cohPull
          }
        }
      }

      // Normalize desired cruise+alignment+cohesion speed into species cruising range
      const rawDesiredMag = Math.hypot(desiredVx, desiredVy) || 1
      const clampedCruiseSpeed = Math.max(
        c.minSpeed * 0.88,
        Math.min(c.maxSpeed * 1.05, rawDesiredMag),
      )
      const targetSpeed = applyFearAndRecoverySpeed(c, clampedCruiseSpeed, dt)
      desiredVx = (desiredVx / rawDesiredMag) * targetSpeed
      desiredVy = (desiredVy / rawDesiredMag) * targetSpeed

      // Apply Separation + inter-creature avoidance + boundary steering as direct acceleration
      // so velocity normalization never dilutes local fish separation
      const sepAccelStrength = c.maxSpeed * (c.fearTimer > 0 ? 2.4 : 4.2)
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
      const creatureAvoid = env.computeCreatureAvoidance(i, creatures, 0.35)
      const extraAx =
        sepX * sepAccelStrength + plateAvoid.ax * 1.25 + creatureAvoid.ax * 1.15 + boundAx
      const extraAy =
        sepY * sepAccelStrength + plateAvoid.ay * 1.25 + creatureAvoid.ay * 1.15 + boundAy

      const maxSteerSpeed = c.fearTimer > 0 ? c.maxSpeed * 2.75 : c.maxSpeed * 1.15
      const maxAccel = c.fearTimer > 0 ? c.maxSpeed * 4.8 : c.maxSpeed * 3.4
      const gain = c.fearTimer > 0 ? 3.8 : 3.1

      applySteeringForce(
        c,
        desiredVx,
        desiredVy,
        maxAccel,
        maxSteerSpeed,
        gain,
        dt,
        extraAx,
        extraAy,
      )

      // Preserve personal space when the school banks near boundaries
      c.vx += sepX * c.maxSpeed * 3.2 * dt
      c.vy += sepY * c.maxSpeed * 3.2 * dt

      wrapOrBounceBounds(c, width, height, margin, dt)

      const curSpeed = Math.hypot(c.vx, c.vy)
      const cap = c.fearTimer > 0 ? c.maxSpeed * 2.75 : c.maxSpeed * 1.15
      if (curSpeed > cap && curSpeed > 0) {
        c.vx = (c.vx / curSpeed) * cap
        c.vy = (c.vy / curSpeed) * cap
      } else if (curSpeed < c.minSpeed * 0.65) {
        const boost = c.minSpeed * 0.65
        const ang = curSpeed > 1e-3 ? Math.atan2(c.vy, c.vx) : c.heading
        c.vx = Math.cos(ang) * boost
        c.vy = Math.sin(ang) * boost
      }

      // Smoothly steer heading toward velocity with bounded angular turn rate
      const velHeading = Math.atan2(c.vy, c.vx)
      const maxTurnRate = c.fearTimer > 0 ? 3.8 : 2.6
      steerAngleDamped(c, velHeading, maxTurnRate, 4.2, dt)

      c.x += c.vx * dt
      c.y += c.vy * dt

      c.auxTimer -= dt
      if (c.auxTimer <= 0) {
        c.auxTimer = 0.75 + env.rng() * 0.9
        if (i % 4 === 0) {
          env.emitWake(
            c.x - Math.cos(c.heading) * cell * 2.6 * sizeScale,
            c.y - Math.sin(c.heading) * cell * 2.6 * sizeScale,
            '.',
            0.5,
          )
        }
      }
    }
  },

  renderCreature(c, cell, scale, _time, plotCell: PlotCellFn) {
    const cx = c.x / cell
    const cy = c.y / cell
    const cosH = Math.cos(c.heading)
    const sinH = Math.sin(c.heading)
    const nx = -sinH
    const ny = cosH
    const sizeScale = Math.max(0.5, scale)
    const bodyRamp = (c.seed & 3) === 0 ? 1 : 0 // Cobalt-light shimmer on ~25% of fish, muted gray on rest
    const wiggle = Math.sin(c.phase) * 0.25 * sizeScale

    const plotLocal = (
      lx: number,
      ly: number,
      rampIdx: number,
      shade: number,
      cov: number,
      slotX: number,
      slotY: number,
    ) => {
      const gx = Math.floor(cx + cosH * lx + nx * ly)
      const gy = Math.floor(cy + sinH * lx + ny * ly)
      plotCell(gx, gy, rampIdx, shade, cov, hashCreatureLocalGlyph(c.id, slotX, slotY))
    }

    // 4 to 5 cells long fish with a distinct eye cell and forked tail
    const bodySteps = Math.max(3, c.lengthCells - 1) // 3 or 4 body columns + 1 forked tail column = 4..5 cells long
    const headFront = 1.6 * sizeScale

    // Snout cell
    plotLocal(headFront, 0, bodyRamp, 0.76, 1.0, 2, 0)

    // Dorsal bright eye cell (rampIndex = 2 text white, Level 2 solid tile + glyph) and ventral jaw cell
    plotLocal(headFront - 0.85 * sizeScale, 0.55 * sizeScale, 2, 1.0, 1.0, 1, 1)
    plotLocal(headFront - 0.85 * sizeScale, -0.45 * sizeScale, bodyRamp, 0.72, 1.0, 1, -1)

    // Mid-body spine segments
    for (let s = 2; s < bodySteps; s++) {
      const lx = headFront - s * 0.95 * sizeScale
      const sway = Math.sin(c.phase - s * 0.5) * 0.16 * sizeScale
      const shade = s === 2 ? 0.74 : 0.58
      plotLocal(lx, sway, bodyRamp, shade, 1.0, -s, 0)
      if (s === 2) {
        plotLocal(lx, sway + 0.65 * sizeScale, 0, 0.45, 0.85, -s, 1)
      }
    }

    // Forked tail: two distinct prongs separated by a notch behind the peduncle
    const tailX = headFront - bodySteps * 0.98 * sizeScale
    plotLocal(tailX, 0.85 * sizeScale + wiggle, 0, 0.34, 0.9, -10, 2)
    plotLocal(tailX, -0.85 * sizeScale + wiggle, 0, 0.34, 0.9, -10, -2)
  },
}
