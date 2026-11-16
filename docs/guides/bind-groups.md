# How does a shader find its data?

*WebGPU mini guide · 4 min read · Code: [src/world.ts](../../src/world.ts) · Read first: [pipelines](./pipelines.md)*

**In short:** a shader never names a buffer: it declares numbered slots, with `@group` and `@binding`. A *bind group* puts a real buffer in each slot. You make it once, with `device.createBindGroup()`, and hand it over before the shader runs, with `setBindGroup()`.

## The idea

In three.js a `ShaderMaterial` finds its data by name: `uniforms: { time: { value: 0 } }` in JavaScript meets `uniform float time;` in GLSL because both say `time`.

In WebGPU no name crosses the border. The shader calls its array `positions`, JavaScript calls its buffer `this.positions`, and neither ever sees the other's name. They meet on two numbers:

```wgsl
@group(0) @binding(1) var<storage, read_write> positions: array<vec4f>;
```

It reads: "whatever sits in slot 1 of group 0, I will call `positions`, and read as an array of `vec4f`". Which buffer sits there, JavaScript decides, with a bind group. A group is a set of slots that are filled together; here there is only one, group 0.

The [pipelines guide](./pipelines.md) had a kitchen, with the pipeline as a recipe hung on the wall. That recipe says "take the jar in place 1", and never which jar. A bind group is a tray with real jars in numbered places. Slide in another tray, and the same recipe cooks with other ingredients: the pipeline is *which program*, the bind group is *which data*.

Between the two sits a third object, the **bind group layout**: the labels on the places of the tray, saying what must go in each one ("a uniform buffer of at least 32 bytes"). It is the piece the two share. The pipeline has one layout for each group, written from what the shader expects, and every bind group is made for one layout: `createBindGroup()` checks each buffer against its label. That is why the tray fits the recipe.

Two more things to know:

- **A bind group cannot change.** Like a pipeline, it has no setters: for other buffers, make another bind group. But it holds the buffers themselves, not a copy of their bytes. Write new values into a buffer, and the next run reads them through the same bind group.
- **Why "group".** A shader can spread its slots over several groups, four at most by default (the `maxBindGroups` limit), and each group is set on its own. That lets you change only what changes: a renderer could keep the camera in group 0, set once per frame, and the data of each object in group 1, set once per object. One group is enough for FORCE.

## The code

From FORCE, a physics engine whose `World` moves particles with one compute shader. The three slots, in the shader:

```wgsl
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec4f>;
```

And the bind group that fills them, in JavaScript:

```ts
this.bindGroup = device.createBindGroup({
  layout: this.pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: this.params } },
    { binding: 1, resource: { buffer: this.positions } },
    { binding: 2, resource: { buffer: this.velocities } },
  ],
})
```

- `layout`: the labels to check the entries against. The pipeline was created with `layout: 'auto'`, so WebGPU wrote them from the shader, and `getBindGroupLayout(0)` asks the pipeline for the ones of `@group(0)`.
- `entries`: one for each slot of the layout, no more and no fewer. Their order in the array does not count: `binding` does.
- `binding`: the `@binding` number of the slot.
- `resource`: what goes in the slot. `{ buffer }` is the whole buffer; add `offset` and `size`, in bytes, and the shader sees only that part of it. A texture or a sampler goes in a slot too, directly as the `resource`.

Then, on every frame, inside `update()`:

```ts
pass.setPipeline(this.pipeline)
pass.setBindGroup(0, this.bindGroup)
pass.dispatchWorkgroups(this.workgroups)
```

The `0` is the group again. A pass starts with no bind group set; once set, one stays for every dispatch that follows in that pass, until another takes its place. Same rule as for the pipeline: create it once, set it on every frame.

## Common mistakes

The first four do not throw: the browser prints the error in the console. Three of them are caught by `createBindGroup()`, which returns a bind group that is *invalid*. The last one gives no error at all. The messages are Chrome's.

