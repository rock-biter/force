# 054 · Without the Lists

*November 25, 2026 · 2 min read*

**In short:** the live pages no longer keep a list of neighbours for each particle. Every round reads the cells around a particle, in order. 300 lines of the page are gone, two buffers are free, and a step takes about the same.

## The story

**The decision.** "At this point I would take the lists out," the user said, once the step without lists worked with sizes too ([chapter 053](./053-in-order-by-default.md)). It is [decision 034](../decisions/034-no-lists-of-neighbours.md), and it replaces the lists of [decision 016](../decisions/016-a-list-made-when-needed.md), chosen five days and twenty-four chapters ago, when a search through the cells was most of a step.

**What went.** From the page: the shader that made the lists and the one that watched how far the particles had moved, to know when to make them again; the lists themselves, 128 bytes per particle, and the *anchors*, where each particle was when its list was made, 16 more; the flag that asked for new lists, cleared and raised at every substep. And what leaned on them: the grid with 4 places per cell, which had no other way to find neighbours and was already set aside by the table, the counters "list full" and "new lists" of the panel, and `?check`, which compared two ways of making the same lists. The page lost 300 lines and gained 116.

**What stays.** The files. [book-list.wgsl](../../examples/heap-simulation/book-list.wgsl) and [round-push.wgsl](../../examples/heap-simulation/round-push.wgsl) are what the benchmark page runs on people's devices, and the user's rule holds: the benchmarks do not change until they are closed. They sit in the folder, with a line at the top of the page's code to say why. The three copies with sizes of chapter 049, lived one day, are deleted.

**A step now.** Predict, make the address book, move the particles into its order, the levels, three rounds, finish. Twice. On our Mac M1, 100 000 particles with friction, one run each:

| A step | ms | Pairs deeper than 1 cm |
| --- | --- | --- |
| In the table, the default | 10.5 | 7 |
| On a grid | 7.4 | 9 |
| With sizes 2 to 1, in the table | 12.3 | 48, by a tenth of the smaller radius |
| In the table, not in order (`?sorted=off`) | 17.5 | 6 |

The last line is why the order had to come first.

## What we take away

- A decision is right for the engine it was made in. Order changed what a search costs, and the lists went from the best idea to dead weight.
- What we remove frees more than what we add: two buffers, 144 bytes per particle, and the limit of 32 neighbours that held sizes at 2 to 1.
- Code that others measure cannot be tidied away. It can be left, and labelled.

## Open questions

- With no limit of 32, how far apart can sizes be now? Chapter 048 found a second limit behind it: a heavy sphere on light ones.
- How far a particle may move during the rounds before the cells are stale.
- A phone.

## Sources

- The page's code, [main.ts](../../examples/heap-simulation/main.ts), with `?profile=60`, and the chapters 050 to 053 for the comparisons.

## Next step

The user's choice: try sizes beyond 2 to 1, or go on to the springs with the buffers now free.
