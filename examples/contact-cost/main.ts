// What contacts cost on the GPU, timed.
//   Part 1, the grid: each particle takes a place in its cell, with the pigeonholes of chapter 024.
//   Part 2, moving positions: a whole step of the half and half rule, with compressed masses and
//   levels in the pile (chapters 026 and 029), 8 rounds per step.
//   Part 3, the spring: a whole step of springs and dampers measured in hertz (chapter 029), 8
//   substeps per step.
//   Part 4, a list of neighbours made only when needed (chapter 030), against the 27 cells.
// Add ?part=4 to the address to run part 4 alone: the GPU slows down after minutes of load.
// Each part is checked against the same algorithm written in JavaScript, then timed from a
// thousand particles to a hundred thousand.

import clearIfCode from './clear-if.wgsl?raw'
import commonCode from './common.wgsl?raw'
import finishCode from './finish.wgsl?raw'
import gridCode from './grid.wgsl?raw'
import gridIfCode from './grid-if.wgsl?raw'
import levelsCode from './levels.wgsl?raw'
import levelsListCode from './levels-list.wgsl?raw'
import listCode from './list.wgsl?raw'
import predictCode from './predict.wgsl?raw'
import rebuildCode from './rebuild.wgsl?raw'
import roundCode from './round.wgsl?raw'
import roundListCode from './round-list.wgsl?raw'
import springCode from './spring.wgsl?raw'
import watchCode from './watch.wgsl?raw'

const RADIUS = 0.1 // meters
const DIAMETER = 2 * RADIUS
const CELL = DIAMETER // a cell as wide as a particle (chapter 024)
const PLACES = 4 // per cell
const STEP = 1 / 60
const GRAVITY = 9.81
const ALPHA = 0.5 // the solver sees m^0.5 (chapter 029)
const LEVELS = 2 // c, per level (chapter 029)
const ROUNDS = 8
const HERTZ = 60 // the spring way: an eighth of the 480 substeps per second, Box2D's cap
const DAMPER = 0.3
const SUBSTEPS = 8
const MARGIN = 0.1 // the list of neighbours looks this far beyond touching, by default
const MAX_NEIGHBOURS = 32 // as in list.wgsl
const TIMED_STEPS = 60 // steps timed in a row for the list of neighbours
const RUNS = 20 // timings per row; the middle one is shown
const NO_LEVEL = 0xffffffff

type Vec3 = [number, number, number]

/** A scene: particles with x, y, z and 1 / mass in w (0 never moves), planes, and a grid around them. */
interface Scene {
  name: string
  positions: Float32Array
  planes: { normal: Vec3; offset: number }[]
  origin: Vec3
  size: Vec3
}

/** Repeats the same jitter at every run. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A heap packed as tightly as spheres go, on a floor and inside four walls: face-centred cubic, each
 * sphere touching 12 others, about 1.4 spheres per cell. `side` cubes of 4 spheres along each edge,
 * jittered by 1 mm. Masses are 1 kg, or between 1 and 10 kg at random.
 */
function heap(side: number, mixed = false, tall = side, lift = 0): Scene {
  const a = DIAMETER * Math.SQRT2 // the edge of one cube, for touching spheres
  const corners = [
    [0, 0, 0],
    [0.5, 0.5, 0],
    [0.5, 0, 0.5],
    [0, 0.5, 0.5],
  ]
  const next = random(1)
  const mass = random(3)
  const positions = new Float32Array(side * side * tall * 4 * 4)
  let n = 0
  for (let x = 0; x < side; x++)
    for (let y = 0; y < tall; y++)
      for (let z = 0; z < side; z++)
        for (const [cx, cy, cz] of corners) {
          positions[n++] = (x + cx) * a + RADIUS + (next() - 0.5) * 0.002
          positions[n++] = (y + cy) * a + RADIUS + lift + (next() - 0.5) * 0.002
          positions[n++] = (z + cz) * a + RADIUS + (next() - 0.5) * 0.002
          positions[n++] = mixed ? 1 / (1 + 9 * mass()) : 1
        }
  const width = side * a + DIAMETER
  const cells = Math.ceil(width / CELL)
  return {
    name: `heap of ${(side * side * tall * 4).toLocaleString('en-US')}${mixed ? ', 1-10 kg' : ''}${lift ? `, ${lift} m up` : ''}`,
    positions,
    planes: [
      { normal: [0, 1, 0], offset: 0 },
      { normal: [1, 0, 0], offset: 0 },
      { normal: [-1, 0, 0], offset: -width },
      { normal: [0, 0, 1], offset: 0 },
      { normal: [0, 0, -1], offset: -width },
    ],
    origin: [0, 0, 0],
    size: [cells, Math.ceil((tall * a + DIAMETER + lift) / CELL) + 4, cells],
  }
}

