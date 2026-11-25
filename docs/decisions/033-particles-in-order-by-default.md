# 033 · Particles in the order of their cells, by default

*Accepted · November 25, 2026 · The user, after three chapters of timings ([050](../logbook/050-the-price-of-remembering.md) to [053](../logbook/053-in-order-by-default.md))*

**Decision:** we will keep the particles in the order of the address book whenever there is a book, without being asked. `?sorted=off` in the address turns it off, to compare.

## Why

In order, the particles of a cell sit next to each other in memory, and every search through the cells reads less scattered memory ([chapter 041](../logbook/041-next-to-each-other.md)). Since then it was only on with `?sorted` in the address: the user believed it was the default with the table, and it was not. Measured on our Mac M1 with 100 000 particles: a pile takes 7.5 ms a step in order and 12.8 without (chapter 050); with sizes, 13.2 ms against 24.9 ([chapter 052](../logbook/052-what-follows-a-particle.md)).

## Not chosen

- **Leaving it to the address:** nobody who opens a page gets the faster way.
- **A switch in the panel:** one more control for a choice with no reason to pick the slow side.

## Consequences

- A particle's number changes from one substep to the next: what belongs to a particle must move with it. Its position, its level and, with sizes, its properties do. Whatever comes next, springs first, must too, or must name particles in another way.
- Whoever reads the positions twice cannot follow one particle between the two readings: the page's "at rest" measure is skipped in order.
- The move costs about 1 ms a step at 100 000 particles, when the book is made again.
- The benchmark page is not touched: it measures both ways, as before.

## Still open

- How springs will name the particles they join, if the numbers change.

## Revisit if

A device shows the move costing more than it saves.
