# 004 · Rigid bodies and particles first

*Accepted · before November 11, 2026 · The user, during the [research with ChatGPT](../logbook/004-the-detour.md)*

**Decision:** we will start from rigid bodies and particles, and add cloth, fluids and soft bodies after.

## Why

Rigid bodies and particles are the base of most game physics, and the other materials reuse their pieces: particles, constraints, collisions.

## Not chosen

- **Starting from cloth, fluids or soft bodies.**

## Consequences

- The first data model holds bodies and particles.
- The first collisions are between simple shapes, such as spheres and boxes.

## Still open

- What a rigid body is inside the engine: a true body, with an orientation and an inertia tensor, or a cluster of particles, as in [Harada's GPU Gems chapter](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-29-real-time-rigid-body-simulation-gpus) and in NVIDIA FleX. ChatGPT suggested true bodies; nothing is tested yet.
