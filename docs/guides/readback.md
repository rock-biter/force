# How do you get the results back?

*WebGPU mini guide · 4 min read · Code: [src/world.ts](../../src/world.ts), [examples/round-trip](../../examples/round-trip/main.ts) · Read first: [buffers](./buffers.md)*

**In short:** JavaScript cannot read the memory a shader writes. You copy it into a second buffer, of a kind JavaScript can open, wait for a promise, copy the numbers out, and give the buffer back. This is a *readback*.

## The idea

Think of a kitchen you may not enter. To get a dish out, you ask for a copy of it on a tray. The tray is in the cook's hands or in yours, never both: the cook cannot plate on a tray you are holding, and you cannot take one the cook is still filling. So you ask, the cook finishes what was ordered before, and rings a bell. You take what you need off the tray and hand it back.

In WebGPU the tray is a buffer created with the usage flag `MAP_READ`. A flag says what a buffer may be used for, and several can be combined with `|` (the [buffers guide](./buffers.md) lists them all). The tray changes hands with two calls:

- **`mapAsync()`** asks for the tray. It returns a promise, which resolves when the buffer is *mapped*: open to JavaScript.
- **`unmap()`** hands it back. Until then, no GPU command can use the buffer.

Why not open the shader's own buffer? Because `MAP_READ` can be combined with one flag only, `COPY_DST`, "can be copied into". A buffer that JavaScript can open cannot also be one that a shader writes. Hence the copy, and two buffers: asking takes two moves, the copy and then `mapAsync()`.

In three.js with WebGL, `renderer.readRenderTargetPixels()` reads pixels back and makes your script wait for the GPU. Its sibling `readRenderTargetPixelsAsync()` returns a promise instead. The WebGPU API has only the second way.

## The code

`readPositions()`, from FORCE's `World`. `this.positions` is the buffer the shader writes, created with `STORAGE` and `COPY_SRC`, "can be copied from". `size` is its length in bytes:

```ts
const readback = this.device.createBuffer({
  size,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
})
const encoder = this.device.createCommandEncoder()
encoder.copyBufferToBuffer(this.positions, 0, readback, 0, size)
this.device.queue.submit([encoder.finish()])

await readback.mapAsync(GPUMapMode.READ)
// fromVec4 copies the bytes out: the mapped range cannot be read after unmap().
const xyz = fromVec4(new Float32Array(readback.getMappedRange()))
readback.unmap()
readback.destroy()
```

- `encoder` writes down a list of commands, and `submit()` sends the list to the GPU.
- `copyBufferToBuffer(source, sourceOffset, destination, destinationOffset, size)`: a command like any other. It runs after the commands sent before it, so the copy holds their results.
- `mapAsync(GPUMapMode.READ)`: the promise resolves once the GPU has finished the commands that use this buffer, here the copy.
- `getMappedRange()`: an `ArrayBuffer` over the buffer's memory. No copy is made: you are looking at the tray.
- `new Float32Array(...)` on it is still only a view of the tray. `fromVec4()`, a helper of FORCE, builds a new array with the x, y, z of each particle: that is the copy that survives `unmap()`.
- `readPositions()` creates a new tray at every call and destroys it at the end, which is fine for a check. To read at every frame, keep one buffer and map it again after each `unmap()`, as [examples/round-trip](../../examples/round-trip/main.ts) does.

## How long it takes

Our measure, with [examples/round-trip](../../examples/round-trip/main.ts): milliseconds from writing the copy command to the promise resolving, with the GPU doing nothing else. A frame at 60 per second lasts 16.7.

| Bytes | 16 | 65 536 | 1 048 576 | 8 388 608 |
| --- | --- | --- | --- | --- |
| The promise resolves after | 0.26 to 0.30 | 0.20 to 0.30 | 0.34 to 0.40 | 1.0 to 1.25 |
| Copying the numbers out | 0.01 | 0.02 | 0.11 to 0.20 | 0.8 to 0.9 |

Up to 65 536 bytes, 64 KB, the size does not count. With work in front, a readback waits for it: behind about 3 ms of compute shaders, it arrived after 3 to 4. Asked inside `requestAnimationFrame()`, which the browser calls once per frame, 64 KB were back 0.55 to 0.81 ms later, before the next call 60 times out of 60. That is slower than with the GPU idle, and we did not look into why. In a real window on the same Mac, on a screen at 50 frames per second and on one at 120, the times were close to these, and one answer in 120 came a frame late. One machine, an Apple M1 with Chrome 157 run headless, that is with no window, on a page that draws nothing: a phone, or a busy frame, may differ.