/** Two spheres on the floor, 1 kg under 100 kg: the hard case of chapter 029. */
function lightUnderHeavy(): Scene {
  return {
    name: '1 kg under 100 kg',
    positions: new Float32Array([0, RADIUS, 0, 1, 0, RADIUS + DIAMETER, 0, 1 / 100]),
    planes: [{ normal: [0, 1, 0], offset: 0 }],
    origin: [-0.5, 0, -0.5],
    size: [5, 5, 5],
  }
}

// ---- the same step in JavaScript, to check the GPU against ------------------------------------
// It finds neighbours by testing every pair, not through the grid, and counts in 64-bit floats.

interface Mirror {
  x: Float64Array
  v: Float64Array
  levels: Uint32Array
}

function mirrorStart(scene: Scene): Mirror {
  return {
    x: Float64Array.from(scene.positions),
    v: new Float64Array(scene.positions.length),
    levels: new Uint32Array(scene.positions.length / 4).fill(NO_LEVEL),
  }
}

function mirrorStep(scene: Scene, state: Mirror, rounds: number): void {
  const { x, v } = state
  const count = x.length / 4
  const fixed = (i: number) => x[i * 4 + 3] === 0
  let p = Float64Array.from(x)
  for (let i = 0; i < count; i++) {
    if (fixed(i)) continue
    v[i * 4 + 1] -= GRAVITY * STEP
    for (let k = 0; k < 3; k++) p[i * 4 + k] = x[i * 4 + k] + v[i * 4 + k] * STEP
  }
  const at = (q: Float64Array, i: number): Vec3 => [q[i * 4], q[i * 4 + 1], q[i * 4 + 2]]
  // levels, on the predicted positions, from last step's
  const before = state.levels
  const levels = new Uint32Array(count)
  for (let i = 0; i < count; i++) {
    const pi = at(p, i)
    let level = NO_LEVEL
    for (const { normal, offset } of scene.planes)
      if (normal[1] > 0.5 && dot(pi, normal) - offset - RADIUS < 0.001) level = 0
    for (let j = 0; j < count; j++) {
      if (j === i || before[j] === NO_LEVEL) continue
      const away = sub(pi, at(p, j))
      const distance = Math.hypot(...away)
      if (distance - DIAMETER < 0.001 && away[1] > 0.5 * distance)
        level = Math.min(level, before[j] + 1)
    }
    levels[i] = level
  }
  state.levels = levels
  const lightness = (w: number) => (w === 0 ? 0 : w ** ALPHA)
  for (let r = 0; r < rounds; r++) {
    const next = Float64Array.from(p)
    for (let i = 0; i < count; i++) {
      if (fixed(i)) continue
      const pi = at(p, i)
      const sum: Vec3 = [0, 0, 0]
      let n = 0
      for (let j = 0; j < count; j++) {
        if (j === i) continue
        const away = sub(pi, at(p, j))
        const distance = Math.hypot(...away)
        if (distance >= DIAMETER || distance === 0) continue
        const tilt =
          levels[i] !== NO_LEVEL && levels[j] !== NO_LEVEL
            ? Math.exp(LEVELS * (levels[i] - levels[j]))
            : 1
        const wi = lightness(p[i * 4 + 3]) * tilt
        const wj = lightness(p[j * 4 + 3])
        const share = ((DIAMETER - distance) * wi) / (wi + wj) / distance
        for (let k = 0; k < 3; k++) sum[k] += away[k] * share
        n++
      }
      for (const { normal, offset } of scene.planes) {
        const overlap = RADIUS - (dot(pi, normal) - offset)
        if (overlap > 0) {
          for (let k = 0; k < 3; k++) sum[k] += normal[k] * overlap
          n++
        }
      }
      if (n) for (let k = 0; k < 3; k++) next[i * 4 + k] = pi[k] + sum[k] * (0.5 + 0.5 / n)
    }
    p = next
  }
  for (let i = 0; i < count; i++) {
    if (fixed(i)) continue
    for (let k = 0; k < 3; k++) {
      v[i * 4 + k] = (p[i * 4 + k] - x[i * 4 + k]) / STEP
      x[i * 4 + k] = p[i * 4 + k]
    }
  }
}

