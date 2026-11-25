# 031 · Particles of different sizes, up to 2 to 1

*Accepted · November 25, 2026 · The user, after a script in 3D that tried mixes up to 4 to 1 ([chapter 048](../logbook/048-big-and-small.md))*

**Decision:** we will let every particle have its own radius, the largest at most twice the smallest, and keep one speed limit for all, worked out from the largest radius. A particle weighs its density times its volume.

## Why

The user wants scenes with grains of several sizes, of one material or of several. In the script, up to 2 to 1 nothing else has to change: the lists of 32 neighbours hold (the longest was 26) and a pile settles with one deep overlap in 457 spheres. At 3 to 1 the lists overflow, and at 4 to 1 a large sphere, 64 times as heavy as a small one, sinks into them even with longer lists.

## Not chosen

- **A wider ratio:** needs longer lists, then a way to hold heavy on light. Not studied yet.
- **A speed limit from the smallest radius:** 6 m/s at 2 to 1, half of today's, for every particle.
- **A speed limit for each size:** small particles would fall slower than large ones: falling 3 m, 1.13 s against 0.78 s at 4 to 1.

## Consequences

- With the limit from the largest radius, two of the smallest that meet head on at full speed can pass through each other: measured at 4 to 1, in half of the shots, not at 2 to 1. Large against small never does.
- The cell follows the largest radius. The margin of the lists follows the smallest, half its radius: lists are made more often.
- On the GPU the radius is the first of a particle's properties ([decision 032](./032-a-buffer-of-particle-properties.md)), read for every neighbour. Only the pages with sizes pay for it: they run their own copies of three shaders, and the benchmark page keeps the originals.
- Particles kept in the order of their cells (chapter 041) are off with sizes: the radii do not move with them yet.

## Still open

- Passing through at 2 to 1, and friction and levels with sizes: seen only by eye, on the [mixed-sizes](../../examples/mixed-sizes/index.html) page.
- How much reading the properties costs per step, measured properly.

## Revisit if

A scene needs more than 2 to 1, or small particles are seen passing through each other.
