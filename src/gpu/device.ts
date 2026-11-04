/** Thrown when the current environment cannot provide a WebGPU device. */
export class WebGPUUnavailableError extends Error {
  override name = 'WebGPUUnavailableError'
}

/** Whether this environment exposes the WebGPU API at all. */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && navigator.gpu !== undefined
}

/**
 * Requests a `GPUDevice`, the handle every WebGPU resource is created from.
 *
 * @throws {WebGPUUnavailableError} If WebGPU is missing or no GPU adapter is available.
 */
export async function requestGPUDevice(): Promise<GPUDevice> {
  if (!isWebGPUSupported()) {
    throw new WebGPUUnavailableError(
      'navigator.gpu is missing: the browser lacks WebGPU, or the page is not on HTTPS/localhost.',
    )
  }

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new WebGPUUnavailableError('WebGPU is available, but no suitable GPU adapter was found.')
  }

  return adapter.requestDevice()
}
