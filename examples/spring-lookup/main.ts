// How a spring finds its two particles, timed (chapter 059).
//
// FORCE keeps its particles in the order of their cells (decision 033), so a particle's row in the
// buffers changes at every substep. A spring that says "row 12 with row 13" is wrong one substep
// later. Two ways out:
//
//   A, a name and a register. Every particle has a name, a number that never changes. A spring
//      says two names, and its record is kept under the name of its owner. A register says in
//      which row each name is now, written again at every substep. A round then reads, for each
//      particle: its name, its springs under that name, the register for each other end, and
//      that end's position.
//   B, a list corrected every time. A spring says two rows, and its record sits in the row of its
//      owner. At every substep the records move with their particles and their rows are rewritten.
//      A round reads the springs of its row and the other end's position, nothing more.
//
// The scene: a square cloth, each particle joined to its neighbours, lying flat and turned by 30
// degrees. No physics here, only the reading and writing each way needs, on the same data, with
// the rows in three orders: by the cells of a grid, by the slots of our hashed table, and at
// random, the worst a cloth could ever be.

const REPEAT = 20 // dispatches in one timed pass
// ?part=1 or ?part=2 in the address runs only that part: both take several minutes.
const ONLY = new URLSearchParams(location.search).get('part')
const CELL = 0.25 // meters, as the live pages
const SPACING = 0.21 // meters between neighbours in the cloth
const NONE = 0xffffffff

const COMMON = `
const K = __K__u;
const NONE = 0xffffffffu;
fn pull(p: vec3f, q: vec3f, rest: f32) -> vec3f {
  let away = p - q;
  let far = length(away);
  if (far == 0.0) { return vec3f(0.0); }
  return away / far * (rest - far) * 0.5;
}
`
// A: the round. springs[name * K + k]: x the other end's name, y its rest length as bits.
const ROUND_A = `
@group(0) @binding(0) var<storage, read> positions: array<vec4f>;
@group(0) @binding(1) var<storage, read> names: array<u32>;
@group(0) @binding(2) var<storage, read> springs: array<vec2u>;
@group(0) @binding(3) var<storage, read> rowOf: array<u32>;
@group(0) @binding(4) var<storage, read_write> moved: array<vec4f>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&positions)) { return; }
  let p = positions[row].xyz;
  let name = names[row];
  var sum = vec3f(0.0);
  var n = 0.0;
  for (var k = 0u; k < K; k++) {
    let s = springs[name * K + k];
    if (s.x == NONE) { continue; }
    sum += pull(p, positions[rowOf[s.x]].xyz, bitcast<f32>(s.y));
    n += 1.0;
  }
  moved[row] = vec4f(p + sum / max(n, 1.0), 1.0);
}`
// A: the register, written again at every substep. (`register` is a word WGSL keeps for itself.)
const REGISTER = `
@group(0) @binding(0) var<storage, read> names: array<u32>;
@group(0) @binding(1) var<storage, read_write> rowOf: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&names)) { return; }
  rowOf[names[row]] = row;
}`
// B: the round. springs[row * K + k]: x the other end's row.
const ROUND_B = `
@group(0) @binding(0) var<storage, read> positions: array<vec4f>;
@group(0) @binding(1) var<storage, read> springs: array<vec2u>;
@group(0) @binding(2) var<storage, read_write> moved: array<vec4f>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&positions)) { return; }
  let p = positions[row].xyz;
  var sum = vec3f(0.0);
  var n = 0.0;
  for (var k = 0u; k < K; k++) {
    let s = springs[row * K + k];
    if (s.x == NONE) { continue; }
    sum += pull(p, positions[s.x].xyz, bitcast<f32>(s.y));
    n += 1.0;
  }
  moved[row] = vec4f(p + sum / max(n, 1.0), 1.0);
}`
// B: where each old row went, from the address book, which says which old row is in each new one.
const WENT = `
@group(0) @binding(0) var<storage, read> book: array<u32>;
@group(0) @binding(1) var<storage, read_write> went: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&book)) { return; }
  went[book[row]] = row;
}`
// B: the records move to the new row of their owner, and their other ends are rewritten.
const CORRECT = `
@group(0) @binding(0) var<storage, read> book: array<u32>;
@group(0) @binding(1) var<storage, read> went: array<u32>;
@group(0) @binding(2) var<storage, read> springs: array<vec2u>;
@group(0) @binding(3) var<storage, read_write> corrected: array<vec2u>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&book)) { return; }
  let old = book[row];
  for (var k = 0u; k < K; k++) {
    let s = springs[old * K + k];
    if (s.x == NONE) {
      corrected[row * K + k] = s;
    } else {
      corrected[row * K + k] = vec2u(went[s.x], s.y);
    }
  }
}`

