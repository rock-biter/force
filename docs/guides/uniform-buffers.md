# How do you give every thread the same values?

*WebGPU mini guide · 4 min read · Code: [examples/net-surface](../../examples/net-surface/round-cells-surface.wgsl) · Read first: [buffers](./buffers.md), [bind groups](./bind-groups.md)*

**In short:** a compute shader runs many times at once, each run a *thread*: in a physics engine, one per particle. A *uniform buffer* is a small buffer that a shader can only read, declared `var<uniform>`: the place for the few values every thread shares, such as a friction or the planes of a floor. A *storage buffer*, `var<storage>`, is for the big arrays. A shader stage (compute, vertex or fragment: a compute shader is one stage) may read only 8 storage buffers unless the device is asked for more, and 12 uniform buffers on top of them: moving a small fixed array to a uniform frees a place.

## The idea

In a kitchen every cook reads the same recipe pinned to the wall: short, the same for all, and nobody writes on it. The crates of vegetables are another matter: large, a different one for each job, and the cooks put things in them. The cooks are the threads, the recipe is a uniform buffer, the crates are storage buffers.

In three.js and GLSL you know the first kind already: `uniform float friction;`, set from JavaScript with `material.uniforms.friction.value = 0.15`. In WebGPU a uniform is not set value by value: it lives in a buffer, which you fill with `writeBuffer()` and hand to the shader in a bind group, like any other buffer. A struct of several values travels as one buffer.

What tells the two kinds apart:

| | Uniform | Storage |
| --- | --- | --- |
| Declared | `var<uniform>` | `var<storage, read>` or `read_write` |
| The shader can | read | read, and write if `read_write` |
| An array in it | has a fixed length, `array<vec4f, 6>` | can have no fixed length, `array<vec4f>` |
| Largest binding, unless asked | 65 536 bytes | 128 MB |
| How many in a shader stage, unless asked | 12 | 8 |

The numbers are the default *limits* of a device: what every device gives without being asked.

## The code

From the shader that pushes touching particles apart in FORCE, a physics engine. Three of its uniforms, shortened: one number, one struct, and one array. The loop is from inside `main()`, where `p` and `radius` are this thread's particle; `params` is one more uniform struct, not shown.

```wgsl
struct Surface {
  method: u32,
  half: f32,  // meters: half the thickness of a cloth
  large: f32,
  rounded: u32,
}

@group(0) @binding(9) var<uniform> friction: f32;
@group(0) @binding(12) var<uniform> surface: Surface;
@group(0) @binding(5) var<uniform> planes: array<vec4f, 6>; // the floor and the walls

for (var k = 0u; k < params.planeCount; k++) {
  let plane = planes[k];
  let overlap = radius - (dot(p, plane.xyz) - plane.w);
```

- `friction` is a whole buffer of 4 bytes for one `f32`. From JavaScript, where `rub` is that buffer: `device.queue.writeBuffer(rub, 0, new Float32Array([mu]))`.
- `surface` mixes whole numbers and floats, so JavaScript writes one `ArrayBuffer` through two views of it, a `Uint32Array` and a `Float32Array`, in the order of the struct.
- `planes` is an array with a fixed length, 6, and the shader reads only the first `planeCount` of them. Its length is part of the type: the buffer must hold all 6, even when only 5 are used.

The other shaders of the page read the same bytes as a storage buffer, declared `array<vec4f>` with no fixed length: they have places to spare, so they were left alone. One buffer can be both, if it is created with both usages:

```ts
const storage = (size: number, extra = 0) =>
  device.createBuffer({
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | extra,
  })
// Room for 6 planes, and a uniform too
const planes = storage(6 * 16, GPUBufferUsage.UNIFORM)
```

Nothing else changes in JavaScript: the bind group still gives this buffer to binding 5. The pipelines here are made with `layout: 'auto'`, so the kind of each binding is read from the shader ([bind groups](./bind-groups.md)).

## Common mistakes

- **A buffer too small for the type.** A binding declared `array<vec4f, 6>` needs 96 bytes. With a buffer of 80, for 5 planes, creating the bind group is rejected with a validation error.
- **The usage forgotten.** A buffer made with `STORAGE` only cannot be bound to a `var<uniform>`: it needs `GPUBufferUsage.UNIFORM` when it is created, and usages cannot be added later.
- **A ninth storage buffer.** A shader that reads 9 is rejected unless the device was created with `requiredLimits: { maxStorageBuffersPerShaderStage: 9 }`, and a device can refuse. We did that for a day, then moved the planes to a uniform.

## Where FORCE uses it

In [round-cells-surface.wgsl](../../examples/net-surface/round-cells-surface.wgsl): the normals of a cloth needed a storage buffer, the shader had 8 already, and the planes gave up their place ([chapter 077](../logbook/077-the-surface-of-a-cloth.md)). The page of `examples/net-surface` runs the script of another folder, [main.ts](../../examples/heap-simulation/main.ts): the buffers are made there.

## Try it

In `round-cells-surface.wgsl`, change `var<uniform> planes: array<vec4f, 6>` back to `var<storage, read> planes: array<vec4f>` and open `examples/net-surface`. The page shows the error of the ninth storage buffer.

## Sources

- [MDN, GPUSupportedLimits](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits): the default limits in the table.
- [WGSL specification](https://www.w3.org/TR/WGSL/): the store type of a uniform or storage buffer must be host-shareable, a type with a set layout in memory, and "the number of elements in a runtime-sized array is determined by the size of buffer binding associated with the corresponding storage buffer variable".
- That one buffer can carry both usages, and the two errors above: tried in Chrome on a Mac, not read in the specification.

## For an article or video

- **Hook:** "My shader needed a ninth buffer, and WebGPU gives eight."
- **Show:** the error in the console, then one line changed from `storage` to `uniform`, and the page running.
- **Takeaway:** big arrays are storage, a few shared values are uniform, and the two have separate counts.

## Questions

*Asked while reading this guide, and answered after checking the sources.*
