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

  it('requests a device of its own when none is given', async () => {
    vi.stubGlobal('navigator', {})

    await expect(World.create({ positions: new Float32Array(3) })).rejects.toBeInstanceOf(
      WebGPUUnavailableError,
    )
  })
})
