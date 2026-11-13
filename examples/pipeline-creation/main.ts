// Two ways to create a pipeline, timed: the immediate one, and the async one.
// The question is not which one is faster, since both compile the same shader, but who waits
// meanwhile. So right after asking for the pipeline we send the GPU a tiny job that has nothing to
// do with it, and time how long that job takes.

import { requestGPUDevice } from 'force-gpu'
import integrateCode from '../../src/shaders/integrate.wgsl?raw'

const RUNS = 5

interface Timing {
  /** How long the JavaScript call took to return. */
  call: number
  /** How long the unrelated job waited. */
  otherWork: number
  /** When the pipeline had run for the first time. */
  firstRun: number
}

/** Browsers keep compiled shaders, so a text seen before costs nothing: every run needs a new one. */
let variant = Math.floor(Math.random() * 100_000)

/** FORCE's own shader, with one number changed. */
function forceShader(): string {
  const number = `1.${String(variant++).padStart(6, '0')}`
  return integrateCode.replace('1.0 + params.restitution', `${number} + params.restitution`)
}

/** A shader long enough to make the compiler sweat: a hundred lines of trigonometry. */
function longShader(): string {
  let body = ''
  for (let i = 0; i < 100; i++) {
    body += `  v = v * 1.001 + sin(v.yzx * ${(variant + i) % 97}.0) * cos(v.zxy + ${i}.0);\n`
    body += `  if (v.x > ${i}.5) { v = normalize(v + vec3f(${i % 13}.0)); }\n`
  }
  variant++
  return `@group(0) @binding(0) var<storage, read_write> data: array<vec4f>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  var v = data[id.x].xyz;
${body}  data[id.x] = vec4f(v, 1.0);
}`
}

async function measure(
  device: GPUDevice,
  code: string,
  mode: 'immediate' | 'async',
): Promise<Timing> {
  const isForce = code.includes('override GROUND')
  const descriptor: GPUComputePipelineDescriptor = {
    layout: 'auto',
    compute: {
      module: device.createShaderModule({ code }),
      constants: isForce ? { WORKGROUP_SIZE: 64, GROUND: 1 } : {},
    },
  }
  const scratch = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST })
  await device.queue.onSubmittedWorkDone() // start from a GPU with nothing to do

  const start = performance.now()
  let pipeline: GPUComputePipeline
  let pending: Promise<GPUComputePipeline> | undefined
  if (mode === 'immediate') {
    pipeline = device.createComputePipeline(descriptor)
  } else {
    pending = device.createComputePipelineAsync(descriptor)
  }
  const call = performance.now() - start

  // The unrelated job: sixteen bytes into a buffer the pipeline never touches.
  device.queue.writeBuffer(scratch, 0, new Float32Array(4))
  const otherWork = device.queue.onSubmittedWorkDone().then(() => performance.now() - start)

  pipeline ??= await (pending as Promise<GPUComputePipeline>)
  runOnce(device, pipeline, isForce)
  await device.queue.onSubmittedWorkDone()
  const firstRun = performance.now() - start

  scratch.destroy()
  return { call, otherWork: await otherWork, firstRun }
}

/** One dispatch, on throwaway buffers: enough to make sure the pipeline is really built. */
function runOnce(device: GPUDevice, pipeline: GPUComputePipeline, isForce: boolean): void {
  const storage = () => device.createBuffer({ size: 64 * 16, usage: GPUBufferUsage.STORAGE })
  const buffers = isForce
    ? [device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM }), storage(), storage()]
    : [storage()]
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })),
  })
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.dispatchWorkgroups(1)
  pass.end()
  device.queue.submit([encoder.finish()])
}

async function run(): Promise<string> {
  const device = await requestGPUDevice()
  // The first pipeline of a page pays for starting the compiler: keep it out of the numbers.
  await measure(device, longShader(), 'async')

  const lines = ['Milliseconds, the middle one of 5 runs. A frame at 60 per second lasts 16.7.', '']
  const shaders = [
    ['integrate.wgsl, the shader of FORCE', forceShader],
    ['a long shader', longShader],
  ] as const
  for (const [name, make] of shaders) {
    lines.push(name, '             call returns   other work waits   first run done')
    for (const mode of ['immediate', 'async'] as const) {
      const timings: Timing[] = []
      for (let i = 0; i < RUNS; i++) {
        timings.push(await measure(device, make(), mode))
      }
      const cells = (['call', 'otherWork', 'firstRun'] as const).map((key) =>
        median(timings.map((timing) => timing[key])).toFixed(1),
      )
      lines.push(
        `  ${mode.padEnd(11)}${cells[0].padStart(12)}${cells[1].padStart(19)}${cells[2].padStart(17)}`,
      )
    }
    lines.push('')
  }
  return lines.join('\n')
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
