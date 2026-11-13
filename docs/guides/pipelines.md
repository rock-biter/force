# How do you prepare a shader to run?

*WebGPU mini guide · 4 min read · Code: [src/world.ts](../../src/world.ts) · Read first: [compute shaders](./compute-shader.md)*

**In short:** you build a *pipeline*: the shader, plus everything about it that will never change, compiled into something the GPU can run. You make it once, with `device.createComputePipeline()`, and use it on every frame.

## The idea

In three.js a `ShaderMaterial` is only text and settings. The first time the renderer draws with it, it compiles that text into a program for the GPU, which is why a new material can make a frame stutter, and why `renderer.compileAsync()` exists: to do that work before the first frame. A material with other `defines` gets another program.

WebGPU has the same two things, the text and the compiled program, and makes you hold both:

- A **shader module** is your WGSL code, checked by the compiler. It cannot run yet: it may hold several entry points, and constants that have no value.
- A **pipeline** is one runnable version of it: this module, this entry point, these values for its constants, this list of the buffers it expects.

A module is a recipe that says "bake for N minutes"; a pipeline is that recipe with N filled in, printed and hung in the kitchen. Nothing in it can change afterwards: a pipeline has no setters. That is the point: with every choice closed, the GPU's driver can compile and tune the whole thing once. For other values you make another pipeline, and you can make as many as you like from one module.

This guide is about compute pipelines. Drawing has a twin, the *render pipeline*, which holds a vertex and a fragment shader plus the fixed settings of drawing, such as blending.

## The code

From FORCE, a physics engine whose `World` moves particles with one compute shader:

```ts
this.pipeline = device.createComputePipeline({
  layout: 'auto',
  compute: {
    module: device.createShaderModule({ code: integrateCode }),
    constants: { WORKGROUP_SIZE, GROUND: ground ? 1 : 0 },
  },
})
```

- `compute`: the one *stage* of a compute pipeline, the place where a shader plugs in. A render pipeline has two, `vertex` and `fragment`.
- `module`: the WGSL code, made into a shader module.
- `entryPoint`: missing here. It is the name of the function to start from; with only one `@compute` function in the module, the browser finds it by itself.
- `constants`: a value for each `override` constant of the shader, by name. Values are JavaScript numbers, converted to the constant's type: `GROUND` is a `bool` in the shader, so it gets 1 or 0. An override that the shader uses and that has no default value must be given here.
- `layout`: which buffers the shader expects, and in which slots. `'auto'` lets WebGPU work it out from the `@group` and `@binding` lines of the shader, counting only the ones the entry point really uses. Attaching real buffers to those slots is the job of bind groups (a guide still to write).

Then, on every frame, inside `update()`:

```ts
const pass = encoder.beginComputePass()
pass.setPipeline(this.pipeline)
pass.setBindGroup(0, this.bindGroup)
pass.dispatchWorkgroups(this.workgroups)
```

`encoder` and `pass` write down a list of commands for the GPU (commands and queue, a guide still to write). `setPipeline()` says which program to use, and `dispatchWorkgroups()` starts its threads. Creating a pipeline is slow, since it compiles; setting one is cheap. So: create it once, at startup, and never inside the loop.

### Now or when it is ready

`createComputePipeline()` hands back a pipeline at once, but the compiling is not done yet: while it goes on, everything else you send to the GPU waits. `createComputePipelineAsync()` takes the same object of options, the *descriptor*, and returns a `Promise`, which resolves when the pipeline can be used with no further wait. The spec prefers it whenever possible. What each one costs, with numbers, is in [its own guide](./pipeline-creation.md).

## Common mistakes

None of these throws: the browser prints the error in the console. With the first three, the call returns a pipeline that is *invalid*, and the commands that use it are refused, so nothing moves. The messages are Chrome's.