// ---- part 2: two ways to solve the springs (chapter 061) --------------------------------------
// 'All at once' is ROUND_A above: a thread per particle reads what its springs ask and writes its
// own move, into a second buffer. 'One by one' is below: a thread per spring moves its two ends
// where they are. Two springs that share a particle must not run together, so the springs are
// split into groups that share none, and each group is a dispatch of its own. On a cloth: links
// along a side that start at an even column, at an odd one, and so on, 4 groups, 8 with diagonals.
// springs[i]: x and y the names of the two ends, z the rest length as bits.
const ONE_BY_ONE = `
struct Part { first: u32, count: u32 }
@group(0) @binding(0) var<uniform> part: Part;
@group(0) @binding(1) var<storage, read> springs: array<vec4u>;
@group(0) @binding(2) var<storage, read> rowOf: array<u32>;
@group(0) @binding(3) var<storage, read_write> positions: array<vec4f>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= part.count) { return; }
  let s = springs[part.first + id.x];
  let a = rowOf[s.x];
  let b = rowOf[s.y];
  let pa = positions[a];
  let pb = positions[b];
  let shift = pull(pa.xyz, pb.xyz, bitcast<f32>(s.z)); // not 'move': WGSL keeps that word for itself
  positions[a] = vec4f(pa.xyz + shift, pa.w);
  positions[b] = vec4f(pb.xyz - shift, pb.w);
}`

/**
 * The springs of a cloth with k links per particle, 4 or 8, each once, sorted into groups that
 * share no particle: the two names and the rest length of each, and where each group begins.
 */
function groupedSprings(side: number, k: number) {
  const rest = new Uint32Array(new Float32Array([SPACING]).buffer)[0]
  const groups: number[][] = Array.from({ length: k }, () => [])
  const at = (a: number, b: number) => a + b * side
  for (let b = 0; b < side; b++)
    for (let a = 0; a < side; a++) {
      if (a + 1 < side) groups[a % 2].push(at(a, b), at(a + 1, b))
      if (b + 1 < side) groups[2 + (b % 2)].push(at(a, b), at(a, b + 1))
      if (k > 4 && a + 1 < side && b + 1 < side) {
        groups[4 + (a % 2)].push(at(a, b), at(a + 1, b + 1))
        groups[6 + (a % 2)].push(at(a + 1, b), at(a, b + 1))
      }
    }
  const total = groups.reduce((sum, g) => sum + g.length / 2, 0)
  const data = new Uint32Array(total * 4)
  const parts: [first: number, count: number][] = []
  let n = 0
  for (const group of groups) {
    parts.push([n, group.length / 2])
    for (let i = 0; i < group.length; i += 2) data.set([group[i], group[i + 1], rest, 0], 4 * n++)
  }
  return { data, parts }
}

// One more shader, to find out what in CORRECT costs: the same with no branch.
const NO_BRANCH = CORRECT.replace(
  /if \(s\.x == NONE\) \{[^}]*\} else \{[^}]*\}/,
  'corrected[row * K + k] = vec2u(went[min(s.x, arrayLength(&went) - 1u)], s.y);',
)

/** Repeats the same numbers at every run. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Order = 'grid' | 'table' | 'random'

/**
 * A cloth of side × side particles, named in rows, and the order its particles are kept in:
 * `nameOf[row]`. `shake` moves every particle by up to that many meters first, as a substep would.
 */
