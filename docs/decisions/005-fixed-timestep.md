# 005 · A fixed timestep

*Accepted · November 11, 2026 · The user, after studying the [fixed timestep](../topics/fixed-timestep.md)*

**Decision:** we will advance the physics by a fixed step, spending the time of each frame through an accumulator, with a limit on the steps per frame.

## Why

With a variable step the results change with the frame rate, and one long frame can make a spring explode. A fixed step behaves the same on every device and at every frame rate. The details are in the [theory page](../topics/fixed-timestep.md).

## Not chosen

- **A variable step (`deltaTime`):** the three.js habit, whose results depend on the frame rate.
- **A semi-fixed step:** it caps the length of a step, but steps still differ.

## Consequences

- The engine takes the time of a frame, not a step, and decides by itself how many steps to run.
- To look smooth, the picture must blend the last two states, and it lags one step behind the simulation.
- Under heavy load the simulation runs slower than real time, instead of freezing.

## Still open

- The length of a step: 1/60 s is the usual choice.
- Who blends the two states: the engine, or the renderer with `alpha`.
- The limit on steps per frame.
