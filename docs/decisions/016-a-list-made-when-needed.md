# 016 · Neighbours: a grid, and a list made when needed

*Accepted · November 20, 2026 · The user, after timing the lists of neighbours ([chapter 030](../logbook/030-the-lazy-list.md))*

**Decision:** we will find the particles that touch with a grid of cells one diameter wide, 4 places each, filled with `atomicAdd`. From it each particle writes a list of up to 32 neighbours closer than a diameter plus 5 cm. The rounds read only that list. The GPU makes the lists again by itself when some particle has moved more than 2 cm since the last ones.

## Why

The grid is cheap: 108 000 particles placed in 67 µs on our M1. Reading the 27 cells around a particle at every round is what costs, almost all of a step. A list of the few particles close enough to touch, made only when the particles have moved enough to need it, made a step 2.3 times faster at 10 000 particles and 1.6 times at 100 000, at rest, with the same depths ([chapter 030](../logbook/030-the-lazy-list.md)). The user proposed not making it every time; the rule for when comes from molecular dynamics, where it is called a Verlet list.

## Not chosen

- **27 cells at every round:** the slowest at rest.
- **A list at every step:** making it costs more than it saves.
- **A list every few steps, fixed:** it cannot know when particles move fast, so it may miss a pair.
- **A 10 cm margin:** the lists are longer, and every round reads them.

## Consequences

- Memory: 32 neighbours of 4 bytes and a position of 16 bytes per particle, beyond the grid.
- A cell holds 4 particles: a fifth is left out of the grid, and of the lists. None was in our heaps.
- The check measures how far each particle moved, not how far from its neighbours: a heap falling as a whole makes new lists at almost every step.
- One small buffer holds the flags and counters, so that no shader needs more than the 8 storage buffers WebGPU guarantees.

## Still open

- A check on relative motion, so that bodies falling together keep their lists.
- Sorting particles by cell, Green's other way, which may read memory faster.
- Worlds with no bounds, where a grid of fixed size does not fit.

## Revisit if

- A phone shows a different ratio between the list and the 27 cells.
