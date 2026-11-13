# What does a compute shader look like?

*WebGPU mini guide · 4 min read · Code: [src/shaders/integrate.wgsl](../../src/shaders/integrate.wgsl) · Read first: [buffers](./buffers.md)*

**In short:** a compute shader is a function written in WGSL, WebGPU's shading language, that the GPU runs many times at once. Each run gets a number saying which one it is, and returns nothing: it works by reading and writing buffers, the blocks of GPU memory that JavaScript fills.

## The idea

A GLSL fragment shader is one `main()` that the GPU runs once per pixel. Each run learns which pixel it is from `gl_FragCoord`, and all it can do is give that pixel a color.

A compute shader keeps the first half and drops the second. It is still one function run many times at once, and each run, called an *invocation* (a *thread* in these guides), still gets its own number. But there are no pixels and no output: a thread reads and writes buffers, wherever it likes. That freedom has a price: two threads writing the same element at once give an unpredictable result. In FORCE, thread 7 moves particle 7 and touches nothing else, so no two threads ever meet.

In three.js on WebGL, `GPUComputationRenderer` fakes this with a fragment shader that writes positions as the colors of a texture. Here no disguise is needed.

WGSL is close to GLSL in what it can do (`vec3`, swizzles like `.xyz`, `length()`, `max()`) and different in how it is spelled, in the style of Rust or TypeScript:

| GLSL | WGSL |
| --- | --- |
| `float x`, `vec3 v`, `uint i` | `x: f32`, `v: vec3f`, `i: u32`: the type comes after the name |
| `float x = 1.0;` | `let x = 1.0;` can never change, `var x = 1.0;` can. The type is worked out from the value |
| `void main()` | `@compute @workgroup_size(64) fn main(…)`: any name, the *attributes* starting with `@` make it the entry point |
| `gl_FragCoord` | a parameter marked `@builtin(…)` |
| `uniform float time;` | `@group(0) @binding(0) var<uniform> params: Params;` |
| `defines` of a three.js `ShaderMaterial` | `override N: u32;`, a constant set from JavaScript. Not pasted in as text like a `#define`: a real constant, with a type |
| `a ? b : c` | `select(c, b, a)`: there is no `?:`, and the "false" value comes first |

## The code

The shader that moves FORCE's particles, without the part about the ground:

```wgsl
struct Params {
  gravity: vec3f, // m/s²
  step: f32,      // seconds: how much time one run advances
  // …then four more f32 for the ground
}

override WORKGROUP_SIZE: u32;

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec4f>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions)) {
    return;
  }

  var velocity = velocities[i].xyz + params.gravity * params.step;
  var position = positions[i].xyz + velocity * params.step;
  // …the ground goes here: it changes both, which is why they are var

  velocities[i] = vec4f(velocity, velocities[i].w);
  positions[i] = vec4f(position, positions[i].w);
}
```

From top to bottom, a shader file has four kinds of things:

- **`struct`**: a type of your own, as in GLSL. Here it describes how the bytes of the `params` buffer are laid out.
- **`override`**: a constant whose value arrives from JavaScript when the pipeline (the shader made ready to run) is created. With no default value, as here, JavaScript must give one: `constants: { WORKGROUP_SIZE: 64 }` in the call that creates the pipeline.
- **The variables with `@group` and `@binding`**: the buffers, seen from the shader. `var<uniform>` is a few values every thread reads; `var<storage, read_write>` is an array every thread can read and write. `array<vec4f>` has no length: it is as long as the buffer JavaScript attaches. Each particle is a `vec4f`, four floats, though only `xyz` is used: why is in the [buffers guide](./buffers.md). `@group` and `@binding` number the slot each buffer goes in; JavaScript uses the same two numbers to attach it (bind groups, a guide still to write).
- **The entry point**: `@compute` says it is a compute shader, and `@workgroup_size` how many threads are launched together, in blocks. How many blocks is up to JavaScript, each time it runs the shader (dispatch and workgroups, a guide still to write). A compute entry point never returns a value.

Inside `main`:

- `id` is the thread's number, the `gl_FragCoord` of compute shaders. It is a `vec3u`, three unsigned integers, because threads can be laid out on a 1D, 2D or 3D grid. Particles are a list, so only `id.x` counts.
- The `if` is a guard. Threads start in whole blocks, so the last block can go past the last particle: 1000 particles in blocks of 64 means 16 blocks, 1024 threads, and 24 with nothing to do. `arrayLength(&positions)` asks how many elements the array has; the `&` passes the array itself (a pointer to it), not a copy of its contents.
- The two lines in the middle are the physics, and would read the same in GLSL.
- The last two write the results back, keeping the fourth float (`w`) as it was.