- **A constant with no value.** Leaving `WORKGROUP_SIZE` out of `constants` gives `There are uninitialized pipeline overridable constants, their identifiers:[WORKGROUP_SIZE]`.
- **A constant the shader does not have.** A typo such as `constants: { SPEED: 1 }` is not ignored: `Pipeline overridable constant ""SPEED"" not found in [ShaderModule]`.
- **A workgroup too big.** The size is checked when the pipeline is created, since that is when the constant gets its value: 1024 gives `Entry-point uses workgroup_size(1024, 1, 1) that exceeds the maximum allowed (256, 256, 64)`.
- **Dispatching with no pipeline.** Forget `setPipeline()` and the whole batch of commands is refused: `No pipeline set.`
- **Sharing a bind group between two `'auto'` pipelines.** Even two made from the same module: `The current pipeline was created with a default layout, and is not compatible with the BindGroup…`. Each `'auto'` pipeline gets a layout of its own; to share, the layout must be made by hand.

## Where FORCE uses it

[`World`](../../src/world.ts) builds one pipeline in its constructor, from [`integrate.wgsl`](../../src/shaders/integrate.wgsl), and sets it at every `update()`. The `GROUND` constant is why a world with a ground and one without run two different programs from the same file: in the second, the compiler knows `GROUND` is false before it builds the program, so it can leave the ground's code out. FORCE creates its pipeline the immediate way today; whether to move to the async one is [still open](./pipeline-creation.md#where-force-uses-it).

## Try it

In the DevTools console of any HTTPS page, in a browser with WebGPU:

```js
const adapter = await navigator.gpu.requestAdapter()
const device = await adapter.requestDevice()
const module = device.createShaderModule({ code: `
override N: u32;
@compute @workgroup_size(N)
fn main() {}` })
const compute = { module }
device.pushErrorScope('validation')
device.createComputePipeline({ layout: 'auto', compute }) // no exception: a GPUComputePipeline, invalid
;(await device.popErrorScope()).message // "There are uninitialized pipeline overridable constants, their identifiers:[N]…"
await device.createComputePipelineAsync({ layout: 'auto', compute }).catch((error) => error.reason) // "validation": the promise rejects with a GPUPipelineError
compute.constants = { N: 64 }
await device.createComputePipelineAsync({ layout: 'auto', compute }) // a GPUComputePipeline, ready
```

The same mistake, seen twice. The immediate call cannot throw: it returns before the browser has checked anything, so the error has to be caught with an error scope (`pushErrorScope()` and `popErrorScope()`, as in the [buffers guide](./buffers.md)). The async one waits for the check, so it can reject its promise: a `.catch()`, or a `try`/`catch` around the `await`, is enough.

## Sources

