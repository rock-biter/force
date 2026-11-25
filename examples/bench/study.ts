// The measure behind the cells study, shared by two users: the bench page, which runs it on the
// device of whoever opens it, and docs/topics/cells-study.mjs, which runs it in Chrome without a
// window and keeps the numbers of our own machine.
//
// A scene is a set of particles at rest, 20 cm wide, on a lattice with a little noise, numbered
// in random order. Nothing moves: the shaders of examples/heap-simulation that find the neighbours and
// one round of pushes are timed on it. A step is making the book, making the lists and six rounds.
//
// `study` must stay self-contained, with no import and nothing from outside its own body: the
// script sends its text to the page it measures in. Only syntax that Node can strip is used here
// (no enum, no namespace), so that the script can import this file as it is.

/** A way to keep the cells: 4 places per cell, the address book on a grid, or a hash of the table. */
export type Way = 'places' | 'grid' | 'scattered' | 'rows' | 'zorder' | 'blocks'

export interface Scene {
  /** A layer on a floor of 24 m, a cube, a beam of 16 by 16 particles, or heaps of 1000. */
  shape: 'slab' | 'cube' | 'beam' | 'islands'
  count: number
  /** For the heaps: the side of the cube of world they are scattered in, in meters. */
  world?: number
  /** For the beam: the axis it lies along. */
  axis?: 'x' | 'y' | 'z'
}

export interface Job {
  sweep: string
  scene: Scene
  way: Way
  /** The particles moved into the order of the book. */
  sorted: boolean
  /** Slots of the table per particle, at least. */
  slots: number
  /** The width of a cell, in meters. */
  cell: number
  /** For 'blocks': cells a side of a block kept together. */
  block?: number
}

export interface Result extends Scene {
  sweep: string
  way: Way
  sorted: boolean
  block?: number
  cell: number
  /** Slots of the table, or cells of the grid. */
  slots: number
  perParticle: number
  cellsMB: number
  worldCells: number
  /** The grid does not fit the shaders or the memory of this device. */
  tooLarge?: boolean
  fullCells?: number
  /** The share of the cells holding particles that share their slot with another such cell. */
  sharing?: number
  neighbours?: number
  leftOut?: number
  /** Milliseconds: making the book, making the lists, one round of pushes, and a step. */
  build?: number
  list?: number
  round?: number
  step?: number
  error?: string
}

export type Shaders = Record<
  | 'common'
  | 'rebuild'
  | 'clear'
  | 'gridIf'
  | 'placesList'
  | 'cellsGrid'
  | 'cellsTable'
  | 'count'
  | 'blocks'
  | 'scan'
  | 'ends'
  | 'fill'
  | 'list'
  | 'move'
  | 'settle'
  | 'round',
  string
>

export interface Study {
  gpu: string
  /** 'gpu': timestamps of the GPU. 'page': the clock of the page around a readback. */
  clock: 'gpu' | 'page'
  results: Result[]
}

/**
 * Runs every job of the plan, one after the other, and tells `report` after each. With
 * `pageClock`, or on a device with no GPU clock, times are read on the page's clock.
 */
