# 036 · The Address Book

*November 20, 2026 · 4 min read*

**In short:** under pressure the grid's four places per cell leave particles out, 23 000 of 100 000 in the corner of a tilted box. An address book, one list of all the particles sorted by cell, leaves none out. Filed in a small table instead of under every cell of the grid, it needs 1 MB where the four places need 78, and a step takes longer.

## The story

To find which particles touch, FORCE drops them into a grid of cells 20 cm wide, with 4 places per cell ([decision 016](../decisions/016-a-list-made-when-needed.md)). A fifth particle in a cell finds no place, and nobody sees it until the grid is filled again, which happens when particles have moved enough. Simon Green of NVIDIA gives 4 as enough for spheres one cell wide, and in [chapter 030](./030-the-lazy-list.md) no cell ever held more. The user wanted to get past that limit anyway. First we counted, on our two [pages that run live](../../examples/heap-simulation/main.ts), one with a level box and one with a box that tilts, how many particles find their cell full each time the grid is filled:

| Scene | Particles | Left out |
| --- | --- | --- |
| level box | 100 000 | 0 |
| corner of the box tilted by 30° and −20° | 20 000 | 0 |
| the same corner | 50 000 | 1 183 |
| the same corner | 100 000 | 23 749 |

Later runs of the corner with 50 000 gave 2 046 to 2 241: the count depends on the moment. Our reading: four is enough while spheres do not overlap. In the corner the particles pile up tall, and at 100 000 are still falling onto each other, so they are pressed into each other and more than four fit in a cell. And Claude's guess for how it grows, not measured: a particle left out is not pushed away, overlaps more, and takes the place of others.

**The address book.** [Chapter 024](./024-twenty-seven-cells.md) had met the other way, also Green's: one long list of all the particles, sorted by cell. A cell only needs to know the row where its part begins and how many rows it has, so a fifth particle just makes that part one row longer. To build it without a real sort: count the particles of each cell, work out where each part begins, then let every particle write itself into its cell's part. The middle step is a *prefix sum*: each cell begins at the sum of the counts of all the cells before it. Claude, the AI assistant we study with, asked where four cells with 3, 1, 0 and 2 particles begin. "0, 3, 4, 4, and the list is 6 long," the user said.

**Summing in blocks.** A running sum is hard to share out: each cell needs the total of all the cells before it. One thread, one run of a program on the GPU, cannot walk millions of cells in time, and a thread per cell would have to wait for the one before. So the cells are cut into blocks of 512. One thread per block adds up its counts. One thread alone walks the few thousand block sums and writes where each block begins. Then one thread per block walks its 512 cells again, starting from that row. To fill the list, each particle takes the last free row of its part with `atomicSub`, the ticket machine of our [guide](../guides/atomics.md) run backward. Six shaders in all, and the page has a menu to switch. After one step, 1/60 s, both ways find the same neighbours: 115 546 entries in the lists of 20 000 particles, and the same total when the numbers of the two particles of every entry are multiplied and added up, whatever their order.

**The table.** The book still keeps a count and a start for every cell of the grid, and since [chapter 035](./035-the-grid-stays-still.md) the grid of the page with the box that tilts has 3.9 million cells, almost all empty. *Spatial hashing* gives the book a fixed number of slots instead, about two per particle. A cell's three coordinates are scrambled into one number with three large primes, a *hash*, and the remainder of its division by the number of slots says which slot. Two cells far apart can land in the same slot, so whoever reads a slot checks which cell each particle is really in. Space no longer has a border, so the grid need not hold the box. The neighbours are again the same.

With 50 000 particles, two runs of each way, one after the other and then again, since the GPU slows as it warms:

| | 4 places per cell | Address book, grid | Address book, table |
| --- | --- | --- | --- |
| the corner, a step | 12.7 and 13.9 ms | 21.8 and 8.5 ms | 17.2 and 17.5 ms |
| the corner, left out | 2 241 and 2 042 | 0 | 0 |
| level box, a step | 8.4 and 6.2 ms | 7.0 and 9.7 ms | 13.0 and 10.5 ms |
| memory to find neighbours, page that tilts | about 78 MB | about 31 MB | about 1 MB |

### What surprised us

**The table is not faster.** It skips the sum over millions of empty cells, yet in the level box it took longer in both runs, 13.0 and 10.5 ms against 8.4 and 6.2 for the 4 places, whose own two runs differ by a third. Claude's guess, not measured: cells that are neighbours in space land in slots far apart in memory, and the GPU reads memory best in a row. Teschner and others, who proposed the hash in 2003, were after memory, not speed.

**A pile that rested.** The 8.5 ms of the book's second run is not a faster book. That pile had come to rest, so the lists of neighbours were not made again ([decision 016](../decisions/016-a-list-made-when-needed.md)). In the other runs something was still moving.

**The numbers are rough.** Single runs in Chrome without a window, on an M1 that slows down as it warms. At 100 000 the page runs at about 10 frames per second, so when we read the numbers, after 16 s, the cube the particles start in was still falling over: the 23 749 were counted during the collapse.

## What we take away

- Four places per cell lose particles in a pile under pressure, and a counter shows it. That overlapping spheres are the cause is our reading.
- An address book has no limit per cell, at the price of a prefix sum over every cell.
- A prefix sum on a GPU is made in blocks: sum each block, scan the sums, then walk each block.
- A hashed table makes memory follow the particles, not the space, and its steps took longer in the level box.

## Open questions

- Which of the three for the engine. Decision 016 chose the first.
- Would the table read faster with slots that keep nearby cells close in memory?
- A phone, where memory is tighter and everything is slower.

## Sources

- Matthias Teschner, Bruno Heidelberger, Matthias Müller, Danat Pomeranets and Markus Gross, [Optimized Spatial Hashing for Collision Detection of Deformable Objects](https://matthias-research.github.io/pages/publications/tetraederCollision.pdf), 2003: section 4.1, the hash and its three primes.
- Simon Green, [Particle Simulation using CUDA](https://developer.download.nvidia.com/assets/cuda/files/particles.pdf), NVIDIA, 2010: the two ways to keep a grid, read in chapter 024.
- Our pages, [examples/heap-simulation](../../examples/heap-simulation/main.ts) and its `book-*.wgsl` and `cells-*.wgsl` shaders: every number of this chapter.

## Next step

Choose how the engine keeps its grid, with more runs and a phone.
