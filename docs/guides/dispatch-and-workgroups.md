# How do you make thousands of threads work?

*WebGPU mini guide · 5 min read · Code: [src/world.ts](../../src/world.ts) · Read first: [bind groups](./bind-groups.md)*

**In short:** threads start in blocks. The shader fixes how many threads make a block, a *workgroup*, and `dispatchWorkgroups()` says how many blocks to launch. Threads = size × count: you round the count up, and the threads left over do nothing.

## The idea

A fragment shader never says how many times it runs: the pixels you draw on decide. A compute shader has no pixels, so you say it yourself, in two parts:

- **In the shader**, `@workgroup_size(64)`: threads come in blocks of 64. One block is a *workgroup*.
- **In JavaScript**, `pass.dispatchWorkgroups(16)`: launch 16 blocks. This command is a *dispatch*.

The shader runs 64 × 16 = 1024 times. The 16 counts workgroups, not threads.

Think of a trip by coach: the seats are the threads, the people are the particles. The seats per coach are fixed once, when the pipeline is built: 64. The number of coaches is chosen at every trip. For 1000 people, 15 coaches carry 960 and 40 stay behind; 16 carry everyone, with 24 seats empty. So you round up, and tell the empty seats to do nothing. GLSL has the same waste: 1000 particles kept in a square texture need 32 × 32 = 1024 pixels.

Each thread can ask which seat it is. `workgroup_id` is its coach, `local_invocation_id` its place in the coach, and `global_invocation_id` its place in the whole trip, coach × 64 + place. With one thread per particle, that last one is the particle's index.

Three more things to know:

- **Why not blocks of one.** `@workgroup_size(1)` is allowed, and then the count is the number of threads. It costs twice: a dispatch takes 65 535 workgroups at most in each dimension, and blocks of one were the slowest in [our test](#does-the-size-matter). Blocks also have a use of their own: the threads of one workgroup can share a little memory, as neighbours do. FORCE's shader does not use it.
- **No order.** The threads of a dispatch run in no order you can count on, coaches and seats alike.
- **Up to three numbers.** Both sides take x, y and z: `@workgroup_size(8, 8)` with `dispatchWorkgroups(2, 2)` is a grid of 16 × 16 threads, a natural fit for an image. A number left out is 1. That is why the three ids are each a `vec3u`. Particles are a list, so FORCE uses x alone.

## The code

From FORCE, a physics engine whose `World` moves particles with one compute shader. The count, made once in JavaScript:

```ts
const WORKGROUP_SIZE = 64
// …
this.workgroups = Math.ceil(this.particleCount / WORKGROUP_SIZE)
if (this.workgroups > device.limits.maxComputeWorkgroupsPerDimension) {
  const max = device.limits.maxComputeWorkgroupsPerDimension * WORKGROUP_SIZE
  throw new RangeError(`this device can move at most ${max} particles, got ${this.particleCount}`)
}
```

The shader, where every thread finds its particle:

```wgsl
@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions)) {
    return;
  }
```

And the dispatch, on every frame:

```ts
for (let i = 0; i < steps * this.substeps; i++) {
  pass.dispatchWorkgroups(this.workgroups)
}
```

- `WORKGROUP_SIZE`: the size belongs to the shader, in `@workgroup_size`. FORCE writes the number once, in JavaScript, and hands it over as an `override` constant when the [pipeline](./pipelines.md) is created, so the two sides cannot disagree.
- `Math.ceil()`: the rounding up. 1000 particles give 15.625, so 16 workgroups.
- The check on the limit: a dispatch takes 65 535 workgroups per dimension at most, unless you ask the device for more. With 64 threads each, that is 4 194 240 particles. Past that, the ways out are a bigger workgroup or the y dimension.
- The `if` in the shader: the guard for the empty seats. Threads 1000 to 1023 have no particle, and return at once.
- The loop: `steps * this.substeps` is how many steps of physics this frame needs. One dispatch is one run of every thread, so each step gets a dispatch of its own. Nothing runs at this call: the dispatch is written down with the other commands, and sent later (commands and queue, a guide still to write).

### The limits

What a device gives by default. Sizes are checked when the pipeline is created, counts at each dispatch.

| Limit | Default | What it bounds |
| --- | --- | --- |
| `maxComputeWorkgroupSizeX`, `…SizeY` | 256 | the first two numbers of `@workgroup_size` |
| `maxComputeWorkgroupSizeZ` | 64 | the third |
| `maxComputeInvocationsPerWorkgroup` | 256 | their product: the threads in one workgroup |
| `maxComputeWorkgroupsPerDimension` | 65 535 | each number of `dispatchWorkgroups()` |

### Does the size matter?

On our machine, only at the small end. We moved 1 048 560 particles (65 535 × 16) with 100 dispatches, and timed until the GPU had finished them all. With workgroups of 4, 16, 64 and 256 threads it took about 70 ms, with more difference from one round to the next than from one size to another. With workgroups of 1 it took about 110 ms. That is one Mac with an Apple GPU, and a shader whose threads share nothing: other machines may differ. 64 is the usual choice: WebGPU Fundamentals gives it as the general advice, and three.js uses it by default.

## Common mistakes

- **Forgetting to round up.** `dispatchWorkgroups(1000 / 64)` passes 15.625. There is no error: the fraction is dropped, 15 workgroups leave, and the last 40 particles never move.
- **Forgetting the guard.** The 24 spare threads read and write past the end of the array. WGSL promises only that they will not touch memory outside the buffer: the write may be skipped, or land on another element of the same buffer. In Chrome on our Mac it was skipped, and all looked fine. That is the trap: another machine may choose otherwise.
- **Counting threads, not workgroups.** `dispatchWorkgroups(1000)` with blocks of 64 starts 64 000 threads for 1000 particles. The guard hides the waste. With more particles the count passes the limit and the commands are refused: `Dispatch workgroup count X (65536) exceeds max compute workgroups per dimension (65535).`
- **A workgroup too big.** Each number of `@workgroup_size` has its limit, and so does their product: `@workgroup_size(16, 16, 2)` gives `The total number of workgroup invocations (512) exceeds the maximum allowed (256).`

## Where FORCE uses it

[`World`](../../src/world.ts) counts its workgroups once, in the constructor, and sends one dispatch for each substep of each step, all in the same pass. Its shader, [`integrate.wgsl`](../../src/shaders/integrate.wgsl), starts with the guard. Three.js users get all of this for free: `compute(count)` in its node system picks 64, rounds up, adds the guard, and moves to the y dimension past 65 535 workgroups.

## Try it

In the DevTools console of any HTTPS page, in a browser with WebGPU:

```js
const adapter = await navigator.gpu.requestAdapter()
const device = await adapter.requestDevice()
const module = device.createShaderModule({ code: `
@group(0) @binding(0) var<storage, read_write> data: array<u32>;
@compute @workgroup_size(4)
fn main(@builtin(global_invocation_id) id: vec3u,
        @builtin(workgroup_id) group: vec3u,
        @builtin(local_invocation_id) seat: vec3u) {
  if (id.x >= arrayLength(&data)) { return; }
  data[id.x] = group.x * 10 + seat.x;
}` })
const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module } })
const data = device.createBuffer({ size: 40, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC })
const result = device.createBuffer({ size: 40, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST })
const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: { buffer: data } }],
})
const encoder = device.createCommandEncoder()
const pass = encoder.beginComputePass()
pass.setPipeline(pipeline)
pass.setBindGroup(0, bindGroup)
pass.dispatchWorkgroups(3)
pass.end()
encoder.copyBufferToBuffer(data, 0, result, 0, 40)
device.queue.submit([encoder.finish()])
await result.mapAsync(GPUMapMode.READ)
new Uint32Array(result.getMappedRange()) // [0, 1, 2, 3, 10, 11, 12, 13, 20, 21]
```

Every thread signs its element: the tens are its workgroup, the units its seat. Ten elements and 3 workgroups of 4 make 12 threads, so two found nothing to sign. Reload the page, change the 3 into a 2, and run it again: the last two elements stay at 0, because nobody came for them. The lines after `pass.end()` copy the result to where JavaScript can read it (readback, a guide still to write).

## Sources

- [MDN, GPUComputePassEncoder.dispatchWorkgroups()](https://developer.mozilla.org/en-US/docs/Web/API/GPUComputePassEncoder/dispatchWorkgroups): the three counts, the last two 1 by default, and the note that they count workgroups, not shader runs.
- [WGSL specification](https://www.w3.org/TR/WGSL/): a workgroup is "a set of invocations which concurrently execute a compute shader stage entry point, and share access to shader variables in the workgroup address space", a dispatch runs the entry point once for each point of a grid of workgroup size × workgroup count, and each thread's global, local and workgroup ids follow from its place in that grid ([compute shaders and workgroups](https://www.w3.org/TR/WGSL/#compute-shader-workgroups)); `@workgroup_size` takes one to three numbers, the missing ones being 1 ([workgroup_size](https://www.w3.org/TR/WGSL/#workgroup-size-attr)); an access past the end of an array is never done as written, and a write may land elsewhere in the same buffer or not happen ([out-of-bounds access](https://www.w3.org/TR/WGSL/#out-of-bounds-access)); `global_invocation_id` is `workgroup_id * workgroup_size + local_invocation_id`; threads of the same workgroup share the variables of the workgroup address space and those of different workgroups do not ([overview](https://www.w3.org/TR/WGSL/#overview)), such a variable starts at its zero value and can be used only in a compute shader ([var declarations](https://www.w3.org/TR/WGSL/#var-decls)), and `workgroupBarrier()` orders what the threads of a workgroup wrote there ([synchronization functions](https://www.w3.org/TR/WGSL/#sync-builtin-functions)).
- [WebGPU specification](https://www.w3.org/TR/webgpu/): each count of a dispatch must stay within `maxComputeWorkgroupsPerDimension` ([dispatchWorkgroups](https://www.w3.org/TR/webgpu/#dom-gpucomputepassencoder-dispatchworkgroups)), and the default values of the limits, among them the 16 384 bytes of `maxComputeWorkgroupStorageSize` ([limits](https://www.w3.org/TR/webgpu/#limits)).
- [WebGPU Fundamentals, compute shader basics](https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders.html): "the general advice for WebGPU is to choose a workgroup size of 64", since the best size depends on the GPU and WebGPU cannot tell you.
- [three.js r187, ComputeNode.js](https://github.com/mrdoob/three.js/blob/r187/src/nodes/gpgpu/ComputeNode.js): `compute()` has a default workgroup size of `[64]`, and adds an early return for the threads past `count`. In [WebGPUBackend.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgpu/WebGPUBackend.js), the count becomes `Math.ceil(count / size)` workgroups, spread on y when they pass the device's limit.
- The error messages, the results and the timings are the ones Chrome 157 gave us on November 16, 2026, on a Mac with an Apple GPU. The timings are five rounds for each size: between 65 and 80 ms for sizes 4 to 256, between 108 and 114 ms for size 1, which needs the y dimension to reach that many threads. For the missing guard, every thread wrote its own number: the last element kept 999 in 20 runs out of 20.

## For an article or video

- **Hook:** you have 1000 particles, and the GPU will not let you ask for 1000 threads.
- **Show:** the coaches: 64 seats, 16 coaches, 24 empty seats. Then the console snippet, where every thread signs with its coach and its seat.
- **Takeaway:** threads = workgroup size × workgroup count. Round the count up, and guard the shader against the extra threads.

## Questions

*Asked while reading this guide, and answered after checking the sources.*

### A workgroup can have up to three dimensions, and so can a dispatch. What is the advantage, and when would you use a grid in 2D or 3D?

The dimensions give the threads the shape of your data. The number of threads is always the product, so nothing more runs: what changes is the id each thread receives.

A fragment shader gets `gl_FragCoord.xy` and knows which pixel it is. `@workgroup_size(8, 8)` with `dispatchWorkgroups(240, 135)` gives the same to a compute shader: 1920 × 1080 threads, and `global_invocation_id.xy` is the pixel. With one dimension each thread would get a single index, and would have to work out its row and column with a division and a remainder.

So the shape follows the data:

- **1D** for a list: particles, as in FORCE.
- **2D** for an image, a height map, or a cloth stored as rows and columns.
- **3D** for voxels, or smoke and fluids on a grid.

There is a practical gain too. Each number of a dispatch stops at 65 535, so a second dimension reaches past that: three.js moves to y when a list needs more workgroups than the limit.

We have not measured whether the shape alone changes the speed.

### Do the threads of one workgroup really share memory?

Yes. A variable declared with `var<workgroup>`, outside any function, exists once for each workgroup, and all the threads of that workgroup read and write it:

```wgsl
var<workgroup> tile: array<vec4f, 64>;
```

In the coach of this guide it is a whiteboard at the front: everyone on board sees it, the other coaches do not, and it starts clean, since the variable begins at zero. With `dispatchWorkgroups(16)` there are 16 whiteboards. It exists only in compute shaders, and all the workgroup variables of a shader may take 16 384 bytes at most by default (`maxComputeWorkgroupStorageSize`). A fragment shader has nothing like it: each pixel is alone.

It is where the shape of a workgroup starts to matter. In a blur by tiles of 8 × 8, each thread could load its pixel on the whiteboard, and then read its neighbours from there. The snippet and the blur are examples: FORCE has no workgroup variable, and we have not run one yet.

Threads run at the same time, so two of them writing the same place is a race. WGSL has two tools for that, atomic types and `workgroupBarrier()`, which makes what was written before it visible to the whole workgroup. They are a concept of their own, for another guide.
