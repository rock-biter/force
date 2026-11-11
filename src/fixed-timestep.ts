// Rounding can leave the accumulator a hair short of a step it really holds: at 50 FPS, four frames
// of 1/50 s should end with exactly two steps of 1/60 s, and floats can miss by 1e-17 s.
const TOLERANCE = 1e-9

/**
 * Spends the real time of each frame in fixed steps of simulated time, keeping what is left over
 * for the next frame: the accumulator of docs/topics/fixed-timestep.md. Pure arithmetic, no GPU.
 */
export class FixedTimestep {
  /** Seconds of simulated time per step. */
  readonly step: number
  /** Steps per frame at most: time beyond them is thrown away (decision 007). */
  readonly maxSteps: number
  private accumulator = 0

  constructor(step = 1 / 60, maxSteps = 4) {
    if (!(step > 0)) {
      throw new RangeError(`step must be a positive number of seconds, got ${step}`)
    }
    if (!Number.isInteger(maxSteps) || maxSteps < 1) {
      throw new RangeError(`maxSteps must be a whole number of at least 1, got ${maxSteps}`)
    }
    this.step = step
    this.maxSteps = maxSteps
  }

  /** How far the leftover time is into the next step, from 0 to 1: the blend weight for drawing. */
  get alpha(): number {
    return this.accumulator / this.step
  }

  /** Adds the real time of one frame, in seconds, and returns how many steps to run now. */
  advance(frameTime: number): number {
    if (!(frameTime >= 0)) {
      throw new RangeError(`frameTime must be zero or more seconds, got ${frameTime}`)
    }

    // Never hold more than maxSteps steps: after a slow frame, or a tab left in the background,
    // the simulation falls behind real time instead of trying to catch up (the spiral of death).
    this.accumulator = Math.min(this.accumulator + frameTime, this.maxSteps * this.step)

    let steps = 0
    while (steps < this.maxSteps && this.accumulator >= this.step - TOLERANCE) {
      this.accumulator -= this.step
      steps++
    }
    this.accumulator = Math.max(0, this.accumulator) // drop rounding noise such as -1e-17
    return steps
  }
}
