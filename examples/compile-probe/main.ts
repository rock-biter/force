// Which ways of writing one check does a browser's shader compiler take, and how long does each
// need? (chapter 068)
//
// The check: of the 27 cells around a particle, do two share a slot of the table? That is 351
// comparisons of the 27 slots, two by two. Written as one expression, Safari on a Mac never
// finished compiling the shader. Cut into a line for each cell, it did, and Safari on an iPhone
// still did not. A phone has no console, so this page tries the ways one after the other and
// writes on itself which ones pass.
//
// Each way is the real shader of the levels (heap-simulation/levels-cells.wgsl) with the table
// (cells-table.wgsl), on a device of its own. It is made into a pipeline and run once on 64
// particles, since a browser may put off the real work until the first run. Each of the two waits
// has a time limit: a compiler that hangs gives no error. A way that hangs may also hold up the
// ones after it, so the ways go from the one least like the first to the first itself, last.

import commonCode from '../contact-cost/common.wgsl?raw'
import cellsGridCode from '../heap-simulation/cells-grid.wgsl?raw'
import cellsTableCode from '../heap-simulation/cells-table.wgsl?raw'
import levelsCode from '../heap-simulation/levels-cells.wgsl?raw'

const LIMIT = 8000 // milliseconds to wait for a pipeline, and for its first run
const COUNT = 64 // particles

const cells = Array.from({ length: 27 }, (_, m) => m)
const others = cells.slice(1)
/** The cell number m of the 27, as an offset from the middle one, x fastest. */
const offset = (m: number) =>
  `vec3i(${(m % 3) - 1}, ${(Math.floor(m / 3) % 3) - 1}, ${Math.floor(m / 9) - 1})`
/** The 27 slots, s0 to s26, one line each. */
const SLOTS = cells.map((m) => `  let s${m} = slot(home + ${offset(m)}, slots);`).join('\n')
/** Cell m against the cells before it, joined by `join`. */
const pairs = (m: number, join: string, wrap = (text: string) => text) =>
  cells
    .slice(0, m)
    .map((k) => wrap(`s${k} == s${m}`))
    .join(join)
/** Joins answers four at a time, then the results four at a time, with names of their own. */
function byFours(names: string[], join: string, prefix: string): { lines: string[]; last: string } {
  const lines: string[] = []
  let level = 0
  while (names.length > 1) {
    const next: string[] = []
    for (let k = 0; k < names.length; k += 4) {
      const name = `${prefix}${level}_${k / 4}`
      lines.push(`  let ${name} = ${names.slice(k, k + 4).join(join)};`)
      next.push(name)
    }
    names = next
    level++
  }
  return { lines, last: names[0] }
}

const REPEATED = `
fn repeated(home: vec3i, offset: vec3i, slots: u32) -> bool {
  let mine = slot(home + offset, slots);
  let k = (offset.z + 1) * 9 + (offset.y + 1) * 3 + offset.x + 1;
  for (var m = 0; m < k; m++) {
    if (slot(home + vec3i(m % 3 - 1, (m / 3) % 3 - 1, m / 9 - 1), slots) == mine) {
      return true;
    }
  }
  return false;
}
`
const clashing = (body: string) =>
  `\nfn clashing(home: vec3i, slots: u32) -> bool {\n${body}\n}\n${REPEATED}`

/** Every way: its name, what it is, and the functions it adds to the shader. */
const WAYS: [name: string, what: string, code: string][] = [
  ['none', 'no check at all, to see that the page itself works', clashing('  return false;')],
  [
    'loops',
    'two loops, each slot worked out again when it is needed: no long line anywhere',
    clashing(`  for (var m = 1; m < 27; m++) {
    let mine = slot(home + vec3i(m % 3 - 1, (m / 3) % 3 - 1, m / 9 - 1), slots);
    for (var k = 0; k < m; k++) {
      if (slot(home + vec3i(k % 3 - 1, (k / 3) % 3 - 1, k / 9 - 1), slots) == mine) {
        return true;
      }
    }
  }
  return false;`),
  ],
  [
    'vectors',
    'four comparisons at a time with any(vec4u == vec4u), joined by |: no || at all',
    clashing(
      `${SLOTS}\n${others
        .map((m) => {
          const groups: string[] = []
          for (let k = 0; k < m; k += 4) {
            const four = [0, 1, 2, 3].map((d) => `s${Math.min(k + d, m - 1)}`)
            groups.push(`any(vec4u(${four.join(', ')}) == vec4u(s${m}))`)
          }
          const { lines, last } = byFours(groups, ' | ', `v${m}_`)
          return [...lines, `  let c${m} = ${last};`].join('\n')
        })
        .join('\n')}\n${(() => {
        const { lines, last } = byFours(
          others.map((m) => `c${m}`),
          ' | ',
          'all',
        )
        return [...lines, `  return ${last};`].join('\n')
      })()}`,
    ),
  ],
  [
    'fours',
    'a line for every four comparisons, joined by ||: never more than four in a line',
    clashing(
      `${SLOTS}\n${others
        .map((m) => {
          const { lines, last } = byFours(
            cells.slice(0, m).map((k) => `s${k} == s${m}`),
            ' || ',
            `f${m}_`,
          )
          return [...lines, `  let c${m} = ${last};`].join('\n')
        })
        .join('\n')}\n${(() => {
        const { lines, last } = byFours(
          others.map((m) => `c${m}`),
          ' || ',
          'all',
        )
        return [...lines, `  return ${last};`].join('\n')
      })()}`,
    ),
  ],
  [
    'bits',
    'a line for each cell, 26 comparisons at most, joined by | in place of ||',
    clashing(
      `${SLOTS}\n${others.map((m) => `  let c${m} = ${pairs(m, ' | ', (t) => `(${t})`)};`).join('\n')}\n  return ${others.map((m) => `c${m}`).join(' | ')};`,
    ),
  ],
  [
    'ifs',
    'an if for each cell, 26 comparisons at most, with a return (the first fix)',
    clashing(
      `${SLOTS}\n${others.map((m) => `  if (${pairs(m, ' || ')}) {\n    return true;\n  }`).join('\n')}\n  return false;`,
    ),
  ],
  [
    'lets',
    'a line for each cell, 26 comparisons at most, joined by || (the page now)',
    clashing(
      `${SLOTS}\n${others.map((m) => `  let c${m} = ${pairs(m, ' || ')};`).join('\n')}\n  return ${others.map((m) => `c${m}`).join(' || ')};`,
    ),
  ],
  [
    'one',
    'one expression of 351 comparisons joined by || (as it was at first)',
    clashing(
      `${SLOTS}\n  return ${cells.flatMap((m) => cells.slice(0, m).map((k) => `s${k} == s${m}`)).join(' ||\n    ')};`,
    ),
  ],
]

