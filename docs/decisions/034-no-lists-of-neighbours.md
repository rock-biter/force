# 034 · No lists of neighbours: every round reads the cells

*Accepted · November 25, 2026 · The user, after timing a step with and without the lists, with one size and with several, on a grid and in the table (chapters [050](../logbook/050-the-price-of-remembering.md), [051](../logbook/051-read-once.md) and [053](../logbook/053-in-order-by-default.md)). Supersedes the lists of [016](./016-a-list-made-when-needed.md)*

**Decision:** we will no longer keep a list of neighbours for each particle. The levels of the pile and every round look into the 3 × 3 × 3 cells around a particle themselves, with the particles kept in the order of their cells ([decision 033](./033-particles-in-order-by-default.md)). The address book is made again at every substep.

## Why

The lists saved a search that was costly. With the particles in order the search is cheap, and the lists save almost nothing: at 100 000 particles on our Mac M1 a step without them takes 10.3 ms against 12.0 in the table, and 7.2 against 7.5 on a grid for a pile; with sizes, 12.1 against 15.1 in the table. Only a liquid on a grid was slower, 6.5 against 5.5. What they cost stays: two buffers of the 8 a shader can read, 144 bytes per particle, a shader to watch how far particles move, and a limit of 32 neighbours, which held sizes at 2 to 1. The buffers are wanted for springs and for what comes after.

## Not chosen

- **Keeping the lists:** a little faster in one case of four, and the buffers stay taken.
- **Lists at every substep with no margin:** they miss the pairs that meet during the rounds, 11 162 deep pairs in a pile.
- **Lists on a grid, none in the table:** two ways to keep in step for less than a millisecond.

## Consequences

- In a table a slot shared by two of the 27 cells is read once (chapter 051): no particle is asked which cell it is in, since it has moved since the cells were filed.
- A cell is 5 cm wider than the largest particle, the old margin of the lists: the room a particle has to move during the rounds before it is looked for in the wrong cell.
- With sizes the particles must be in order: a round then reads 8 storage buffers, and the book would be the ninth.
- The live pages lose the 4 places per cell, which needed the lists, the counters "list full" and "new lists", and `?check`.
- The shaders with lists stay in the repo, unused by the live pages: the benchmark page times them, and must not change until the benchmarks are closed.

## Still open

- How far a particle can move during the rounds before a contact is missed, and whether cells as wide as a particle, the fastest, are safe.
- A phone. All of this is one Mac.

## Revisit if

- A device shows the search costing much more than it does here.
- The rounds per substep grow: every round pays the search.
