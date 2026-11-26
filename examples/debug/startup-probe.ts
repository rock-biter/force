// A probe for a page that never starts: with ?probe in the address it writes on the page each step
// of the start on the GPU as it happens, so a phone, where there is no console, says by itself
// where it stops. It wraps the calls of WebGPU and changes nothing of what they do. Load it before
// the page's own script.

if (new URLSearchParams(location.search).has('probe') && 'gpu' in navigator) {
  const began = performance.now()
  const output = document.createElement('pre')
  output.style.cssText =
    'position:fixed;left:0;right:0;bottom:0;max-height:60%;overflow:auto;margin:0;padding:8px;' +
    'font-size:11px;background:#fffd;color:#000;z-index:10;white-space:pre-wrap;user-select:text;' +
    '-webkit-user-select:text'
  document.body.append(output)
  const lines: string[] = []
  /** Adds a line, and gives back a way to rewrite it when what it tells of ends. */
  const say = (text: string) => {
    const at = lines.length
    const write = (now: string) => {
      lines[at] = `${Math.round(performance.now() - began)} ms  ${now}`
      output.textContent = lines.join('\n')
    }
    write(text)
    return write
  }
  /** Tells of a promise: that it started, then that it ended and after how long, or how it failed. */
  const follow = <T>(name: string, promise: Promise<T>): Promise<T> => {
    const started = performance.now()
    const write = say(`${name}: waiting…`)
    const took = () => `${Math.round(performance.now() - started)} ms`
    promise.then(
      () => write(`${name}: ok, ${took()}`),
      (error) => write(`${name}: FAILED after ${took()}: ${error}`),
    )
    return promise
  }

  say(navigator.userAgent)

  const requestAdapter = GPU.prototype.requestAdapter
  GPU.prototype.requestAdapter = function (...args) {
    const adapter = follow('adapter', requestAdapter.apply(this, args))
    adapter.then((a) => {
      if (a) say(`features: ${[...a.features].join(' ')}`)
    })
    return adapter
  }
  const requestDevice = GPUAdapter.prototype.requestDevice
  GPUAdapter.prototype.requestDevice = function (...args) {
    const device = follow('device', requestDevice.apply(this, args))
    device.then((d) => d.lost.then((info) => say(`device LOST: ${info.reason} ${info.message}`)))
    return device
  }

  // A pipeline is told apart by its shader: how long the code is, and the names of its functions.
  const codes = new WeakMap<GPUShaderModule, string>()
  const createShaderModule = GPUDevice.prototype.createShaderModule
  GPUDevice.prototype.createShaderModule = function (descriptor) {
    const module = createShaderModule.call(this, descriptor)
    codes.set(module, descriptor.code)
    return module
  }
  let count = 0
  const createComputePipelineAsync = GPUDevice.prototype.createComputePipelineAsync
  GPUDevice.prototype.createComputePipelineAsync = function (descriptor) {
    const code = codes.get(descriptor.compute.module) ?? ''
    const names = [...code.matchAll(/\bfn (\w+)/g)].map((match) => match[1])
    const name = `pipeline ${count++} (${code.length} chars; fn ${names.slice(-3).join(', ')})`
    return follow(name, createComputePipelineAsync.call(this, descriptor))
  }

  new MutationObserver((changes) => {
    for (const change of changes)
      for (const node of change.addedNodes)
        if (node instanceof HTMLCanvasElement)
          say(`canvas on the page, ${node.width}×${node.height}`)
  }).observe(document.body, { childList: true })
  addEventListener('error', (event) => say(`error: ${event.message}`))
  addEventListener('unhandledrejection', (event) => say(`rejected: ${event.reason}`))
}
