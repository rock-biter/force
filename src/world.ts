import { FixedTimestep } from './fixed-timestep.js'
import integrateCode from './shaders/integrate.wgsl?raw'

const WORKGROUP_SIZE = 64
/** Floats per particle in each GPU buffer: one vec4f, with w free (decision 008). */
const STRIDE = 4
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT

export interface WorldOptions {
  /** Where the particles start, in meters: x, y, z for each one. */
  positions: Float32Array
  /** How fast they start, in meters per second: x, y, z for each one. Default: at rest. */
  velocities?: Float32Array
  /** In m/s². Default: 9.81 down the Y axis (decision 009). */
  gravity?: readonly [number, number, number]
  /** Seconds of simulated time per step. Default: 1/60 (decision 007). */
  step?: number
  /** Steps per frame at most, with the time beyond them thrown away. Default: 4 (decision 007). */
  maxStepsPerFrame?: number
}

/** A set of particles that move on the GPU, one fixed step at a time. */
export class World {
  readonly device: GPUDevice
  readonly particleCount: number
  private readonly clock: FixedTimestep
  private readonly positions: GPUBuffer
  private readonly velocities: GPUBuffer
  private readonly params: GPUBuffer
  private readonly pipeline: GPUComputePipeline
  private readonly bindGroup: GPUBindGroup
  private readonly workgroups: number
  private steps = 0

  constructor(device: GPUDevice, options: WorldOptions) {
    const { positions, velocities, gravity = [0, -9.81, 0] } = options
    if (positions.length === 0 || positions.length % 3 !== 0) {
      throw new RangeError('positions must hold x, y, z for at least one particle')
    }
    if (velocities && velocities.length !== positions.length) {
      throw new RangeError('velocities must hold x, y, z for each particle')
    }

    this.device = device
    this.particleCount = positions.length / 3
    this.clock = new FixedTimestep(options.step, options.maxStepsPerFrame)

    // Workgroups are counted per dimension, and we only use x.
    this.workgroups = Math.ceil(this.particleCount / WORKGROUP_SIZE)
    if (this.workgroups > device.limits.maxComputeWorkgroupsPerDimension) {
      const max = device.limits.maxComputeWorkgroupsPerDimension * WORKGROUP_SIZE
      throw new RangeError(
        `this device can move at most ${max} particles, got ${this.particleCount}`,
      )
    }

    const size = this.particleCount * STRIDE * FLOAT_BYTES
    this.positions = device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    })
    this.velocities = device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(this.positions, 0, toVec4(positions))
    if (velocities) {
      device.queue.writeBuffer(this.velocities, 0, toVec4(velocities))
    } // otherwise the buffer stays as WebGPU creates it: all zeros

    // The shader's Params struct: gravity in xyz, the step in the fourth slot.
    this.params = device.createBuffer({
      size: 4 * FLOAT_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(this.params, 0, new Float32Array([...gravity, this.clock.step]))

    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: integrateCode }),
        constants: { WORKGROUP_SIZE },
      },
    })
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.params } },
        { binding: 1, resource: { buffer: this.positions } },
        { binding: 2, resource: { buffer: this.velocities } },
      ],
    })
  }

  /** Steps run so far. */
  get stepCount(): number {
    return this.steps
  }

  /** Seconds of simulated time so far. */
  get time(): number {
    return this.steps * this.clock.step
  }

  /**
   * Advances the world by the real time of one frame, in seconds, and returns the steps it ran.
   * The steps are sent to the GPU without waiting for them to finish.
   */
  update(frameTime: number): number {
    const steps = this.clock.advance(frameTime)
    if (steps === 0) {
      return 0
    }

    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginComputePass()
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    // One dispatch per step. The spec makes each dispatch its own usage scope (§3.4.4); our
    // reading is that WebGPU orders them, so every step sees what the step before wrote.
    // The falling-particles example checks it against the CPU.
    for (let i = 0; i < steps; i++) {
      pass.dispatchWorkgroups(this.workgroups)
    }
    pass.end()
    this.device.queue.submit([encoder.finish()])

    this.steps += steps
    return steps
  }

  /**
   * Copies the positions back from the GPU: x, y, z for each particle. Meant for checks and
   * debugging, since it waits for the GPU. Commands run in the order they are sent, so the result
   * holds every step sent before this call, and none sent after.
   */
  async readPositions(): Promise<Float32Array> {
    const size = this.particleCount * STRIDE * FLOAT_BYTES
    const readback = this.device.createBuffer({
      size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    })
    const encoder = this.device.createCommandEncoder()
    encoder.copyBufferToBuffer(this.positions, 0, readback, 0, size)
    this.device.queue.submit([encoder.finish()])

    await readback.mapAsync(GPUMapMode.READ)
    // fromVec4 copies the bytes out: the mapped range cannot be read after unmap().
    const xyz = fromVec4(new Float32Array(readback.getMappedRange()))
    readback.unmap()
    readback.destroy()
    return xyz
  }

  /** Frees the GPU memory. The world cannot be used after this. */
  destroy(): void {
    this.positions.destroy()
    this.velocities.destroy()
    this.params.destroy()
  }
}

/** Three floats per particle to four, as the GPU buffers hold them. */
function toVec4(xyz: Float32Array): Float32Array {
  const count = xyz.length / 3
  const out = new Float32Array(count * STRIDE)
  for (let i = 0; i < count; i++) {
    out.set(xyz.subarray(i * 3, i * 3 + 3), i * STRIDE)
  }
  return out
}

/** Four floats per particle back to three. */
function fromVec4(vec4: Float32Array): Float32Array {
  const count = vec4.length / STRIDE
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    out.set(vec4.subarray(i * STRIDE, i * STRIDE + 3), i * 3)
  }
  return out
}
