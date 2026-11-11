# How do you send data to the GPU?

*WebGPU mini guide · 4 min read · Code: [src/world.ts](../../src/world.ts) · Read first: [adapter and device](./adapter-and-device.md)*

**In short:** you create a *buffer*, a block of GPU memory, giving its size in bytes and everything it will be used for. Then `device.queue.writeBuffer()` copies a typed array into it.

## The idea

With WebGL, three.js uploads your data for you: you put a `Float32Array` in a `BufferAttribute`, `WebGLRenderer` sends it to the GPU the first time it draws, with `gl.bufferData()`, and `needsUpdate = true` sends it again. With the WebGPU API used directly, nobody does that for you, and three things change:

- **A buffer is only bytes.** It does not know it holds floats, or positions: the shader that reads it decides that. It is like a JavaScript `ArrayBuffer`, with the shader playing the part of the `Float32Array` you look at it through.
- **The size is in bytes.** 1000 particles, 4 floats each, 4 bytes per float: 16 000 bytes. One buffer can hold up to 256 MiB, unless the device asks for more (the `maxBufferSize` limit).
- **Its uses are declared up front.** `usage` lists, as flags joined with `|`, everything the buffer will ever do. WebGL's `gl.STATIC_DRAW` (three.js `setUsage()`) only describes your intent, to help speed; in WebGPU a use that is not on the list is an error.

A new buffer is all zeros. You fill it through the device's *queue*, the line where work for the GPU waits and runs in order. `writeBuffer()` copies your array at once, so you can change the array right after the call. The bytes reach the buffer later, in their turn, so any work you send to the queue after the call sees them.

## The code

From FORCE, a physics engine: a `World` keeps the position and velocity of every particle in buffers, moved by a *compute shader*, a GPU program that computes instead of drawing, written in WGSL, WebGPU's shading language.

```ts
const size = this.particleCount * STRIDE * FLOAT_BYTES // particles × 4 floats × 4 bytes
this.positions = device.createBuffer({
  size,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
})
this.velocities = device.createBuffer({
  size,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(this.positions, 0, toVec4(positions))
```

