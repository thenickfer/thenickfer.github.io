import type { Creature, NeighborQueryResult } from './species/types.ts'

const MAX_ITEMS = 512
const MAX_QUADTREE_NODES = 160
const QUADTREE_LEAF_CAPACITY = 6
const QUADTREE_MAX_DEPTH = 4
const BOUNDARY_PAD_PX = 160

/**
 * Pre-allocated, zero-per-frame-allocation Quadtree using flat typed arrays.
 * Designed for variable-sized creatures (4-cell school fish to 32-cell mantas)
 * and localized neighbor + interaction radius queries.
 */
export class FlatQuadtree {
  private readonly nodeCx = new Float32Array(MAX_QUADTREE_NODES)
  private readonly nodeCy = new Float32Array(MAX_QUADTREE_NODES)
  private readonly nodeHalfW = new Float32Array(MAX_QUADTREE_NODES)
  private readonly nodeHalfH = new Float32Array(MAX_QUADTREE_NODES)
  private readonly nodeMaxRadius = new Float32Array(MAX_QUADTREE_NODES)
  private readonly nodeFirstChild = new Int32Array(MAX_QUADTREE_NODES)
  private readonly nodeHeadItem = new Int32Array(MAX_QUADTREE_NODES)
  private readonly nodeItemCount = new Int32Array(MAX_QUADTREE_NODES)

  private readonly itemX = new Float32Array(MAX_ITEMS)
  private readonly itemY = new Float32Array(MAX_ITEMS)
  private readonly itemRadius = new Float32Array(MAX_ITEMS)
  private readonly itemNext = new Int32Array(MAX_ITEMS)

  private readonly stack = new Int32Array(MAX_QUADTREE_NODES)
  private readonly queryBuffer = new Int32Array(MAX_ITEMS)
  private readonly avoidBuffer = new Int32Array(MAX_ITEMS)
  private readonly queryResult: { indices: Int32Array; count: number } = {
    indices: this.queryBuffer,
    count: 0,
  }

  public nodeCount = 0
  public itemCount = 0
  public queryCount = 0

  private allocNode(cx: number, cy: number, halfW: number, halfH: number): number {
    const idx = this.nodeCount++
    this.nodeCx[idx] = cx
    this.nodeCy[idx] = cy
    this.nodeHalfW[idx] = halfW
    this.nodeHalfH[idx] = halfH
    this.nodeMaxRadius[idx] = 0
    this.nodeFirstChild[idx] = -1
    this.nodeHeadItem[idx] = -1
    this.nodeItemCount[idx] = 0
    return idx
  }

  public rebuild(creatures: readonly Creature[], width: number, height: number): void {
    this.nodeCount = 0
    this.queryCount = 0
    const n = Math.min(MAX_ITEMS, creatures.length)
    this.itemCount = n

    const halfW = width * 0.5 + BOUNDARY_PAD_PX
    const halfH = height * 0.5 + BOUNDARY_PAD_PX
    this.allocNode(width * 0.5, height * 0.5, halfW, halfH)

    for (let i = 0; i < n; i++) {
      const c = creatures[i]!
      const x = c.x
      const y = c.y
      const r = c.collisionRadius
      this.itemX[i] = x
      this.itemY[i] = y
      this.itemRadius[i] = r
      this.itemNext[i] = -1
      this.insertItem(i, x, y, r)
    }
  }

  private insertItem(itemIdx: number, x: number, y: number, r: number): void {
    let node = 0
    let depth = 0

    while (true) {
      if (r > this.nodeMaxRadius[node]!) {
        this.nodeMaxRadius[node] = r
      }

      const firstChild = this.nodeFirstChild[node]!
      if (firstChild !== -1) {
        const qx = x >= this.nodeCx[node]! ? 1 : 0
        const qy = y >= this.nodeCy[node]! ? 2 : 0
        node = firstChild + (qx | qy)
        depth++
        continue
      }

      if (
        this.nodeItemCount[node]! >= QUADTREE_LEAF_CAPACITY &&
        depth < QUADTREE_MAX_DEPTH &&
        this.nodeCount + 4 <= MAX_QUADTREE_NODES
      ) {
        this.subdivide(node)
        const children = this.nodeFirstChild[node]!
        const qx = x >= this.nodeCx[node]! ? 1 : 0
        const qy = y >= this.nodeCy[node]! ? 2 : 0
        node = children + (qx | qy)
        depth++
        continue
      }

      this.itemNext[itemIdx] = this.nodeHeadItem[node]!
      this.nodeHeadItem[node] = itemIdx
      this.nodeItemCount[node] = this.nodeItemCount[node]! + 1
      return
    }
  }

