import { describe, expect, it } from 'vitest'
import { FixedTimestep } from '../src/fixed-timestep.js'

// Runs `frames` frames of the same length and returns the steps of each one.
function stepsPerFrame(clock: FixedTimestep, frameTime: number, frames: number): number[] {
  return Array.from({ length: frames }, () => clock.advance(frameTime))
}

describe('FixedTimestep', () => {
  it('runs two steps per frame at 30 FPS, with nothing left over', () => {
    const clock = new FixedTimestep(1 / 60)

    expect(stepsPerFrame(clock, 1 / 30, 3)).toEqual([2, 2, 2])
    expect(clock.alpha).toBeCloseTo(0)
  })

  it('runs a step every other frame at 120 FPS', () => {
    const clock = new FixedTimestep(1 / 60)

    expect(stepsPerFrame(clock, 1 / 120, 4)).toEqual([0, 1, 0, 1])
  })

  // The frame table of docs/topics/fixed-timestep.md, after the same warm-up frame.
  it('matches the 50 FPS table of the theory page', () => {
    const clock = new FixedTimestep(1 / 60)
    clock.advance(1 / 50)

    const steps: number[] = []
    const alphas: number[] = []
    for (let frame = 0; frame < 5; frame++) {
      steps.push(clock.advance(1 / 50))
      alphas.push(Number(clock.alpha.toFixed(1)))
    }

    expect(steps).toEqual([1, 1, 1, 2, 1])
    expect(alphas).toEqual([0.4, 0.6, 0.8, 0, 0.2])
  })

  it('stops at the step limit and throws the extra time away', () => {
    const clock = new FixedTimestep(1 / 60, 4)

    // A tab left in the background for a second.
    expect(clock.advance(1)).toBe(4)
    expect(clock.alpha).toBeCloseTo(0)
    // The next normal frame is normal again.
    expect(clock.advance(1 / 60)).toBe(1)
  })

  it('rejects a negative or missing frame time', () => {
    const clock = new FixedTimestep()

    expect(() => clock.advance(-0.01)).toThrow(RangeError)
    expect(() => clock.advance(Number.NaN)).toThrow(RangeError)
  })
})
