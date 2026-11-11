// FORCE's first loop: 1000 particles fall and fly sideways, one fixed step of 1/60 s at a time.
// Every simulated second the page reads the positions back from the GPU and checks them against
// the same steps computed in JavaScript. Nothing is drawn yet: the numbers are the result.

import { World } from 'force-gpu'

const PARTICLE_COUNT = 1000
const GRAVITY = -9.81 // m/s² along Y, the engine's default
const STEP = 1 / 60 // the engine's default
const STEPS_PER_CHECK = 60 // one check per simulated second
const TOTAL_STEPS = 600 // 10 simulated seconds, then the loop stops
// The GPU works in 32-bit floats and JavaScript in 64-bit: after 600 steps they drift about 1 mm
// apart. A lost step, or the wrong integrator, would be at least 16 cm off.
const TOLERANCE = 0.01 // meters

// Particle i starts i meters up, at rest vertically, and is thrown along X at (i % 10) m/s.
const start = new Float32Array(PARTICLE_COUNT * 3)
const startVelocity = new Float32Array(PARTICLE_COUNT * 3)
for (let i = 0; i < PARTICLE_COUNT; i++) {
  start[i * 3 + 1] = i
  startVelocity[i * 3] = i % 10
}

// The same semi-implicit Euler steps on the CPU: velocity first, then position.
function expectedPositions(steps: number): Float64Array {
  const position = Float64Array.from(start)
  const velocity = Float64Array.from(startVelocity)
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      velocity[i * 3 + 1] += GRAVITY * STEP
      for (let axis = 0; axis < 3; axis++) {
        position[i * 3 + axis] += velocity[i * 3 + axis] * STEP
      }
    }
  }
  return position
}

// The largest difference between GPU and CPU, in meters.
function largestDifference(gpu: Float32Array, cpu: Float64Array): number {
  let largest = 0
  for (let i = 0; i < gpu.length; i++) {
    largest = Math.max(largest, Math.abs(gpu[i] - cpu[i]))
  }
  return largest
}

async function run(output: HTMLElement): Promise<void> {
  // No device given: FORCE requests its own, since nothing else on this page uses the GPU.
  const world = await World.create({ positions: start, velocities: startVelocity })

  const framesBySteps = [0, 0, 0, 0, 0] // how many frames ran 0, 1, 2, 3 or 4 steps
  const checks: string[] = []
  let failed = false
  let pending = 0
  let nextCheck = STEPS_PER_CHECK
  let last: number | undefined

  const show = (status: string) => {
    output.textContent = [
      status,
      `Simulated ${world.time.toFixed(2)} s in ${world.stepCount} steps.`,
      `Frames by steps run: ${framesBySteps.map((frames, steps) => `${steps}: ${frames}`).join(' · ')}`,
      '',
      ...checks,
    ].join('\n')
  }

  const check = async () => {
    pending++
    // Read the step count now: the positions will hold exactly these steps.
    const steps = world.stepCount
    const difference = largestDifference(await world.readPositions(), expectedPositions(steps))
    const ok = difference <= TOLERANCE
    failed ||= !ok
    const millimeters = (difference * 1000).toFixed(3)
    checks.push(
      `${(steps * STEP).toFixed(2)} s, ${steps} steps: ${ok ? 'OK' : 'FAILED'}, largest difference ${millimeters} mm`,
    )
    pending--
  }

  const frame = (now: number) => {
    // requestAnimationFrame gives milliseconds; the engine wants seconds.
    const frameTime = last === undefined ? 0 : (now - last) / 1000
    last = now

    if (world.stepCount < TOTAL_STEPS) {
      framesBySteps[world.update(frameTime)]++
      if (world.stepCount >= nextCheck) {
        nextCheck += STEPS_PER_CHECK
        check().catch((error: unknown) => {
          failed = true
          checks.push(`Check FAILED: ${error}`)
        })
      }
    }

    // Keep the loop alive until the last readback has come back.
    if (world.stepCount < TOTAL_STEPS || pending > 0) {
      show('Running…')
      requestAnimationFrame(frame)
    } else {
      show(failed ? 'FAILED: the GPU and the CPU disagree.' : 'OK: the GPU matches the CPU.')
    }
  }
  requestAnimationFrame(frame)
}

const output = document.querySelector<HTMLElement>('#output')
if (output) {
  run(output).catch((error: unknown) => {
    output.textContent = `FAILED: ${error}`
  })
}