- **An entry missing, or one too many.** With two entries out of three: `Number of entries (2) did not match the expected number of entries (3)`. The sneaky version: say the shader also declares a fourth buffer, at `@binding(3)`, that `main` never touches. `'auto'` leaves out every slot the entry point does not use, so an entry for it is one too many: `binding index 3 not present in the bind group layout`. Commenting out one line of the shader can break the JavaScript.
- **The wrong kind of buffer.** A buffer created without the `UNIFORM` flag, in a `var<uniform>` slot: `Binding usage (BufferUsage::(CopySrc|CopyDst|Storage)) of [Buffer (unlabeled)] doesn't match expected usage (BufferUsage::Uniform)`.
- **A buffer too small.** A 16-byte buffer for `params`, whose struct takes 32: `Binding size (16) of [Buffer (unlabeled)] is smaller than the minimum binding size (32)`.
- **Forgetting `setBindGroup()`.** The dispatch is refused, and the whole batch of commands with it: `No bind group set at group index 0.`
- **Two buffers swapped.** Put `velocities` at binding 1 and `positions` at binding 2, and nothing complains. Both are storage buffers, both big enough, and the layout checks the kind of a buffer, not its meaning. The shader runs, on the wrong numbers.

## Where FORCE uses it

[`World`](../../src/world.ts) makes one bind group in its constructor, right after the pipeline, and sets it at every `update()`. It holds the three buffers of the world: `params` (32 bytes, just what its slot asks for), `positions` and `velocities`, in the slots that [`integrate.wgsl`](../../src/shaders/integrate.wgsl) declares. The smallest bind group in the repo, one entry, is in [`hello-compute`](../../examples/hello-compute/main.ts).

## Try it

In the DevTools console of any HTTPS page, in a browser with WebGPU:

```js
const adapter = await navigator.gpu.requestAdapter()
const device = await adapter.requestDevice()
const module = device.createShaderModule({ code: `
@group(0) @binding(0) var<uniform> scale: f32;
@group(0) @binding(1) var<storage, read_write> data: array<f32>;
@group(0) @binding(2) var<storage, read_write> spare: array<f32>;
@compute @workgroup_size(1)
fn main() { data[0] *= scale; }` })
const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module } })
device.pushErrorScope('validation')
device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [] })
;(await device.popErrorScope()).message
// "Number of entries (0) did not match the expected number of entries (2) for [BindGroupLayoutInternal (unlabeled)].
// Expected layout: [{ binding: 0, visibility: ShaderStage::Compute, buffer: {type: BufferBindingType::Uniform, minBindingSize: 4, hasDynamicOffset: 0} }, { binding: 1, visibility: ShaderStage::Compute, buffer: {type: BufferBindingType::Storage, minBindingSize: 4, hasDynamicOffset: 0} }]…"
```

An empty bind group is a mistake on purpose: to explain it, Chrome prints the layout that `'auto'` wrote. It is worth reading:

- **Two slots, not three.** `main` never touches `spare`, so binding 2 is not there.
- **Each slot has its label.** `visibility` is the kind of shader that may see the slot, `type` the kind of buffer that fits, and `minBindingSize` the fewest bytes it must hold: 4, one `f32`. (`hasDynamicOffset` is an option this guide does not use.)

