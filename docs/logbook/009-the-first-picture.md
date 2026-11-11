# 009 · The First Picture

*November 11, 2026 · 4 min read*

**In short:** FORCE can be seen. A debug viewer built on three.js draws the particles as spheres, straight from the engine's GPU buffer, with buttons to pause, run one step, restart, and change the step and the substeps.

## The story

Until now FORCE answered only in numbers. We wanted a picture: a small viewer, only for us while we build the engine, with a light grey background, a grid, the axes in the middle, and a panel of controls. It lives in [`examples/debug/`](../../examples/debug/viewer.ts), and the npm package does not include it.

The big question was how the positions get from FORCE to three.js. The easy way is a *readback*: copy them to the CPU on every frame and draw them with WebGL. We took the harder one: the `WebGPURenderer` of three.js, on the same device as FORCE, drawing from the engine's own buffer, with no copy ([decision 012](../decisions/012-renderers-read-the-gpu-buffer.md)). It is the path [decision 010](../decisions/010-device-from-outside.md) promised, and the viewer is the first thing to put it to the test.

### What the three.js source says

Before writing any code, we opened the three.js source, version r187. The good news: `WebGPURenderer` accepts a device from outside, and never destroys a device it was given, the same rule as our decision 010. The bad news: there is no public way to draw from a buffer three.js did not create. Textures have one (`ExternalTexture`), buffers do not.

Its code, though, creates a buffer for an attribute only when its private map has none. So we fill the map first: [one line](../../examples/debug/particles.ts), kept in one function, that a later three.js can break. And one trap to remember: `dispose()` on that attribute would destroy FORCE's buffer.

### Spheres made of one triangle

Each particle is an *impostor*, a flat shape that pretends to be a sphere. In three.js terms it is an `InstancedBufferGeometry` with three vertices, drawn once per particle (*instancing*). The vertex shader turns the triangle to face the camera, which makes it a *billboard*. The fragment shader cuts a disc out of it and computes the normal as (x, y, √(1 − x² − y²)). It also writes the depth a real sphere would have, like `gl_FragDepth` in GLSL, so two spheres cross as spheres and not as flat discs.

The shaders are in *TSL*, the language three.js uses to write shaders in JavaScript, which it compiles to WGSL: the WebGPU renderer takes no GLSL.

### Substeps, at last

The panel needed a substeps knob, and the engine had none: [decision 006](../decisions/006-semi-implicit-euler.md) had chosen them, but the code had not caught up. Now `World.create({ substeps })` splits each step into equal parts, one dispatch each ([decision 011](../decisions/011-substeps-per-world.md)).

A check, in the browser: one particle falling for one second, on the GPU and in JavaScript. They agree to 5 decimal places. With 4 substeps, the drift from an exact fall goes from 8.2 cm to 2.0 cm, a quarter: with constant gravity, the error of semi-implicit Euler grows in proportion to the step.

### It worked on the first run

A headless Chrome, driven by a small script, showed 5000 spheres rising from the origin in a cone, then falling through the grid, since there is no ground yet. Pause froze the time, the step button added exactly one step, and restart went back to zero. A [Tweakpane](https://tweakpane.github.io/docs/) panel also shows the frames per second, the CPU time of each frame, the JavaScript heap, and the GPU memory three.js knows about.

## What we take away

- Sharing a device is half the job: the renderer must also accept your buffer, and three.js does not, officially.
- Read the library's source before guessing: twenty lines of three.js answered what its docs did not.
- An impostor fakes a sphere with a triangle and a little math in the fragment shader; writing the depth makes the trick hold when spheres overlap.
- A knob chosen in theory waits for the code that needs it: substeps came with their first slider.

## Open questions

- The viewer draws the last step, with no blend between the last two ([render interpolation](../topics/fixed-timestep.md#render-interpolation), still open in [decision 005](../decisions/005-fixed-timestep.md)).
- Is it worth asking three.js for a public way to use an existing buffer?
- The numbers from a headless browser are not real performance: we need real devices, phones too.

## Sources

- [three.js r187, `WebGPUBackend.js`](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgpu/WebGPUBackend.js): the `device` parameter, and who destroys the device.
- [three.js r187, `WebGPUAttributeUtils.js`](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgpu/utils/WebGPUAttributeUtils.js): `createAttribute()` makes a buffer only when there is none.
- [WebGPU specification](https://www.w3.org/TR/webgpu/), §19.2: `submit()` runs command buffers in order; and `GPUBuffer.destroy()` may be called more than once.

## Next step

Back to the WebGPU guides, starting with buffers; sharing a buffer between two libraries gets a guide of its own.