const output = document.querySelector<HTMLElement>('#output')
const lines: string[] = []
const say = (text: string) => {
  lines.push(text)
  if (output) output.textContent = lines.join('\n')
  return lines.length - 1
}
const rewrite = (at: number, text: string) => {
  lines[at] = text
  if (output) output.textContent = lines.join('\n')
}

/** The promise's value, or 'late' if it does not come within LIMIT. */
const within = <T>(promise: Promise<T>) =>
  Promise.race([promise, new Promise<'late'>((done) => setTimeout(() => done('late'), LIMIT))])

/** Makes the shader into a pipeline on a device of its own and runs it once. What happened. */
async function attempt(code: string): Promise<string> {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) return 'no WebGPU here'
  const device = await adapter.requestDevice()
  const began = performance.now()
  const made = await within(
    device
      .createComputePipelineAsync({
        layout: 'auto',
        compute: { module: device.createShaderModule({ code }) },
      })
      .catch((error: unknown) => String(error)),
  )
  if (made === 'late') return `NO PIPELINE after ${LIMIT / 1000} s: still compiling`
  if (typeof made === 'string') return `FAILED: ${made}`
  const compiled = performance.now() - began

  // The buffers of levels-cells.wgsl, in the order of its bindings: the params, then seven lists.
  const params = new ArrayBuffer(80)
  const floats = new Float32Array(params)
  const words = new Uint32Array(params)
  floats.set([0, -9.81, 0, 1 / 60, 0, 0, 0, 0.25]) // gravity, step, origin, cell
  words.set([8, 8, 8, 0], 8) // cells along x, y and z
  floats.set([0.1, 0.5, 1.5], 12) // radius, alpha, level strength
  const sizes = [80, COUNT * 16, 1024 * 4, 1024 * 4, 16, COUNT * 4, COUNT * 4, COUNT * 4]
  const buffers = sizes.map((size, binding) =>
    device.createBuffer({
      size,
      usage:
        (binding === 0 ? GPUBufferUsage.UNIFORM : GPUBufferUsage.STORAGE) | GPUBufferUsage.COPY_DST,
    }),
  )
  device.queue.writeBuffer(buffers[0], 0, params)
  // Particles a few centimeters apart, and a table with one of them in every slot: so the check
  // runs for all of them.
  const places = new Float32Array(COUNT * 4)
  for (let i = 0; i < COUNT; i++)
    places.set([(i % 8) * 0.2, 0.1, Math.floor(i / 8) * 0.2, 1], i * 4)
  device.queue.writeBuffer(buffers[1], 0, places)
  device.queue.writeBuffer(buffers[2], 0, new Uint32Array(1024).fill(1))
  const started = performance.now()
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(made)
  pass.setBindGroup(
    0,
    device.createBindGroup({
      layout: made.getBindGroupLayout(0),
      entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })),
    }),
  )
  pass.dispatchWorkgroups(1)
  pass.end()
  device.queue.submit([encoder.finish()])
  const ran = await within(device.queue.onSubmittedWorkDone().then(() => 'done' as const))
  const first = performance.now() - started
  device.destroy()
  if (ran === 'late')
    return `pipeline in ${compiled.toFixed(0)} ms, but its FIRST RUN is not over after ${LIMIT / 1000} s`
  return `ok: pipeline in ${compiled.toFixed(0)} ms, first run in ${first.toFixed(0)} ms`
}

async function run() {
  lines.length = 0
  say(navigator.userAgent)
  say('')
  // ?only=lets,ifs in the address tries those ways alone.
  const only = new URLSearchParams(location.search).get('only')?.split(',')
  // First with a slot for every cell of the grid, where the check is never asked for.
  const grid = say('grid       …')
  rewrite(
    grid,
    `grid       ${await attempt(`${commonCode + cellsGridCode + clashing('  return false;') + levelsCode}`)}`,
  )
  for (const [name, what, code] of WAYS) {
    if (only && !only.includes(name)) continue
    const at = say(`${name.padEnd(10)} …`)
    const result = await attempt(commonCode + cellsTableCode + code + levelsCode)
    rewrite(at, `${name.padEnd(10)} ${result}\n           ${what}`)
  }
  say('')
  say('Done. A way that hangs may hold up the ways after it: try them alone with ?only=name.')
}

run().catch((error) => say(`FAILED: ${error}`))
