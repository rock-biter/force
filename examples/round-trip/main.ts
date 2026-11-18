// What a trip from the GPU to JavaScript costs, timed.
// A solver that takes turns needs the CPU in the middle of a step: results are copied back, looked
// at in JavaScript, and an answer goes to the GPU again. In WebGPU the way back is asynchronous:
// you ask, and the data comes later. Four measures of how much later.

const RUNS = 7
/** Runs averaged into one number. Some browsers give a page a clock that moves in steps of a whole
 * millisecond: one run then reads 0 or 1, and only the average of many says something. */
const REPEAT = 10
const FRAMES = 60

/** Every thread adds 1 to its own number: after N dispatches each number is N. */
const SHADER = `
@group(0) @binding(0) var<storage, read_write> data: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= arrayLength(&data)) { return; }
  data[id.x] = data[id.x] + 1.0;
}`

interface Scene {
  /** How many numbers the buffer holds, 4 bytes each. */
  numbers: number
  workgroups: number
  buffer: GPUBuffer
  /** The buffer JavaScript can open: results are copied here first. */
  readable: GPUBuffer
  bindGroup: GPUBindGroup
  /** How many dispatches the buffer has seen: what every number should be. */
  sent: number
}

async function run(): Promise<string> {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) {
    throw new Error('no WebGPU here')
  }
  const device = await adapter.requestDevice()
  const pipeline = await device.createComputePipelineAsync({
    layout: 'auto',
    compute: { module: device.createShaderModule({ code: SHADER }) },
  })
  let allRight = true
  // Most WebGPU errors do not throw: the work is skipped. Keep them, to print them at the end.
  const refused: string[] = []
  device.addEventListener('uncapturederror', (event) => refused.push(event.error.message))

  function scene(numbers: number): Scene {
    const buffer = device.createBuffer({
      size: numbers * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    })
    const readable = device.createBuffer({
      size: numbers * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    })
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    })
    return { numbers, workgroups: Math.ceil(numbers / 64), buffer, readable, bindGroup, sent: 0 }
  }

  /** Writes `count` dispatches over the whole buffer into the list of commands. */
  function work(encoder: GPUCommandEncoder, target: Scene, count: number): void {
    if (count === 0) {
      return
    }
    const pass = encoder.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, target.bindGroup)
    for (let i = 0; i < count; i++) {
      pass.dispatchWorkgroups(target.workgroups)
    }
    pass.end()
    target.sent += count
  }

  /** Opens the readable buffer, copies its first `numbers` out, and checks them. */
  function open(target: Scene, numbers: number): Float32Array<ArrayBuffer> {
    const copy = new Float32Array(target.readable.getMappedRange(0, numbers * 4)).slice()
    target.readable.unmap()
    allRight &&= copy[0] === target.sent && copy[numbers - 1] === target.sent
    return copy
  }

  /** Some work, then the trip back of the first `numbers`. Milliseconds until JavaScript has them. */
  async function tripBack(target: Scene, numbers: number, dispatches: number) {
    await device.queue.onSubmittedWorkDone() // start from a GPU with nothing to do
    const start = performance.now()
    const encoder = device.createCommandEncoder()
    work(encoder, target, dispatches)
    encoder.copyBufferToBuffer(target.buffer, 0, target.readable, 0, numbers * 4)
    device.queue.submit([encoder.finish()])
    await target.readable.mapAsync(GPUMapMode.READ, 0, numbers * 4)
    const arrived = performance.now() - start
    open(target, numbers)
    return { arrived, copied: performance.now() - start - arrived }
  }

  /** The same work with no trip: milliseconds until the browser says it is done. */
  async function workAlone(target: Scene, dispatches: number): Promise<number> {
    await device.queue.onSubmittedWorkDone()
    const start = performance.now()
    const encoder = device.createCommandEncoder()
    work(encoder, target, dispatches)
    device.queue.submit([encoder.finish()])
    await device.queue.onSubmittedWorkDone()
    return performance.now() - start
  }

  /**
   * The work, a wait until the browser says it is done, and only then the trip. If "done" is true
   * this takes the work alone plus an idle trip. If it takes as long as a trip sent with the work,
   * the browser said "done" too early.
   */
  async function tripAfterDone(target: Scene, numbers: number, dispatches: number) {
    await device.queue.onSubmittedWorkDone()
    const start = performance.now()
    const encoder = device.createCommandEncoder()
    work(encoder, target, dispatches)
    device.queue.submit([encoder.finish()])
    await device.queue.onSubmittedWorkDone()
    const copy = device.createCommandEncoder()
    copy.copyBufferToBuffer(target.buffer, 0, target.readable, 0, numbers * 4)
    device.queue.submit([copy.finish()])
    await target.readable.mapAsync(GPUMapMode.READ, 0, numbers * 4)
    const arrived = performance.now() - start
    open(target, numbers)
    return arrived
  }

  /** A step of two dispatches with a trip to JavaScript and back between them. */
  async function stepCutInTwo(target: Scene): Promise<number> {
    await device.queue.onSubmittedWorkDone()
    const start = performance.now()
    const first = device.createCommandEncoder()
    work(first, target, 1)
    first.copyBufferToBuffer(target.buffer, 0, target.readable, 0, target.numbers * 4)
    device.queue.submit([first.finish()])
    await target.readable.mapAsync(GPUMapMode.READ)
    const news = open(target, target.numbers)
    // Here the CPU would decide something. We send the same numbers back.
    device.queue.writeBuffer(target.buffer, 0, news)
    const second = device.createCommandEncoder()
    work(second, target, 1)
    device.queue.submit([second.finish()])
    await device.queue.onSubmittedWorkDone()
    return performance.now() - start
  }

  /** One trip per frame, started inside requestAnimationFrame: does it come back before the next? */
  function inFrames(target: Scene, numbers: number) {
    const stamps: number[] = []
    const late: number[] = []
    const frames: number[] = []
    let frame = 0
    let waiting = false
    return new Promise<{ every: number; late: number[]; frames: number[] }>((resolve) => {
      const finish = () => resolve({ every: mean(differences(stamps)), late, frames })
      const giveUp = setTimeout(finish, 5000) // a hidden tab gets no frames
      const tick = () => {
        frame++
        stamps.push(performance.now())
        if (late.length >= FRAMES) {
          clearTimeout(giveUp)
          finish()
          return
        }
        if (!waiting) {
          waiting = true
          const startFrame = frame
          const start = performance.now()
          const encoder = device.createCommandEncoder()
          encoder.copyBufferToBuffer(target.buffer, 0, target.readable, 0, numbers * 4)
          device.queue.submit([encoder.finish()])
          target.readable.mapAsync(GPUMapMode.READ, 0, numbers * 4).then(() => {
            late.push(performance.now() - start)
            frames.push(frame - startFrame)
            open(target, numbers)
            waiting = false
          })
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }

  /** The average of a few runs, taken a few times: the middle one of those averages. */
  async function middle<T>(measure: () => Promise<T>, pick: (result: T) => number) {
    await measure() // one run that does not count
    const rounds: T[][] = []
    for (let i = 0; i < RUNS; i++) {
      const round: T[] = []
      for (let j = 0; j < REPEAT; j++) {
        round.push(await measure())
      }
      rounds.push(round)
    }
    return (key: (result: T) => number = pick) =>
      median(rounds.map((round) => mean(round.map(key))))
  }

  const lines = [
    `${adapter.info.description || adapter.info.vendor} (${adapter.info.architecture})`,
    '',
    `Milliseconds: each number is the average of ${REPEAT} runs, the middle one of ${RUNS} such averages.`,
    `The clock of this page moves in steps of ${clockStep()}. A frame at 60 per second lasts 16.7.`,
    '',
    '1. One trip back, with the GPU doing nothing else',
    '',
    '           bytes   arrives after   copied out in',
  ]
  // A dispatch takes 65 535 workgroups at most: 64 threads each, about four million numbers.
  for (const numbers of [4, 16_384, 262_144, 2_097_152]) {
    const target = scene(numbers)
    await workAlone(target, 1)
    const trip = await middle(
      () => tripBack(target, numbers, 0),
      (result) => result.arrived,
    )
    lines.push(
      (numbers * 4).toLocaleString('en').padStart(16) +
        cell(trip(), 16) +
        cell(
          trip((result) => result.copied),
          16,
        ),
    )
    target.buffer.destroy()
    target.readable.destroy()
  }

  lines.push('', '2. A trip of 64 KB behind dispatches over a million numbers', '')
  lines.push('      dispatches      work alone    trip arrives   done, then trip')
  const big = scene(1_048_576)
  for (const dispatches of [0, 20, 40]) {
    const alone = await middle(
      () => workAlone(big, dispatches),
      (result) => result,
    )
    const trip = await middle(
      () => tripBack(big, 16_384, dispatches),
      (result) => result.arrived,
    )
    const after = await middle(
      () => tripAfterDone(big, 16_384, dispatches),
      (result) => result,
    )
    lines.push(
      String(dispatches).padStart(16) + cell(alone(), 16) + cell(trip(), 16) + cell(after(), 18),
    )
  }

  lines.push('', '3. A step of two dispatches over 65 536 numbers', '')
  const small = scene(65_536)
  const whole = await middle(
    () => workAlone(small, 2),
    (result) => result,
  )
  const cut = await middle(
    () => stepCutInTwo(small),
    (result) => result,
  )
  lines.push(`sent whole:                           ${cell(whole(), 8)}`)
  lines.push(`cut in two by a trip there and back:  ${cell(cut(), 8)}`)

  lines.push('', '4. One trip of 64 KB per frame, asked inside requestAnimationFrame', '')
  const perFrame = await inFrames(small, 16_384)
  if (perFrame.late.length === 0) {
    lines.push('No frames here: the page is not visible.')
  } else {
    const count = (test: (frames: number) => boolean) => perFrame.frames.filter(test).length
    lines.push(
      `a frame every ${perFrame.every.toFixed(1)}, the answer after ${mean(perFrame.late).toFixed(2)}, on average`,
      `back before the next frame:  ${count((frames) => frames === 0)} of ${perFrame.late.length}`,
      `one frame late:              ${count((frames) => frames === 1)}`,
      `later:                       ${count((frames) => frames > 1)}`,
    )
  }

  lines.push(
    '',
    allRight ? 'Checked: every number read back was right.' : 'WRONG numbers came back.',
  )
  return [...lines, ...refused].join('\n')
}

function cell(value: number, width: number): string {
  return value.toFixed(2).padStart(width)
}

function median(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** The smallest step the clock of the page makes, in milliseconds. */
function clockStep(): number {
  let smallest = Number.POSITIVE_INFINITY
  for (let i = 0; i < 5; i++) {
    const from = performance.now()
    let to = from
    while (to === from) {
      to = performance.now()
    }
    smallest = Math.min(smallest, to - from)
  }
  return Number(smallest.toFixed(3))
}

function differences(values: number[]): number[] {
  return values.slice(1).map((value, i) => value - values[i])
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