function clothOrder(side: number, order: Order, shake: number, seed: number): Uint32Array {
  const count = side * side
  const next = random(seed)
  const key = new Float64Array(count)
  const slots = 2 ** Math.ceil(Math.log2(2 * count))
  const [cos, sin] = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)]
  for (let name = 0; name < count; name++) {
    const a = (name % side) * SPACING + (next() - 0.5) * 2 * shake
    const b = Math.floor(name / side) * SPACING + (next() - 0.5) * 2 * shake
    const cx = Math.floor((a * cos - b * sin) / CELL) + 4096
    const cz = Math.floor((a * sin + b * cos) / CELL) + 4096
    const cy = 4096
    key[name] =
      order === 'random'
        ? next()
        : order === 'grid'
          ? cx + 8192 * (cy + 8192 * cz)
          : // the hash of cells-table.wgsl
            (((Math.imul(cy, 19349663) ^ Math.imul(cz, 83492791)) + cx) >>> 0) % slots
  }
  // 'random' with no shake keeps its order: the same seed gives the same keys
  return Uint32Array.from({ length: count }, (_, i) => i).sort((p, q) => key[p] - key[q] || p - q)
}

/** The names of the K neighbours each particle is joined to, NONE beyond the border. */
function neighbours(side: number, k: number): Uint32Array {
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [2, 0],
    [-2, 0],
    [0, 2],
    [0, -2],
  ].slice(0, k)
  const out = new Uint32Array(side * side * k).fill(NONE)
  for (let name = 0; name < side * side; name++)
    steps.forEach(([dx, dz], s) => {
      const x = (name % side) + dx
      const z = Math.floor(name / side) + dz
      if (x >= 0 && x < side && z >= 0 && z < side) out[name * k + s] = x + z * side
    })
  return out
}

