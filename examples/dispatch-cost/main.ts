// What one more dispatch costs, timed.
// A step of physics may need a hundred dispatches, so we send the same tiny shader many times in a
// row and read three clocks: how long JavaScript takes to write the commands down, how long the
// GPU takes to run them, and how long until the browser says that all of it is done.

const RUNS = 5

/** Every thread adds 1 to its own element: after N dispatches each element counts N. */
const SHADER = `
@group(0) @binding(0) var<storage, read_write> data: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= arrayLength(&data)) { return; }
  data[id.x] = data[id.x] + vec4f(1.0);
}`

/** How the dispatches are packed: all in one pass, a pass for each, or a submit for each. */
type Packing = 'one pass' | 'a pass each' | 'a submit each'

interface Clocks {
  /** JavaScript: from the first command to `submit()` returning. */
  js: number
  /** The GPU: from the start of the pass to its end, by its own clock. NaN if it has none. */
  gpu: number
  /** All of it: from the first command until the browser says the work is done. */
  all: number
}

interface Scene {
  threads: number
  workgroups: number
  buffer: GPUBuffer
  bindGroup: GPUBindGroup
  /** How many dispatches this buffer has seen: what every element should count. */
  sent: number
}

async function run(): Promise<string> {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) {
    throw new Error('no WebGPU here')
  }
  // The GPU's own clock is an optional feature: without it that column stays empty.
  const hasClock = adapter.features.has('timestamp-query')
  const device = await adapter.requestDevice({
    requiredFeatures: hasClock ? ['timestamp-query'] : [],
  })
  const pipeline = await device.createComputePipelineAsync({
    layout: 'auto',
    compute: { module: device.createShaderModule({ code: SHADER }) },
  })

  // Two timestamps, 8 bytes each: the GPU writes them, then we copy them where JavaScript can read.
  const stamps = hasClock ? device.createQuerySet({ type: 'timestamp', count: 2 }) : undefined
  const resolved = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })
  const readable = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })

  function scene(threads: number): Scene {
    const buffer = device.createBuffer({
      size: threads * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    })
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    })
    return { threads, workgroups: Math.ceil(threads / 64), buffer, bindGroup, sent: 0 }
  }

  /** Sends `count` dispatches and reads the three clocks, in milliseconds. */
  async function time(target: Scene, count: number, packing: Packing): Promise<Clocks> {
    await device.queue.onSubmittedWorkDone() // start from a GPU with nothing to do
    const start = performance.now()

    if (packing === 'one pass') {
      const encoder = device.createCommandEncoder()
      const pass = encoder.beginComputePass(
        stamps && {
          timestampWrites: {
            querySet: stamps,
            beginningOfPassWriteIndex: 0,
            endOfPassWriteIndex: 1,
          },
        },
      )
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, target.bindGroup)
      for (let i = 0; i < count; i++) {
        pass.dispatchWorkgroups(target.workgroups)
      }
      pass.end()
      device.queue.submit([encoder.finish()])
    } else {
      let encoder = device.createCommandEncoder()
      for (let i = 0; i < count; i++) {
        const pass = encoder.beginComputePass()
        pass.setPipeline(pipeline)
        pass.setBindGroup(0, target.bindGroup)
        pass.dispatchWorkgroups(target.workgroups)
        pass.end()
        if (packing === 'a submit each') {
          device.queue.submit([encoder.finish()])
          encoder = device.createCommandEncoder()
        }
      }
      device.queue.submit([encoder.finish()])
    }
    target.sent += count

    const js = performance.now() - start
    await device.queue.onSubmittedWorkDone()
    const all = performance.now() - start

    let gpu = Number.NaN
    if (stamps && packing === 'one pass') {
      const encoder = device.createCommandEncoder()
      encoder.resolveQuerySet(stamps, 0, 2, resolved, 0)
      encoder.copyBufferToBuffer(resolved, 0, readable, 0, 16)
      device.queue.submit([encoder.finish()])
      await readable.mapAsync(GPUMapMode.READ)
      const [begin, end] = new BigUint64Array(readable.getMappedRange())
      gpu = Number(end - begin) / 1e6 // nanoseconds to milliseconds
      readable.unmap()
    }
    return { js, gpu, all }
  }

  /** The middle one of a few runs, clock by clock, after one run that does not count. */
  async function middle(target: Scene, count: number, packing: Packing): Promise<Clocks> {
    await time(target, count, packing)
    const runs: Clocks[] = []
    for (let i = 0; i < RUNS; i++) {
      runs.push(await time(target, count, packing))
    }
    return {
      js: median(runs.map((clocks) => clocks.js)),
      gpu: median(runs.map((clocks) => clocks.gpu)),
      all: median(runs.map((clocks) => clocks.all)),
    }
  }

  /** The last element of the buffer: how many dispatches really reached it. */
  async function counted(target: Scene): Promise<number> {
    const encoder = device.createCommandEncoder()
    encoder.copyBufferToBuffer(target.buffer, (target.threads - 1) * 16, readable, 0, 16)
    device.queue.submit([encoder.finish()])
    await readable.mapAsync(GPUMapMode.READ)
    const value = new Float32Array(readable.getMappedRange())[0]
    readable.unmap()
    return value
  }

  const lines = [
    `${adapter.info.description || adapter.info.vendor} (${adapter.info.architecture})`,
    '',
    'One more dispatch, in microseconds: a thousandth of a millisecond.',
    'A frame at 60 per second lasts 16 700.',
    '',
    'threads per dispatch       GPU       all',
  ]
  let allRan = true
  const small = scene(64)

  // Sending anything costs a fixed fee, however many dispatches it holds. So each row is timed
  // twice, with many dispatches and with a tenth of them, and the difference is shared out.
  for (const threads of [64, 4096, 65_536, 1_048_576]) {
    const target = scene(threads)
    const many = threads > 100_000 ? 100 : 1000
    const few = many / 10
    const long = await middle(target, many, 'one pass')
    const short = await middle(target, few, 'one pass')
    const each = (key: keyof Clocks) => ((long[key] - short[key]) / (many - few)) * 1000
    lines.push(
      threads.toLocaleString('en').padStart(20) +
        cell(each('gpu'), 10, 1) +
        cell(each('all'), 10, 1),
    )
    allRan &&= (await counted(target)) === target.sent
    target.buffer.destroy()
  }

  // JavaScript's share is too small for the clock of a page, which ticks every 0.1 ms in Chrome:
  // write down a hundred thousand dispatches, and send none.
  const start = performance.now()
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, small.bindGroup)
  for (let i = 0; i < 100_000; i++) {
    pass.dispatchWorkgroups(1)
  }
  pass.end()
  encoder.finish()
  const written = (performance.now() - start) / 100
  lines.push('', `JavaScript writes one down in ${written.toFixed(2)} (timed over 100 000).`)

  lines.push('', '1000 dispatches of 64 threads, in milliseconds', '')
  lines.push('                       JavaScript       all')
  for (const packing of ['one pass', 'a pass each', 'a submit each'] as const) {
    const clocks = await middle(small, 1000, packing)
    lines.push(packing.padEnd(20) + cell(clocks.js, 13, 2) + cell(clocks.all, 10, 1))
  }
  allRan &&= (await counted(small)) === small.sent

  lines.push('', allRan ? 'Checked: every dispatch ran.' : 'WRONG: some dispatches did not run.')
  if (!hasClock) {
    lines.push('This browser gives no GPU clock (the timestamp-query feature).')
  }
  return lines.join('\n')
}

function cell(value: number, width: number, digits: number): string {
  return (Number.isNaN(value) ? '-' : value.toFixed(digits)).padStart(width)
}

function median(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
}

const output = document.querySelector('#output')
if (output) {
  run().then(
    (message) => {
      output.textContent = message
    },
    (error: unknown) => {
      output.textContent = `FAILED: ${error}`
    },
  )
}
