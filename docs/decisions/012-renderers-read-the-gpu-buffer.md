# 012 · Renderers draw from the world's GPU buffer

*Accepted · November 11, 2026 · The user, choosing how the debug viewer gets the particles ([step 009](../logbook/009-the-first-picture.md))*

**Decision:** we will expose the positions buffer, `world.positionBuffer`, so that a renderer on the same device draws from it with no copy. Our debug viewer does it with the `WebGPURenderer` of three.js.

## Why

[Decision 010](./010-device-from-outside.md) lets the app share its device with FORCE, so that data stays on the GPU. This is the other half: the renderer needs the buffer itself. Copying it to the CPU and back (a readback) costs 16 bytes per particle on every frame, and draws a frame or two late.

## Not chosen

- **`WebGLRenderer` and a readback on every frame:** simple, with shaders in GLSL, but it pays the copy, and it never tests the path decision 010 promises.
- **FORCE copies the positions into a buffer the renderer owns:** one more copy on every frame, and three.js keeps its buffers private too.
- **three.js creates the buffer, and FORCE borrows it:** three.js's own bookkeeping would stay right, but its buffers are just as private and exist only after the first draw. And the engine's API would bend to a limit of three.js: FORCE would take buffers it did not choose, and could no longer swap or grow them on its own.

## Consequences

- three.js r187 accepts our device (`new WebGPURenderer({ device })`) and never destroys a device it was given. It has no public way to use a buffer it did not create, though. The viewer puts our buffer into three.js's private map of buffers: a single line, kept in one function, that a later three.js can break.
- A renderer must only read the buffer. In three.js, `dispose()` on that attribute would destroy it.
- The layout becomes public: one `vec4f` per particle, w free ([decision 008](./008-particles-in-two-vec4-buffers.md)). Changing it breaks renderers.
- One device has one queue, and `submit()` runs command buffers in the order they arrive (spec §19.2): the steps sent before drawing run before the drawing reads them.
- three.js and Tweakpane are dev dependencies only: the npm package does not include them.

## Still open

- Velocities and the buffers to come: expose them when a renderer needs them.
- A public way into three.js, like `ExternalTexture` for textures: a pull request upstream, once the engine is further along.
- How other libraries take a buffer they did not create: to check one by one, together with their device ([decision 010](./010-device-from-outside.md)). Not now: too early.

## Revisit if

- three.js adds a public way to use an existing buffer, or changes how it stores them.
