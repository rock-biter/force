# 006 · Semi-implicit Euler, with substeps

*Accepted · November 11, 2026 · The user, after studying [numerical integration](../topics/integration.md)*

**Decision:** we will update velocities first and positions after (semi-implicit Euler), and split a step into substeps where stiffness requires it.

## Why

One force computation per step, energy steady on average, and the integrator Glenn Fiedler says most commercial game engines use; Box2D uses it too. Its limit, `dt × ω < 2`, is handled with substeps. The details are in the [theory page](../topics/integration.md).

## Not chosen

- **Explicit Euler:** it creates energy, and springs explode.
- **Velocity Verlet:** more accurate, but the velocity has to wait for the force at the end of the step.
- **RK4:** four force computations per step, and it still loses energy.
- **Implicit Euler:** a system to solve at every step, hard to parallelize, and it drains energy.

## Consequences

- Each particle integrates on its own: one GPU thread per particle.
- Substeps become a knob of the quality tiers: more on desktop, fewer on phones. In code since [decision 011](./011-substeps-per-world.md).

## Still open

- How many substeps each tier gets.

## Revisit if

- The constraint solver brings its own scheme. Position based methods, such as PBD and XPBD, start from a semi-implicit step, then correct the positions and work out the velocities from them.
