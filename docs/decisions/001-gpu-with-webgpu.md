# 001 · Physics on the GPU, with WebGPU

*Accepted · November 4, 2026 · The user, at the start of the project ([logbook 000](../logbook/000-the-launch.md))*

**Decision:** we will run the simulation on the GPU with WebGPU compute shaders, behind a TypeScript API.

## Why

It is the idea FORCE was born from. Most physics engines that run in a browser compute on the CPU, in JavaScript or WebAssembly, and use the GPU only to draw. A GPU runs the same code on thousands of items at once, which suits particles, cloth and fluids.

## Not chosen

- **The CPU, in JavaScript or WebAssembly:** the road of cannon-es, Ammo.js or Rapier. Proven, but limited to a few cores.
- **WebGL:** it has no compute shaders, so computing means bending textures and drawing passes. It stays a possible fallback for later.

## Consequences

- The parts that compare objects with each other, the solver above all, are the hardest to parallelize ([logbook 001](../logbook/001-the-flip-book.md)).
- FORCE runs only where WebGPU exists, and must check the limits of each GPU.
- Data should stay on the GPU, and be read back to JavaScript as rarely as possible.

## Revisit if

- A piece of the engine turns out simpler or faster on the CPU.
