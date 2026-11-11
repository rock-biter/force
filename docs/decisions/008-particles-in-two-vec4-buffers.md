# 008 · Particles in two vec4 buffers

*Accepted · November 11, 2026 · The user, when the first particle state went onto the GPU (step 008)*

**Decision:** we will keep particle positions and velocities in two separate GPU buffers, one `vec4f` per particle in each, with the fourth number free for now.

## Why

In a WGSL array a `vec3f` takes 16 bytes, not 12: the GPU aligns it to 16, as GLSL's `std140` does with `vec3` uniforms. Since the fourth float is there anyway, `vec4f` makes it visible and usable.

Separate buffers, one per quantity, work like the attributes of a three.js `BufferGeometry`. Drawing needs only the positions, and [render interpolation](../topics/fixed-timestep.md#render-interpolation) needs two copies of the positions only, not of the velocities. The technical name is *struct of arrays* (SoA).

## Not chosen

- **One buffer of `{ position, velocity }` structs** (*array of structs*, AoS): closer to a JavaScript object, but whoever needs only positions carries the velocities along.
- **Three floats per particle in an `array<f32>`:** no wasted bytes, but every read rebuilds the vector by hand.

## Consequences

- Each quantity we add, such as forces or mass, decides whether it gets its own buffer or a free fourth slot.
- The public API takes and gives three numbers per particle, like three.js; the padding stays inside.

## Still open

- What the fourth slot holds. A candidate: the inverse mass, where zero means a particle that never moves.
