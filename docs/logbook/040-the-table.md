# 040 · The Table

*November 23, 2026 · 2 min read*

**In short:** one more try closed the question. With 100 000 particles, a hash that keeps the cells of a row together makes the hashed table as fast as the grid. The user chose it for the engine, and it is now what our pages run.

## The story

To find which particles touch, FORCE cuts space into cells and keeps, for each cell, the particles in it. [Chapter 039](./039-far-apart-in-memory.md) left two ways standing, both an *address book*, one list of all the particles sorted by cell. One files the cells on a grid, a row of memory for every cell of the world. The other files them in a *hashed table*, a few rows called slots, where a formula, the hash, says which slot a cell uses. The table needs 1 MB where the grid needs 31, and its space has no border. But at 100 000 particles its step took 15.6 ms against 12.0.

**The last try.** Chapter 039 had found the table's weak point: cells next to each other in space were far apart in memory. A hash that scrambles only a cell's y and z, and then adds its x, keeps the cells of a row along x in slots next to each other. With 50 000 particles it saved little. Claude, the AI assistant we study with, proposed to try it where the table was behind, and the user said yes. In the box with a level floor, 100 000 particles, two runs each, in ms:

| | Making the lists of neighbours | A step of 1/60 s |
| --- | --- | --- |
| the table, hash as it was | 7.9 and 7.7 | 16.0 and 15.8 |
| the table, rows kept together | 4.3 and 4.3 | 12.3 and 12.2 |
| the book on a grid | 3.8 and 3.8 | 12.0 and 11.9 |

All three find the same 586 106 neighbours at the first step. The table is 0.3 ms from the grid, 2% of a step.

**The choice.** Claude proposed the table with this hash, and the user took it ([decision 024](../decisions/024-cells-in-a-hashed-table.md)): as fast as the grid, and it does not pay for the size of the world, which was the user's point in [chapter 037](./037-the-lonely-thread.md). The [live page](../../examples/force-plus/main.ts) and the [one with a box that tilts](../../examples/force-tilt/index.html) now start that way, with cells 25 cm wide ([decision 023](../decisions/023-cells-as-wide-as-the-reach.md)). The other ways stay in the menu and in the address, for measuring.

Then the pages as they now start, with 50 000 particles, one run each. In the level box a step takes 6.1 ms. In the corner of the box tilted by 30° and −20° it takes 7.9 ms, and 9.0 with the old hash. Three days ago, in [chapter 036](./036-the-address-book.md), the same corner took 12.7 and 13.9 ms and left 2 000 particles out of their cells.

### What surprised us

**The same idea, weighed twice.** At 50 000 particles keeping rows together looked like noise, 0.3 ms. At 100 000 it was worth 3.7 ms. Had we stopped at the first scene, we would have dropped it.

## What we take away

- A try that changes little in one scene can decide another: measure where the problem is largest.
- The engine keeps its cells in a hashed table: no border, memory that follows the particles, and the speed of a grid.
- Three chapters ago we suspected the table's sum. It was the cells read, then the memory between them.

## Open questions

- A phone: none of this was run on one.
- The corner under pressure still has thousands of pairs deep into each other, with every way.

## Sources

- Our page, [examples/force-plus](../../examples/force-plus/main.ts), with `?profile`, `?cells=book` and `?hash=scattered`: every number of this chapter, in Chrome without a window on a Mac M1.

## Next step

Run the pages on the phone, with `?profile` if its browser has the GPU's clock.
