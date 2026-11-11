# 010 · The Ground

*November 11, 2026 · 3 min read*

**In short:** the particles no longer fall forever. A world can have a flat ground, and particles bounce on it, slide, and stop. It is the simplest version there is, on purpose: the real study of contacts will come with the rigid bodies.

## The story

In the fountain of the [last chapter](./009-the-first-picture.md), 5000 particles rose, fell through the grid, and kept falling. We wanted a floor, and a first version simple enough to write in one sitting ([decision 013](../decisions/013-a-flat-ground.md)).

The idea fits in one sentence. After each move, if a particle is below the ground, put it back on top and turn its vertical speed around, weakened. How much comes back is the *restitution*: with 0.5, a particle hitting the ground at 5 m/s leaves at 2.5 m/s and rises to a quarter of the height, since the height goes with the square of the speed. Finding the touch is *collision detection*; what we do about it is *collision response*.

It all lives in [`integrate.wgsl`](../../src/shaders/integrate.wgsl), the shader that already moves the particles: one `if` per particle, no extra pass, no talk between particles. Two more things came with it:

- **A radius.** The engine saw points, so the center touched the ground and the spheres of the viewer sank halfway in. Now every particle in a world has the same radius, and the viewer reads it from the engine.
- **Friction.** Without it, whatever landed slid away forever. At each hit, the sliding slows by the friction coefficient times the change in vertical speed, down to a full stop.

The ground is switched on by an *override constant*, a WGSL constant set from JavaScript when the pipeline is made, the same mechanism as the workgroup size. With no ground, the shader is built without that code, and falling-particles stays a pure free fall check.

### Seven centimeters

We checked it in the browser against the same steps in JavaScript. A particle dropped from 5 m bounced to 1.185, 0.267, 0.062 m: about a quarter each time, as a restitution of 0.5 predicts. But GPU and JavaScript were up to 74 mm apart.

Not a bug. JavaScript counts in 64-bit floats and the GPU in 32-bit ones, and near the ground that tiny difference decides *on which step* a particle is found below it. The second bounce came one step earlier on the GPU, step 118 instead of 119. Redone in 32-bit JavaScript (`Math.fround` after each operation), the two agree within 0.0001 mm, bounce for bounce. In [chapter 008](./008-the-first-loop.md) the rounding stayed small; here, an `if` turns it into a whole step.

### Friction that finds Coulomb

A particle sliding on the ground at 2 m/s stopped after 0.68 s. That is exactly 2 / (0.3 × 9.81), the stopping time Coulomb's law gives with gravity alone. While it rests, gravity pulls it a hair into the ground on every step, the ground pushes it back by just as much, and friction slows it in proportion to that push. Nobody put Coulomb in the code, yet he turned up.

## What we take away

- The simplest contact is "put it back and turn the speed around": a few lines, no extra pass.
- A branch can turn rounding noise into a whole step: compare against 32-bit math, not 64-bit.
- At rest, the "in proportion to the hit" rule becomes Coulomb's law, μ·g.
- A first version is fine if its limits are written down: one flat plane, the same bounce for everyone, a resting speed that never quite reaches zero.

## Open questions

- How real engines handle contacts, with impulses or position based dynamics: to study with the rigid bodies.
- Where restitution and friction will live once bodies differ from each other.

## Next step

Back to the WebGPU guides, starting with buffers.
