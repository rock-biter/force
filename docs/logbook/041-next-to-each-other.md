# 041 · Next to Each Other

*November 23, 2026 · 3 min read*

**In short:** two papers we already had say to keep the particles themselves in the order of their cells. We tried it: making the lists of neighbours takes a third of the time. And with the cells on a grid the pushes take half, which our hashed table does not get. The choice of the table is open again.

## The story

The user asked two things: has anyone written about the memory problem of [chapter 039](./039-far-apart-in-memory.md), and what other ways are there. Claude, the AI assistant we study with, searched the text of the papers in our library.

**What the papers say.** Simon Green, whose grid we follow since [chapter 024](./024-twenty-seven-cells.md), writes it three times: a numbering of the cells such as the *Z-order curve* can "improve the coherence of memory accesses"; he moves the positions and velocities into the order of the cells; and sorting is his fastest way "on most hardware" because of that coherence. Macklin and others, in the paper behind NVIDIA FleX, use a grid with a hash like ours and say in one line that they re-order the particle data by cell. Teschner and others, whose hash we took, do not speak of memory at all.

So both sort the particles, and we did not. Our *address book*, the list of all the particles sorted by cell, holds only their numbers: particle 7 stays in row 7 of the buffer of positions wherever it is in space, and reading a neighbour's position is a jump to anywhere.

**Moving the particles.** With `?sorted` in the address of our [live page](../../examples/heap-simulation/main.ts), each time the book is made again two more shaders run. [One](../../examples/heap-simulation/book-move.wgsl) copies, for every row of the book, what belongs to that particle into the same row of spare buffers: where it was, where it is predicted to be, its level in the pile. [The other](../../examples/heap-simulation/book-settle.wgsl) copies it all back. From then on particle number 7 is the one in row 7 of the book, and the particles of a cell are next to each other in memory. Its mass travels with its position, and the page draws from the positions, so nothing else had to change. At the first step the lists hold the same 115 546 neighbours as before.

In the box with a level floor, 100 000 particles, in ms per step of 1/60 s:

| | The move | The lists | The 6 rounds of pushes | A step |
| --- | --- | --- | --- | --- |
| table, particles as they were | none | 4.2 and 4.5 | 6.4 and 6.5 | 12.3 and 12.7 |
| table, particles in order | 0.3 | 1.3, 1.2 and 1.2 | 6.8, 6.1 and 6.6 | 10.2, 9.5 and 10.1 |
| grid, particles as they were | none | 3.7 | 6.9 | 12.9 |
| grid, particles in order | 0.3 to 0.4 | 1.1, 1.2 and 1.3 | 3.3, 3.3 and 4.4 | 6.6, 6.7 and 7.7 |

With 50 000 a step took 4.7 and 3.9 ms with the table in order, against 5.7, and 4.4 with the grid in order. In the corner of the tilted box, 50 000 particles: 6.8 and 6.8 ms with the table in order, against 8.1 and 8.7, and 8.3 with the grid in order, whose running sum over a large, almost empty grid costs 3.3 ms there.

### What surprised us

**The lists gain, the pushes do not, with the table.** We expected the rounds of pushes to gain most: they read every neighbour's position six times a step. With the table they gain nothing.

**The order of a grid is worth half the pushes.** With the cells on a grid the same move halves the rounds, 3.3 ms against 6.9. Claude's reading, not tested: on a grid the rows of the book follow space along all three axes, so the neighbours of a particle sit in a few stretches of memory. In the table only the cells of a row along x are together ([decision 024](../decisions/024-cells-in-a-hashed-table.md)); the rows above, below and beside are anywhere.

**Decision 024 is one day old and already in doubt.** At 100 000 particles the grid in order takes 6.6 ms a step and the table in order 10. The table still wins in the corner, and still costs 1 MB whatever the world.

## What we take away

- Keeping the particles in the order of their cells costs 0.3 ms and saves 3 in the lists, at 100 000.
- How much the pushes gain depends on the order: all of space in order, as on a grid, halves them.
- The papers we had already read held the answer. We had read them for the grid, not for the memory.

## Open questions

- A table that keeps whole blocks of cells together, not only rows: would it get the order of a grid without its border? Not tried.
- Make the move the way of the page? And grid or table, now that each wins a scene by much.
- Velocities are not moved: the end of a step writes them again. A particle that never moves would need them.

## Sources

- Simon Green, [Particle Simulation using CUDA](https://developer.download.nvidia.com/assets/cuda/files/particles.pdf), NVIDIA, 2010: the Z-order curve, the re-ordered arrays and the performance section.
- Miles Macklin, Matthias Müller, Nuttapong Chentanez and Tae-Yong Kim, Unified Particle Physics for Real-Time Applications, 2014, from our local copy: the line on re-ordering particle data by hash-grid cell.
- Our page, [examples/heap-simulation](../../examples/heap-simulation/main.ts), with `?profile`, `?sorted` and `?cells=book`: every number of this chapter, in Chrome without a window on a Mac M1.

## Next step

Try a table that keeps blocks of cells together, then choose again between table and grid.