Add `spare[0] = 0.0;` to `main` and run it again: three slots. Writing the same labels by hand is `device.createBindGroupLayout()`, which you need when [two pipelines share a bind group](./pipelines.md#can-two-pipelines-share-a-bind-group).

## Sources

- [MDN, GPUDevice.createBindGroup()](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createBindGroup): the descriptor, `offset` and `size` of a buffer binding, and the checks that give an invalid bind group instead of an exception.
- [MDN, GPUComputePassEncoder.setBindGroup()](https://developer.mozilla.org/en-US/docs/Web/API/GPUComputePassEncoder/setBindGroup): the index is the `n` of `@group(n)`, and the bind group is used "for subsequent compute commands".
- [MDN, GPUComputePipeline.getBindGroupLayout()](https://developer.mozilla.org/en-US/docs/Web/API/GPUComputePipeline/getBindGroupLayout): with `layout: 'auto'`, the only way to get the layouts the pipeline made.
- [WebGPU specification](https://www.w3.org/TR/webgpu/): a bind group is "a set of resources to be bound together in a group", its interface has no methods, and its layout and entries are read-only ([GPUBindGroup](https://www.w3.org/TR/webgpu/#gpubindgroup)); the number of entries must equal the layout's, each must match the kind of its slot, the buffer's usage and the minimum size ([bind group creation](https://www.w3.org/TR/webgpu/#bind-group-creation)); the layout is "the interface between a set of resources bound in a GPUBindGroup and their accessibility in shader stages" ([GPUBindGroupLayout](https://www.w3.org/TR/webgpu/#gpubindgrouplayout)); `'auto'` counts only the resources the entry point uses ([default pipeline layout](https://www.w3.org/TR/webgpu/#default-pipeline-layout)); what changes least belongs in the lowest group numbers ([GPUPipelineLayout](https://www.w3.org/TR/webgpu/#gpupipelinelayout)); `maxBindGroups` starts at 4 ([limits](https://www.w3.org/TR/webgpu/#limits)); a pass starts with no bind group, and every group of the pipeline's layout must be set before a dispatch ([bind groups](https://www.w3.org/TR/webgpu/#programmable-passes-bind-groups)); two layouts with the same entries can be used one for the other, unless one was made by an `'auto'` pipeline ([compatibility](https://www.w3.org/TR/webgpu/#bind-group-compatibility)).
- [WGSL specification, resource interface](https://www.w3.org/TR/WGSL/#resource-interface): every buffer, texture or sampler variable must have both `@group` and `@binding`, and no two may share the same pair.
- [three.js r187, WebGLUniforms.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgl/WebGLUniforms.js): the WebGL renderer keeps a program's uniforms "by name", and sets each one from the entry of the same name in the material's `uniforms`.
- The error messages are the ones Chrome 157 gave us on November 16, 2026, shortened where marked with `…` or cut at the first line. Other browsers word them differently. In the same run we swapped the two buffers and got no error, and we rewrote `params` between two runs with the same bind group: the second run read the new values. The answers under Questions were run the same way.

## For an article or video

- **Hook:** the shader says `positions`, your JavaScript says `positions`, and WebGPU reads neither. Swap two buffers and nothing complains.
- **Show:** the shader's three `@binding` lines next to the three entries, joined by their numbers; then one pipeline run with two bind groups, on two sets of particles.
- **Takeaway:** the pipeline is which program, the bind group is which data, and two numbers are all that joins them.

## Questions

*Asked while reading this guide, and answered after checking the sources.*

### With `layout: 'auto'`, is the bind group always number 0?

No. The number is the one the shader writes in `@group(n)`, and `'auto'` only reads it. FORCE has a group 0 because `integrate.wgsl` says `@group(0)` on every line. A shader can say otherwise:

```wgsl
@group(0) @binding(0) var<uniform> scale: f32;
@group(1) @binding(0) var<storage, read_write> data: array<f32>;
```

Here `'auto'` writes two layouts, and each bind group is made and set with its own number: `pipeline.getBindGroupLayout(1)`, then `pass.setBindGroup(1, …)`. The numbers go from 0 to 3. A `@group(4)` makes the pipeline invalid: `The entry-point uses a binding with a group decoration (4) that exceeds maxBindGroups (4) - 1`.

### Can several bind groups be attached to the same pipeline?

Yes, in two ways.

- **Side by side.** One for each group the shader uses, four at most. With the shader above, `setBindGroup(0, a)` and `setBindGroup(1, b)` before the dispatch: with `scale` at 3 and `data[0]` at 5, we read back 15. All of them must be set. With only group 0: `No bind group set at group index 1.`
- **One after the other.** In the same place, at different times: set a bind group, dispatch, set another, dispatch again. The same program runs on other data, which is the tray being swapped.

### Can the same bind group be used with two different layouts?

Not if they really differ. A bind group is made for one layout and keeps it for good. What counts, though, is what the layout says, not which object it is. Two layouts created apart with the same entries can stand in for each other:

```js
const entry = { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
const slotsA = device.createBindGroupLayout({ entries: [entry] })
const slotsB = device.createBindGroupLayout({ entries: [entry] })
const group = device.createBindGroup({ layout: slotsA, entries: [{ binding: 0, resource: { buffer } }] })
```

`group` ran with a pipeline built on `slotsA` and with one built on `slotsB`. Change anything in the second layout, one slot more or another `minBindingSize`, and the dispatch is refused: `Bind group layout … of pipeline layout … does not match layout … of bind group … set at group index 0`. The layouts of an `'auto'` pipeline are the exception: they belong to that pipeline alone, so they never match any other, whatever they say.

The other way round is free: one *buffer* can sit in as many bind groups as you like, with different layouts. That is how two different shaders work on the same data.
