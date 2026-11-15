import type { Creature, PlotCellFn, SpeciesDefinition } from './types.ts'
import {
  applyFearAndRecoverySpeed,
  hashCreatureLocalGlyph,
  lerpAngle,
  normalizeAngle,
  pickSafeSpawnPosition,
  steerAngleDamped,
  valueNoise2D,
  wrapOrBounceBounds,
} from './types.ts'

const SPINE_NODES = 9
const SCRATCH_SX = new Float32Array(SPINE_NODES)
const SCRATCH_SY = new Float32Array(SPINE_NODES)
const SEG_VX = new Float32Array(SPINE_NODES - 1)
const SEG_VY = new Float32Array(SPINE_NODES - 1)
const SEG_INV_LEN = new Float32Array(SPINE_NODES - 1)

export const koiSpecies: SpeciesDefinition = {
  id: 'koi',
  countRange: [5, 8],
  speedRange: [40, 70],
  defaultClickBehavior: 'feed',
  getRamps: (palette) => [palette.oxide, palette.hot, palette.text],

  spawn(count, width, height, cell, scale, avoidRects, rng) {
    const speedScale = cell / 8
    const creatures: Creature[] = []
    for (let i = 0; i < count; i++) {
      const lengthCells = 20 + Math.floor(rng() * 5) // 20 to 24 cells long
      const widthCells = 6 + Math.floor(rng() * 3) // 6 to 8 cells wide at widest
      const collisionRadius = lengthCells * 0.48 * cell * scale
      const pos = pickSafeSpawnPosition(
        width,
        height,
        cell,
        avoidRects,
        rng,
        Math.ceil(lengthCells * 0.65 * scale),
        creatures,
      )
      const heading = rng() * Math.PI * 2 - Math.PI
      const minSpeed = 40 * speedScale
      const maxSpeed = 70 * speedScale
      const baseSpeed = minSpeed + rng() * (maxSpeed - minSpeed)
      const spineX = new Float32Array(SPINE_NODES)
      const spineY = new Float32Array(SPINE_NODES)
      const stepPx = ((lengthCells - 1) / (SPINE_NODES - 1)) * cell * scale
      const cosH = Math.cos(heading)
      const sinH = Math.sin(heading)

      for (let s = 0; s < SPINE_NODES; s++) {
        spineX[s] = pos.x - cosH * s * stepPx
        spineY[s] = pos.y - sinH * s * stepPx
      }

      creatures.push({
        id: i,
        species: 'koi',
        x: pos.x,
        y: pos.y,
        vx: cosH * baseSpeed,
        vy: sinH * baseSpeed,
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
        phaseSpeed: 3.1 + rng() * 0.9,
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
        spineX,
        spineY,
      })
    }
    return creatures
  },

  update(creatures, dt, env) {
    const { width, height, cell, scale, time, foodPellets } = env
    const diagonal = Math.hypot(width, height)
    const feedDetectRadius = 0.5 * diagonal
    const eatRadius = cell * 1.6 * scale

    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i]!
      let desiredSpeed = c.baseSpeed
      let targetHeading = c.heading

      if (c.stateMode === 1 && c.stateTimer > 0) {
        c.stateTimer = Math.max(0, c.stateTimer - dt)
        c.phase += dt * 16
        if (c.stateTimer === 0) c.stateMode = 0
      } else {
        c.phase += dt * c.phaseSpeed * (Math.hypot(c.vx, c.vy) / Math.max(1, c.baseSpeed))
      }

      let nearestFoodIdx = -1
      let nearestFoodDist = feedDetectRadius
      if (c.fearTimer <= 0) {
        for (let f = 0; f < foodPellets.length; f++) {
          const pellet = foodPellets[f]!
          if (!pellet.active) continue
          const dist = Math.hypot(pellet.x - c.x, pellet.y - c.y)
          if (dist < nearestFoodDist) {
            nearestFoodDist = dist
            nearestFoodIdx = f
          }
        }
      }

      if (nearestFoodIdx !== -1) {
        const pellet = foodPellets[nearestFoodIdx]!
        if (nearestFoodDist <= eatRadius) {
          pellet.active = false
          c.stateMode = 1
          c.stateTimer = 0.45
          env.emitWake(pellet.x, pellet.y, '+', 0.55)
        } else {
          const angleToFood = Math.atan2(pellet.y - c.y, pellet.x - c.x)
          targetHeading = lerpAngle(c.heading, angleToFood, Math.min(1, dt * 6.5))
          const approachRadius = cell * 9 * scale
          if (nearestFoodDist < approachRadius) {
            const slowFactor = 0.55 + 0.45 * (nearestFoodDist / approachRadius)
            desiredSpeed = c.baseSpeed * slowFactor
          } else {
            desiredSpeed = c.maxSpeed * 1.05
          }
        }
      } else {
        const wander = valueNoise2D(time * 0.22 + i * 3.1, c.seed * 0.01, c.seed) * 0.85
        let groupDx = 0
        let groupDy = 0
        let sepDx = 0
        let sepDy = 0
        let neighbors = 0
        const groupRadius = cell * 28 * scale
        const sepRadius = cell * 14 * scale

        const nearby = env.queryNeighbors(c.x, c.y, groupRadius, i)
        for (let k = 0; k < nearby.count; k++) {
          const j = nearby.indices[k]!
          const other = creatures[j]!
          const dx = other.x - c.x
          const dy = other.y - c.y
          const d = Math.hypot(dx, dy)
          if (d > 0 && d < groupRadius) {
            groupDx += Math.cos(other.heading) * 0.5 + (dx / d) * 0.2
            groupDy += Math.sin(other.heading) * 0.5 + (dy / d) * 0.2
            neighbors++
            if (d < sepRadius) {
              const push = (1 - d / sepRadius) * 2.4
              sepDx -= (dx / d) * push
              sepDy -= (dy / d) * push
            }
          }
        }

        let steerAngle = c.heading + wander * dt
        if (neighbors > 0) {
          const socialAngle = Math.atan2(groupDy + sepDy, groupDx + sepDx)
          steerAngle = lerpAngle(steerAngle, socialAngle, dt * 0.95)
        }
        targetHeading = steerAngle
      }

      if (c.fearTimer <= 0) {
        const nibbleOffset = c.stateMode === 1 ? Math.sin(c.phase * 2.2) * 0.14 : 0
        c.desiredHeading = normalizeAngle(targetHeading + nibbleOffset)
        c.heading = c.desiredHeading
        const speed = applyFearAndRecoverySpeed(c, desiredSpeed, dt)
        c.vx = Math.cos(c.heading) * speed
        c.vy = Math.sin(c.heading) * speed
      } else {
        const speed = applyFearAndRecoverySpeed(c, desiredSpeed, dt)
        steerAngleDamped(c, Math.atan2(c.vy, c.vx), 2.8, 3.5, dt)
        c.vx = Math.cos(c.heading) * speed
        c.vy = Math.sin(c.heading) * speed
      }

      const bodyRadiusPx = c.lengthCells * 0.65 * cell * scale
      const avoid = env.computeAvoidance(c.x, c.y, c.vx, c.vy, c.maxSpeed, bodyRadiusPx)
      const creatureAvoid = env.computeCreatureAvoidance(i, creatures, 0.45)
      // When swimming toward food pellets, lightly relax inter-koi repulsion so all koi can reach the food
      const foodRelax = nearestFoodIdx !== -1 ? 0.35 : 1.0
      c.ax = avoid.ax + creatureAvoid.ax * foodRelax
      c.ay = avoid.ay + creatureAvoid.ay * foodRelax
      c.vx += c.ax * dt
      c.vy += c.ay * dt
      wrapOrBounceBounds(c, width, height, cell * 12 * scale, dt)

      const curSpeed = Math.hypot(c.vx, c.vy)
      const cap = c.fearTimer > 0 ? c.maxSpeed * 3 : c.maxSpeed * 1.35
      if (curSpeed > cap) {
        c.vx = (c.vx / curSpeed) * cap
        c.vy = (c.vy / curSpeed) * cap
      } else if (curSpeed < c.minSpeed * 0.45) {
        c.vx = Math.cos(c.heading) * c.minSpeed * 0.5
        c.vy = Math.sin(c.heading) * c.minSpeed * 0.5
      }

      c.heading = Math.atan2(c.vy, c.vx)
      c.x += c.vx * dt
      c.y += c.vy * dt

      const stepPx = ((c.lengthCells - 1) / (SPINE_NODES - 1)) * cell * scale
      c.spineX[0] = c.x
      c.spineY[0] = c.y
      const waveAmp = cell * scale * (c.stateMode === 1 ? 0.55 : 0.32)

      for (let s = 1; s < SPINE_NODES; s++) {
        const prevX = c.spineX[s - 1]!
        const prevY = c.spineY[s - 1]!
        let dx = c.spineX[s]! - prevX
        let dy = c.spineY[s]! - prevY
        const dist = Math.hypot(dx, dy) || 1
        dx /= dist
        dy /= dist
        const wave = Math.sin(c.phase - s * 0.72) * waveAmp * (s / (SPINE_NODES - 1))
        const nx = -dy
        const ny = dx
        c.spineX[s] = prevX + dx * stepPx + nx * wave * 0.3
        c.spineY[s] = prevY + dy * stepPx + ny * wave * 0.3
      }

      c.auxTimer -= dt
      if (c.auxTimer <= 0) {
        c.auxTimer = 0.28 + env.rng() * 0.24
        const tailX = c.spineX[SPINE_NODES - 1]!
        const tailY = c.spineY[SPINE_NODES - 1]!
        env.emitWake(tailX, tailY, c.stateMode === 1 ? ':' : '.', 0.58)
      }
    }
  },

  renderCreature(c, cell, scale, _time, plotCell: PlotCellFn) {
    const maxHalfW = c.widthCells * 0.5 // 3.0 to 4.0 cells half-width (6 to 8 cells wide)

    for (let s = 0; s < SPINE_NODES; s++) {
      SCRATCH_SX[s] = c.spineX[s]! / cell
      SCRATCH_SY[s] = c.spineY[s]! / cell
    }
    for (let s = 0; s < SPINE_NODES - 1; s++) {
      const vx = SCRATCH_SX[s + 1]! - SCRATCH_SX[s]!
      const vy = SCRATCH_SY[s + 1]! - SCRATCH_SY[s]!
      const lenSq = vx * vx + vy * vy || 1e-4
      SEG_VX[s] = vx
      SEG_VY[s] = vy
      SEG_INV_LEN[s] = 1 / Math.sqrt(lenSq)
    }

    // 2 to 4 deterministic patches per koi in oxide (0), hot cream (1), and text white (2)
    const numPatches = 2 + (c.seed % 3) // 2, 3, or 4 patches
    const baseRamp = c.seed % 2 === 0 ? 2 : 1 // base body is white (2) or warm cream (1)

    const longSteps = Math.max(20, Math.ceil(c.lengthCells * scale * 1.05))
    const latStep = 0.88 / Math.max(0.5, scale)

    for (let i = 0; i <= longSteps; i++) {
      const bestT = i / longSteps
      const segFloat = bestT * (SPINE_NODES - 1)
      const s = Math.min(SPINE_NODES - 2, Math.floor(segFloat))
      const proj = segFloat - s

      const vx = SEG_VX[s]!
      const vy = SEG_VY[s]!
      const invLen = SEG_INV_LEN[s]!
      const sx = SCRATCH_SX[s]! + vx * proj
      const sy = SCRATCH_SY[s]! + vy * proj
      // Lateral normal vector pointing to the right of the spine segment
      const nx = vy * invLen
      const ny = -vx * invLen

      // Width profile: 6 to 8 cells wide at shoulders, tapering to peduncle and forked tail
      let halfWidth: number
      if (bestT < 0.15) {
        halfWidth = 1.25 + (bestT / 0.15) * (maxHalfW - 1.25)
      } else if (bestT < 0.36) {
        halfWidth = maxHalfW - ((bestT - 0.15) / 0.21) * 0.2
      } else if (bestT < 0.78) {
        halfWidth = (maxHalfW - 0.2) - ((bestT - 0.36) / 0.42) * (maxHalfW - 1.35)
      } else {
        // Forked tail flare
        halfWidth = 1.15 + ((bestT - 0.78) / 0.22) * (maxHalfW * 0.75)
      }

      const hasPectoralBand = bestT >= 0.19 && bestT <= 0.44
      const maxLat = hasPectoralBand ? halfWidth + 2.35 : halfWidth
      const alongCells = bestT * c.lengthCells
      const localX = Math.round(alongCells)
      const isTailFin = bestT >= 0.79

      for (let lateral = -maxLat; lateral <= maxLat + 0.01; lateral += latStep) {
        const absSide = Math.abs(lateral)

        // Forked tail V-notch cutout at the back
        if (bestT > 0.85 && absSide < (bestT - 0.85) * 9.5) continue

        // Two swept pectoral fins around bestT in [0.19, 0.37]
        const finSweepT = bestT - (absSide - halfWidth) * 0.035
        const isPectoral =
          finSweepT >= 0.2 &&
          finSweepT <= 0.35 &&
          absSide > halfWidth &&
          absSide <= halfWidth + 2.35

        if (absSide <= halfWidth || isPectoral) {
          const gx = Math.floor(sx + nx * lateral * scale)
          const gy = Math.floor(sy + ny * lateral * scale)
          const localY = Math.round(lateral)
          const glyphHash = hashCreatureLocalGlyph(c.id, localX, localY)

          // Two lateral eyes on the head (bestT in [0.06, 0.12], absSide near head margin)
          const isEye =
            !isPectoral &&
            bestT >= 0.06 &&
            bestT <= 0.12 &&
            absSide >= halfWidth * 0.48 &&
            absSide <= halfWidth * 0.82
          if (isEye) {
            plotCell(gx, gy, 2, 0.25, 1.0, glyphHash)
            continue
          }

          let coverage = 1.0
          if (isPectoral) {
            const finOut = (absSide - halfWidth) / 2.35
            coverage = finOut > 0.7 ? 0.58 : 0.88
          } else if (isTailFin) {
            coverage = bestT > 0.92 ? 0.62 : 0.88
          } else if (absSide > halfWidth - 0.55) {
            coverage = Math.max(0.35, 1 - (absSide - (halfWidth - 0.55)) / 0.7)
          }

          // Darker back line along the dorsal spine ridge (absSide <= 0.58)
          const isDarkBackLine =
            !isPectoral && !isTailFin && bestT >= 0.13 && bestT <= 0.76 && absSide <= 0.58
          const normalizedDist = absSide / Math.max(0.6, halfWidth)

          let shade: number
          if (isPectoral) {
            shade = 0.52
          } else if (isTailFin) {
            shade = 0.45
          } else if (isDarkBackLine) {
            shade = 0.54 // Middle ASCII glyph level along the dorsal back line
          } else {
            shade = Math.max(0.24, Math.min(1, 0.98 - normalizedDist * 0.58 - bestT * 0.1))
          }

          // Determine color ramp from base + 2 to 4 deterministic patches (0 = oxide, 1 = cream, 2 = white)
          let rampIndex = baseRamp
          if (!isPectoral && !isTailFin) {
            for (let p = 0; p < numPatches; p++) {
              const pSeed = c.seed + p * 7919
              const patchT = 0.14 + ((p + 0.35 + (pSeed % 100) / 350) / numPatches) * 0.62
              const patchSide = (((pSeed >> 4) % 100) / 50 - 1) * (maxHalfW * 0.45)
              const patchLenT = 0.09 + ((pSeed >> 8) % 10) * 0.008
              const patchWidth = maxHalfW * (0.55 + ((pSeed >> 12) % 10) * 0.035)
              const dT = (bestT - patchT) / patchLenT
              const dS = (lateral - patchSide) / patchWidth
              if (dT * dT + dS * dS <= 1.0) {
                rampIndex = p % 2 === 0 ? 0 : baseRamp === 2 ? 1 : 2
                break
              }
            }
          }

          plotCell(gx, gy, rampIndex, shade, coverage, glyphHash)
        }
      }
    }
  },
}