/** The deepest overlap between two particles or with a plane, found through cells in JavaScript. */
function deepestPair(positions: Float32Array, scene: Scene): number {
  const cells = new Map<string, number[]>()
  const count = positions.length / 4
  const key = (i: number) => [0, 1, 2].map((k) => Math.floor(positions[i * 4 + k] / CELL))
  for (let i = 0; i < count; i++) {
    const k = key(i).join()
    cells.get(k)?.push(i) ?? cells.set(k, [i])
  }
  let worst = 0
  for (let i = 0; i < count; i++) {
    const pi: Vec3 = [positions[i * 4], positions[i * 4 + 1], positions[i * 4 + 2]]
    for (const { normal, offset } of scene.planes)
      worst = Math.max(worst, RADIUS - (dot(pi, normal) - offset))
    const [cx, cy, cz] = key(i)
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of cells.get([cx + dx, cy + dy, cz + dz].join()) ?? [])
            if (j > i)
              worst = Math.max(
                worst,
                DIAMETER -
                  Math.hypot(
                    ...sub(pi, [positions[j * 4], positions[j * 4 + 1], positions[j * 4 + 2]]),
                  ),
              )
  }
  return worst
}

/** One step of the spring way in JavaScript: every pair, forces from the substep before. */
function mirrorSpringStep(scene: Scene, state: Mirror): void {
  const { x, v } = state
  const count = x.length / 4
  const h = STEP / SUBSTEPS
  const omega = 2 * Math.PI * HERTZ
  const contact = (m: number, overlap: number, closing: number) =>
    m * omega * omega * overlap - 2 * DAMPER * m * omega * closing
  for (let s = 0; s < SUBSTEPS; s++) {
    const force = new Float64Array(count * 3)
    for (let i = 0; i < count; i++) {
      const w = x[i * 4 + 3]
      if (w === 0) continue
      force[i * 3 + 1] -= GRAVITY / w
      const pi: Vec3 = [x[i * 4], x[i * 4 + 1], x[i * 4 + 2]]
      const vi: Vec3 = [v[i * 4], v[i * 4 + 1], v[i * 4 + 2]]
      for (let j = 0; j < count; j++) {
        if (j === i) continue
        const away = sub(pi, [x[j * 4], x[j * 4 + 1], x[j * 4 + 2]])
        const distance = Math.hypot(...away)
        if (distance >= DIAMETER || distance === 0) continue
        const normal = away.map((a) => a / distance) as Vec3
        const closing = dot(sub(vi, [v[j * 4], v[j * 4 + 1], v[j * 4 + 2]]), normal)
        const f = contact(1 / (w + x[j * 4 + 3]), DIAMETER - distance, closing)
        for (let k = 0; k < 3; k++) force[i * 3 + k] += normal[k] * f
      }
      for (const { normal, offset } of scene.planes) {
        const overlap = RADIUS - (dot(pi, normal) - offset)
        if (overlap > 0) {
          const f = contact(1 / w, overlap, dot(vi, normal))
          for (let k = 0; k < 3; k++) force[i * 3 + k] += normal[k] * f
        }
      }
    }
    for (let i = 0; i < count; i++) {
      const w = x[i * 4 + 3]
      if (w === 0) continue
      for (let k = 0; k < 3; k++) {
        v[i * 4 + k] += force[i * 3 + k] * w * h
        x[i * 4 + k] += v[i * 4 + k] * h
      }
    }
  }
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

// ---- the GPU --------------------------------------------------------------------------------------

async function run(): Promise<string> {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) throw new Error('no WebGPU here')
  const hasClock = adapter.features.has('timestamp-query')
  const device = await adapter.requestDevice({
    requiredFeatures: hasClock ? ['timestamp-query'] : [],
  })
  // WebGPU reports a rejected command here, not with an exception: we print them all at the end.
  const errors = new Set<string>()
  device.addEventListener('uncapturederror', (event) => {
    errors.add((event as GPUUncapturedErrorEvent).error.message.split('\n')[0])
  })
  const pipeline = (code: string) =>
    device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: commonCode + code }) },
    })
  const [predict, grid, levels, round, finish, spring] = await Promise.all(
    [predictCode, gridCode, levelsCode, roundCode, finishCode, springCode].map(pipeline),
  )
  const [watch, clearIf, gridIf, list, levelsList, roundList] = await Promise.all(
    [
      watchCode,
      rebuildCode + clearIfCode,
      rebuildCode + gridIfCode,
      rebuildCode + listCode,
      levelsListCode,
      roundListCode,
    ].map(pipeline),
  )
  const manyStamps = hasClock
    ? device.createQuerySet({ type: 'timestamp', count: 2 * TIMED_STEPS })
    : undefined
  const manyResolved = device.createBuffer({
    size: 16 * TIMED_STEPS,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })
  const stamps = hasClock ? device.createQuerySet({ type: 'timestamp', count: 2 }) : undefined
  const resolved = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })

  /** Copies a GPU buffer where JavaScript can read it. */
  async function read(buffer: GPUBuffer, size: number): Promise<ArrayBuffer> {
    const readable = device.createBuffer({
      size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    })
    const encoder = device.createCommandEncoder()
    encoder.copyBufferToBuffer(buffer, 0, readable, 0, size)
    device.queue.submit([encoder.finish()])
    await readable.mapAsync(GPUMapMode.READ)
    const copy = readable.getMappedRange().slice(0)
    readable.destroy()
    return copy
  }

  /**
   * Everything one scene needs on the GPU, and a function that encodes one step of it, moving
   * positions or with springs.
   */
  function prepare(scene: Scene, way: 'positions' | 'spring' = 'positions') {
    const count = scene.positions.length / 4
    const cellCount = scene.size[0] * scene.size[1] * scene.size[2]
    const storage = (size: number, extra = 0) =>
      device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | extra })
    const positions = storage(scene.positions.byteLength, GPUBufferUsage.COPY_SRC)
    const velocities = storage(scene.positions.byteLength)
    // The spring way moves positions and velocities between two buffers each, a substep each.
    const positionsB = storage(scene.positions.byteLength)
    const velocitiesB = storage(scene.positions.byteLength)
    const predicted = [storage(scene.positions.byteLength), storage(scene.positions.byteLength)]
    const counts = storage(cellCount * 4, GPUBufferUsage.COPY_SRC)
    const places = storage(cellCount * PLACES * 4, GPUBufferUsage.COPY_SRC)
    const levelBuffers = [storage(count * 4), storage(count * 4)]
    const planes = storage(Math.max(scene.planes.length, 1) * 16)
    device.queue.writeBuffer(positions, 0, scene.positions)
    for (const b of levelBuffers)
      device.queue.writeBuffer(b, 0, new Uint32Array(count).fill(NO_LEVEL))
    device.queue.writeBuffer(
      planes,
      0,
      new Float32Array(scene.planes.flatMap(({ normal, offset }) => [...normal, offset])),
    )
    // The Params struct of common.wgsl: 80 bytes, in its order.
    const data = new ArrayBuffer(80)
    const floats = new Float32Array(data)
    const words = new Uint32Array(data)
    floats.set([0, -GRAVITY, 0, STEP, ...scene.origin, CELL])
    words.set([...scene.size, PLACES], 8)
    floats.set([RADIUS, ALPHA, LEVELS], 12)
    words[15] = scene.planes.length
    floats.set([2 * Math.PI * HERTZ, DAMPER, STEP / SUBSTEPS, MARGIN], 16)
    const params = device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(params, 0, data)

    const group = (p: GPUComputePipeline, buffers: GPUBuffer[]) =>
      device.createBindGroup({
        layout: p.getBindGroupLayout(0),
        entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })),
      })
    const predictGroup = group(predict, [params, positions, velocities, predicted[0]])
    const gridGroup = group(grid, [params, predicted[0], counts, places])
    // Levels alternate between two buffers, a step each; positions between two, a round each.
    const levelGroups = [0, 1].map((k) =>
      group(levels, [
        params,
        predicted[0],
        counts,
        places,
        planes,
        levelBuffers[k],
        levelBuffers[1 - k],
      ]),
    )
    const roundGroups = [0, 1].map((k) =>
      [0, 1].map((from) =>
        group(round, [
          params,
          predicted[from],
          predicted[1 - from],
          counts,
          places,
          planes,
          levelBuffers[1 - k],
        ]),
      ),
    )
    const finishGroups = [0, 1].map((last) =>
      group(finish, [params, positions, velocities, predicted[last]]),
    )
    const springGridGroup = group(grid, [params, positions, counts, places])
    const springGroups = [
      group(spring, [
        params,
        positions,
        velocities,
        positionsB,
        velocitiesB,
        counts,
        places,
        planes,
      ]),
      group(spring, [
        params,
        positionsB,
        velocitiesB,
        positions,
        velocities,
        counts,
        places,
        planes,
      ]),
    ]
    const workgroups = Math.ceil(count / 64)
    let parity = 0

    function encode(
      encoder: GPUCommandEncoder,
      rounds: number,
      timestampWrites?: GPUComputePassTimestampWrites,
    ) {
      encoder.clearBuffer(counts) // every step starts from empty cells
      const pass = encoder.beginComputePass(timestampWrites && { timestampWrites })
      const dispatch = (p: GPUComputePipeline, g: GPUBindGroup) => {
        pass.setPipeline(p)
        pass.setBindGroup(0, g)
        pass.dispatchWorkgroups(workgroups)
      }
      if (way === 'positions') {
        dispatch(predict, predictGroup)
        dispatch(grid, gridGroup)
        dispatch(levels, levelGroups[parity])
        for (let r = 0; r < rounds; r++) dispatch(round, roundGroups[parity][r % 2])
        dispatch(finish, finishGroups[rounds % 2])
      } else {
        // rounds counts substeps here; an even number ends in the first buffers again
        dispatch(grid, springGridGroup)
        for (let s = 0; s < rounds; s++) dispatch(spring, springGroups[s % 2])
      }
      pass.end()
      parity = 1 - parity
    }

    /** Runs `steps` steps in one submit. */
    function steps(n: number, rounds = ROUNDS) {
      const encoder = device.createCommandEncoder()
      for (let s = 0; s < n; s++) encode(encoder, rounds)
      device.queue.submit([encoder.finish()])
    }

    /** The GPU time of one step, in microseconds: the middle of RUNS. */
    async function time(rounds = ROUNDS): Promise<number> {
      const times: number[] = []
      for (let r = 0; r < RUNS; r++) {
        const encoder = device.createCommandEncoder()
        encode(
          encoder,
          rounds,
          stamps && { querySet: stamps, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
        )
        if (stamps) encoder.resolveQuerySet(stamps, 0, 2, resolved, 0)
        device.queue.submit([encoder.finish()])
        const [begin, end] = new BigUint64Array(await read(resolved, 16))
        times.push(Number(end - begin) / 1000)
      }
      times.sort((a, b) => a - b)
      return times[RUNS >> 1]
    }

    async function positionsNow() {
      return new Float32Array(await read(positions, scene.positions.byteLength))
    }

    /** How many particles found no place in the grid at the last step. */
    async function leftOut() {
      const c = new Uint32Array(await read(counts, cellCount * 4))
      return c.reduce((sum, n) => sum + Math.max(n - PLACES, 0), 0)
    }

    function destroy() {
      for (const b of [
        positions,
        velocities,
        positionsB,
        velocitiesB,
        ...predicted,
        counts,
        places,
        ...levelBuffers,
        planes,
        params,
      ])
        b.destroy()
    }

    return {
      count,
      steps,
      time,
      timeMany: () => timeMany((encoder, writes) => encode(encoder, ROUNDS, writes)),
      positionsNow,
      leftOut,
      destroy,
    }
  }

  /** The mean GPU time of TIMED_STEPS steps in a row, in microseconds, each step timed apart. */
  async function timeMany(
    encode: (encoder: GPUCommandEncoder, writes?: GPUComputePassTimestampWrites) => void,
  ): Promise<number> {
    const encoder = device.createCommandEncoder()
    for (let s = 0; s < TIMED_STEPS; s++)
      encode(
        encoder,
        manyStamps && {
          querySet: manyStamps,
          beginningOfPassWriteIndex: 2 * s,
          endOfPassWriteIndex: 2 * s + 1,
        },
      )
    if (!manyStamps) {
      device.queue.submit([encoder.finish()])
      return Number.NaN
    }
    encoder.resolveQuerySet(manyStamps, 0, 2 * TIMED_STEPS, manyResolved, 0)
    device.queue.submit([encoder.finish()])
    const times = new BigUint64Array(await read(manyResolved, 16 * TIMED_STEPS))
    let total = 0
    for (let s = 0; s < TIMED_STEPS; s++) total += Number(times[2 * s + 1] - times[2 * s])
    return total / TIMED_STEPS / 1000
  }

  /**
   * Moving positions through a list of neighbours. The list is made again every `every` steps,
   * or, with 'auto', when the GPU finds that some particle moved more than 0.4 of the margin.
   */
  function prepareList(scene: Scene, every: number | 'auto', margin = MARGIN) {
    const count = scene.positions.length / 4
    const cellCount = scene.size[0] * scene.size[1] * scene.size[2]
    const storage = (size: number, extra = 0) =>
      device.createBuffer({
        size,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | extra,
      })
    const bytes = scene.positions.byteLength
    const positions = storage(bytes, GPUBufferUsage.COPY_SRC)
    const velocities = storage(bytes)
    const predicted = [storage(bytes), storage(bytes)]
    const counts = storage(cellCount * 4)
    const places = storage(cellCount * PLACES * 4)
    const levelBuffers = [storage(count * 4), storage(count * 4)]
    const planes = storage(Math.max(scene.planes.length, 1) * 16)
    const neighbours = storage(count * MAX_NEIGHBOURS * 4)
    const neighbourCounts = storage(count * 4)
    const anchors = storage(bytes)
    const control = storage(32, GPUBufferUsage.COPY_SRC) // see rebuild.wgsl
    const flag = (value: number) => {
      const b = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      })
      device.queue.writeBuffer(b, 0, new Uint32Array([value]))
      return b
    }
    const [zero, one] = [flag(0), flag(1)]
    device.queue.writeBuffer(positions, 0, scene.positions)
    for (const b of levelBuffers)
      device.queue.writeBuffer(b, 0, new Uint32Array(count).fill(NO_LEVEL))
    device.queue.writeBuffer(
      planes,
      0,
      new Float32Array(scene.planes.flatMap(({ normal, offset }) => [...normal, offset])),
    )
    device.queue.writeBuffer(control, 0, new Uint32Array([1, every === 'auto' ? 1 : 0, 0, 0, 0]))
    const data = new ArrayBuffer(80)
    const floats = new Float32Array(data)
    const words = new Uint32Array(data)
    floats.set([0, -GRAVITY, 0, STEP, ...scene.origin, CELL])
    words.set([...scene.size, PLACES], 8)
    floats.set([RADIUS, ALPHA, LEVELS], 12)
    words[15] = scene.planes.length
    floats.set([2 * Math.PI * HERTZ, DAMPER, STEP / SUBSTEPS, margin], 16)
    const params = device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(params, 0, data)

    const group = (p: GPUComputePipeline, buffers: GPUBuffer[]) =>
      device.createBindGroup({
        layout: p.getBindGroupLayout(0),
        entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })),
      })
    const predictGroup = group(predict, [params, positions, velocities, predicted[0]])
    const watchGroup = group(watch, [params, predicted[0], anchors, control])
    const clearGroup = group(clearIf, [params, control, counts])
    const gridGroup = group(gridIf, [params, predicted[0], counts, places, control])
    const listGroup = group(list, [
      params,
      predicted[0],
      counts,
      places,
      control,
      neighbours,
      neighbourCounts,
      anchors,
    ])
    const levelGroups = [0, 1].map((k) =>
      group(levelsList, [
        params,
        predicted[0],
        neighbours,
        neighbourCounts,
        planes,
        levelBuffers[k],
        levelBuffers[1 - k],
      ]),
    )
    const roundGroups = [0, 1].map((k) =>
      [0, 1].map((from) =>
        group(roundList, [
          params,
          predicted[from],
          predicted[1 - from],
          neighbours,
          neighbourCounts,
          planes,
          levelBuffers[1 - k],
        ]),
      ),
    )
    const finishGroups = [0, 1].map((last) =>
      group(finish, [params, positions, velocities, predicted[last]]),
    )
    const workgroups = Math.ceil(count / 64)
    const cellWorkgroups = Math.ceil(cellCount / 64)
    let parity = 0
    let stepIndex = 0

    function encode(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites) {
      encoder.clearBuffer(control, 8, 4) // the largest move, measured again at every step
      const now = every === 'auto' ? stepIndex === 0 : stepIndex % every === 0
      encoder.copyBufferToBuffer(now ? one : zero, 0, control, 0, 4)
      const pass = encoder.beginComputePass(timestampWrites && { timestampWrites })
      const dispatch = (p: GPUComputePipeline, g: GPUBindGroup, n = workgroups) => {
        pass.setPipeline(p)
        pass.setBindGroup(0, g)
        pass.dispatchWorkgroups(n)
      }
      dispatch(predict, predictGroup)
      dispatch(watch, watchGroup)
      dispatch(clearIf, clearGroup, cellWorkgroups)
      dispatch(gridIf, gridGroup)
      dispatch(list, listGroup)
      dispatch(levelsList, levelGroups[parity])
      for (let r = 0; r < ROUNDS; r++) dispatch(roundList, roundGroups[parity][r % 2])
      dispatch(finish, finishGroups[ROUNDS % 2])
      pass.end()
      parity = 1 - parity
      stepIndex++
    }

    return {
      steps(n: number) {
        const encoder = device.createCommandEncoder()
        for (let s = 0; s < n; s++) encode(encoder)
        device.queue.submit([encoder.finish()])
      },
      timeMany: () => timeMany(encode),
      /** Lists made so far, and neighbours that found no room in a list. */
      async stats() {
        return [...new Uint32Array(await read(control, 32)).slice(3, 5)]
      },
      async positionsNow() {
        return new Float32Array(await read(positions, bytes))
      },
      destroy() {
        for (const b of [
          positions,
          velocities,
          ...predicted,
          counts,
          places,
          ...levelBuffers,
          planes,
          neighbours,
          neighbourCounts,
          anchors,
          control,
          zero,
          one,
          params,
        ])
          b.destroy()
      },
    }
  }

  const lines = [
    `${adapter.info.description || adapter.info.vendor} (${adapter.info.architecture})`,
    '',
    'Times are on the GPU clock, in microseconds: a thousandth of a millisecond.',
    `Each time is the middle one of ${RUNS} runs. A frame at 60 per second lasts 16 700.`,
  ]

  const only = new URLSearchParams(location.search).get('part')
  if (!only) {
    // ---- the check -----------------------------------------------------------------------------------
    lines.push('', 'The check: the GPU against the same step in JavaScript.')
    {
      const scene = heap(3, true)
      const gpu = prepare(scene)
      const mirror = mirrorStart(scene)
      gpu.steps(10)
      for (let s = 0; s < 10; s++) mirrorStep(scene, mirror, ROUNDS)
      const got = await gpu.positionsNow()
      let gap = 0
      for (let i = 0; i < got.length; i++)
        if (i % 4 !== 3) gap = Math.max(gap, Math.abs(got[i] - mirror.x[i]))
      lines.push(
        `  ${scene.name}, after 10 steps: largest gap ${(gap * 1000).toFixed(4)} mm, left out of the grid ${await gpu.leftOut()}`,
      )
      gpu.destroy()
    }
    {
      const scene = lightUnderHeavy()
      const gpu = prepare(scene)
      const mirror = mirrorStart(scene)
      gpu.steps(480)
      for (let s = 0; s < 480; s++) mirrorStep(scene, mirror, ROUNDS)
      const got = await gpu.positionsNow()
      const deep = (y0: number, y1: number) => ((DIAMETER - (y1 - y0)) * 1000).toFixed(2)
      lines.push(
        `  ${scene.name}, after 8 s: they overlap ${deep(got[1], got[5])} mm on the GPU, ${deep(mirror.x[1], mirror.x[5])} mm in JavaScript`,
      )
      gpu.destroy()
    }

    // ---- the times -----------------------------------------------------------------------------------
    lines.push(
      '',
      `Moving positions: a whole step, ${ROUNDS} rounds of half and half, alpha ${ALPHA}, levels ${LEVELS}.`,
      'Heaps 10 layers tall, as wide as it takes, settled for 2 s first. Without rounds, the step only',
      'predicts, builds the grid, finds the levels and finishes; the rest is the rounds.',
      '',
      'scene                       step   without rounds   one round   left out   deepest pair',
    )
    for (const side of [7, 23, 73]) {
      const scene = heap(side, false, 5)
      const gpu = prepare(scene)
      gpu.steps(120)
      const full = await gpu.time()
      // Checked now: the steps timed without rounds below push nothing apart, and the heap sinks.
      const deepest = deepestPair(await gpu.positionsNow(), scene)
      const out = await gpu.leftOut()
      const bare = await gpu.time(0)
      lines.push(
        `${scene.name.padEnd(24)}${full.toFixed(0).padStart(8)}${bare.toFixed(0).padStart(17)}` +
          `${((full - bare) / ROUNDS).toFixed(1).padStart(12)}${String(out).padStart(11)}` +
          `${(deepest * 1000).toFixed(1).padStart(12)} mm`,
      )
      gpu.destroy()
    }

    // ---- part 3: the spring ----------------------------------------------------------------------------
    lines.push('', `The spring way, checked: ${HERTZ} Hz, damper ${DAMPER}, ${SUBSTEPS} substeps.`)
    {
      const scene = heap(3, true)
      const gpu = prepare(scene, 'spring')
      const mirror = mirrorStart(scene)
      gpu.steps(10, SUBSTEPS)
      for (let s = 0; s < 10; s++) mirrorSpringStep(scene, mirror)
      const got = await gpu.positionsNow()
      let gap = 0
      for (let i = 0; i < got.length; i++)
        if (i % 4 !== 3) gap = Math.max(gap, Math.abs(got[i] - mirror.x[i]))
      lines.push(`  ${scene.name}, after 10 steps: largest gap ${(gap * 1000).toFixed(4)} mm`)
      gpu.destroy()
    }
    {
      const scene = lightUnderHeavy()
      const gpu = prepare(scene, 'spring')
      const mirror = mirrorStart(scene)
      gpu.steps(480, SUBSTEPS)
      for (let s = 0; s < 480; s++) mirrorSpringStep(scene, mirror)
      const got = await gpu.positionsNow()
      const deep = (y0: number, y1: number) => ((DIAMETER - (y1 - y0)) * 1000).toFixed(2)
      lines.push(
        `  ${scene.name}, after 8 s: they overlap ${deep(got[1], got[5])} mm on the GPU, ${deep(mirror.x[1], mirror.x[5])} mm in JavaScript`,
      )
      gpu.destroy()
    }
    lines.push(
      '',
      `The spring way, timed: a whole step of ${SUBSTEPS} substeps, on the same heaps, settled for 2 s.`,
      'Without substeps, the step only builds the grid; the rest is the substeps.',
      '',
      'scene                       step  without substeps  one substep   left out   deepest pair',
    )
    for (const side of [7, 23, 73]) {
      const scene = heap(side, false, 5)
      const gpu = prepare(scene, 'spring')
      gpu.steps(120, SUBSTEPS)
      const full = await gpu.time(SUBSTEPS)
      const deepest = deepestPair(await gpu.positionsNow(), scene)
      const out = await gpu.leftOut()
      const bare = await gpu.time(0)
      lines.push(
        `${scene.name.padEnd(24)}${full.toFixed(0).padStart(8)}${bare.toFixed(0).padStart(18)}` +
          `${((full - bare) / SUBSTEPS).toFixed(1).padStart(13)}${String(out).padStart(11)}` +
          `${(deepest * 1000).toFixed(1).padStart(12)} mm`,
      )
      gpu.destroy()
    }
  }

  // ---- part 4: the list of neighbours ---------------------------------------------------------------
  // The M1's GPU slows down after minutes of load, so the ways are timed in turns, five times over,
  // and the middle of the five is kept: a slowdown falls on all of them alike.
  lines.push(
    '',
    'Part 4. Moving positions through a list of neighbours: every other particle closer than a',
    'diameter plus a margin, made from the grid, then read by the levels and every round.',
    `Mean step over ${TIMED_STEPS} steps in a row, in microseconds, the middle of 5 turns.`,
    'At rest: heaps settled for 2 s. Falling: the same heaps let go 1 m above the floor, timed',
    'once, over the first second. Lists: how many were made in those steps, and neighbours',
    'dropped for lack of room in all of them. Deepest: the deepest pair after the fall.',
  )
  const ways: { label: string; every?: number | 'auto'; margin?: number }[] = [
    { label: '27 cells each round' },
    { label: 'list every step, 10 cm', every: 1, margin: 0.1 },
    { label: 'list every 3 steps, 10 cm', every: 3, margin: 0.1 },
    { label: 'list when needed, 10 cm', every: 'auto', margin: 0.1 },
    { label: 'list when needed, 5 cm', every: 'auto', margin: 0.05 },
  ]
  const make = (scene: Scene, way: (typeof ways)[number]) => {
    if (way.every === undefined) {
      const gpu = prepare(scene)
      return {
        steps: gpu.steps,
        timeMany: gpu.timeMany,
        positionsNow: gpu.positionsNow,
        stats: async () => [0, 0],
        destroy: gpu.destroy,
      }
    }
    return prepareList(scene, way.every, way.margin)
  }
  for (const side of [7, 23, 73]) {
    lines.push(
      '',
      heap(side, false, 5).name,
      'way                          at rest   lists      falling   lists   dropped   deepest',
    )
    // at rest, in turns
    const resting = ways.map((way) => make(heap(side, false, 5), way))
    for (const gpu of resting) gpu.steps(120)
    const restTimes: number[][] = ways.map(() => [])
    const restLists: number[] = ways.map(() => 0)
    for (let turn = 0; turn < 5; turn++)
      for (const [k, gpu] of resting.entries()) {
        const [before] = await gpu.stats()
        restTimes[k].push(await gpu.timeMany())
        restLists[k] += (await gpu.stats())[0] - before
      }
    for (const gpu of resting) gpu.destroy()
    for (const [k, way] of ways.entries()) {
      const scene = heap(side, false, 5, 1)
      const gpu = make(scene, way)
      const fall = await gpu.timeMany()
      const [made, dropped] = await gpu.stats()
      const deepest = deepestPair(await gpu.positionsNow(), scene)
      gpu.destroy()
      const middle = restTimes[k].sort((a, b) => a - b)[2]
      const list = way.every !== undefined
      lines.push(
        way.label.padEnd(27) +
          middle.toFixed(0).padStart(9) +
          (list ? `${restLists[k]}/${5 * TIMED_STEPS}` : '-').padStart(9) +
          fall.toFixed(0).padStart(13) +
          (list ? `${made}/${TIMED_STEPS}` : '-').padStart(8) +
          (list ? String(dropped) : '-').padStart(10) +
          `${(deepest * 1000).toFixed(1)} mm`.padStart(10),
      )
    }
  }
  if (errors.size) lines.push('', 'WebGPU errors:', ...errors)
  return lines.join('\n')
}

const output = document.getElementById('output') as HTMLElement
run().then(
  (text) => {
    output.textContent = text
  },
  (error: unknown) => {
    output.textContent = `Failed: ${error instanceof Error ? error.message : String(error)}`
  },
)
