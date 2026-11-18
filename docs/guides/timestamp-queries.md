# How long did the GPU take?

*WebGPU mini guide · 4 min read · Code: [examples/dispatch-cost](../../examples/dispatch-cost/main.ts) · Read first: [adapter and device](./adapter-and-device.md), [buffers](./buffers.md), [dispatch and workgroups](./dispatch-and-workgroups.md)*

**In short:** `performance.now()` times your JavaScript, not the GPU. A *timestamp query* asks the GPU to write down the time on its own clock when a *pass*, a stretch of commands, starts and when it ends: two numbers in nanoseconds, to subtract.

## The idea

JavaScript does not run the work. It writes a list of commands with an *encoder*, and hands the list over with `device.queue.submit()`, which returns before the GPU has started. A stopwatch around it times the writing. We sent 1000 tiny dispatches, each one a launch of a compute shader, the program that runs on the GPU, and read three clocks:

| Clock | What it timed | Milliseconds |
| --- | --- | --- |
| `performance.now()` around the commands and `submit()` | JavaScript writing the list | 0.06 |
| The GPU's own clock, from the start of the pass to its end | the GPU running it | 1.0 |
| `performance.now()` until the browser says the work is done | all of it, with the trip to the GPU and the answer coming back | 1.8 |

Think of a restaurant, with you as the waiter. Your watch says when you handed the order in, and when the bell rang. It cannot say how long the dish was on the stove. So you ask the cook to stamp the ticket twice, with the clock of the kitchen: on the stove, off the stove.

The browser says the work is done through `device.queue.onSubmittedWorkDone()`, a promise. JavaScript cannot read what the GPU writes, so the stamps come back in three moves:

- a **query set**: numbered slots that only the GPU can write, one per timestamp;
- a **resolve**: a command that copies the slots into a buffer, 8 bytes each;
- a **readback**: a copy into a second buffer, of the kind JavaScript can open. Every result of the GPU comes back this way.

The clock is an optional *feature*, `timestamp-query`: a device has it only if you ask for it. In three.js, `new WebGPURenderer({ trackTimestamp: true })` and `renderer.resolveTimestampsAsync()` do all of this for you.

## The code

From the example. First the device, with the feature if the adapter has it:

```ts
const hasClock = adapter.features.has('timestamp-query')
const device = await adapter.requestDevice({
  requiredFeatures: hasClock ? ['timestamp-query'] : [],
})
```

Then two slots, a buffer to resolve them into, and one JavaScript can read. Without the feature there is no query set, and the rest is skipped:

```ts
const stamps = hasClock ? device.createQuerySet({ type: 'timestamp', count: 2 }) : undefined
const resolved = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
})
const readable = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
})
```

`COPY_SRC` and `COPY_DST` let a buffer be copied from and to, and `MAP_READ` lets JavaScript open it. The pass says which slot gets the time at its beginning and which at its end:

```ts
const encoder = device.createCommandEncoder()
const pass = encoder.beginComputePass(
  stamps && {
    timestampWrites: { querySet: stamps, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
  },
)
```

Then come the dispatches and `pass.end()`. After them, resolve, copy and read:

```ts
encoder.resolveQuerySet(stamps, 0, 2, resolved, 0)
encoder.copyBufferToBuffer(resolved, 0, readable, 0, 16)
device.queue.submit([encoder.finish()])
await readable.mapAsync(GPUMapMode.READ)
const [begin, end] = new BigUint64Array(readable.getMappedRange())
gpu = Number(end - begin) / 1e6 // nanoseconds to milliseconds
readable.unmap()
```

- `resolveQuerySet(stamps, 0, 2, resolved, 0)`: from slot 0, two slots, into `resolved` at byte 0.
- `mapAsync()` waits until the GPU is done and the buffer can be opened, `getMappedRange()` gives its bytes, and `unmap()` hands it back.
- A timestamp is a whole number of 64 bits, hence `BigUint64Array`: its values are `BigInt`s, such as `12760633507840n`. Subtract first, convert after.
- Only the difference means something: the spec leaves the starting point of the clock to the browser.

## The clock is rounded on purpose

A precise clock can be used to spy on other pages, so the spec wants timestamps made coarser. Chrome's blog says to 100 microseconds, that is 0.1 ms. In Chrome 157 on our Mac every value was a multiple of 65 536 nanoseconds, about 0.066 ms: we do not know why the two differ. With the flag `chrome://flags/#enable-webgpu-developer-features` they were exact.

One tiny dispatch took the GPU 1 to 2 microseconds, far less than one step of the clock. So do as [dispatch-cost](../../examples/dispatch-cost/main.ts) does: time a thousand, and divide.

## Common mistakes