  private subdivide(node: number): void {
    const cx = this.nodeCx[node]!
    const cy = this.nodeCy[node]!
    const qw = this.nodeHalfW[node]! * 0.5
    const qh = this.nodeHalfH[node]! * 0.5

    const firstChild = this.nodeCount
    this.allocNode(cx - qw, cy - qh, qw, qh) // 0: NW
    this.allocNode(cx + qw, cy - qh, qw, qh) // 1: NE
    this.allocNode(cx - qw, cy + qh, qw, qh) // 2: SW
    this.allocNode(cx + qw, cy + qh, qw, qh) // 3: SE
    this.nodeFirstChild[node] = firstChild

    let cur = this.nodeHeadItem[node]!
    this.nodeHeadItem[node] = -1
    this.nodeItemCount[node] = 0

    while (cur !== -1) {
      const next = this.itemNext[cur]!
      const ix = this.itemX[cur]!
      const iy = this.itemY[cur]!
      const ir = this.itemRadius[cur]!
      const qx = ix >= cx ? 1 : 0
      const qy = iy >= cy ? 2 : 0
      const child = firstChild + (qx | qy)
      if (ir > this.nodeMaxRadius[child]!) {
        this.nodeMaxRadius[child] = ir
      }
      this.itemNext[cur] = this.nodeHeadItem[child]!
      this.nodeHeadItem[child] = cur
      this.nodeItemCount[child] = this.nodeItemCount[child]! + 1
      cur = next
    }
  }

  /**
   * Finds all creatures within `radius` (or whose collisionRadius + radius overlaps `(x, y)`
   * when `includeItemRadius` is true) and writes their indices into `outIndices`.
   */
  public queryRadiusInto(
    x: number,
    y: number,
    radius: number,
    outIndices: Int32Array,
    excludeIndex = -1,
    includeItemRadius = false,
  ): number {
    if (this.nodeCount === 0 || this.itemCount === 0) return 0
    this.queryCount++

    let count = 0
    let sp = 0
    this.stack[sp++] = 0
    const rSq = radius * radius

    while (sp > 0) {
      const node = this.stack[--sp]!
      const extraR = includeItemRadius ? this.nodeMaxRadius[node]! : 0
      const reachX = this.nodeHalfW[node]! + radius + extraR
      const reachY = this.nodeHalfH[node]! + radius + extraR

      if (
        Math.abs(x - this.nodeCx[node]!) > reachX ||
        Math.abs(y - this.nodeCy[node]!) > reachY
      ) {
        continue
      }

      const firstChild = this.nodeFirstChild[node]!
      if (firstChild !== -1) {
        this.stack[sp++] = firstChild
        this.stack[sp++] = firstChild + 1
        this.stack[sp++] = firstChild + 2
        this.stack[sp++] = firstChild + 3
        continue
      }

      let item = this.nodeHeadItem[node]!
      while (item !== -1) {
        if (item !== excludeIndex) {
          const dx = this.itemX[item]! - x
          const dy = this.itemY[item]! - y
          const distSq = dx * dx + dy * dy
          const limitR = includeItemRadius ? radius + this.itemRadius[item]! : radius
          const limitSq = includeItemRadius ? limitR * limitR : rSq
          if (distSq <= limitSq) {
            outIndices[count++] = item
          }
        }
        item = this.itemNext[item]!
      }
    }

    return count
  }

  public queryNeighbors(
    x: number,
    y: number,
    radius: number,
    excludeIndex = -1,
  ): NeighborQueryResult {
    this.queryResult.count = this.queryRadiusInto(
      x,
      y,
      radius,
      this.queryBuffer,
      excludeIndex,
      false,
    )
    return this.queryResult
  }

  public queryAvoidanceNeighbors(
    x: number,
    y: number,
    radius: number,
    excludeIndex = -1,
  ): { readonly indices: Int32Array; readonly count: number } {
    const count = this.queryRadiusInto(x, y, radius, this.avoidBuffer, excludeIndex, true)
    return { indices: this.avoidBuffer, count }
  }

  public getAvoidBuffer(): Int32Array {
    return this.avoidBuffer
  }
}

/**
 * Pre-allocated Uniform Spatial Grid used for comparative benchmarking against FlatQuadtree.
 */
