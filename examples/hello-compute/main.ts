// The full round trip of a WebGPU compute job: upload data, run a shader, read the result back.
// Not a benchmark: 1000 floats are faster on the CPU. The point is to see every step once.

import { requestGPUDevice } from 'force-gpu'
import shaderCode from './free-fall.wgsl?raw'

const PARTICLE_COUNT = 1000
const WORKGROUP_SIZE = 64
const GRAVITY = 9.81
const DT = 0.1

async function run(): Promise<string> {
  const device = await requestGPUDevice()

  // 1. Data. GPU buffers are raw bytes, so typed arrays are the natural way to fill them.
  const heights = Float32Array.from({ length: PARTICLE_COUNT }, (_, i) => i)
  const size = heights.byteLength

  // 2. Buffers. `usage` must declare up front everything a buffer will be used for.
  //    JavaScript cannot read a STORAGE buffer directly, so results are copied into a second
  //    buffer that can be mapped (made visible to the CPU).
  const storageBuffer = device.createBuffer({
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  })
  const readbackBuffer = device.createBuffer({
    size,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(storageBuffer, 0, heights)

  // 3. Pipeline: the compiled shader plus its fixed configuration.
  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: device.createShaderModule({ code: shaderCode }),
      constants: { WORKGROUP_SIZE, GRAVITY, DT },
    },
  })

  // 4. Bind group: connects real buffers to the shader's @group/@binding slots.
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: storageBuffer } }],
  })

  // 5. Commands are recorded first, then submitted together. Nothing runs before submit().
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / WORKGROUP_SIZE))
  pass.end()
  encoder.copyBufferToBuffer(storageBuffer, 0, readbackBuffer, 0, size)
  device.queue.submit([encoder.finish()])

  // 6. Readback. mapAsync waits for the GPU; slice() copies the bytes out before unmap().
  await readbackBuffer.mapAsync(GPUMapMode.READ)
  const result = new Float32Array(readbackBuffer.getMappedRange().slice(0))
  readbackBuffer.unmap()

  // Same step on the CPU, to prove that the GPU really did the work.
  const drop = 0.5 * GRAVITY * DT * DT
  const matches = result.every((height, i) => Math.abs(height - (heights[i] - drop)) < 1e-3)
  if (!matches) {
    throw new Error('GPU and CPU results differ')
  }

  const firstHeights = Array.from(result.subarray(0, 4), (height) => height.toFixed(5))
  return `OK: ${PARTICLE_COUNT} particles match the CPU.\nFirst heights: ${firstHeights.join(', ')}`
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