So the wait is short here. What it costs is the `await`: the function that needs the numbers must become `async`, and so must whoever calls it.

## Common mistakes

- **Forgetting `await`.** While the promise is pending, `getMappedRange()` throws: `Failed to execute 'getMappedRange' on 'GPUBuffer': getMappedRange failed`. Chrome says no more than that.
- **Keeping the view.** After `unmap()` the array you built on the mapped range is empty: its `length` is 0 and `view[0]` is `undefined`, with no error. Copy first, with `slice()`.
- **Forgetting `unmap()`.** The next copy into the buffer is refused: `[Buffer (unlabeled)] used in submit while mapped.` And a second `mapAsync()` rejects with `[Buffer (unlabeled)] is already mapped.`
- **Mapping the shader's buffer.** `STORAGE | MAP_READ` is refused at creation: `If a buffer usage contains BufferUsage::MapRead the only other allowed usage is BufferUsage::CopyDst.`
- **Odd ranges.** `mapAsync(mode, offset, size)` can open a part of the buffer, but the offset must be a multiple of 8, and the size a multiple of 4: `Size (6) must be a multiple of 4.`

## Where FORCE uses it

Only for checks. [`World.readPositions()`](../../src/world.ts) feeds [falling-particles](../../examples/falling-particles/main.ts), the example that prints numbers. Drawing never reads back: the debug viewer draws straight from the buffer on the GPU ([decision 012](../decisions/012-renderers-read-the-gpu-buffer.md)). Whether the engine will need a readback at every step of the simulation is an open question, told in [chapter 021](../logbook/021-a-short-trip.md) of the logbook.

## Try it

Paste this in the DevTools console of any HTTPS page, in a browser with WebGPU. The first two lines get a device, the object every buffer is created from ([adapter and device](./adapter-and-device.md)). `onGpu` also has `COPY_DST`, so `writeBuffer()` can put four numbers in it:

```js
const adapter = await navigator.gpu.requestAdapter()
const device = await adapter.requestDevice()
const onGpu = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
})
device.queue.writeBuffer(onGpu, 0, new Float32Array([1, 2, 3, 4]))
const readable = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST })

const encoder = device.createCommandEncoder()
encoder.copyBufferToBuffer(onGpu, 0, readable, 0, 16)
device.queue.submit([encoder.finish()])

await readable.mapAsync(GPUMapMode.READ)
const view = new Float32Array(readable.getMappedRange())
const copy = view.slice()
console.log(readable.mapState, view, copy)
readable.unmap()
console.log(readable.mapState, view, copy)
```

`mapState` says in whose hands the tray is. The first line says `mapped`, and both arrays hold 1, 2, 3, 4. The second says `unmapped`: `view` is empty, `copy` still has its numbers. Then remove the `await` before `mapAsync` and run it again.

## Sources

- [WebGPU specification](https://www.w3.org/TR/webgpu/): mapping is asynchronous so the browser can make sure the GPU has finished with the buffer, and a mapped buffer cannot be used by the GPU until `unmap()` ([buffer mapping](https://www.w3.org/TR/webgpu/#buffer-mapping)); the promise resolves after the commands that use the buffer are done ([mapAsync](https://www.w3.org/TR/webgpu/#dom-gpubuffer-mapasync)).
- [MDN, GPUBuffer.mapAsync()](https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/mapAsync): the modes, and the rules on offset and size.
- [three.js r187, WebGLRenderer.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/WebGLRenderer.js): `readRenderTargetPixelsAsync()` is the "asynchronous, non-blocking version" of `readRenderTargetPixels()`, recommended "whenever possible".
- The times, the error messages and the empty view are what we saw: an Apple M1 with Chrome 157 run headless, on November 18, 2026.

## For an article or video

- **Hook:** you ran a million particles on the GPU. Now try to `console.log` one of them.
- **Show:** the tray changing hands: copy, bell, read, hand back. Then the view that empties after `unmap()`.
- **Takeaway:** a readback is a copy and a promise. The wait is short; the `await` is what changes your code.
