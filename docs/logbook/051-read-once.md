# 051 · Read Once

*November 25, 2026 · 2 min read*

**In short:** a step with no lists of neighbours works in the hashed table too, once we stop asking which cell a particle is in. With the particles in order it is faster than with the lists: 10.3 ms against 12.0 for a pile of 100 000.

## The story

**What was missing.** [Chapter 050](./050-the-price-of-remembering.md) tried a step without lists only on a grid, where every cell has a slot of its own. In the *table*, the cells of a space with no border share about two slots per particle, and two cells far apart can land in the same slot ([chapter 040](./040-the-table.md)). The shader that makes the lists tells their particles apart by asking each one: are you really in the cell I am reading?

**Why that fails here.** The cells are filed once, when the substep begins. Without lists every round reads them, and by the second round the particles have moved. One that crossed into the next cell is still filed under the old one: asked "are you in this cell?", it answers no, and nobody sees it.

**The way out.** The question was never needed for particles of a far cell: they are too far to touch, and the distance, which every round works out anyway, says so. The only harm of a shared slot is when two of the 27 cells a particle reads share one: its particles would be read twice, and push twice. So: read each slot once. If a cell has the slot of one already read, skip it.

**A first try, too slow.** For each of the 27 cells, work out the slots of the ones before it and compare: up to 351 slots per particle, at every round. A step took 31 ms where the grid took 7.

**Rare, so check that first.** Two of 27 cells share a slot for about one particle in a thousand (our estimate, with 262 144 slots). So the shader first works out the 27 slots once and compares every pair, 351 comparisons of numbers it already has, and only when two are equal does it go cell by cell. The text of those 351 comparisons is written by a loop in JavaScript: a shader's own array would be slow ([chapter 045](./045-a-million-and-one-pass.md)).

**The measure.** 100 000 particles kept in order, in the table, on our Mac M1, each line run twice with times within 0.2 ms. A step, in ms:

| In the table, in order | Pile | Liquid |
| --- | --- | --- |
| Lists, as today | 12.0 | 9.6 |
| No lists | 10.3 | 8.9 |
| No lists, cells as wide as a particle | 8.9 | 7.6 |

The pairs deeper than 1 cm stay between 3 and 18 in every line, as with the lists.

### What surprised us

**In the table the lists lose.** On a grid it was a draw. In the table, "in order" is the order of the slots, and the hash scatters the rows of cells: the neighbours in a list are then far apart in memory, and a round over the lists takes 6.9 ms where it takes 3.7 on a grid. Reading the slots themselves, three in a row, suffers less.

## What we take away

- Before fixing a test that fails, ask what it was for. Here the distance already did its job.
- A rare case deserves a cheap test in front of the costly one.
- Without lists, in order: a draw on a grid, a win in the table. Still one Mac, one count of particles.

## Open questions

- We compared times and deep pairs, not the neighbours themselves, one by one.
- Narrow cells were the fastest, but a particle that moves during the rounds is looked for where it was: how far can it go before it is missed?
- The properties must move with the particles before sizes can use any of this.

## Sources

- The live page with `?lists=off&sorted&cells=table&profile=60` ([main.ts](../../examples/heap-simulation/main.ts), `clashing` and `repeated`), and [round-cells.wgsl](../../examples/heap-simulation/round-cells.wgsl).

## Next step

The user's choice: make the properties follow the particles, or decide first whether the lists go.
