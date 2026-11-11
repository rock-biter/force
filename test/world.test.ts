import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebGPUUnavailableError, World } from '../src/index.js'

// Only what runs before the GPU is touched: the GPU part is checked by examples/falling-particles.
describe('World.create', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects positions that are not x, y, z triples', async () => {
    await expect(World.create({ positions: new Float32Array(4) })).rejects.toBeInstanceOf(
      RangeError,
    )
  })

  it('rejects substeps that are not a whole number of at least 1', async () => {
    for (const substeps of [0, 1.5, Number.NaN]) {
      await expect(
        World.create({ positions: new Float32Array(3), substeps }),
      ).rejects.toBeInstanceOf(RangeError)
    }
  })

  it('rejects a negative radius', async () => {
    await expect(
      World.create({ positions: new Float32Array(3), radius: -1 }),
    ).rejects.toBeInstanceOf(RangeError)
  })

  it('rejects a ground with restitution outside 0 to 1, or negative friction', async () => {
    for (const ground of [{ restitution: 1.5 }, { restitution: -0.1 }, { friction: -1 }]) {
      await expect(World.create({ positions: new Float32Array(3), ground })).rejects.toBeInstanceOf(
        RangeError,
      )
    }
  })

  it('requests a device of its own when none is given', async () => {
    vi.stubGlobal('navigator', {})

    await expect(World.create({ positions: new Float32Array(3) })).rejects.toBeInstanceOf(
      WebGPUUnavailableError,
    )
  })
})
