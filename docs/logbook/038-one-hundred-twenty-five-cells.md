# 038 · One Hundred Twenty-Five Cells

*November 23, 2026 · 4 min read*

**In short:** we timed every shader of a step to see why the hashed table was slow. The time was in making the lists of neighbours, and the reason was not the table: every particle read 125 cells, not the 27 we believed. Cells as wide as the lists look bring it back to 27, and halve a step.

## The story

To find which particles touch, FORCE cuts space into cells and each particle looks into the cells around its own. We have three ways to store who is in a cell ([chapter 036](./036-the-address-book.md)): 4 places per cell; an *address book*, one list of all the particles sorted by cell, with a row of memory for every cell of the grid; and the same book with a *hashed table*, a few rows shared by all the cells. The user leans to the table, whose memory follows the particles and not the size of the world ([chapter 037](./037-the-lonely-thread.md)). But its steps were the slowest of the three, and we did not know why.

**A clock for every shader.** A step of the simulation, 1/60 s of it, is about ten shaders, programs run on the GPU one after the other. Our [live page](../../examples/force-plus/main.ts) timed a step as a whole. With `?profile` in its address it now puts every shader in a compute pass of its own, between two readings of the GPU's clock ([guide](../guides/timestamp-queries.md)), for 120 steps after the first 600, and writes the averages. With 50 000 particles in a box with a level floor, in ms per step:

| Shader | 4 places per cell | Address book, grid | Address book, table |
| --- | --- | --- | --- |
| makes the lists of neighbours | 3.0 | 3.8 | 8.7 |
| the 6 rounds of pushes | 2.7 | 2.7 | 2.7 |
| the running sum the book needs | none | 0.6 | 0.2 |
| all the others | 0.9 | 0.8 | 0.7 |
| a step | 6.6 | 7.9 | 12.3 |

The table's extra time is all in one shader: the one where each particle reads the cells around it and writes down, in a list, the particles close enough to touch it soon.

**A guess that failed.** To find a cell's row in the table, that shader ends with the remainder of a division, and whole-number division is slow on a GPU. Claude, the AI assistant we study with, replaced it with a bit mask, which costs almost nothing. Two runs gave 8.8 and 7.9 ms, against 8.9 and 8.7 before: no more than two equal runs differ by. The shader went back as it was.

**The question.** Then the user asked: "the grid checks an area of 3 × 3, and the other two 5 × 5?" No: all three read 5 × 5 × 5 cells, 125. And that was the news. [Chapter 024](./024-twenty-seven-cells.md) had the rule: cells as wide as a particle, 20 cm, so whoever touches it is in the 27 cells around. But since [chapter 030](./030-the-lazy-list.md) the lists look 5 cm beyond touching, a *margin* that lets a list last more than one step. A neighbour 25 cm away can be two cells away, so the code read two cells each way. Our chapters, [decision 016](../decisions/016-a-list-made-when-needed.md) and the comments of the shader went on saying 27. "But in papers and other engines it is 3 × 3," the user said. In Simon Green's particles for NVIDIA, which we had read, yes: he looks no further than touching.

**The user's way, and another.** The user wanted 27 cells without widening the cell: look only as far as touching, 20 cm, with no margin. Claude warned that the lists would then be made again at every step, and tried it, next to its own proposal: keep the margin and make the cell as wide as the lists look, 25 cm. The particles stay 20 cm wide. With the table, in the level box, from new runs (41 and 46 are two of them):

| Cell | Lists look at | Cells read | The lists | A step | Pairs more than 1 cm into each other | The deepest |
| --- | --- | --- | --- | --- | --- | --- |
| 20 cm | 25 cm | 125 | 8.6 ms | 12.3 ms | 48 | 2.1 cm |
| 20 cm | 20 cm | 27 | 2.3 ms | 3.9 ms | 9 291 | 17.1 cm |
| 25 cm | 25 cm | 27 | 2.6 ms | 6.3 ms | 41 and 46 | 1.7 and 2.7 cm |

Without a margin the step is the fastest, also because shorter lists make the pushes cheaper, and the pile is ruined: pairs almost on top of each other. With 4 places per cell it is much the same, 8 201 pairs. With wide cells the step halves, the depths stay as they were, and at the first step the lists hold the same 115 546 neighbours. On our other page, where the box is tilted and the particles pile up in a corner, a step went from 16.1 to 9.0 ms. The user chose wide cells, worked out by the engine from the size of the particles ([decision 023](../decisions/023-cells-as-wide-as-the-reach.md)).

### What surprised us

**The first run without a margin was too good.** A step took 0.6 ms. The lists were never made again: with a margin of zero the shader that decides when to make them again does nothing, by an old rule of ours, so particles did not see each other at all. The page now asks for a list at every step when there is no margin.

**Why no margin fails.** Claude's reading, not tested further: the list is made once, at the start of a step. Then six rounds of pushes move the particles, and one pushed away from a neighbour can land on a particle that was 21 cm away, and so in no list. The margin is what lets them see each other.

**Not the whole answer.** "This does not explain why the table took longer, if all three searched 5 × 5 × 5," the user said. Right: with 125 cells for all, its lists took 8.7 ms against 3.0 and 3.8. Wide cells make a step faster. Why the table was the slowest is for [chapter 039](./039-far-apart-in-memory.md).

## What we take away

- Time every shader alone before guessing: one of ten held 70% of the step.
- A cell must be as wide as the distance you search, not as a particle. They were the same only until the margin came.
- The margin is not a luxury: without it the pushes of a step bring together pairs no list knows.
- We had it wrong since chapter 030: 125 cells, written as 27. A question from the user found it.

## Open questions

- The corner under pressure: 17 000 to 20 000 pairs deeper than 1 cm, with either cell. Still the problem of [chapter 036](./036-the-address-book.md).
- A phone. And the scene of the corner comes to rest in some runs and not in others: it needs a steadier moment to measure.

## Sources

- Our page, [examples/force-plus](../../examples/force-plus/main.ts), with `?profile`, `?margin=0` and `?wide`: every number of this chapter, from runs in Chrome without a window on a Mac M1.
- Simon Green, [Particle Simulation using CUDA](https://developer.download.nvidia.com/assets/cuda/files/particles.pdf), NVIDIA, 2010: the 27 cells, read in chapter 024.

## Next step

Time the three ways again, all with wide cells, and find why the table reads slower.