- **Forgetting the feature.** `createQuerySet()` throws. Most WebGPU errors do not: the call returns, and a warning lands in the console. The message: `Use of timestamp queries requires the 'timestamp-query' or 'chromium-experimental-timestamp-query-inside-passes' feature to be enabled on [Device].`
- **A buffer without `QUERY_RESOLVE`.** The commands are refused: `[Buffer (unlabeled)] usage (BufferUsage::CopySrc) doesn't include BufferUsage::QueryResolve.`
- **Timing an empty pass.** With no dispatch in the pass, in Chrome on our Mac both slots stayed at 0, their value at creation, with no error.
- **Trusting every number.** The spec warns that the clock may restart now and then, and `end` may come out smaller than `begin`: drop that run.
- **Reading it as the whole cost.** It is the time on the GPU only: in the table above, 1.0 of 1.8 ms.
- **Trusting `onSubmittedWorkDone()` instead.** On an iPhone 16 Pro it resolved well before the work was over, in a pass with no timestamps: 3.7 ms by the promise, 5.5 to 5.9 by the GPU's clock once we added it. The story is in [chapter 022](../logbook/022-the-bell-that-rang-early.md) of the logbook.

## Where FORCE uses it

Not in the engine yet, only in [examples/dispatch-cost](../../examples/dispatch-cost/main.ts), which measures what one more dispatch costs. Its numbers are told in [chapter 020](../logbook/020-a-cheap-launch.md) of the logbook.

## Try it

Paste this in the DevTools console of any HTTPS page, in a browser with WebGPU. The first lines prepare a shader and its data, as in the guides on [pipelines](./pipelines.md) and [bind groups](./bind-groups.md). Then it times 100 dispatches over a million numbers. If `requestDevice()` fails, the browser has no GPU clock:

```js
const adapter = await navigator.gpu.requestAdapter()
const device = await adapter.requestDevice({ requiredFeatures: ['timestamp-query'] })
const module = device.createShaderModule({
  code: `@group(0) @binding(0) var<storage, read_write> data: array<f32>;
         @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
           if (id.x < arrayLength(&data)) { data[id.x] += 1.0; }
         }`,
})
const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module } })
const data = device.createBuffer({ size: 4_000_000, usage: GPUBufferUsage.STORAGE })
const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: data } }],
})

const stamps = device.createQuerySet({ type: 'timestamp', count: 2 })
const resolved = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC })
const readable = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST })

const encoder = device.createCommandEncoder()
const pass = encoder.beginComputePass({
  timestampWrites: { querySet: stamps, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 },
})
pass.setPipeline(pipeline)
pass.setBindGroup(0, bindGroup)
for (let i = 0; i < 100; i++) pass.dispatchWorkgroups(15_625)
pass.end()
encoder.resolveQuerySet(stamps, 0, 2, resolved, 0)
encoder.copyBufferToBuffer(resolved, 0, readable, 0, 16)
device.queue.submit([encoder.finish()])

await readable.mapAsync(GPUMapMode.READ)
const [begin, end] = new BigUint64Array(readable.getMappedRange())
console.log(begin, end, `${Number(end - begin) / 1e6} ms`)
```

On our Mac it printed between 7 and 11 ms. Then type `begin % 65536n`, the remainder of a division: if it is `0n`, your browser rounds as ours did.

## Sources

- [WebGPU specification](https://www.w3.org/TR/webgpu/): timestamps are nanoseconds in 64 bits, their values are up to the browser, the clock may reset, and its precision must be reduced ([timestamp query](https://www.w3.org/TR/webgpu/#timestamp)); `createQuerySet()` throws a `TypeError` without the feature, and a set holds 4096 queries at most ([query set creation](https://www.w3.org/TR/webgpu/#queryset-creation)); `requestDevice()` rejects when the adapter lacks a required feature ([requestDevice](https://www.w3.org/TR/webgpu/#dom-gpuadapter-requestdevice)); a resolve writes 8 bytes per query into a buffer with `QUERY_RESOLVE` ([resolveQuerySet](https://www.w3.org/TR/webgpu/#dom-gpucommandencoder-resolvequeryset)).
- [MDN, GPUCommandEncoder.beginComputePass()](https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder/beginComputePass): `timestampWrites` and its three fields.
- [Chrome, What's New in WebGPU 120](https://developer.chrome.com/blog/new-in-webgpu-120): timestamps rounded to 100 microseconds, and the flag that turns the rounding off.
- three.js r187: the `trackTimestamp` option, used only if the device has the feature ([WebGPUBackend.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgpu/WebGPUBackend.js)), and `resolveTimestampsAsync()` ([Renderer.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/common/Renderer.js)).
- The numbers, the error messages, the empty pass and the steps of 65 536 nanoseconds are what we saw: an Apple M1 with Chrome 157 run headless, that is with no window, on November 18, 2026.

## For an article or video

- **Hook:** you timed your compute shader with `performance.now()` and got 0.06 ms. The GPU worked for a whole millisecond.
- **Show:** the table of the three clocks, then the waiter and the stamped ticket.
- **Takeaway:** your watch times the order. Only the kitchen's clock times the cooking.
