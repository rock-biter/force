# 040 · Damping in each spring, drag on every particle

*Accepted · November 25, 2026 · The user, on Claude's proposal after a script and a look at the ropes page ([chapter 065](../logbook/065-two-kinds-of-brake.md))*

**Decision:** we will give each spring a damping ratio, 0 for none and 1 to come to rest without a bounce, applied inside the spring as XPBD does, and give the world a drag, in 1 / s, that brakes the speed of every particle at the end of each substep.

## Why

A spring that is as soft as asked ([decision 039](./039-a-running-total-for-each-spring.md)) keeps swinging. Two things swing, and one brake does not stop both: a spring's damping brakes changes of its length, and a rope swinging like a pendulum does not change length. In the script, a spring asked for ζ = 0.1 loses its swing as 0.41 to 0.50 of the one before, where an exact one gives 0.53, and with ζ = 1 never goes past rest, whatever the passes. On the ropes page a drag of 0.5 per second brings the ropes to rest in 30 seconds; with none they swing on.

## Not chosen

- **A damper in newtons per meter per second:** the same number brakes a soft spring hard and a stiff one hardly. A ratio reads the same on all.
- **Taking speed away after the positions are settled:** the same numbers, for one more pass over the springs.
- **Drag only:** it would also stop what should keep moving, to stop a spring's bounce.
- **Nothing, and the solver's own brake:** it depends on the substeps and on the spring, and nobody sets it.

## Consequences

- A spring's record grows to five numbers, and its shader reads where each particle began the substep.
- The damping we get is what is asked plus what the solver dissipates by itself: more for stiff springs and long substeps.
- A rod has no damping of its own: only the drag brakes it.
- The drag is one number for the whole world, 0 unless a page asks.

## Still open

- Drag for each particle, or growing with the square of the speed, as air.
- Measuring the spring's damping on the GPU.

## Revisit if

Something must keep moving in a world where ropes must stop: then the drag cannot be one number.
