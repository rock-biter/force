# 042 · No Best Way

*November 23, 2026 · 4 min read*

**In short:** the user asked for the Z-order curve, then changed the question: not which way to keep the cells is best, but what in a project makes one better than another. A script now runs our shaders on fixed scenes, one thing changing at a time, and a page draws what it found.

## The story

To find which particles touch, FORCE cuts space into cells and keeps the particles of each cell in an *address book*, one list sorted by cell. The book is filed on a grid, a row of memory for every cell of the world, or in a *hashed table*, a few rows called slots, where a formula, the hash, gives each cell its slot. [Chapter 041](./041-next-to-each-other.md) moved the particles themselves into the order of the book, and found that the pushes then took half the time on a grid and no less in our table.

**The Z-order curve.** Claude, the AI assistant we study with, proposed a hash that keeps blocks of cells together. "And trying the Z-order curve instead?" the user asked. It is the numbering Simon Green names in the paper we follow: weave the bits of a cell's x, y and z into one number, and cells close in space along all three axes get numbers close to each other. Taken as the hash, it gave the table the speed of the grid at 100 000 particles on our [live page](../../examples/heap-simulation/main.ts): 6.9 ms a step against 9.1, three runs each. With 50 000 it was the slowest hash. A table has fewer slots than space has cells, so the curve covers a cube of cells and then repeats: cells 16 m apart shared a slot, in a box 24 m wide. Blocks of 8 × 8 × 8 cells in Z-order, scattered over the table, never lost.

**A different question.** Then the user set the goal: "not to find the best method in every scenario, but to let a project use the best one for it." Which parameters make one way win, with data, and tables and charts to read them from. No engine code yet: that waits for rigid bodies, cloth and fluids.

**Scenes that stand still.** The live page was the wrong tool: 600 steps before each measure, and a pile that differs from run to run. So a [script](../topics/cells-study.mjs) builds fixed scenes of particles at rest, numbered in random order, and times our own shaders on them: making the book, making the lists of neighbours, one round of pushes. A step is the first two and six rounds. It changes one thing at a time, 174 rows in all, and a [page of charts](../../examples/cells-study/index.html) draws them. With 100 000 particles, in ms per step:

| What changes | What happens |
| --- | --- |
| particles, 10 000 to 300 000 | in the order of the book a step grows in line: 0.5 to 10.8 on a grid. In random order 0.5 to 51 |
| the world, 100 heaps in a cube of 20 m to 1 280 m | a table with Z-order or blocks stays at 3.5 to 4.2, with 2 MB. The grid: 3.8 at 20 m, 12 and 32 MB at 40 m, too large from 80 m |
| the block of the hash, 2 to 32 cells a side | 4.6, 4.2, 3.7, 3.7, 3.5: larger is better. Rows together 4.5, Z-order 3.8, the grid 2.9 |
| a beam along x, y or z | rows together: 4.8, 5.2, 4.7. Z-order pays in the lists: the beam is longer than its cube |
| slots per particle, 1 to 8 | no way gets faster. The scattered hash goes from 6.0 to 8.9 |
| the width of a cell, 25 to 50 cm | flat up to 37.5 cm; at 50 the lists take twice as long |

### What surprised us

**The first numbers lied about the blocks.** With one run per row the sizes of the blocks came out in no order, from 3.4 to 5.4 ms. Three runs of the whole sweep, and four times the repeats of a round, put them in line: every step up in size is a little faster, on all five scenes.

**Z-order is the largest block.** A block as large as the table is the Z-order curve alone. That is why it wins where the scene fits in its cube and loses where it does not, and blocks of 32 are as fast without that weak point.

**Past 32 cells a block gains nothing.** Blocks of 64 need scenes of 300 000 particles and more, since one is as large as the whole table of 100 000. On layers they were level with 32: 9.9 ms both at 300 000, 32.3 and 32.9 at a million. On a beam 234 m long they lost, 11.0 against 9.5: the table held 4 such blocks and the beam crossed 15, all piled on the same slots. A block of 128 was the Z-order curve again, to the tenth of a millisecond, which checked the measure. And at a million particles the grid's lead was gone: 31.8 ms against 32.3.

**The axis does not matter.** The user had asked whether keeping rows along x together would hurt a scene laid along another axis. It does not: every particle reads the same 27 cells whatever the scene's shape. Rows together is simply the slowest of the hashes that keep anything together.

## What we take away

- Keep the particles in the order of their cells, always: the more particles, the more it saves.
- The size of the world chooses between grid and table. A grid is a fifth faster in a small, full world, and impossible in a large one.
- In a table, keep blocks of cells together, as large as 32 a side and small enough for the table to hold many. One or two slots per particle are enough.
- One run is not a measure: repeat the sweep, and draw the range.

## Open questions

- These are hypotheses from one Mac M1 and particles that stand still. A phone and moving scenes may move the crossings.
- How the engine picks by itself: from the size of the world, if the developer gives one? Not designed.
- [Decision 024](../decisions/024-cells-in-a-hashed-table.md) chose the hash that keeps rows together, the slowest here. The page still runs it. To settle with the engine.
- 4 places per cell with the particles in order: not tried.

## Sources

- Simon Green, [Particle Simulation using CUDA](https://developer.download.nvidia.com/assets/cuda/files/particles.pdf), NVIDIA, 2010: the Z-order curve as a hash.
- Our script, [docs/topics/cells-study.mjs](../topics/cells-study.mjs), its [numbers](../topics/cells-study.json) and the [page](../../examples/cells-study/index.html) that draws them. The numbers of the live page are from [examples/heap-simulation](../../examples/heap-simulation/main.ts) with `?sorted` and `?hash=zorder` or `?hash=blocks`.

## Next step

The same sweeps on a phone, or back to the route: the user chooses.