export async function study(
  shaders: Shaders,
  plan: Job[],
  report: (row: Result, index: number, of: number) => unknown,
  pageClock = false,
): Promise<Study> {
  const RADIUS = 0.1
  const SPACING = 0.2 // touching
  const MARGIN = 0.05
  const MAX_NEIGHBOURS = 32
  const BLOCK = 512 // of the prefix sum, as in book-blocks.wgsl
  const RUNS = 7

  // A random number generator that gives the same numbers at every run (mulberry32).
  const random = (start: number) => {
    let seed = start
    return () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  /** The particles of a scene: xyz and 1 / mass, in random order. */
  function particles(scene: Scene): Float32Array {
    const rand = random(12345)
    const points: number[][] = []
    const lattice = (nx: number, ny: number, nz: number, at: number[], most: number) => {
      let left = most
      for (let y = 0; y < ny; y++)
        for (let z = 0; z < nz; z++)
          for (let x = 0; x < nx; x++) {
            if (left-- <= 0) return
            points.push([
              at[0] + x * SPACING + (rand() - 0.5) * 0.01,
              at[1] + RADIUS + y * SPACING + (rand() - 0.5) * 0.01,
              at[2] + z * SPACING + (rand() - 0.5) * 0.01,
            ])
          }
    }
    const { shape, count } = scene
    if (shape === 'slab') lattice(120, Math.ceil(count / 14400), 120, [-12, 0, -12], count)
    else if (shape === 'cube') {
      const n = Math.ceil(Math.cbrt(count))
      lattice(n, n, n, [0, 0, 0], count)
    } else if (shape === 'beam') {
      const long = Math.ceil(count / 256)
      const [nx, ny, nz] =
        scene.axis === 'x' ? [long, 16, 16] : scene.axis === 'y' ? [16, long, 16] : [16, 16, long]
      lattice(nx, ny, nz, [0, 0, 0], count)
    } else {
      // heaps of 10 x 10 x 10 particles, each in its own cube of 2.5 m of the world
      const side = Math.floor((scene.world ?? 20) / 2.5)
      const taken = new Set<string>()
      for (let left = count; left > 0; left -= 1000) {
        let at: number[]
        do at = [0, 1, 2].map(() => Math.floor(rand() * side))
        while (taken.has(at.join()))
        taken.add(at.join())
        lattice(
          10,
          10,
          10,
          at.map((v) => v * 2.5),
          Math.min(left, 1000),
        )
      }
    }
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[points[i], points[j]] = [points[j], points[i]]
    }
    const data = new Float32Array(points.length * 4)
    for (const [i, p] of points.entries()) data.set([p[0], p[1], p[2], 1], i * 4)
    return data
  }

  // The hashes, in WGSL and again in JavaScript, to count the cells that share a slot.
  const P = [73856093, 19349663, 83492791]
  const SPREAD = `
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
  const ROWS = '(((u.y * 19349663u) ^ (u.z * 83492791u)) + u.x) % slots'
  const hashCode = (job: Job) => {
    if (job.way === 'rows') return ROWS
    if (job.way === 'scattered')
      return '((u.x * 73856093u) ^ (u.y * 19349663u) ^ (u.z * 83492791u)) % slots'
    if (job.way === 'zorder') return 'zorder(u) % slots'
    const block = job.block ?? 8
    const shift = Math.log2(block)
    return `((((u.x >> ${shift}u) * 73856093u) ^ ((u.y >> ${shift}u) * 19349663u) ^ ((u.z >> ${shift}u) * 83492791u)) * ${block ** 3}u + zorder(u & vec3u(${block - 1}u))) % slots`
  }
  const spread = (n: number) => {
    let x = n & 0x3ff
    x = (x | (x << 16)) & 0x030000ff
    x = (x | (x << 8)) & 0x0300f00f
    x = (x | (x << 4)) & 0x030c30c3
    x = (x | (x << 2)) & 0x09249249
    return x >>> 0
  }
  const zorder = (x: number, y: number, z: number) =>
    (spread(x) | (spread(y) << 1) | (spread(z) << 2)) >>> 0
  const hashOf = (job: Job, slots: number) => (x: number, y: number, z: number) => {
    const mix = (a: number, b: number, c: number) =>
      (Math.imul(a, P[0]) ^ Math.imul(b, P[1]) ^ Math.imul(c, P[2])) >>> 0
    let h: number
    if (job.way === 'rows') h = (((Math.imul(y, P[1]) ^ Math.imul(z, P[2])) >>> 0) + x) >>> 0
    else if (job.way === 'scattered') h = mix(x, y, z)
    else if (job.way === 'zorder') h = zorder(x, y, z)
    else {
      const block = job.block ?? 8
      const s = Math.log2(block)
      const m = block - 1
      h =
        (Math.imul(mix(x >>> s, y >>> s, z >>> s), block ** 3) + zorder(x & m, y & m, z & m)) >>> 0
    }
    return h % slots
  }

  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) throw new Error('no WebGPU here')
  const gpuClock = !pageClock && adapter.features.has('timestamp-query')
  const device = await adapter.requestDevice({
    requiredFeatures: gpuClock ? ['timestamp-query'] : [],
    requiredLimits: {
      maxBufferSize: adapter.limits.maxBufferSize,
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
    },
  })
  const mostCells = 64 * device.limits.maxComputeWorkgroupsPerDimension // one thread per cell
  const stamps = gpuClock ? device.createQuerySet({ type: 'timestamp', count: 2 }) : undefined
  const resolved = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })
  const READ = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  const made = new Map<string, GPUComputePipeline>()
  const pipeline = (code: string) => {
    let p = made.get(code)
    if (!p) {
      p = device.createComputePipeline({
        layout: 'auto',
        compute: { module: device.createShaderModule({ code: shaders.common + code }) },
      })
      made.set(code, p)
    }
    return p
  }
  const inOrder = (code: string) =>
    code
      .replace('@group(0) @binding(8) var<storage, read> book: array<u32>;', '')
      .replace('let j = book[first + s];', 'let j = first + s;')

  interface Dispatch {
    p: GPUComputePipeline
    g: GPUBindGroup
    workgroups: number
  }
  const run = (pass: GPUComputePassEncoder, steps: Dispatch[]) => {
    for (const s of steps) {
      pass.setPipeline(s.p)
      pass.setBindGroup(0, s.g)
      pass.dispatchWorkgroups(s.workgroups)
    }
  }
  const middle = (times: number[]) => times.sort((a, b) => a - b)[times.length >> 1]

  /** On the GPU's clock: the median, in ms, of RUNS timings of these shaders, `repeat` times each. */
  async function timeOnGpu(steps: Dispatch[], repeat: number) {
    const times: number[] = []
    for (let i = 0; i < RUNS; i++) {
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginComputePass({
        timestampWrites: {
          querySet: stamps as GPUQuerySet,
          beginningOfPassWriteIndex: 0,
          endOfPassWriteIndex: 1,
        },
      })
      for (let r = 0; r < repeat; r++) run(pass, steps)
      pass.end()
      const back = device.createBuffer({ size: 16, usage: READ })
      encoder.resolveQuerySet(stamps as GPUQuerySet, 0, 2, resolved, 0)
      encoder.copyBufferToBuffer(resolved, 0, back, 0, 16)
      device.queue.submit([encoder.finish()])
      await back.mapAsync(GPUMapMode.READ)
      const [begin, end] = new BigUint64Array(back.getMappedRange())
      back.destroy()
      times.push(Number(end - begin) / 1e6 / repeat)
    }
    return middle(times)
  }

  /**
   * On the page's clock, for a device with no GPU clock: from sending the shaders until
   * JavaScript holds a number the last one wrote, read from `probe` (logbook chapter 022). The
   * shaders are sent enough times to last about 50 ms, since that clock can move in steps of a
   * whole millisecond, and the time of a readback of nothing, `idle`, is taken off.
   */
  async function timeOnPage(steps: Dispatch[], repeat: number, probe: GPUBuffer, idle: number) {
    const once = (times: number) => onPage(steps, times, probe)
    const first = (await once(repeat)) - idle
    const batch = repeat * Math.min(32, Math.max(1, Math.ceil(50 / Math.max(first, 1))))
    const times: number[] = []
    for (let i = 0; i < RUNS; i++) times.push(Math.max((await once(batch)) - idle, 0) / batch)
    return middle(times)
  }
  /** Sends these shaders `times` times and waits for a number from `probe`: ms on the page's clock. */
  async function onPage(steps: Dispatch[], times: number, probe: GPUBuffer) {
    const encoder = device.createCommandEncoder()
    if (times > 0) {
      const pass = encoder.beginComputePass()
      for (let r = 0; r < times; r++) run(pass, steps)
      pass.end()
    }
    const back = device.createBuffer({ size: 16, usage: READ })
    encoder.copyBufferToBuffer(probe, 0, back, 0, 16)
    const begin = performance.now()
    device.queue.submit([encoder.finish()])
    await back.mapAsync(GPUMapMode.READ)
    const took = performance.now() - begin
    back.destroy()
    return took
  }

  let scene: { key: string; data: Float32Array } | undefined
  const results: Result[] = []
  for (const [index, job] of plan.entries()) {
    const key = JSON.stringify(job.scene)
    if (scene?.key !== key) scene = { key, data: particles(job.scene) } // one scene in memory
    const start = scene.data
    const count = start.length / 4
    const { cell } = job
    const table = job.way !== 'places' && job.way !== 'grid'

    // The cells the particles are in, and the box that holds them.
    const low = [Infinity, Infinity, Infinity]
    const high = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < count; i++)
      for (let a = 0; a < 3; a++) {
        low[a] = Math.min(low[a], start[i * 4 + a])
        high[a] = Math.max(high[a], start[i * 4 + a])
      }
    const origin = table ? [0, 0, 0] : low.map((v) => Math.floor(v / cell) * cell - cell)
    const size = high.map((v, a) => Math.ceil((v - origin[a]) / cell) + 1)
    const slots = table
      ? 2 ** Math.ceil(Math.log2(Math.max(job.slots * count, 1024)))
      : size[0] * size[1] * size[2]
    const row: Result = {
      sweep: job.sweep,
      ...job.scene,
      way: job.way,
      sorted: job.sorted,
      block: job.block,
      cell,
      slots,
      perParticle: job.slots,
      cellsMB: (slots * (job.way === 'places' ? 20 : 8)) / 2 ** 20,
      worldCells: size[0] * size[1] * size[2],
    }
    if (slots > mostCells || slots * 16 > device.limits.maxStorageBufferBindingSize) {
      row.tooLarge = true
      results.push(row)
      await report(row, index, plan.length)
      continue
    }
    if (table) {
      // How many of the cells that hold particles share their slot with another such cell.
      const hash = hashOf(job, slots)
      const cellsOfSlot = new Map<number, number>()
      const seen = new Set<string>()
      for (let i = 0; i < count; i++) {
        const c = [0, 1, 2].map((a) => Math.floor(start[i * 4 + a] / cell))
        const id = c.join()
        if (seen.has(id)) continue
        seen.add(id)
        const s = hash(c[0] >>> 0, c[1] >>> 0, c[2] >>> 0)
        cellsOfSlot.set(s, (cellsOfSlot.get(s) ?? 0) + 1)
      }
      let shared = 0
      for (const n of cellsOfSlot.values()) if (n > 1) shared += n
      row.fullCells = seen.size
      row.sharing = shared / seen.size
    }

    const buffers: GPUBuffer[] = []
    const buffer = (bytes: number, usage: number = GPUBufferUsage.STORAGE) => {
      const b = device.createBuffer({
        size: Math.max(bytes, 16),
        usage: usage | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      })
      buffers.push(b)
      return b
    }
    device.pushErrorScope('out-of-memory')
    device.pushErrorScope('validation')
    try {
      const bytes = start.byteLength
      const blockCount = Math.ceil(slots / BLOCK)
      const positions = buffer(bytes)
      const predicted = [buffer(bytes), buffer(bytes)]
      const spare = buffer(bytes)
      const levels = [buffer(count * 4), buffer(count * 4)]
      const counts = buffer(slots * 4)
      const starts = buffer(slots * 4)
      const blocks = buffer(blockCount * 4)
      const book = buffer(count * 4)
      const places = buffer(job.way === 'places' ? slots * 16 : 16)
      const neighbours = buffer(count * MAX_NEIGHBOURS * 4)
      const neighbourCounts = buffer(count * 4)
      const anchors = buffer(bytes)
      const control = buffer(32)
      const planes = buffer(16)
      const params = buffer(80, GPUBufferUsage.UNIFORM)
      const pointer = buffer(16, GPUBufferUsage.UNIFORM)
      const rub = buffer(16, GPUBufferUsage.UNIFORM)
      device.queue.writeBuffer(positions, 0, start)
      device.queue.writeBuffer(predicted[0], 0, start)
      device.queue.writeBuffer(control, 0, new Uint32Array([1, 1, 0, 0, 0])) // always a new list
      device.queue.writeBuffer(planes, 0, new Float32Array([0, 1, 0, 0]))
      // The Params struct of common.wgsl, as examples/heap-simulation/main.ts fills it; no levels.
      const data = new ArrayBuffer(80)
      const floats = new Float32Array(data)
      const words = new Uint32Array(data)
      floats.set([0, -9.81, 0, 1 / 60, ...origin, cell])
      words.set([...size, 4], 8)
      floats.set([RADIUS, 0.5, 0], 12)
      words[15] = 1
      floats[19] = MARGIN
      device.queue.writeBuffer(params, 0, data)

      const cells = table
        ? SPREAD + shaders.cellsTable.replace(ROWS, hashCode(job))
        : shaders.cellsGrid
      const filed = (code: string) => pipeline(shaders.rebuild + cells + code)
      const plain = (code: string) => pipeline(shaders.rebuild + code)
      const group = (p: GPUComputePipeline, list: GPUBuffer[]) =>
        device.createBindGroup({
          layout: p.getBindGroupLayout(0),
          entries: list.map((b, binding) => ({ binding, resource: { buffer: b } })),
        })
      const per = Math.ceil(count / 64)
      const step = (p: GPUComputePipeline, list: GPUBuffer[], workgroups = per): Dispatch => ({
        p,
        g: group(p, list),
        workgroups,
      })
      const clear = step(plain(shaders.clear), [params, control, counts], Math.ceil(slots / 64))
      let build: Dispatch[]
      let list: Dispatch
      let built = book // what the last shader of `build` writes
      if (job.way === 'places') {
        built = places
        build = [
          clear,
          step(plain(shaders.gridIf), [params, predicted[0], counts, places, control]),
        ]
        list = step(plain(shaders.placesList), [
          params,
          predicted[0],
          counts,
          places,
          control,
          neighbours,
          neighbourCounts,
          anchors,
        ])
      } else {
        const sum = Math.ceil(blockCount / 64)
        build = [
          clear,
          step(filed(shaders.count), [params, predicted[0], counts, control]),
          step(plain(shaders.blocks), [params, control, counts, blocks], sum),
          step(plain(shaders.scan), [params, control, blocks], 1),
          step(plain(shaders.ends), [params, control, counts, blocks, starts], sum),
          step(filed(shaders.fill), [params, predicted[0], starts, book, control]),
        ]
        if (job.sorted) {
          built = positions
          build.push(
            step(plain(shaders.move), [
              params,
              control,
              book,
              positions,
              predicted[0],
              levels[0],
              predicted[1],
              spare,
              levels[1],
            ]),
            step(plain(shaders.settle), [
              params,
              control,
              predicted[1],
              spare,
              levels[1],
              positions,
              predicted[0],
              levels[0],
            ]),
          )
        }
        list = step(filed(job.sorted ? inOrder(shaders.list) : shaders.list), [
          params,
          predicted[0],
          counts,
          starts,
          control,
          neighbours,
          neighbourCounts,
          anchors,
          ...(job.sorted ? [] : [book]),
        ])
      }
      const round = step(pipeline(shaders.round), [
        params,
        predicted[0],
        predicted[1],
        neighbours,
        neighbourCounts,
        planes,
        levels[1],
        pointer,
        positions,
        rub,
      ])

      // Once without a clock, so that the lists exist and the particles are in their order.
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginComputePass()
      run(pass, [...build, list])
      pass.end()
      const back = device.createBuffer({ size: count * 4 + 32, usage: READ })
      encoder.copyBufferToBuffer(neighbourCounts, 0, back, 0, count * 4)
      encoder.copyBufferToBuffer(control, 0, back, count * 4, 32)
      device.queue.submit([encoder.finish()])
      await back.mapAsync(GPUMapMode.READ)
      const read = new Uint32Array(back.getMappedRange())
      let total = 0
      for (let i = 0; i < count; i++) total += read[i]
      row.neighbours = total
      row.leftOut = read[count + 5]
      back.destroy()

      if (gpuClock) {
        row.build = await timeOnGpu(build, 3)
        row.list = await timeOnGpu([list], 3)
        row.round = await timeOnGpu([round], 12)
      } else {
        const idles: number[] = []
        for (let i = 0; i < RUNS; i++) idles.push(await onPage([], 0, control))
        const idle = middle(idles)
        row.build = await timeOnPage(build, 3, built, idle)
        row.list = await timeOnPage([list], 3, neighbourCounts, idle)
        row.round = await timeOnPage([round], 12, predicted[1], idle)
      }
      row.step = row.build + row.list + 6 * row.round // a step that makes the lists again
    } catch (error) {
      row.error = String(error)
    }
    const invalid = await device.popErrorScope()
    const full = await device.popErrorScope()
    if (invalid || full) row.error = (invalid ?? full)?.message ?? 'error'
    for (const b of buffers) b.destroy()
    results.push(row)
    await report(row, index, plan.length)
  }
  const info = adapter.info
  return {
    // Safari gives the same word four times: once is enough.
    gpu: [...new Set([info?.vendor, info?.architecture, info?.device, info?.description])]
      .filter(Boolean)
      .join(' '),
    clock: gpuClock ? 'gpu' : 'page',
    results,
  }
}

// ---- the plans --------------------------------------------------------------------------------
const way = (name: Way, more: Partial<Job> = {}) => ({
  way: name,
  sorted: true,
  slots: 2,
  cell: 0.25,
  ...more,
})
type WayOf = ReturnType<typeof way>
const slab = (count: number): Scene => ({ shape: 'slab', count })
const islands = (world: number, count = 100_000): Scene => ({ shape: 'islands', count, world })
const sweep = (name: string, scenes: Scene[], ways: WayOf[]): Job[] =>
  scenes.flatMap((scene) => ways.map((w) => ({ sweep: name, scene, ...w })))

const PLACES = way('places', { cell: 0.2, sorted: false })
const HASHES = [way('rows'), way('zorder'), way('blocks', { block: 8 })]
const ALL = [PLACES, way('grid'), ...HASHES]
const beam = (axis: 'x' | 'y' | 'z', count = 100_000): Scene => ({ shape: 'beam', count, axis })

/** Every sweep of the study, for our own machine: about twenty minutes. */
export const FULL: Job[] = [
  // 1. How many particles, in a layer on a floor of 24 m by 24 m, with and without the particles
  //    moved into the order of the book.
  ...sweep('count', [10_000, 30_000, 100_000, 300_000].map(slab), [
    ...ALL,
    ...[way('grid'), ...HASHES].map((w) => ({ ...w, sorted: false })),
  ]),
  // 2. The size of a block, on five scenes.
  ...sweep(
    'blocks',
    [slab(100_000), { shape: 'cube', count: 100_000 }, islands(320), beam('x'), slab(300_000)],
    [
      way('rows'),
      ...[2, 4, 8, 16, 32].map((block) => way('blocks', { block })),
      way('zorder'),
      way('grid'),
    ],
  ),
  // 2b. Larger blocks, on scenes with more particles: a block of 64 cells a side is 262 144 slots,
  //     as many as the whole table of 100 000 particles, and is then the Z-order curve alone.
  ...sweep(
    'large',
    [slab(300_000), beam('x', 300_000), slab(1_000_000)],
    [...[16, 32, 64, 128].map((block) => way('blocks', { block })), way('zorder'), way('grid')],
  ),
  // 3. The size of the world: 100 heaps of 1000 particles, scattered in a cube of this side.
  ...sweep(
    'world',
    [20, 40, 80, 320, 1280].map((world) => islands(world)),
    [way('grid'), way('scattered'), ...HASHES],
  ),
  // 4. The shape: a beam of 16 by 16 particles, lying along x, y or z.
  ...sweep(
    'axis',
    (['x', 'y', 'z'] as const).map((axis) => beam(axis)),
    [way('grid'), way('scattered'), ...HASHES],
  ),
  // 5. Slots of the table per particle.
  ...sweep(
    'slots',
    [slab(100_000), islands(320)],
    [1, 2, 4, 8].flatMap((slots) => [way('scattered'), ...HASHES].map((w) => ({ ...w, slots }))),
  ),
  // 6. The width of a cell, from the reach of the lists, 25 cm, to twice that.
  ...sweep(
    'cell',
    [slab(100_000)],
    [0.25, 0.3, 0.375, 0.5].flatMap((cell) => [
      way('grid', { cell }),
      way('blocks', { block: 8, cell }),
    ]),
  ),
]

/** A short plan for anyone's device, a phone too: 30 jobs, none above 100 000 particles. */
export const DEVICE: Job[] = [
  ...sweep('count', [10_000, 30_000, 100_000].map(slab), [
    PLACES,
    way('grid'),
    way('grid', { sorted: false }),
    way('blocks', { block: 32 }),
    way('blocks', { block: 32, sorted: false }),
    way('zorder'),
  ]),
  ...sweep('hash', [slab(100_000)], [way('scattered'), way('rows'), way('blocks', { block: 8 })]),
  ...sweep(
    'world',
    [20, 40, 320].map((world) => islands(world)),
    [way('grid'), way('blocks', { block: 32 }), way('zorder')],
  ),
]
