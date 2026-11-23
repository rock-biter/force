// FORCE+ on the GPU, live. Up to 100 000 particles in a box as big as the grid, pushed apart by
// moving their positions with half and half, masses seen as m^α and levels in the pile (decision
// 015), through lists of neighbours made when needed (decision 016), from cells kept in a hashed table
// (decision 024). A menu switches to FORCE, the
// same rule with the real masses and no levels (chapter 026), as in the compare page. The pointer pushes them away
// with a ball. The shaders come from contact-cost, where they were checked against JavaScript; two
// are this page's own: the round, the same one plus the ball, and finish, the same one plus a speed
// limit. three.js draws the particles straight from the position buffer, on the same device
// (decision 012).

import type { ButtonGridApi, FpsGraphBladeApi } from '@tweakpane/plugin-essentials'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Euler,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  type Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  TOUCH,
  Vector2,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu'
import { Pane } from 'tweakpane'
import clearIfCode from '../contact-cost/clear-if.wgsl?raw'
import commonCode from '../contact-cost/common.wgsl?raw'
import gridIfCode from '../contact-cost/grid-if.wgsl?raw'
import levelsListCode from '../contact-cost/levels-list.wgsl?raw'
import listCode from '../contact-cost/list.wgsl?raw'
import predictCode from '../contact-cost/predict.wgsl?raw'
import rebuildCode from '../contact-cost/rebuild.wgsl?raw'
import watchCode from '../contact-cost/watch.wgsl?raw'
import { ParticleView } from '../debug/particles.js'
import { showError } from '../debug/viewer.js'
import bookBlocksCode from './book-blocks.wgsl?raw'
import bookCountCode from './book-count.wgsl?raw'
import bookEndsCode from './book-ends.wgsl?raw'
import bookFillCode from './book-fill.wgsl?raw'
import bookListCode from './book-list.wgsl?raw'
import bookMoveCode from './book-move.wgsl?raw'
import bookScanCode from './book-scan.wgsl?raw'
import bookSettleCode from './book-settle.wgsl?raw'
import cellsGridCode from './cells-grid.wgsl?raw'
import cellsTableCode from './cells-table.wgsl?raw'
import finishLimitCode from './finish-limit.wgsl?raw'
import roundPushCode from './round-push.wgsl?raw'

type Vec3 = [number, number, number]

const RADIUS = 0.1 // meters, as in every scene since chapter 025
const DIAMETER = 2 * RADIUS
const CELL = DIAMETER // a cell as wide as a particle (chapter 024)
const PLACES = 4 // per cell (decision 016)
const STEP = 1 / 60 // seconds
const GRAVITY = 9.81
const ROUNDS = 6 // decision 022
const MARGIN = 0.05 // the lists look 5 cm beyond touching (decision 016)
const MAX_NEIGHBOURS = 32 // as in list.wgsl
const NO_LEVEL = 0xffffffff
const BLOCK = 512 // cells per block of the prefix sum, as in book-blocks.wgsl
const HALF = 12 // the box is 24 m by 24 m on the floor...
const SIZE: Vec3 = [120, 45, 120] // ...and 9 m tall: 120 by 45 by 120 cells of 20 cm
const MAX_TILT = 30 // degrees, around X and around Z, on the page that tilts the box
const TILT_SPEED = 20 // degrees per second: the floor's far corner, 17 m away, then moves 9.9 cm per step, just under a radius
const GAP = 0.01 // between particles at the start, in meters
const LAYERS = 28 // at most, at the start: about 5.9 m, well inside the grid's 9 m
const BALL_RADIUS = 2 // meters, at the start: the panel changes it
const BALL_FOLLOW = 0.1 // the share of the way to the pointer the ball covers at each step
const BALL_SPEED = 20 // m/s: the fastest the ball moves, however far the pointer jumps
const BALL_GROWTH = 8 // m/s: how fast its radius grows or shrinks
const MAX_STEPS_PER_FRAME = 2
const MAX_SUBSTEPS = 8
const SAMPLE_EVERY = 30 // frames between two readings of the GPU's numbers
const FORCE_PLUS = { alpha: 0.5, levels: 2, substeps: 1 } // decisions 015 and 022
// The choices of the masses menu: the lightest and the heaviest, in kg. Only their ratio changes
// what the solver does: gravity pulls every mass alike, and a contact shares by w_i / (w_i + w_j).
const MASSES: Record<string, readonly [number, number]> = {
  '1 kg': [1, 1],
  '1 to 10 kg': [1, 10],
  '1 to 100 kg': [1, 100],
}

// The floor and four walls, as in contact-cost: the normal in xyz, the offset in w.
const PLANES = [
  [0, 1, 0, 0],
  [1, 0, 0, -HALF],
  [-1, 0, 0, -HALF],
  [0, 0, 1, -HALF],
  [0, 0, -1, -HALF],
]

/** Repeats the same numbers at every run, so every restart starts from the same cube. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A cube of particles in the middle of the box, 1 cm apart, each moved by up to 5 mm so that the
 * columns do not stand balanced on each other. Beyond LAYERS layers, 21 952 particles, the block
 * grows wider instead of taller. Masses between the two of `masses`, even on a log
 * scale: from 1 to 100 kg, as many between 1 and 10 kg as between 10 and 100. x, y, z and 1 / mass
 * for each particle.
 */
function cube(count: number, masses: readonly [number, number]): Float32Array {
  const [lightest, heaviest] = masses
  const side = Math.max(Math.ceil(Math.cbrt(count)), Math.ceil(Math.sqrt(count / LAYERS)))
  const spacing = DIAMETER + GAP
  const corner = (-(side - 1) * spacing) / 2
  const next = random(1)
  const jitter = () => (next() - 0.5) * 0.01
  const data = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const x = i % side
    const z = Math.floor(i / side) % side
    const y = Math.floor(i / (side * side))
    data.set(
      [
        corner + x * spacing + jitter(),
        RADIUS + GAP + y * spacing + jitter(),
        corner + z * spacing + jitter(),
        1 / (lightest * (heaviest / lightest) ** next()),
      ],
      i * 4,
    )
  }
  return data
}

// ?hash= in the address, to measure: the hash of cells-table.wgsl, which keeps the cells of a row
// along x together, is replaced by another. ?hash=scattered: the one of Teschner and others, which
// scrambles all three coordinates (chapter 039).
// ?hash=zorder: the slot is the cell's number along the Z-order curve, which weaves the bits of
// x, y and z, so cells close in space along all three axes get slots close in memory. With slots
// that are a power of two, a cube of cells keeps that order and repeats through space.
// ?hash=blocks: the same curve inside blocks of 8 × 8 × 8 cells, and the blocks scattered.
const HASH = '(((u.y * 19349663u) ^ (u.z * 83492791u)) + u.x) % slots'
const SPREAD = `
// The low 10 bits of n, with two empty bits after each one.
fn spread(n: u32) -> u32 {
  var x = n & 0x3ffu;
  x = (x | (x << 16u)) & 0x030000ffu;
  x = (x | (x << 8u)) & 0x0300f00fu;
  x = (x | (x << 4u)) & 0x030c30c3u;
  x = (x | (x << 2u)) & 0x09249249u;
  return x;
}
fn zorder(u: vec3u) -> u32 {
  return spread(u.x) | (spread(u.y) << 1u) | (spread(u.z) << 2u);
}
`
const HASHES: Record<string, string> = {
  scattered: '((u.x * 73856093u) ^ (u.y * 19349663u) ^ (u.z * 83492791u)) % slots',
  zorder: 'zorder(u) % slots',
  blocks:
    '((((u.x >> 3u) * 73856093u) ^ ((u.y >> 3u) * 19349663u) ^ ((u.z >> 3u) * 83492791u)) * 512u + zorder(u & vec3u(7u))) % slots',
}