- `size`: four floats per particle, not three. A `vec3f` (WGSL's `vec3`) in a shader array takes the room of four floats; the reason is a guide still to write (memory alignment), and FORCE's choice is [decision 008](../decisions/008-particles-in-two-vec4-buffers.md). `toVec4()` adds the fourth float to every particle.
- `STORAGE`: shaders can read it as an array, and write it too, except vertex shaders, which only read. That is how a vertex shader can draw from it with no `VERTEX` flag.
- `COPY_DST`: it can receive data, from `writeBuffer()` or from a copy.
- `COPY_SRC`: it can be copied from. JavaScript cannot read a storage buffer, so `readPositions()`, the method that reads the positions back, copies them into one it can (readback, a guide still to write). Velocities never leave the GPU, so they do without `COPY_SRC`.
- `writeBuffer(buffer, bufferOffset, data)`: `bufferOffset` is where to start writing, in bytes. When the user gives no starting velocities there is no write at all: zero already means at rest.

### Every usage flag

The flags decide what a buffer may do after it is created. The value is what `buffer.usage` adds up.

| Flag | Value | The buffer can be | For example |
| --- | --- | --- | --- |
| `MAP_READ` | 1 | *mapped* for reading: JavaScript reads its memory directly. It can be joined only with `COPY_DST` | `mapAsync(GPUMapMode.READ)` |
| `MAP_WRITE` | 2 | mapped for writing: JavaScript writes its memory directly. It can be joined only with `COPY_SRC` | `mapAsync(GPUMapMode.WRITE)` |
| `COPY_SRC` | 4 | the source of a copy | `copyBufferToBuffer()`, `copyBufferToTexture()` |
| `COPY_DST` | 8 | the destination of a copy or a write | `writeBuffer()`, `copyBufferToBuffer()`, `copyTextureToBuffer()` |
| `INDEX` | 16 | an index buffer, like `geometry.index` in three.js | `setIndexBuffer()` |
| `VERTEX` | 32 | a vertex buffer, like the attributes of a three.js `BufferGeometry` | `setVertexBuffer()` |
| `UNIFORM` | 64 | a uniform buffer: a few values that every thread (one run of the shader) reads, like GLSL uniforms | `var<uniform>` in WGSL |
| `STORAGE` | 128 | a storage buffer: an array shaders read and write | `var<storage>` in WGSL |
| `INDIRECT` | 256 | the arguments of a draw or dispatch, which the GPU reads from the buffer instead of from JavaScript | `drawIndirect()`, `dispatchWorkgroupsIndirect()` |
| `QUERY_RESOLVE` | 512 | where the GPU writes the results of *queries*: timestamps, or whether anything drawn passed the depth test (occlusion) | `resolveQuerySet()` |

## Common mistakes

- **The size in floats, not bytes.** `size: data.length` counts floats, so the buffer is four times too small. The `writeBuffer()` that follows is refused, the buffer stays all zeros, and every particle starts at the origin. A second trap in the same call: `bufferOffset` counts bytes, but the optional fourth and fifth arguments, `dataOffset` and `size` (how much of `data` to write), count elements when `data` is a typed array.
- **A flag missing.** Without `COPY_DST` the write is refused; without `COPY_SRC`, the copy for readback is refused. And most WebGPU errors do not throw: the call returns, the work is skipped, and the browser prints a warning in the console. When something does nothing, look there first.
- **Changing the array afterwards.** `writeBuffer()` copied it when you called it, so later changes never reach the GPU. Where three.js wants `needsUpdate = true`, WebGPU wants another `writeBuffer()`.

## Where FORCE uses it

[`World`](../../src/world.ts) makes three buffers: positions and velocities, one `vec4f` per particle, and `params`, the values every thread shares (a uniform buffer, a guide still to write). The debug viewer, on three.js, draws straight from `world.positionBuffer`, which its vertex shader reads as a storage buffer ([decision 012](../decisions/012-renderers-read-the-gpu-buffer.md)). `World.destroy()` calls `destroy()` on each buffer, so the browser can take the GPU memory back as soon as the GPU is done with it, without waiting for the garbage collector.

## Try it

In the DevTools console of any HTTPS page, in a browser with WebGPU:

```js
const adapter = await navigator.gpu.requestAdapter()
const device = await adapter.requestDevice()
const buffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE })
buffer.usage // 128: flags are plain numbers, joined bit by bit
device.queue.writeBuffer(buffer, 0, new Float32Array([1, 2, 3, 4])) // no exception: a warning, no COPY_DST
device.queue.writeBuffer(buffer, 0, new Uint8Array(3)) // throws: 3 bytes is not a multiple of 4
```

The last call throws because JavaScript can tell at once that 3 bytes is wrong. The missing flag is checked later, away from your script and often in another process, so the call cannot throw. You see a warning, or catch the error in code: `device.pushErrorScope('validation')` before the call, then `await device.popErrorScope()` gives the error, or `null`.

## Sources

- [MDN, GPUDevice.createBuffer()](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createBuffer): the descriptor, and the rules on `MAP_READ` and `MAP_WRITE`.
- [MDN, GPUQueue.writeBuffer()](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/writeBuffer): offsets in bytes or elements, and what throws.
- [MDN, GPUBuffer.usage](https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/usage): every flag and what it allows.
- [WebGPU specification](https://www.w3.org/TR/webgpu/): every usage flag, its value and an example ([buffer usages](https://www.w3.org/TR/webgpu/#buffer-usage)), a new buffer has every byte at zero ([buffer creation](https://www.w3.org/TR/webgpu/#buffer-creation)), `destroy()` frees the memory once submitted work is done ([buffer destruction](https://www.w3.org/TR/webgpu/#buffer-destruction)), `writeBuffer()` copies the data when called and checks the buffer later ([writeBuffer](https://www.w3.org/TR/webgpu/#dom-gpuqueue-writebuffer)), a vertex shader may read a storage buffer but not write it ([bind group layout](https://www.w3.org/TR/webgpu/#dom-gpudevice-createbindgrouplayout)), `maxBufferSize` starts at 256 MiB ([limits](https://www.w3.org/TR/webgpu/#limits)), and errors nobody catches go to the console as warnings ([errors and debugging](https://www.w3.org/TR/webgpu/#errors-and-debugging)).
- [WGSL specification, array layout examples](https://www.w3.org/TR/WGSL/#array-layout-examples): in an `array<vec3<f32>>` each element takes 16 bytes.
- [three.js r187, WebGLAttributes.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgl/WebGLAttributes.js): a `BufferAttribute` goes up with `gl.bufferData()`, and again with `gl.bufferSubData()` after `needsUpdate`; [MDN, bufferData()](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/bufferData): WebGL's `usage` is an intended pattern, "for optimization purposes".

## For an article or video

- **Hook:** in three.js you never upload anything by hand. With raw WebGPU you do, and the GPU wants to know in advance everything you will do with it.
- **Show:** the console snippet: one mistake is silent, one throws.
- **Takeaway:** a buffer is raw bytes with a size and a list of uses; `writeBuffer()` fills it, and your array is yours again the moment the call returns.