export class FlatSpatialGrid {
  private readonly cellHead: Int32Array
  private readonly itemX = new Float32Array(MAX_ITEMS)
  private readonly itemY = new Float32Array(MAX_ITEMS)
  private readonly itemRadius = new Float32Array(MAX_ITEMS)
  private readonly itemNext = new Int32Array(MAX_ITEMS)
  private readonly maxCells: number
  private cols = 1
  private rows = 1
  private cellSize = 128
  private maxItemRadius = 0
  public queryCount = 0

  constructor(maxCells = 1024) {
    this.maxCells = maxCells
    this.cellHead = new Int32Array(maxCells)
  }

  public rebuild(
    creatures: readonly Creature[],
    width: number,
    height: number,
    cellSize = 128,
  ): void {
    this.cellSize = Math.max(32, cellSize)
    this.cols = Math.max(1, Math.min(32, Math.ceil((width + BOUNDARY_PAD_PX * 2) / this.cellSize)))
    this.rows = Math.max(
      1,
      Math.min(Math.floor(this.maxCells / this.cols), Math.ceil((height + BOUNDARY_PAD_PX * 2) / this.cellSize)),
    )
    const activeCells = this.cols * this.rows
    this.cellHead.fill(-1, 0, activeCells)
    this.maxItemRadius = 0
    this.queryCount = 0

    const n = Math.min(MAX_ITEMS, creatures.length)
    for (let i = 0; i < n; i++) {
      const c = creatures[i]!
      this.itemX[i] = c.x
      this.itemY[i] = c.y
      this.itemRadius[i] = c.collisionRadius
      if (c.collisionRadius > this.maxItemRadius) {
        this.maxItemRadius = c.collisionRadius
      }
      const cx = Math.max(
        0,
        Math.min(this.cols - 1, Math.floor((c.x + BOUNDARY_PAD_PX) / this.cellSize)),
      )
      const cy = Math.max(
        0,
        Math.min(this.rows - 1, Math.floor((c.y + BOUNDARY_PAD_PX) / this.cellSize)),
      )
      const cellIdx = cy * this.cols + cx
      this.itemNext[i] = this.cellHead[cellIdx]!
      this.cellHead[cellIdx] = i
    }
  }

  public queryRadiusInto(
    x: number,
    y: number,
    radius: number,
    outIndices: Int32Array,
    excludeIndex = -1,
    includeItemRadius = false,
  ): number {
    this.queryCount++
    const reach = radius + (includeItemRadius ? this.maxItemRadius : 0)
    const minCx = Math.max(
      0,
      Math.min(this.cols - 1, Math.floor((x - reach + BOUNDARY_PAD_PX) / this.cellSize)),
    )
    const maxCx = Math.max(
      0,
      Math.min(this.cols - 1, Math.floor((x + reach + BOUNDARY_PAD_PX) / this.cellSize)),
    )
    const minCy = Math.max(
      0,
      Math.min(this.rows - 1, Math.floor((y - reach + BOUNDARY_PAD_PX) / this.cellSize)),
    )
    const maxCy = Math.max(
      0,
      Math.min(this.rows - 1, Math.floor((y + reach + BOUNDARY_PAD_PX) / this.cellSize)),
    )

    let count = 0
    const rSq = radius * radius
    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowOffset = cy * this.cols
      for (let cx = minCx; cx <= maxCx; cx++) {
        let item = this.cellHead[rowOffset + cx]!
        while (item !== -1) {
          if (item !== excludeIndex) {
            const dx = this.itemX[item]! - x
            const dy = this.itemY[item]! - y
            const distSq = dx * dx + dy * dy
            const limitR = includeItemRadius ? radius + this.itemRadius[item]! : radius
            const limitSq = includeItemRadius ? limitR * limitR : rSq
            if (distSq <= limitSq) {
              outIndices[count++] = item
            }
          }
          item = this.itemNext[item]!
        }
      }
    }
    return count
  }
}

/**
 * Naive O(N) pairwise radius query baseline for benchmarking.
 */
export function queryNaiveRadiusInto(
  creatures: readonly Creature[],
  x: number,
  y: number,
  radius: number,
  outIndices: Int32Array,
  excludeIndex = -1,
  includeItemRadius = false,
): number {
  let count = 0
  const rSq = radius * radius
  const n = creatures.length
  for (let i = 0; i < n; i++) {
    if (i === excludeIndex) continue
    const c = creatures[i]!
    const dx = c.x - x
    const dy = c.y - y
    const distSq = dx * dx + dy * dy
    const limitR = includeItemRadius ? radius + c.collisionRadius : radius
    const limitSq = includeItemRadius ? limitR * limitR : rSq
    if (distSq <= limitSq) {
      outIndices[count++] = i
    }
  }
  return count
}