- [MDN, GPUDevice.createComputePipeline()](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createComputePipeline): the descriptor, `entryPoint` may be left out when the module has one `@compute` function, and an invalid pipeline is returned instead of an exception.
- [MDN, GPUDevice.createComputePipelineAsync()](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createComputePipelineAsync): the promise, and `GPUPipelineError` with its `reason`, `"validation"` or `"internal"`.
- [WebGPU specification](https://www.w3.org/TR/webgpu/): a pipeline is shaders plus fixed settings, created as one object; the immediate way can stall and the async way is preferred ([pipelines](https://www.w3.org/TR/webgpu/#pipelines), [compute pipeline creation](https://www.w3.org/TR/webgpu/#compute-pipeline-creation)); constants are set by name, and every override without a default that the entry point uses needs a value ([GPUProgrammableStage](https://www.w3.org/TR/webgpu/#gpuprogrammablestage)); numbers are converted to the constant's type, `bool` included ([numeric conversions](https://www.w3.org/TR/webgpu/#conversions-to-wgsl)); `'auto'` builds the layout from the bindings the entry point uses, and its bind groups work with that pipeline only ([default pipeline layout](https://www.w3.org/TR/webgpu/#default-pipeline-layout)).
- [three.js r187, WebGLRenderer.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/WebGLRenderer.js): `compile()` is there "to precompile shaders before the first rendering", and `compileAsync()` resolves when the scene can be drawn "without unnecessary stalling due to shader compilation". In [WebGLPrograms.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgl/WebGLPrograms.js), a material's `defines` are part of the key that tells one program from another.
- [WGSL specification](https://www.w3.org/TR/WGSL/): "a WGSL program is composed of a single WGSL module" ([WGSL module](https://www.w3.org/TR/WGSL/#wgsl-module)), and what the entry point does not use "is effectively stripped before compilation" ([shader lifecycle](https://www.w3.org/TR/WGSL/#shader-lifecycle)).
- [WebGPU specification, pipeline layout creation](https://www.w3.org/TR/webgpu/#pipeline-layout-creation): `createPipelineLayout()` makes a layout by hand, from a list of bind group layouts.
- The error messages are the ones Chrome 157 gave us on November 13, 2026, shortened where marked with `…`. Other browsers word them differently.

## For an article or video

- **Hook:** your shader compiled without errors, and it still cannot run. What is missing?
- **Show:** one module turned into two pipelines with different constants; then the console snippet, silent with one call and rejecting with the other.
- **Takeaway:** a pipeline is a shader with every open choice closed. Make it once, set it on every frame.

## Questions

*Asked while reading this guide, and answered after checking the sources.*

### Can one shader file hold several compute functions, and give one pipeline for each?

Yes. A module can hold as many `@compute` functions as you like, and each pipeline picks one with `entryPoint`:

```js
const module = device.createShaderModule({ code: `
@group(0) @binding(0) var<storage, read_write> data: array<f32>;
@compute @workgroup_size(4) fn double(@builtin(global_invocation_id) id: vec3u) { data[id.x] *= 2.0; }
@compute @workgroup_size(4) fn addOne(@builtin(global_invocation_id) id: vec3u) { data[id.x] += 1.0; }` })
const a = device.createComputePipeline({ layout, compute: { module, entryPoint: 'double' } })
const b = device.createComputePipeline({ layout, compute: { module, entryPoint: 'addOne' } })
```

In Chrome, running `a` and then `b` on `[1, 2, 3, 4]` gave `[3, 5, 7, 9]`. The two functions share what stands outside them: structs, constants, helper functions, the `@group` and `@binding` lines. Each pipeline keeps only what its own entry point uses. One thing changes: `entryPoint` is no longer optional. Leave it out and the pipeline is invalid: `The entry-point is defaulted but multiple entry points for stage (Compute) exist in the shader module`.

It is the natural shape for a physics step made of several passes over the same buffers. FORCE has one function so far.

### What do you gain by keeping several functions in one module?

Nothing at run time: it is a way to organize code. A WGSL program is one module, with no `import` or `#include`, so two separate files cannot share a struct or a helper function: each would need its own copy, and copies drift apart. In one module, what is shared is written once:

- **The data.** The `Params` struct and the `@group` and `@binding` lines exist once, so every function reads the buffers the same way. It is also what makes one layout, and one bind group, fit all the pipelines.
- **The helpers and the constants.** A function called from two passes is written once.
- **The checks.** One `createShaderModule()`, one list of compiler messages.

It costs nothing in the pipelines: what an entry point does not reach is stripped before compiling, so `double`'s pipeline holds no trace of `addOne`. The price is elsewhere: a mistake anywhere in the file breaks every pipeline made from it, and a long file is harder to read. The other common way is to keep the shared part in a JavaScript string and glue it in front of each shader, as three.js does with its `ShaderChunk`s.

### Can two pipelines share a bind group?

Yes, but not with `layout: 'auto'`. You describe the slots by hand, once, and give the same layout to both pipelines. The `layout` in the snippet above is made like this:

```js
const slots = device.createBindGroupLayout({
  entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }],
})
const layout = device.createPipelineLayout({ bindGroupLayouts: [slots] })
const bindGroup = device.createBindGroup({ layout: slots, entries: [{ binding: 0, resource: { buffer } }] })
```

That one `bindGroup` then works with `a` and with `b`: set it once, and switch only the pipeline between dispatches. What each line means is for the guide on bind groups, still to write.
