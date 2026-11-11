# How do you get access to the GPU?

*WebGPU mini guide · 4 min read · Code: [src/gpu/device.ts](../../src/gpu/device.ts)*

**In short:** you ask the browser for an *adapter*, one GPU of this machine, then ask the adapter for a *device*, your own connection to it. Every buffer, shader and pipeline (a shader ready to run) is created from the device.

## The idea

In three.js, `new WebGLRenderer()` calls `canvas.getContext('webgl2')` for you, and that context is your handle on the GPU: every texture, shader and buffer is created through it, and it belongs to one canvas.

WebGPU splits that handle in two, and leaves the canvas out:

- The **adapter** (`GPUAdapter`) stands for one GPU. It tells you what that GPU is and what it can do.
- The **device** (`GPUDevice`) is your session with it. Everything you create belongs to it, and cannot be used with another device.

Think of a restaurant: the adapter is the menu, the device is your order. You get standard portions unless you ask for more, and each menu takes one order.

What a GPU can do is mostly its **limits**, maximum sizes and counts, like `gl.getParameter(gl.MAX_TEXTURE_SIZE)` in WebGL or `renderer.capabilities` in three.js. One difference matters: WebGL gives you the GPU's real limits, while a WebGPU device starts from defaults that every GPU supports, and gets more only if it asks.

And no canvas is needed. WebGL has no compute shaders, so three.js `GPUComputationRenderer` hides each computation inside a draw into a texture. A WebGPU device can compute without ever drawing, which is all FORCE does so far.

## The code

```ts
export async function requestGPUDevice(): Promise<GPUDevice> {
  if (!isWebGPUSupported()) {
    throw new WebGPUUnavailableError('navigator.gpu is missing: …')
  }

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    throw new WebGPUUnavailableError('WebGPU is available, but no suitable GPU adapter was found.')
  }

  return adapter.requestDevice()
}
```

- `navigator.gpu` is the entry point, and `isWebGPUSupported()` checks that it exists. It is missing in browsers without WebGPU, and on pages served neither over HTTPS nor from localhost.
- `requestAdapter()` asks for a GPU. It accepts a hint, `powerPreference: 'low-power'` or `'high-performance'`, the same one you can pass to `WebGLRenderer`, mainly to choose between two GPUs in a laptop. When no suitable GPU is available it resolves to `null`: no error is thrown.
- `requestDevice()` opens the session. Without options the device gets the default limits, no matter what the GPU could do, and no optional features, extras such as compressed texture formats. Asking for more looks like this: `adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize } })`.

## Common mistakes

- **Testing on a phone over the local network.** `http://192.168.1.10:5173` is neither HTTPS nor localhost, so `navigator.gpu` is `undefined`, even on a phone that supports WebGPU. Serve the page over HTTPS, for example with Vite's `@vitejs/plugin-basic-ssl`.
- **Forgetting the `null`.** `requestAdapter()` does not throw, so the error shows up one line later, in Chrome as `Cannot read properties of null (reading 'requestDevice')`.
- **Expecting the adapter's limits on the device.** A compute shader reads and writes GPU memory through *storage buffers*. A GPU may let a shader see more than 128 MiB of one at a time, yet the device stays at 128 MiB (`maxStorageBufferBindingSize`) until you ask for more.

## Where FORCE uses it

[`World.create()`](../../src/world.ts) takes the device your renderer already uses, and calls [`requestGPUDevice()`](../../src/gpu/device.ts) only when you give none ([decision 010](../decisions/010-device-from-outside.md)). The world then reads `device.limits.maxComputeWorkgroupsPerDimension`, how many groups of threads one command can launch, to know how many particles it can move. FORCE does not handle a *lost* device yet: the browser can take the GPU back at any time, for example after a driver update. Then `device.lost` resolves, and everything has to be created again, starting from a new adapter.

## Try it

In the DevTools console of any HTTPS page, in a browser with WebGPU:

```js
const adapter = await navigator.gpu.requestAdapter()
const device = await adapter.requestDevice()
adapter.limits.maxStorageBufferBindingSize // the best this GPU allows
device.limits.maxStorageBufferBindingSize  // what you got: 134217728, the default 128 MiB
await adapter.requestDevice()              // rejects: one menu, one order
```

## Sources

- [WebGPU specification](https://www.w3.org/TR/webgpu/), section 3.5: a new device starts from the default limits, the adapter's limits are the best it can offer, and why an adapter gives only one device.
- [MDN, GPU.requestAdapter()](https://developer.mozilla.org/en-US/docs/Web/API/GPU/requestAdapter): `null` when no adapter fits, and `powerPreference` as a hint.
- [MDN, GPUAdapter.requestDevice()](https://developer.mozilla.org/en-US/docs/Web/API/GPUAdapter/requestDevice): the options, and why a second call rejects.
- [MDN, GPUDevice.lost](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost): when and why a device is lost.
- [MDN, Navigator.gpu](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/gpu): secure contexts only.
- [MDN, GPUSupportedLimits](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits): the default values, such as 128 MiB for a storage buffer binding.
- [Toji.dev, WebGPU Best Practices: Device Loss](https://toji.dev/webgpu-best-practices/device-loss): the causes of a lost device, Chrome's 10-second limit, and how to test it.

## For an article or video

- **Hook:** in WebGL the GPU came with the canvas. In WebGPU you ask for it, twice, and you can skip the canvas.
- **Show:** the console snippet, with the adapter's limit and the device's side by side.
- **Takeaway:** the adapter says what the GPU can do; the device is what you get, and you get more only if you ask.

## Questions

*Asked while reading this guide, and answered after checking the sources.*

### Each adapter gives only one device. Can I ask for two adapters?

Yes. Every call to `requestAdapter()` returns a new adapter object, even for the same GPU, and each one can give its own device. Two devices on one GPU are two separate sessions: a device is "the exclusive owner" of what it creates, so a buffer made on one cannot be used on the other.

That matters for FORCE. If three.js drew with one device and FORCE simulated on another, the positions would have to pass through the CPU to get from one to the other. So FORCE takes the renderer's device when you give it, and requests its own only when you do not: [decision 010](../decisions/010-device-from-outside.md).

Why one device per adapter? The spec says it makes apps choose the GPU from the latest state of the system. An adapter is a snapshot, and it can *expire*: a device asked from an expired adapter arrives already lost, while a second device asked from a used adapter is rejected. So ask for a new adapter right before each device.

### When is a device lost?

When the browser takes the GPU back, at any time and without warning. The causes listed by MDN and Toji.dev:

- the GPU driver crashes, or is updated;
- a shader takes too long: Chrome kills its GPU process when the driver needs about 10 seconds for one operation;
- the GPU runs out of memory, on some systems;
- the GPU is unplugged, or turned off to save power;
- the browser needs the resources back;
- your own code calls `device.destroy()`.

Then `device.lost` resolves with an info object. Its `reason` is `'destroyed'` after `destroy()` and `'unknown'` for everything else; its `message` is for humans, not for code. Nothing throws: new objects are just invalid, and reading back with `mapAsync()` fails. The way out is to start over: a new adapter, a new device, and every buffer and pipeline again.

For a physics engine the hard part is the data: positions and velocities live only on the GPU, so they are gone too. *Our reading:* FORCE will need a way to rebuild its state, a question for when we handle device loss.

To try it, call `device.destroy()`, or open `about:gpucrash` in another Chrome tab to crash the GPU process.
