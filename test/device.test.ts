import { afterEach, describe, expect, it, vi } from 'vitest'
import { isWebGPUSupported, requestGPUDevice, WebGPUUnavailableError } from '../src/index.js'

describe('requestGPUDevice', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects when the browser has no WebGPU', async () => {
    vi.stubGlobal('navigator', {})

    expect(isWebGPUSupported()).toBe(false)
    await expect(requestGPUDevice()).rejects.toBeInstanceOf(WebGPUUnavailableError)
  })

  it('rejects when no adapter is available', async () => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => null } })

    expect(isWebGPUSupported()).toBe(true)
    await expect(requestGPUDevice()).rejects.toBeInstanceOf(WebGPUUnavailableError)
  })

  it('resolves with the device from the adapter', async () => {
    const device = {}
    const adapter = { requestDevice: async () => device }
    vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => adapter } })

    await expect(requestGPUDevice()).resolves.toBe(device)
  })
})