async function run(): Promise<string> {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) throw new Error('no WebGPU here')
  if (!adapter.features.has('timestamp-query'))
    throw new Error('this browser gives a page no GPU clock: nothing to measure with')
  const device = await adapter.requestDevice({
    requiredFeatures: ['timestamp-query'],
    requiredLimits: { maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize },
  })
  const clock = device.createQuerySet({ type: 'timestamp', count: 2 })
  const resolved = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })
  const storage = (data: Uint32Array | Float32Array | number) => {
    const buffer = device.createBuffer({
      size: typeof data === 'number' ? data : data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    if (typeof data !== 'number') device.queue.writeBuffer(buffer, 0, data as BufferSource)
    return buffer
  }
  /** The GPU time of one dispatch of `code` over `count` threads, in ms, the middle of 5 timings. */
  async function time(code: string, k: number, count: number, buffers: GPUBuffer[]) {
    const pipeline = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: COMMON.replace('__K__', String(k)) + code }),
      },
    })
    const group = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })),
    })
    const timings: number[] = []
    for (let run = 0; run < 6; run++) {
      const back = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      })
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginComputePass({
        timestampWrites: { querySet: clock, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, group)
      for (let r = 0; r < REPEAT; r++) pass.dispatchWorkgroups(Math.ceil(count / 64))
      pass.end()
      encoder.resolveQuerySet(clock, 0, 2, resolved, 0)
      encoder.copyBufferToBuffer(resolved, 0, back, 0, 16)
      device.queue.submit([encoder.finish()])
      await back.mapAsync(GPUMapMode.READ)
      const [begin, end] = new BigUint64Array(back.getMappedRange())
      back.destroy()
      if (run > 0) timings.push(Number(end - begin) / 1e6 / REPEAT) // the first run warms up
    }
    return timings.sort((a, b) => a - b)[2]
  }

  const lines: string[] = [
    'A substep, in ms on the GPU clock: what a spring needs besides the physics.',
    'A: names and a register.  B: a list corrected at every substep.  3 rounds per substep.',
    '',
  ]
  for (const side of ONLY === '2' ? [] : [316, 1000])
    for (const k of [4, 12]) {
      const count = side * side
      lines.push(`${count.toLocaleString('en')} particles, ${k} springs each`)
      const byName = neighbours(side, k)
      for (const order of ['grid', 'table', 'random'] as Order[]) {
        // the rows now, and one substep later, after every particle moved by up to 2 cm
        const nameOf = clothOrder(side, order, 0, 7)
        const nameAfter = clothOrder(side, order, order === 'random' ? 0 : 0.02, 7)
        const rowOf = new Uint32Array(count)
        nameOf.forEach((name, row) => {
          rowOf[name] = row
        })
        const positions = new Float32Array(count * 4)
        nameOf.forEach((name, row) => {
          positions.set([(name % side) * SPACING, 0, Math.floor(name / side) * SPACING, 1], row * 4)
        })
        // A keeps the records under names, B under rows, with rows inside
        const rest = new Uint32Array(new Float32Array([SPACING]).buffer)[0]
        const recordsA = new Uint32Array(count * k * 2)
        const recordsB = new Uint32Array(count * k * 2)
        for (let name = 0; name < count; name++)
          for (let s = 0; s < k; s++) {
            const other = byName[name * k + s]
            recordsA.set([other, rest], (name * k + s) * 2)
            recordsB.set([other === NONE ? NONE : rowOf[other], rest], (rowOf[name] * k + s) * 2)
          }
        // the address book of the next substep: which old row is in each new one
        const book = Uint32Array.from(nameAfter, (name) => rowOf[name])
        const gpu = {
          positions: storage(positions),
          moved: storage(count * 16),
          names: storage(nameOf),
          register: storage(rowOf),
          springsA: storage(recordsA),
          springsB: storage(recordsB),
          corrected: storage(count * k * 8),
          book: storage(book),
          went: storage(count * 4),
        }
        const roundA = await time(ROUND_A, k, count, [
          gpu.positions,
          gpu.names,
          gpu.springsA,
          gpu.register,
          gpu.moved,
        ])
        const register = await time(REGISTER, k, count, [gpu.names, gpu.register])
        const roundB = await time(ROUND_B, k, count, [gpu.positions, gpu.springsB, gpu.moved])
        const went = await time(WENT, k, count, [gpu.book, gpu.went])
        const correct = await time(CORRECT, k, count, [
          gpu.book,
          gpu.went,
          gpu.springsB,
          gpu.corrected,
        ])
        const f = (ms: number) => ms.toFixed(3).padStart(7)
        lines.push(
          `  rows by ${order.padEnd(6)}  A ${f(register + 3 * roundA)} = register ${f(register)} + 3 × round ${f(roundA)}` +
            `   B ${f(went + correct + 3 * roundB)} = went ${f(went)} + correct ${f(correct)} + 3 × round ${f(roundB)}`,
        )
        for (const buffer of Object.values(gpu)) buffer.destroy()
        await device.queue.onSubmittedWorkDone()
      }
      lines.push('')
    }
  // Part 2: solving the springs, with names and a register (decision 036).
  lines.push(
    '',
    'Solving the springs, a round in ms. All at once: one dispatch, a thread per particle.',
  )
  lines.push(
    'One by one: a dispatch per group of springs that share no particle, a thread per spring.',
  )
  for (const side of ONLY === '1' ? [] : [316, 1000])
    for (const k of [4, 8]) {
      const count = side * side
      lines.push(`${count.toLocaleString('en')} particles, ${k} links each`)
      const byName = neighbours(side, k)
      const rest = new Uint32Array(new Float32Array([SPACING]).buffer)[0]
      const records = new Uint32Array(count * k * 2)
      byName.forEach((other, i) => {
        records.set([other, rest], i * 2)
      })
      const { data, parts } = groupedSprings(side, k)
      for (const order of ['grid', 'table'] as Order[]) {
        const nameOf = clothOrder(side, order, 0, 7)
        const rowOf = new Uint32Array(count)
        nameOf.forEach((name, row) => {
          rowOf[name] = row
        })
        const positions = new Float32Array(count * 4)
        nameOf.forEach((name, row) => {
          positions.set([(name % side) * SPACING, 0, Math.floor(name / side) * SPACING, 1], row * 4)
        })
        const gpu = {
          positions: storage(positions),
          moved: storage(count * 16),
          names: storage(nameOf),
          rowOf: storage(rowOf),
          records: storage(records),
          springs: storage(data),
        }
        const together = await time(ROUND_A, k, count, [
          gpu.positions,
          gpu.names,
          gpu.records,
          gpu.rowOf,
          gpu.moved,
        ])
        // one by one: every group in the same timed pass, REPEAT times
        const pipeline = await device.createComputePipelineAsync({
          layout: 'auto',
          compute: {
            module: device.createShaderModule({
              code: COMMON.replace('__K__', String(k)) + ONE_BY_ONE,
            }),
          },
        })
        const sets = parts.map(([first, n]) => {
          const part = device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          })
          device.queue.writeBuffer(part, 0, new Uint32Array([first, n]))
          return {
            part,
            n,
            group: device.createBindGroup({
              layout: pipeline.getBindGroupLayout(0),
              entries: [part, gpu.springs, gpu.rowOf, gpu.positions].map((buffer, binding) => ({
                binding,
                resource: { buffer },
              })),
            }),
          }
        })
        const timings: number[] = []
        for (let run = 0; run < 6; run++) {
          const back = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
          })
          const encoder = device.createCommandEncoder()
          const pass = encoder.beginComputePass({
            timestampWrites: {
              querySet: clock,
              beginningOfPassWriteIndex: 0,
              endOfPassWriteIndex: 1,
            },
          })
          pass.setPipeline(pipeline)
          for (let r = 0; r < REPEAT; r++)
            for (const set of sets) {
              pass.setBindGroup(0, set.group)
              pass.dispatchWorkgroups(Math.ceil(set.n / 64))
            }
          pass.end()
          encoder.resolveQuerySet(clock, 0, 2, resolved, 0)
          encoder.copyBufferToBuffer(resolved, 0, back, 0, 16)
          device.queue.submit([encoder.finish()])
          await back.mapAsync(GPUMapMode.READ)
          const [begin, end] = new BigUint64Array(back.getMappedRange())
          back.destroy()
          if (run > 0) timings.push(Number(end - begin) / 1e6 / REPEAT)
        }
        const apart = timings.sort((a, b) => a - b)[2]
        const f = (ms: number) => ms.toFixed(3).padStart(7)
        lines.push(
          `  rows by ${order.padEnd(6)}  all at once ${f(together)}   one by one ${f(apart)} in ${parts.length} dispatches` +
            `   |  a substep: 3 one by one ${f(3 * apart)}, 10 all at once ${f(10 * together)}, 30 all at once ${f(30 * together)}`,
        )
        for (const buffer of Object.values(gpu)) buffer.destroy()
        for (const set of sets) set.part.destroy()
        await device.queue.onSubmittedWorkDone()
      }
    }
  lines.push('')

  // What in the correcting pass costs, with 100 000 particles in the order of the table.
  lines.push('The correcting pass alone, 99,856 particles, rows by table:')
  for (const k of ONLY === '2' ? [] : [2, 4, 6, 8, 12]) {
    const side = 316
    const count = side * side
    const byName = neighbours(side, k)
    const nameOf = clothOrder(side, 'table', 0, 7)
    const nameAfter = clothOrder(side, 'table', 0.02, 7)
    const rowOf = new Uint32Array(count)
    nameOf.forEach((name, row) => {
      rowOf[name] = row
    })
    const records = new Uint32Array(count * k * 2)
    for (let name = 0; name < count; name++)
      for (let s = 0; s < k; s++) {
        const other = byName[name * k + s]
        records.set([other === NONE ? NONE : rowOf[other], 0], (rowOf[name] * k + s) * 2)
      }
    const buffers = [
      storage(Uint32Array.from(nameAfter, (name) => rowOf[name])),
      storage(rowOf),
      storage(records),
      storage(count * k * 8),
    ]
    const f = (ms: number) => ms.toFixed(3).padStart(7)
    lines.push(
      `  ${String(k).padStart(2)} springs each: correct ${f(await time(CORRECT, k, count, buffers))}` +
        `   no branch ${f(await time(NO_BRANCH, k, count, buffers))}`,
    )
    for (const buffer of buffers) buffer.destroy()
  }
  return lines.join('\n')
}

const output = document.querySelector('#output') as HTMLElement
run().then(
  (text) => {
    output.textContent = text
  },
  (error) => {
    output.textContent = `FAILED: ${error}`
  },
)