// When the particles are kept in the order of the book, row s of a cell is particle s: the list
// of neighbours needs no book to read.
const listInOrder = (code: string) =>
  code
    .replace('@group(0) @binding(8) var<storage, read> book: array<u32>;', '')
    .replace('let j = book[first + s];', 'let j = first + s;')

/** The compute pipelines, made once: every restart uses them again. */
async function makePipelines(device: GPUDevice, hash: string) {
  const make = (code: string) =>
    device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: commonCode + code }) },
    })
  const [predict, watch, clearIf, gridIf, list, levels, round, finish, ...book] = await Promise.all(
    [
      predictCode,
      watchCode,
      rebuildCode + clearIfCode,
      rebuildCode + gridIfCode,
      rebuildCode + listCode,
      levelsListCode,
      roundPushCode,
      finishLimitCode,
      // the address book: the particles sorted by cell, instead of 4 places per cell
      rebuildCode + bookBlocksCode,
      rebuildCode + bookScanCode,
      rebuildCode + bookEndsCode,
      rebuildCode + bookMoveCode,
      rebuildCode + bookSettleCode,
      // its three shaders that file a particle under its cell, once with a slot per cell of the
      // grid and once with the slots of a table
      ...[
        cellsGridCode,
        HASHES[hash] ? SPREAD + cellsTableCode.replace(HASH, HASHES[hash]) : cellsTableCode,
      ].flatMap((cellsCode) =>
        [bookCountCode, bookFillCode, bookListCode, listInOrder(bookListCode)].map(
          (code) => rebuildCode + cellsCode + code,
        ),
      ),
    ].map(make),
  )
  const [bookBlocks, bookScan, bookEnds, bookMove, bookSettle, ...filed] = book
  const filing = (k: number) => ({
    bookCount: filed[4 * k],
    bookFill: filed[4 * k + 1],
    bookList: filed[4 * k + 2],
    bookListInOrder: filed[4 * k + 3],
  })
  return {
    predict,
    watch,
    clearIf,
    gridIf,
    list,
    levels,
    round,
    finish,
    bookBlocks,
    bookScan,
    bookEnds,
    bookMove,
    bookSettle,
    byGrid: filing(0),
    byTable: filing(1),
  }
}
type Pipelines = Awaited<ReturnType<typeof makePipelines>>

/** One radius per substep, in m/s: 6 with 1 substep, 12 with 2, the safe limit (decision 017). */
const safeSpeed = (substeps: number) => (RADIUS * substeps) / STEP
/** The default limit, as a share of the safe one: 9 m/s with 1 substep (decision 019). */
const DEFAULT_SHARE = 1.5

/** The grid of cells: where its first corner is, in meters, and how many cells along x, y, z. */
interface Grid {
  origin: Vec3
  size: Vec3
}
/**
 * How the grid keeps its particles. 'places': 4 places per cell, and a particle that finds its cell
 * full is left out (decision 016). 'book': one list of all the particles sorted by cell, the
 * address book of chapter 024, where a cell is never full, with a slot for every cell of the grid.
 * 'table': the same book with the slots of a table, about two per particle, shared by all the
 * cells of a space with no border (spatial hashing).
 */
type Cells = 'places' | 'book' | 'table'
/** The grid of the level box, with cells of this width: 120 by 45 by 120 of them at 20 cm. */
const levelGrid = (cell: number): Grid => ({
  origin: [-HALF, 0, -HALF],
  size: SIZE.map((n) => Math.ceil((n * CELL) / cell - 1e-6)) as Vec3,
})

/**
 * The grid never turns: its cells stay along the world's axes. So for a box that tilts, it must be
 * big enough to hold the box at every tilt, up to `most` degrees around X and around Z. The box
 * turns around the middle of its floor.
 */
function gridAround(most: number, cell: number): Grid {
  const low = new Vector3(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  )
  const high = low.clone().negate()
  const corner = new Vector3()
  const turn = new Euler()
  for (let x = -most; x <= most; x += 5)
    for (let z = -most; z <= most; z += 5) {
      turn.set(MathUtils.degToRad(x), 0, MathUtils.degToRad(z))
      for (const sx of [-HALF, HALF])
        for (const y of [0, SIZE[1] * CELL])
          for (const sz of [-HALF, HALF]) {
            corner.set(sx, y, sz).applyEuler(turn)
            low.min(corner)
            high.max(corner)
          }
    }
  const origin = low.toArray().map((v) => Math.floor(v / cell) * cell - cell) as Vec3
  const size = high.toArray().map((v, a) => Math.ceil((v - origin[a]) / cell) + 1) as Vec3
  return { origin, size }
}

/**
 * The particles on the GPU and how to encode one step of them: the step of contact-cost's part 4,
 * with the list made when needed.
 */
