# 039 · Far Apart in Memory

*November 23, 2026 · 3 min read*

**In short:** of our three ways to store which particles are in each cell of space, the one with a hashed table was the slowest, even when all three read the same cells. Two tries say why: cells that are neighbours in space sit far apart in its memory. With wider cells the gap almost closes, and both ways with a list become as fast as the simplest one, which cannot use wide cells.

## The story

Each particle keeps a list of its neighbours, the particles closer than 25 cm: a particle is 20 cm wide, and the list looks 5 cm further. To write it, the particle reads the cells of space around its own. [Chapter 038](./038-one-hundred-twenty-five-cells.md) found that with cells of 20 cm those are 125, and made the cells 25 cm wide, as far as the lists look, so that 27 are enough. The user was not done: "this does not explain why the table took more time than the other two, if they all searched 5 × 5 × 5. Let's compare the three ways again."

The three ways store who is in each cell of space ([chapter 036](./036-the-address-book.md)). *4 places*: every cell has 4 places for particles. *Book on a grid*: one list of all the particles sorted by cell, and a row of memory for every cell of the grid, in the order of the cells. *Book on a table*: the same list, but only a few rows, called slots, two per particle; a formula, the *hash*, scrambles a cell's three coordinates into the number of its slot.

**The same cells for all.** With cells of 20 cm, 125 read by every particle, and 50 000 particles in the box with a level floor, making the lists took 3.0 ms with the 4 places, 3.8 with the book on a grid and 8.4 with the table. So the table was the slowest by itself, whatever the cells.

**Wide cells, but not for the 4 places.** `?wide` on our [live page](../../examples/force-plus/main.ts) gives cells of 25 cm, as wide as the lists look ([decision 023](../decisions/023-cells-as-wide-as-the-reach.md)). With the 4 places that fails: a cell of 25 cm holds more than 4 particles, 451 found no place each time the lists were made, and the deepest pair overlapped by 18.6 cm, with particles 20 cm wide. "Obviously," the user said: "with 4 places the cell must stay as wide as the particle, and the comparison must be made that way." So: 4 places with cells of 20 cm, the two books with cells of 25. A step of 1/60 s, in ms:

| | 4 places, cells of 20 cm | Book on a grid, 25 cm | Book on a table, 25 cm |
| --- | --- | --- | --- |
| level box, 50 000: the lists | 2.8 to 3.3 | 1.7 to 1.9 | 2.6 to 2.7 |
| the same: a step, 3 runs | 6.3 to 6.8 | 5.7 to 6.0 | 6.2 to 6.5 |
| level box, 100 000: a step, 1 run | 17.6 | 12.0 | 15.6 |
| corner of the tilted box, 50 000: a step, 2 runs | 11.0 and 10.7 | 10.4 and 10.7 | 8.8 and 8.9 |
| the same: left out of a full cell, each time | 1 491 and 1 967 | 0 | 0 |

The corner is our other page, where the box is tilted by 30° and −20° and the particles pile up under pressure. The two books are now as fast as the 4 places or faster, and lose no particle. The grid wins in the level box, the table in the corner, where the grid of the box that tilts is large and almost empty, and its running sum costs.

**Two tries on the table.** Claude, the AI assistant we study with, had two guesses left for the table's extra time. Each became an option of the page, and each was checked first: all find the same 115 546 neighbours.

| The lists, in ms | Cells of 20 cm | Cells of 25 cm |
| --- | --- | --- |
| the table as it is, 2 slots per particle | 8.4 | 2.7 |
| 8 slots per particle | 10.2 | 3.0 |
| rows of cells kept together | 5.0 | 2.4 |

*Shared slots.* Two cells can land in the same slot, and then a particle reads the particles of both and throws half away. With four times the slots that happens less, so the lists should be faster. They were slower. So it is not the sharing.

*Far apart.* On a grid, the cell to the right of a cell is the next row in memory. In the table the hash sends it anywhere. So the second try changes the hash: it scrambles only the y and z of a cell, and then adds its x. Cells in a row along x, which differ only in x, get slots next to each other, as on a grid. The lists went from 8.4 to 5.0 ms.

Both tries point the same way. A larger table is slower, and a table whose neighbours stay close is faster: what costs is how far apart in memory the cells a particle reads are. It is what a texture does in a shader: reading the texel next to the last one is cheap, reading texels all over it is not. Why a GPU reads close memory faster we have not studied: caches, Claude says, from memory and without a source.

### What surprised us

**More slots, slower.** We expected fewer shared slots to help at least a little. A table four times as large lost 20% with narrow cells, and 10% with wide ones.

**Wide cells hide the problem, until the particles are many.** With 27 cells there are fewer jumps to make, so at 50 000 keeping rows together saves 0.3 ms, and two runs of the same thing can differ by that much. At 100 000 the table is twice as large and the jumps are back. Two runs each: the lists took 7.9 and 7.7 ms with the table as it is, 4.3 and 4.3 with rows kept together, 3.8 and 3.8 with the book on a grid. A step: 16.0 and 15.8, then 12.3 and 12.2, against 12.0 and 11.9. All three find the same 586 106 neighbours at the first step.

**Few runs.** Every number is from one to three runs in Chrome without a window on a Mac M1, the two tries from one. Differences of a few tenths of a ms mean little yet.

## What we take away

- The table was slower because its cells are scattered in memory, not because cells share slots.
- More memory can make a GPU program slower: what counts is how close together the things read are. A hash can keep some of them close.
- Wide cells are for the two books. The 4 places need cells as wide as a particle, and then read 125 of them.
- Compared that way, the books are as fast as the 4 places or faster, and lose no particle.
- A guess is tested by an option in the page's address and one table, not by reasoning: of three guesses, counting the division of chapter 038, two were wrong.

## Open questions

- Keep rows together in the table for good? We did not look at how it spreads the cells over the slots.
- Book on a grid or on a table: each won a scene, and with rows kept together the table is 0.3 ms from the grid at 100 000.
- Rows kept together in the corner of the tilted box, and all of this on a phone.

## Sources

- Our page, [examples/force-plus](../../examples/force-plus/main.ts), with `?profile`, `?wide`, `?slots=8` and `?hash=rows`: every number of this chapter.

## Next step

Choose how the engine keeps its cells, between the two books, and make wide cells the way of the page. The options named here changed in [chapter 040](./040-the-table.md): wide cells and rows kept together are now what the page does, and `?narrow` and `?hash=scattered` bring the old ones back.
