# 021 · A grid fixed in the world

*Accepted · November 20, 2026 · The user, after piles exploded in the corners of a tilted box ([chapter 035](../logbook/035-the-grid-stays-still.md))*

**Decision:** we will keep the grid of cells and gravity fixed in the world, with the cells along its axes. A box, a floor or a wall may turn as it likes inside the grid, and the grid must be big enough to hold everything the particles can reach.

## Why

A tilted box can be simulated by turning gravity the other way and leaving the box level. It is cheap, and it broke: the levels of a pile ([decision 015](./015-half-and-half-on-positions.md)) count "lower" along the y axis, and with gravity turned by 30° the corners of the box threw particles out. With the levels switched off the pile held; with the grid and gravity fixed and only the five planes turned, it held with the levels on. Any rule that knows which way is up would have the same trouble, and a world with two boxes turned in different ways could not turn gravity for both.

## Not chosen

- **Turning gravity, and making the levels follow it:** it mends the levels, but only one solid thing per world can turn, and every later rule must remember that down is not −y.
- **Turning the grid with the box:** the same limit, one box per world.

## Consequences

- Planes are the only thing a page turns: their normals, read by every round.
- The grid must cover every place the box can go. For a box 24 m wide and 9 m tall that tilts by 30° both ways, 3.9 million cells instead of 648 000, almost all empty.
- A plane that moves must move less than a particle's radius per step, or it lands inside the particles ([decision 017](./017-a-speed-limit-per-substep.md) says the same of the particles).

## Still open

- Friction against a plane that moves: a contact measures the slide against the world ([decision 020](./020-friction-after-the-pushes.md)).

## Revisit if

- The memory of the empty cells becomes the limit: then a structure that pays only for full cells.