function makeSimulation(
  device: GPUDevice,
  kit: Pipelines,
  pointer: GPUBuffer,
  count: number,
  masses: readonly [number, number],
  grid: Grid,
  box: Matrix4,
  cells: Cells,
  margin: number,
  cell: number,
  slotsEach: number,
  inOrder: boolean,
) {
  // The cube stands on the floor of the box, wherever the box is turned.
  const start = cube(count, masses)
  const point = new Vector3()
  for (let i = 0; i < count; i++) {
    point.fromArray(start, i * 4).applyMatrix4(box)
    start.set(point.toArray(), i * 4)
  }
  const bytes = start.byteLength
  // The slots that count particles: one per cell of the grid, or those of the table, the first
  // power of two that gives at least `slotsEach` per particle.
  const cellCount =
    cells === 'table'
      ? 2 ** Math.ceil(Math.log2(Math.max(slotsEach * count, 1024)))
      : grid.size[0] * grid.size[1] * grid.size[2]
  const buffers: GPUBuffer[] = []
  const storage = (size: number, extra = 0) => {
    const buffer = device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | extra,
    })
    buffers.push(buffer)
    return buffer
  }
  const positions = storage(bytes, GPUBufferUsage.COPY_SRC) // read back by ?profile
  const velocities = storage(bytes)
  const predicted = [storage(bytes), storage(bytes)]
  const counts = storage(cellCount * 4)
  // 4 places per cell, or the address book: a row per particle, where each cell's rows begin, and
  // the sums of the blocks the prefix sum is made in
  const blockCount = Math.ceil(cellCount / BLOCK)
  const places = storage(cells === 'places' ? cellCount * PLACES * 4 : 4)
  const booked = cells !== 'places'
  // The particles kept in the order of the book (book-move.wgsl): only with a book.
  const sorted = booked && inOrder
  const spare = storage(sorted ? bytes : 16)
  const book = storage(booked ? count * 4 : 4)
  const starts = storage(booked ? cellCount * 4 : 4)
  const blocks = storage(booked ? blockCount * 4 : 4)
  const file = cells === 'table' ? kit.byTable : kit.byGrid
  const levels = [storage(count * 4), storage(count * 4)]
  const planes = storage(PLANES.length * 16)
  const neighbours = storage(count * MAX_NEIGHBOURS * 4, GPUBufferUsage.COPY_SRC)
  const neighbourCounts = storage(count * 4, GPUBufferUsage.COPY_SRC)
  const anchors = storage(bytes)
  const control = storage(32, GPUBufferUsage.COPY_SRC) // see rebuild.wgsl
  const params = device.createBuffer({
    size: 80,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  buffers.push(params)

  device.queue.writeBuffer(positions, 0, start)
  for (const b of levels) device.queue.writeBuffer(b, 0, new Uint32Array(count).fill(NO_LEVEL))
  device.queue.writeBuffer(planes, 0, new Float32Array(PLANES.flat()))
  // A list asked for at the first step; from then on the GPU decides by itself.
  device.queue.writeBuffer(control, 0, new Uint32Array([1, 1, 0, 0, 0]))
  // The Params struct of common.wgsl: 80 bytes, in its order.
  const data = new ArrayBuffer(80)
  const floats = new Float32Array(data)
  const words = new Uint32Array(data)
  floats.set([0, -GRAVITY, 0, STEP, ...grid.origin, cell])
  words.set([...grid.size, PLACES], 8)
  floats.set([RADIUS, FORCE_PLUS.alpha, FORCE_PLUS.levels], 12)
  words[15] = PLANES.length
  floats[19] = margin // 16 to 18 belong to the spring, not used here
  device.queue.writeBuffer(params, 0, data)

  const group = (p: GPUComputePipeline, entries: GPUBuffer[]) =>
    device.createBindGroup({
      layout: p.getBindGroupLayout(0),
      entries: entries.map((buffer, binding) => ({ binding, resource: { buffer } })),
    })
  const predictGroup = group(kit.predict, [params, positions, velocities, predicted[0]])
  const watchGroup = group(kit.watch, [params, predicted[0], anchors, control])
  const clearGroup = group(kit.clearIf, [params, control, counts])
  const gridGroup = group(kit.gridIf, [params, predicted[0], counts, places, control])
  const listGroup = group(kit.list, [
    params,
    predicted[0],
    counts,
    places,
    control,
    neighbours,
    neighbourCounts,
    anchors,
  ])
  const bookGroups = {
    count: group(file.bookCount, [params, predicted[0], counts, control]),
    blocks: group(kit.bookBlocks, [params, control, counts, blocks]),
    scan: group(kit.bookScan, [params, control, blocks]),
    ends: group(kit.bookEnds, [params, control, counts, blocks, starts]),
    fill: group(file.bookFill, [params, predicted[0], starts, book, control]),
    list: group(sorted ? file.bookListInOrder : file.bookList, [
      params,
      predicted[0],
      counts,
      starts,
      control,
      neighbours,
      neighbourCounts,
      anchors,
      ...(sorted ? [] : [book]),
    ]),
    // Moving the particles into the order of the book, in a substep whose levels are read from
    // levels[k]. The spare buffers: the second buffer of the rounds, free until the first round,
    // one more for the predicted positions, and the levels the substep is about to write.
    move: [0, 1].map((k) =>
      group(kit.bookMove, [
        params,
        control,
        book,
        positions,
        predicted[0],
        levels[k],
        predicted[1],
        spare,
        levels[1 - k],
      ]),
    ),
    settle: [0, 1].map((k) =>
      group(kit.bookSettle, [
        params,
        control,
        predicted[1],
        spare,
        levels[1 - k],
        positions,
        predicted[0],
        levels[k],
      ]),
    ),
  }
  // µ, the friction of round-push.wgsl: 4 bytes, in a buffer of the usual 16.
  const rub = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  buffers.push(rub)
  // Levels alternate between two buffers, a step each; positions between two, a round each.
  const levelGroups = [0, 1].map((k) =>
    group(kit.levels, [
      params,
      predicted[0],
      neighbours,
      neighbourCounts,
      planes,
      levels[k],
      levels[1 - k],
    ]),
  )
  const roundGroups = [0, 1].map((k) =>
    [0, 1].map((from) =>
      group(kit.round, [
        params,
        predicted[from],
        predicted[1 - from],
        neighbours,
        neighbourCounts,
        planes,
        levels[1 - k],
        pointer,
        positions, // where each particle was when the substep began: friction measures from there
        rub,
      ]),
    ),
  )
  // The speed limit of finish-limit.wgsl, in m/s: 4 bytes, in a buffer of the usual 16.
  const limit = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  buffers.push(limit)
  const finishGroup = group(kit.finish, [
    params,
    positions,
    velocities,
    predicted[ROUNDS % 2],
    limit,
  ])
  const workgroups = Math.ceil(count / 64)
  const cellWorkgroups = Math.ceil(cellCount / 64)
  const blockWorkgroups = Math.ceil(blockCount / 64)
  let parity = 0
  let substeps = 1
  let levelsOn = true // the levels pass runs only when the rounds read the levels, c > 0

  return {
    particleCount: count,
    radius: RADIUS,
    positionBuffer: positions,
    control,
    neighbours,
    neighbourCounts,
    substepCount: 0,

    get substeps() {
      return substeps
    },

    /**
     * One step of 1/60 s, cut into substeps. Each one: predict, the list if needed, the levels, 6
     * rounds with the ball, finish. Before each substep its own ball is copied from `path`, from
     * entry `from` on, into the Pointer uniform. With a `clock`, the GPU clock is read when the
     * first substep starts and when the last one ends. With a `profile`, every shader runs in a
     * compute pass of its own, between two readings of the profile's clock, and its name is added
     * to the profile's names: pass k of the step wrote entries 2k and 2k + 1.
     */
    encode(
      encoder: GPUCommandEncoder,
      path: GPUBuffer,
      from: number,
      clock?: GPUQuerySet,
      profile?: Profile,
    ) {
      for (let s = 0; s < substeps; s++) {
        const first = s === 0
        const last = s === substeps - 1
        encoder.copyBufferToBuffer(path, (from + s) * 16, pointer, 0, 16)
        encoder.clearBuffer(control, 8, 4) // the largest move, measured again at every substep
        const whole = profile
          ? undefined
          : encoder.beginComputePass(
              clock && (first || last)
                ? {
                    timestampWrites: {
                      querySet: clock,
                      beginningOfPassWriteIndex: first ? 0 : undefined,
                      endOfPassWriteIndex: last ? 1 : undefined,
                    },
                  }
                : undefined,
            )
        const dispatch = (name: string, p: GPUComputePipeline, g: GPUBindGroup, n = workgroups) => {
          const k = profile?.names.push(name) ?? 0
          const pass =
            whole ??
            encoder.beginComputePass({
              timestampWrites: {
                querySet: (profile as Profile).clock,
                beginningOfPassWriteIndex: 2 * k - 2,
                endOfPassWriteIndex: 2 * k - 1,
              },
            })
          pass.setPipeline(p)
          pass.setBindGroup(0, g)
          pass.dispatchWorkgroups(n)
          if (!whole) pass.end()
        }
        dispatch('predict', kit.predict, predictGroup)
        dispatch('watch', kit.watch, watchGroup)
        dispatch('clear', kit.clearIf, clearGroup, cellWorkgroups)
        if (cells === 'places') {
          dispatch('fill', kit.gridIf, gridGroup)
          dispatch('list', kit.list, listGroup)
        } else {
          dispatch('count', file.bookCount, bookGroups.count)
          dispatch('sum', kit.bookBlocks, bookGroups.blocks, blockWorkgroups)
          dispatch('sum', kit.bookScan, bookGroups.scan, 1)
          dispatch('sum', kit.bookEnds, bookGroups.ends, blockWorkgroups)
          dispatch('fill', file.bookFill, bookGroups.fill)
          if (sorted) {
            dispatch('move', kit.bookMove, bookGroups.move[parity])
            dispatch('move', kit.bookSettle, bookGroups.settle[parity])
          }
          dispatch('list', sorted ? file.bookListInOrder : file.bookList, bookGroups.list)
        }
        if (levelsOn) dispatch('levels', kit.levels, levelGroups[parity])
        for (let r = 0; r < ROUNDS; r++) dispatch('rounds', kit.round, roundGroups[parity][r % 2])
        dispatch('finish', kit.finish, finishGroup)
        whole?.end()
        // Only the first substep asks for a list. With no margin every substep does: a list that
        // looks no further than touching is right only where it was made.
        if (margin > 0) encoder.clearBuffer(control, 0, 4)
        parity = 1 - parity
        this.substepCount++
      }
    },

    /**
     * α, c, the substeps and the speed limit, from the next step on. A substep lasts 1/60 s
     * divided by their number: predict and finish read it from the params. No particle may go
     * faster than `maxSpeed`, in m/s, 0 for no limit (decisions 017 to 019). With c = 0 the levels
     * are not computed: the levels of the pile then catch up in a few steps when c comes back.
     */
    setSolver(alpha: number, levelStrength: number, count: number, maxSpeed: number) {
      substeps = count
      levelsOn = levelStrength > 0
      device.queue.writeBuffer(params, 3 * 4, new Float32Array([STEP / count]))
      device.queue.writeBuffer(params, 13 * 4, new Float32Array([alpha, levelStrength]))
      device.queue.writeBuffer(limit, 0, new Float32Array([maxSpeed]))
    },

    /** The floor and the walls, turned as the box is: only their normals change. */
    setBox(turn: Quaternion) {
      const normal = new Vector3()
      const data = PLANES.flatMap(([x, y, z, offset]) => [
        ...normal.set(x, y, z).applyQuaternion(turn).toArray(),
        offset,
      ])
      device.queue.writeBuffer(planes, 0, new Float32Array(data))
    },

    /** µ, how much of their slide two touching particles take back: 0 is none (decision 020). */
    setFriction(mu: number) {
      device.queue.writeBuffer(rub, 0, new Float32Array([mu]))
    },

    destroy() {
      for (const b of buffers) b.destroy()
    },
  }
}
type Simulation = ReturnType<typeof makeSimulation>
/** A clock with two entries per shader of a step, and the names of the shaders that wrote them. */
type Profile = { clock: GPUQuerySet; names: string[] }
// The most shaders a step runs: thirteen and the rounds, in every substep.
const MAX_PASSES = (13 + ROUNDS) * MAX_SUBSTEPS

async function start() {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) throw new Error('no WebGPU here')
  // The GPU clock, where there is one, to time a step.
  const hasClock = adapter.features.has('timestamp-query')
  const device = await adapter.requestDevice({
    requiredFeatures: hasClock ? ['timestamp-query'] : [],
  })
  // WebGPU reports a rejected command here, not with an exception: each one is shown once.
  const seen = new Set<string>()
  device.addEventListener('uncapturederror', (event) => {
    const message = (event as GPUUncapturedErrorEvent).error.message.split('\n')[0]
    if (!seen.has(message)) showError(message)
    seen.add(message)
  })
  const kit = await makePipelines(device, new URLSearchParams(location.search).get('hash') ?? '')

  const renderer = new WebGPURenderer({ device, antialias: true })
  await renderer.init()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.append(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0xe9e9e9)
  // Light for the ball only: the particles shade themselves (debug/particles.ts).
  scene.add(new HemisphereLight(0xffffff, 0x777788, 2))
  const sun = new DirectionalLight(0xffffff, 2)
  sun.position.set(2, 5, 3)
  scene.add(sun)
  // The floor, with a line every meter, 5 cells of the grid, and the box the grid fills.
  // They and the ball sit in one group, the box. The force-tilt page turns the group, and the
  // floor and the walls of the simulation with it. The particles are not in the group: they live in
  // the world, where the grid of cells stays still and gravity points down.
  const world = new Group()
  scene.add(world)
  world.add(new GridHelper(2 * HALF, 2 * HALF, 0xbcbcbc, 0xd4d4d4))
  const height = SIZE[1] * CELL
  const box = new LineSegments(
    new EdgesGeometry(new BoxGeometry(2 * HALF, height, 2 * HALF)),
    new LineBasicMaterial({ color: 0x9a9a9a }),
  )
  box.position.y = height / 2
  world.add(box)

  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200)
  camera.position.set(17, 14, 23)
  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.target.set(0, 0.5, 0)
  orbit.enableDamping = true
  orbit.dampingFactor = 0.08
  // On a phone one finger pushes the particles, so the camera turns with two.
  orbit.touches = { ONE: null, TWO: TOUCH.DOLLY_ROTATE }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // ---- the pointer ---------------------------------------------------------------------------------
  // The Pointer struct of round-push.wgsl: the center of the ball, then its radius. The ball moves
  // at every substep, not once per step: moved all at once, it would cover a step's way in the
  // first substep, and push particles as many times faster. So JavaScript writes where it is at
  // every substep of the frame in `ballPath`, and the GPU copies each one in before its substep.
  const pointerBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const ballPath = device.createBuffer({
    size: MAX_STEPS_PER_FRAME * MAX_SUBSTEPS * 16,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  })
  const pathData = new Float32Array(MAX_STEPS_PER_FRAME * MAX_SUBSTEPS * 4)
  const canvas = renderer.domElement
  const screen = new Vector2() // the pointer from -1 to 1, as the camera sees the canvas
  let pointing = false
  let fingers = 0
  const aim = (event: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    screen.set(
      ((event.clientX - r.left) / r.width) * 2 - 1,
      -((event.clientY - r.top) / r.height) * 2 + 1,
    )
  }
  // A mouse pushes while it hovers with no button down: dragging turns the camera. A finger pushes
  // while it is the only one on the screen.
  canvas.addEventListener('pointerdown', (event) => {
    aim(event)
    if (event.pointerType === 'mouse') pointing = false
    else pointing = ++fingers === 1
  })
  canvas.addEventListener('pointermove', (event) => {
    aim(event)
    pointing = event.pointerType === 'mouse' ? event.buttons === 0 : fingers === 1
  })
  const lift = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') pointing = event.type === 'pointerup'
    else {
      fingers = Math.max(fingers - 1, 0)
      pointing = false
    }
  }
  canvas.addEventListener('pointerup', lift)
  canvas.addEventListener('pointercancel', lift)
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') pointing = false
  })

  // The ball has its center on the floor, y = 0, under the point where the pointer meets the
  // surface of the heap: a flat plane at the height the heap will settle to, since a packed heap
  // holds about 150 particles per cubic meter. It does not jump to the pointer: in each step it
  // covers BALL_FOLLOW of the way there, a lerp, at BALL_SPEED at most, and it grows from nothing at
  // BALL_GROWTH, so it pushes particles instead of throwing them. Only a ball that has shrunk to
  // nothing comes back straight under the pointer. Only its upper half is drawn: the floor is made
  // of lines, and the lower half would show through it.
  const ball = { x: 0, z: 0, radius: 0 }
  const ballMesh = new Mesh(
    new SphereGeometry(1, 48, 12, 0, 2 * Math.PI, 0, Math.PI / 2),
    new MeshStandardMaterial({ color: 0xf2c200, roughness: 1, metalness: 0 }), // matte yellow
  )
  world.add(ballMesh)
  const raycaster = new Raycaster()
  const surface = new Plane(new Vector3(0, 1, 0), 0)
  const hit = new Vector3()
  const inside = new Matrix4()
  const center = new Vector3()
  /**
   * Moves the ball through the `steps` steps of this frame, `substeps` each, toward the pointer and
   * toward `radius`, and writes where it is at every substep into `ballPath`.
   */
  function moveBall(count: number, steps: number, substeps: number, radius: number) {
    const top = Math.max(count / (150 * (2 * HALF) ** 2), DIAMETER)
    surface.constant = -top // the plane y = top
    raycaster.setFromCamera(screen, camera)
    // the ray as the box sees it, since the plane and the ball are the box's own
    raycaster.ray.applyMatrix4(inside.copy(world.matrixWorld).invert())
    const on = pointing && raycaster.ray.intersectPlane(surface, hit) !== null
    if (on && ball.radius === 0) {
      ball.x = hit.x
      ball.z = hit.z
    }
    const h = STEP / substeps
    // the lerp of a substep, so that a whole step still covers BALL_FOLLOW of the way
    const follow = 1 - (1 - BALL_FOLLOW) ** (1 / substeps)
    for (let k = 0; k < steps * substeps; k++) {
      if (on) {
        const dx = hit.x - ball.x
        const dz = hit.z - ball.z
        const far = Math.hypot(dx, dz)
        const move = far > 0 ? Math.min(follow, (BALL_SPEED * h) / far) : 0
        ball.x += dx * move
        ball.z += dz * move
      }
      // The radius goes toward its target at BALL_GROWTH, also when the panel changes it.
      const change = (on ? radius : 0) - ball.radius
      ball.radius += Math.min(Math.max(change, -BALL_GROWTH * h), BALL_GROWTH * h)
      // the simulation wants the ball in the world, not in the box
      center.set(ball.x, 0, ball.z).applyMatrix4(world.matrixWorld)
      pathData.set([center.x, center.y, center.z, ball.radius], k * 4)
    }
    if (steps) device.queue.writeBuffer(ballPath, 0, pathData, 0, steps * substeps * 4)
    ballMesh.visible = ball.radius > 0
    ballMesh.scale.setScalar(ball.radius)
    ballMesh.position.set(ball.x, 0, ball.z)
  }

  // ---- the simulation and the panel ----------------------------------------------------------------
  // ?particles=20000 in the address starts with that many, in thousands from 1000 to 100 000.
  // ?draw=flat or ?draw=none starts with the cheap discs, or with no particles drawn at all.
  const query = new URLSearchParams(location.search)
  const asked = Math.round(Number(query.get('particles')) / 1000)
  const askedDraw = query.get('draw')
  const askedFriction = Number(query.get('friction') ?? Number.NaN) // ?friction=0 starts as a liquid
  const startTilt = (key: 'tiltX' | 'tiltZ') =>
    MathUtils.clamp(
      Number(query.get(key) ?? document.body.dataset[key] ?? 0) || 0,
      -MAX_TILT,
      MAX_TILT,
    )
  const settings = {
    // FORCE+ ('plus') or FORCE ('force'): the same rule, with α = 1 and c = 0
    method: 'plus',
    ...FORCE_PLUS,
    // a gentler start than decision 015, as in compare's tunable copy; ?c=0 starts without levels
    levels: query.has('c') ? MathUtils.clamp(Number(query.get('c')) || 0, 0, 4) : 1.5,
    // The speed limit: 'auto', the default of 1.5 × the safe one, 'safe', 'custom', `speed` in
    // m/s, or 'off' (decisions 017 to 019). With the default 1 substep, 'auto' is 9 m/s.
    maxSpeed: 'auto',
    speed: 20,
    // µ: 0 is the liquid of chapter 031, 0.3 already makes a pile stand (chapter 034). A page
    // sets its own start with data-friction on its <body>.
    friction:
      askedFriction >= 0 && askedFriction <= 1
        ? askedFriction
        : Number(document.body.dataset.friction ?? 0),
    // The tilt of the box around X and around Z, in degrees: only the force-tilt page has the
    // sliders.
    // ?tiltX=20 in the address starts tilted that much; else as the page's <body> says.
    tiltX: startTilt('tiltX'),
    tiltZ: startTilt('tiltZ'),
    particles: asked >= 1 && asked <= 100 ? asked * 1000 : 20000,
    masses: '1 to 100 kg',
    // How the particles are drawn: as shaded spheres with their own depth, as flat discs, or not
    // at all, to see how much of a frame goes into drawing them.
    draw: askedDraw === 'flat' || askedDraw === 'none' ? askedDraw : 'spheres',
    // How the cells keep their particles: the address book with a table (decision 024), the
    // address book with a slot per cell of the grid, or 4 places per cell. ?cells=book or
    // ?cells=places
    cells: (['book', 'places'].includes(query.get('cells') ?? '')
      ? query.get('cells')
      : 'table') as Cells,
    ball: BALL_RADIUS,
  }
  // ?margin=0 in the address: how far beyond touching the lists look, in meters. With 0 a
  // particle reads 3 × 3 × 3 cells, not 5 × 5 × 5, and the lists are made again at every step.
  const margin = query.has('margin')
    ? MathUtils.clamp(Number(query.get('margin')) || 0, 0, CELL)
    : MARGIN
  const stats = { gpu: Number.NaN, lists: Number.NaN, crowded: Number.NaN, leftOut: Number.NaN }
  /** α and c as the solver sees them: FORCE uses the real masses and no levels. */
  const solverAlpha = () => (settings.method === 'plus' ? settings.alpha : 1)
  const solverLevels = () => (settings.method === 'plus' ? settings.levels : 0)
  /** The speed limit asked for, in m/s, 0 for none. */
  const maxSpeed = () =>
    settings.maxSpeed === 'auto'
      ? DEFAULT_SHARE * safeSpeed(settings.substeps)
      : settings.maxSpeed === 'safe'
        ? safeSpeed(settings.substeps)
        : settings.maxSpeed === 'custom'
          ? settings.speed
          : 0
  // A page that tilts the box needs a grid that holds it at every tilt.
  // Cells as wide as the lists reach, a diameter plus the margin, so that 3 × 3 × 3 of them are
  // enough (decision 023). With ?narrow in the address, cells as wide as a particle, as before.
  // The 4 places per cell keep cells as wide as a particle: a wider cell holds more than 4, and
  // particles are left out (chapter 039).
  const cellWidth = () =>
    !query.has('narrow') && settings.cells !== 'places' ? DIAMETER + margin : CELL
  const gridOf = (cell: number) =>
    document.body.dataset.tilt !== undefined ? gridAround(MAX_TILT, cell) : levelGrid(cell)
  // ?slots=8 in the address: slots of the table per particle, at least; 2 without it.
  const slotsEach = Math.max(Number(query.get('slots')) || 2, 1)
  let simulation: Simulation | undefined
  let view: ParticleView | undefined
  let paused = false
  let owed = 0 // simulated time the steps still owe to real time
  let lastReading: { lists: number; steps: number; crowded: number; leftOut: number } | undefined

  /** Draws the same simulation again, in the way the panel asks. */
  function redraw() {
    if (view) {
      scene.remove(view.mesh)
      view.dispose()
      view = undefined
    }
    if (!simulation || settings.draw === 'none') return
    view = new ParticleView(renderer, simulation, {
      massRange: MASSES[settings.masses],
      look: settings.draw === 'flat' ? 'flat' : 'sphere',
    })
    scene.add(view.mesh)
  }

  function restart() {
    simulation?.destroy()
    const masses = MASSES[settings.masses]
    simulation = makeSimulation(
      device,
      kit,
      pointerBuffer,
      settings.particles,
      masses,
      gridOf(cellWidth()),
      world.matrixWorld,
      settings.cells,
      margin,
      cellWidth(),
      slotsEach,
      // ?sorted in the address: the particles kept in the order of the address book
      query.has('sorted'),
    )
    simulation.setBox(world.quaternion)
    applySolver()
    redraw()
    owed = 0
    lastReading = undefined
    stats.lists = stats.crowded = stats.leftOut = Number.NaN
  }
  // The box as it is turned now, in degrees. It follows the sliders at TILT_SPEED, not at once: a
  // floor that jumped by one degree would move 21 cm at its edge, more than a particle's radius.
  const tilt = { x: settings.tiltX, z: settings.tiltZ }
  const turnBox = () => {
    world.rotation.set(MathUtils.degToRad(tilt.x), 0, MathUtils.degToRad(tilt.z))
    world.updateMatrixWorld()
    simulation?.setBox(world.quaternion)
  }
  turnBox()
  /** Moves the box toward the tilt the sliders ask, for a frame that lasted dt seconds. */
  const followTilt = (dt: number) => {
    if (tilt.x === settings.tiltX && tilt.z === settings.tiltZ) return
    const most = TILT_SPEED * dt
    tilt.x += MathUtils.clamp(settings.tiltX - tilt.x, -most, most)
    tilt.z += MathUtils.clamp(settings.tiltZ - tilt.z, -most, most)
    turnBox()
  }
  const applySolver = () => {
    simulation?.setSolver(solverAlpha(), solverLevels(), settings.substeps, maxSpeed())
    simulation?.setFriction(settings.friction)
  }

  const pane = new Pane({ title: 'FORCE on the GPU', expanded: window.innerWidth >= 600 })
  pane.registerPlugin(EssentialsPlugin)
  const solver = pane.addFolder({ title: 'Solver' })
  // FORCE or FORCE+: with FORCE, α and c do not apply, and their sliders rest.
  const method = solver
    .addBinding(settings, 'method', { options: { 'FORCE+': 'plus', FORCE: 'force' } })
    .on('change', () => {
      alpha.disabled = levels.disabled = settings.method !== 'plus'
      applySolver()
    })
  const alpha = solver
    .addBinding(settings, 'alpha', { label: 'α', min: 0, max: 1, step: 0.05 })
    .on('change', applySolver)
  const levels = solver
    .addBinding(settings, 'levels', { label: 'c', min: 0, max: 4, step: 0.25 })
    .on('change', applySolver)
  // Each substep has its own rounds, so a step costs about as many times more.
  const substeps = solver
    .addBinding(settings, 'substeps', { min: 1, max: MAX_SUBSTEPS, step: 1 })
    .on('change', applySolver)
  // The speed limit: 1.5 × the safe one by default, the safe one, one radius per substep, or any
  // speed in m/s, at the risk of splashes above the safe one (decisions 017 to 019).
  solver
    .addBinding(settings, 'maxSpeed', {
      label: 'max speed',
      options: { 'default, 1.5 × safe': 'auto', safe: 'safe', 'in m/s': 'custom', off: 'off' },
    })
    .on('change', () => {
      speed.disabled = settings.maxSpeed !== 'custom'
      applySolver()
    })
  const speed = solver
    .addBinding(settings, 'speed', { label: 'm/s', min: 1, max: 60, step: 1, disabled: true })
    .on('change', applySolver)
  // The limit in use, and the safe one, read again by the panel a few times per second.
  const cap = {
    get value() {
      const now = maxSpeed()
      const short = (v: number) => String(Number(v.toFixed(1))) // 7.5, not 7.50; 9, not 9.0
      return `${now ? `${short(now)} m/s` : 'none'}, safe ${short(safeSpeed(settings.substeps))}`
    },
  }
  solver.addBinding(cap, 'value', { label: 'limit', readonly: true })
  solver
    .addBinding(settings, 'friction', { label: 'friction µ', min: 0, max: 1, step: 0.05 })
    .on('change', applySolver)
  solver.addButton({ title: 'as decision 015' }).on('click', () => {
    Object.assign(settings, FORCE_PLUS, { method: 'plus' })
    alpha.disabled = levels.disabled = false
    method.refresh()
    alpha.refresh()
    levels.refresh()
    substeps.refresh()
    applySolver()
  })
  const particles = pane.addFolder({ title: 'Particles' })
  // A new count builds everything again, so only when the slider is let go.
  particles
    .addBinding(settings, 'particles', { label: 'count', min: 1000, max: 100000, step: 1000 })
    .on('change', (event) => {
      if (event.last) restart()
    })
  particles
    .addBinding(settings, 'masses', {
      options: Object.fromEntries(Object.keys(MASSES).map((label) => [label, label])),
    })
    .on('change', restart)
  // A new way to keep the grid builds everything again.
  particles
    .addBinding(settings, 'cells', {
      label: 'grid',
      options: {
        '4 places per cell': 'places',
        'address book': 'book',
        'address book, table': 'table',
      },
    })
    .on('change', restart)
  particles
    .addBinding(settings, 'draw', {
      options: { spheres: 'spheres', 'flat discs': 'flat', nothing: 'none' },
    })
    .on('change', redraw)
  const buttons = particles.addBlade({
    view: 'buttongrid',
    size: [2, 1],
    cells: (x: number) => ({ title: ['pause', 'restart'][x] }),
  }) as ButtonGridApi
  buttons.on('click', ({ index: [x] }) => {
    if (x === 1) return restart()
    paused = !paused
    const cell = buttons.cell(0, 0)
    if (cell) cell.title = paused ? 'resume' : 'pause'
  })
  if (document.body.dataset.tilt !== undefined) {
    const tiltFolder = pane.addFolder({ title: 'Tilt' })
    for (const [key, label] of [
      ['tiltX', 'around X'],
      ['tiltZ', 'around Z'],
    ] as const)
      tiltFolder.addBinding(settings, key, {
        label,
        min: -MAX_TILT,
        max: MAX_TILT,
        step: 1,
        format: (v) => `${v}°`,
      })
    tiltFolder.addButton({ title: 'level' }).on('click', () => {
      settings.tiltX = settings.tiltZ = 0
      pane.refresh()
    })
  }
  const ballFolder = pane.addFolder({ title: 'Ball' })
  ballFolder.addBinding(settings, 'ball', { label: 'radius', min: 0.3, max: 3, step: 0.1 })
  const numbers = pane.addFolder({ title: 'Numbers' })
  const fps = numbers.addBlade({ view: 'fpsgraph', label: 'fps', rows: 2 }) as FpsGraphBladeApi
  numbers.addBinding(stats, 'gpu', {
    label: 'GPU step',
    readonly: true,
    format: (v) => (Number.isNaN(v) ? 'n/a' : `${v.toFixed(2)} ms`),
  })
  // The grid has 4 places per cell (decision 016): a particle that finds its cell full is seen by
  // nobody until the next list.
  numbers.addBinding(stats, 'leftOut', {
    label: 'cell full',
    readonly: true,
    format: (v) => (Number.isNaN(v) ? '…' : `${v.toFixed(0)} particles`),
  })
  numbers.addBinding(stats, 'crowded', {
    label: 'list full',
    readonly: true,
    format: (v) => (Number.isNaN(v) ? '…' : `${v.toFixed(0)} neighbours`),
  })
  numbers.addBinding(stats, 'lists', {
    label: 'new lists',
    readonly: true,
    format: (v) => (Number.isNaN(v) ? '…' : `${(v * 100).toFixed(0)}% of substeps`),
  })

  // ---- the GPU's numbers ---------------------------------------------------------------------------
  // Every SAMPLE_EVERY frames one step, all its substeps, is timed on the GPU clock, and the count
  // of lists made is copied out, both into one buffer JavaScript can read when the GPU is done.
  const stamps = hasClock ? device.createQuerySet({ type: 'timestamp', count: 2 }) : undefined
  const resolved = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })
  const readback = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })
  let reading = false
  function read(from: Simulation) {
    reading = true
    const steps = from.substepCount
    readback.mapAsync(GPUMapMode.READ).then(() => {
      const data = readback.getMappedRange()
      const [begin, end] = new BigUint64Array(data, 0, 2)
      const [, , , lists, crowded, leftOut] = new Uint32Array(data, 16, 8)
      readback.unmap()
      reading = false
      if (stamps && end > begin) {
        const ms = Number(end - begin) / 1e6
        stats.gpu = Number.isNaN(stats.gpu) ? ms : 0.7 * stats.gpu + 0.3 * ms
      }
      if (from !== simulation) return // restarted meanwhile
      if (lastReading && steps > lastReading.steps)
        stats.lists = (lists - lastReading.lists) / (steps - lastReading.steps)
      // per list made: how many particles found their cell full, and how many neighbours found
      // no room in a list of 32
      if (lastReading && lists > lastReading.lists) {
        stats.leftOut = (leftOut - lastReading.leftOut) / (lists - lastReading.lists)
        stats.crowded = (crowded - lastReading.crowded) / (lists - lastReading.lists)
      }
      lastReading = { lists, steps, crowded, leftOut }
    }, showError)
  }

  restart()

  // ?check in the address: after the first step, when the first lists exist, print how many
  // neighbours they hold and a sum that does not depend on their order. The two ways of keeping
  // the grid must print the same, as long as no cell was full.
  if (query.has('check') && simulation) {
    const sim = simulation
    const encoder = device.createCommandEncoder()
    moveBall(sim.particleCount, 1, sim.substeps, settings.ball)
    sim.encode(encoder, ballPath, 0)
    const sizes = [sim.particleCount * 4, sim.particleCount * MAX_NEIGHBOURS * 4]
    const copies = [sim.neighbourCounts, sim.neighbours].map((from, k) => {
      const to = device.createBuffer({
        size: sizes[k],
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      })
      encoder.copyBufferToBuffer(from, 0, to, 0, sizes[k])
      return to
    })
    device.queue.submit([encoder.finish()])
    await Promise.all(copies.map((b) => b.mapAsync(GPUMapMode.READ)))
    const counts = new Uint32Array(copies[0].getMappedRange())
    const lists = new Uint32Array(copies[1].getMappedRange())
    let total = 0
    let sum = 0
    counts.forEach((n, i) => {
      total += n
      for (let s = 0; s < n; s++)
        sum = (sum + Math.imul(i + 1, lists[i * MAX_NEIGHBOURS + s] + 7)) >>> 0
    })
    const note = document.createElement('p')
    note.id = 'check'
    note.textContent = `check ${settings.cells}: ${total} neighbours, sum ${sum}`
    document.querySelector('.crumb')?.append(note)
    for (const b of copies) b.destroy()
  }

  // ?profile=120 in the address: once ?after=600 steps have run, time every shader of the next 120
  // steps on the GPU clock, each in a pass of its own, and write under the title how many ms of a
  // step each one takes, on average. Shaders with the same name are added up: the three of the
  // sum, the six rounds.
  const profileSteps = hasClock && query.has('profile') ? Number(query.get('profile')) || 120 : 0
  const profileAfter = Number(query.get('after')) || 600
  const profileClock = profileSteps
    ? device.createQuerySet({ type: 'timestamp', count: 2 * MAX_PASSES })
    : undefined
  const profileResolved = device.createBuffer({
    size: 16 * MAX_PASSES,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })
  const profiled = {
    sent: 0,
    read: 0,
    ms: new Map<string, number>(),
    lists: [] as number[], // lists made so far, after each profiled step
    leftOut: [] as number[], // particles that found their cell full so far
    steps: [] as number[], // substeps run so far, after each profiled step
    whole: Number.NaN, // a step in one pass, as the panel showed it just before
  }
  /**
   * How deep the particles are into each other now: the positions are read back, and every pair
   * closer than a diameter is measured in JavaScript, with a grid of its own.
   */
  async function overlaps(sim: Simulation) {
    const size = sim.particleCount * 16
    const back = device.createBuffer({
      size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    })
    const encoder = device.createCommandEncoder()
    encoder.copyBufferToBuffer(sim.positionBuffer, 0, back, 0, size)
    device.queue.submit([encoder.finish()])
    await back.mapAsync(GPUMapMode.READ)
    const p = new Float32Array(back.getMappedRange().slice(0))
    back.destroy()
    const cellOf = (i: number, a: number) => Math.floor(p[i * 4 + a] / DIAMETER) + 4096
    const key = (x: number, y: number, z: number) => (x * 8192 + y) * 8192 + z
    const grid = new Map<number, number[]>()
    for (let i = 0; i < sim.particleCount; i++) {
      const k = key(cellOf(i, 0), cellOf(i, 1), cellOf(i, 2))
      const cell = grid.get(k)
      if (cell) cell.push(i)
      else grid.set(k, [i])
    }
    let touching = 0
    let deep = 0
    let deepest = 0
    for (let i = 0; i < sim.particleCount; i++)
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++)
            for (const j of grid.get(
              key(cellOf(i, 0) + dx, cellOf(i, 1) + dy, cellOf(i, 2) + dz),
            ) ?? []) {
              if (j <= i) continue
              const depth =
                DIAMETER -
                Math.hypot(
                  p[i * 4] - p[j * 4],
                  p[i * 4 + 1] - p[j * 4 + 1],
                  p[i * 4 + 2] - p[j * 4 + 2],
                )
              if (depth <= 0) continue
              touching++
              if (depth > 0.1 * RADIUS) deep++
              deepest = Math.max(deepest, depth)
            }
    return (
      `overlaps: ${touching} pairs closer than a diameter, ${deep} of them by more than ` +
      `${RADIUS * 10} cm, the deepest by ${(deepest * 100).toFixed(1)} cm`
    )
  }

  /** Reads the clock entries of one step, and the count of lists made, copied after them. */
  async function readProfile(back: GPUBuffer, names: string[], steps: number) {
    await back.mapAsync(GPUMapMode.READ)
    const data = back.getMappedRange()
    const times = new BigUint64Array(data, 0, 2 * names.length)
    names.forEach((name, k) => {
      const ms = Number(times[2 * k + 1] - times[2 * k]) / 1e6
      profiled.ms.set(name, (profiled.ms.get(name) ?? 0) + ms)
    })
    const control = new Uint32Array(data, 16 * names.length, 8)
    profiled.lists.push(control[3])
    profiled.leftOut.push(control[5])
    profiled.steps.push(steps)
    back.destroy()
    if (++profiled.read < profileSteps) return
    const made = Math.max(...profiled.lists) - Math.min(...profiled.lists)
    const ran = Math.max(...profiled.steps) - Math.min(...profiled.steps)
    const total = [...profiled.ms.values()].reduce((a, b) => a + b, 0) / profileSteps
    const lines = [
      `profile ${settings.cells}: ${settings.particles} particles, ${profileSteps} steps after ` +
        `${profileAfter}, ${settings.substeps} substeps, margin ${margin} m, cells of ${cellWidth()} m${query.has('hash') ? `, hash ${query.get('hash')}` : ''}${settings.cells === 'table' ? `, ${slotsEach} slots each` : ''}${query.has('sorted') ? ', particles in order' : ''}, lists made again in ${made} of ${ran} substeps`,
      ...[...profiled.ms].map(
        ([name, ms]) =>
          `${name.padEnd(8)} ${(ms / profileSteps).toFixed(3).padStart(7)} ms  ` +
          `${((100 * ms) / profileSteps / total).toFixed(0).padStart(3)}%`,
      ),
      `${'total'.padEnd(8)} ${total.toFixed(3).padStart(7)} ms`,
      `a step in one pass, just before: ${profiled.whole.toFixed(2)} ms`,
      `left out of a full cell, per list: ${(
        (Math.max(...profiled.leftOut) - Math.min(...profiled.leftOut)) / Math.max(made, 1)
      ).toFixed(0)}`,
      simulation ? await overlaps(simulation) : '',
    ]
    const note = document.createElement('pre')
    note.id = 'profile'
    note.textContent = lines.join('\n')
    document.querySelector('.crumb')?.append(note)
  }

  let last: number | undefined
  let frame = 0
  renderer.setAnimationLoop((now) => {
    fps.begin()
    const dt = last === undefined ? 0 : Math.min((now - last) / 1000, 0.1)
    last = now
    orbit.update()
    if (!paused) followTilt(dt)
    if (simulation) {
      const sim = simulation
      // A fixed step of 1/60 s: as many as real time asks, two per frame at most.
      if (!paused) owed += dt
      let steps = 0
      while (owed >= STEP && steps < MAX_STEPS_PER_FRAME) {
        owed -= STEP
        steps++
      }
      if (owed >= STEP) owed = 0 // the GPU cannot keep up: slow down rather than pile up
      moveBall(sim.particleCount, steps, sim.substeps, settings.ball)
      const sample = steps > 0 && !reading && frame++ % SAMPLE_EVERY === 0
      // the first step of this frame is profiled, if ?profile asks and the wait is over
      const profile =
        profileClock &&
        steps > 0 &&
        profiled.sent < profileSteps &&
        sim.substepCount >= profileAfter * sim.substeps
          ? { clock: profileClock, names: [] as string[] }
          : undefined
      if (profile && profiled.sent++ === 0) profiled.whole = stats.gpu
      const encoder = device.createCommandEncoder()
      for (let s = 0; s < steps; s++)
        sim.encode(
          encoder,
          ballPath,
          s * sim.substeps,
          sample && s === 0 && !profile ? stamps : undefined,
          s === 0 ? profile : undefined,
        )
      let profileBack: GPUBuffer | undefined
      if (profile) {
        const size = 16 * profile.names.length
        profileBack = device.createBuffer({
          size: size + 32,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        })
        encoder.resolveQuerySet(profile.clock, 0, 2 * profile.names.length, profileResolved, 0)
        encoder.copyBufferToBuffer(profileResolved, 0, profileBack, 0, size)
        encoder.copyBufferToBuffer(sim.control, 0, profileBack, size, 32)
      }
      if (sample) {
        if (stamps) {
          encoder.resolveQuerySet(stamps, 0, 2, resolved, 0)
          encoder.copyBufferToBuffer(resolved, 0, readback, 0, 16)
        }
        encoder.copyBufferToBuffer(sim.control, 0, readback, 16, 32)
      }
      device.queue.submit([encoder.finish()])
      if (sample) read(sim)
      if (profile && profileBack)
        readProfile(profileBack, profile.names, sim.substepCount).catch(showError)
    }
    // Same queue, same order: the steps sent above run before this drawing reads the positions.
    renderer.render(scene, camera)
    fps.end()
  })
}

start().catch(showError)
