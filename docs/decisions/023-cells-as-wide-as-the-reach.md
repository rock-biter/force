# 023 · Cells as wide as the lists reach

*Accepted · November 23, 2026 · The user, after timing every shader of a step ([chapter 038](../logbook/038-one-hundred-twenty-five-cells.md))*

**Decision:** we will make a cell as wide as the distance the lists of neighbours look at, a particle's diameter plus the margin, so that a particle reads the 3 × 3 × 3 cells around it. A world is created with the size of its particles, and the engine works out the cell from it.

This supersedes the cell width of [decision 016](./016-a-list-made-when-needed.md), one diameter. The rest of 016 stays: the list of up to 32 neighbours, its 5 cm margin, and when it is made again.

## Why

A neighbour can be as far as the lists look: 25 cm, for particles 20 cm wide and a margin of 5. With cells of 20 cm that is two cells away, so each particle read 5 × 5 × 5 = 125 cells, not the 27 our pages wrote about. The shader that makes the lists was the largest part of a step. With 50 000 particles in the level box, kept in the hashed table of [chapter 036](../logbook/036-the-address-book.md), on our M1:

| Cell | Lists look at | Cells read | The lists | A step | Pairs more than 1 cm into each other |
| --- | --- | --- | --- | --- | --- |
| 20 cm | 25 cm | 125 | 8.6 ms | 12.3 ms | 48 |
| 20 cm | 20 cm, no margin | 27 | 2.3 ms | 3.9 ms | 9 291 |
| **25 cm** | **25 cm** | **27** | **2.6 ms** | **6.3 ms** | **41 and 46, in two runs** |

## Not chosen

- **A cell one diameter wide, and 125 cells:** the same lists, at twice the time of a step.
- **No margin**, the user's first idea, to keep the cell as wide as a particle: the fastest, but particles end up inside each other: the deepest pair overlaps by 17 cm, and a particle is 20 cm wide. A list that looks no further than touching misses the pairs that the pushes of a step bring together.

## Consequences

- The width of a cell is no longer the size of a particle: it follows the diameter and the margin.
- A cell of 25 cm has almost twice the volume of one of 20, so it holds more particles. With 4 places per cell, 451 of 50 000 were left out each time the lists were made, in a box where none was before ([chapter 039](../logbook/039-far-apart-in-memory.md)). The address book has no such limit. So the 4 places keep cells one diameter wide, and read 125 of them: the user's rule.
- Our pages use cells of 25 cm since [chapter 040](../logbook/040-the-table.md), and of 20 cm with `?narrow` in the address.

## Still open

- Which of the three ways keeps the cells: settled by [decision 024](./024-cells-in-a-hashed-table.md), the address book on a table.
- Particles of different sizes in one world, and all of this on a phone.

## Revisit if

- The margin changes much, or a world holds particles of very different sizes.