## Common mistakes

All four are caught when the shader is compiled. The messages are Chrome's:

- **Changing a `let`.** `let x = 1.0; x = 2.0;` gives `cannot assign to 'let x'`. Use `var` for what changes, `let` for everything else.
- **Forgetting `read_write`.** A plain `var<storage>` is read-only, and writing to it gives `cannot store into a read-only type`.
- **Mixing number types.** With `i` a `u32` and `step` an `f32`, `i * step` gives `no matching overload for 'operator * (u32, f32)'`: nothing is converted for you, so write `f32(i) * step`. Only numbers written out in the code adapt: `step * 2` is fine.
- **Forgetting `@workgroup_size`.** `a compute shader must include '@workgroup_size' in its attributes`, even if the size is 1.

One more thing to know: a shader that does not compile **does not throw**. `createShaderModule()` returns as if all were well, the browser prints the error in the console, and nothing moves. When particles stand still, look at the console first.

## Where FORCE uses it

The engine has one shader so far, [`integrate.wgsl`](../../src/shaders/integrate.wgsl): it moves every particle by one step and, if the world has a ground, makes it bounce. [`World`](../../src/world.ts) imports the file as text and hands it to `device.createShaderModule({ code })`. A second override, `GROUND`, switches the ground code on or off. The shortest shader in the repo, ten lines, is [`free-fall.wgsl`](../../examples/hello-compute/free-fall.wgsl).

## Try it

In the DevTools console of any HTTPS page, in a browser with WebGPU:

```js
const adapter = await navigator.gpu.requestAdapter()
const device = await adapter.requestDevice()
const module = device.createShaderModule({ code: `
@compute @workgroup_size(1)
fn main() {
  let x = 1.0;
  x = 2.0;
}` }) // no exception, only an error in the console
const info = await module.getCompilationInfo()
info.messages[0].message // "cannot assign to 'let x'"
info.messages[0].lineNum // 5
```

`getCompilationInfo()` gives the compiler's messages to your code, each with its line and column. Change `let` to `var` and run it again: `info.messages` comes back empty.

## Sources

- [WGSL specification](https://www.w3.org/TR/WGSL/): `let` is fixed and `var` is a variable ([value declarations](https://www.w3.org/TR/WGSL/#value-decls), [var declarations](https://www.w3.org/TR/WGSL/#var-decls)), an override with no default must be given at pipeline creation ([override declarations](https://www.w3.org/TR/WGSL/#override-decls)), a storage variable is read-only unless declared `read_write` ([var declarations](https://www.w3.org/TR/WGSL/#var-decls)), `vec3f` is short for `vec3<f32>` ([vector types](https://www.w3.org/TR/WGSL/#vector-types)), only numbers written out in the code convert by themselves ([conversion rank](https://www.w3.org/TR/WGSL/#conversion-rank)), compute entry points never return a value and need `@workgroup_size` ([entry point declaration](https://www.w3.org/TR/WGSL/#entry-point-decl)), `global_invocation_id` is a `vec3<u32>` ([built-in values](https://www.w3.org/TR/WGSL/#global-invocation-id-builtin-value)), and the built-in functions [`select`](https://www.w3.org/TR/WGSL/#select-builtin) and [`arrayLength`](https://www.w3.org/TR/WGSL/#arrayLength-builtin).
- [WebGPU specification](https://www.w3.org/TR/webgpu/): a shader with errors makes a *validation error*, which goes to the console instead of being thrown ([shader module creation](https://www.w3.org/TR/webgpu/#shader-module-creation)), and `getCompilationInfo()` gives the messages, with lines counted from 1 ([compilation information](https://www.w3.org/TR/webgpu/#shader-module-compilation-information)).
- The error messages are the ones Chrome 157 gave us on November 12, 2026. Other browsers word them differently.

## For an article or video

- **Hook:** take a fragment shader, remove the pixels and the color it returns. What is left is a compute shader.
- **Show:** GLSL and WGSL side by side, then the console snippet with the silent error.
- **Takeaway:** one function, thousands of threads, each with its own number, and buffers to read and write instead of an output.
