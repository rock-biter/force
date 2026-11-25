# 053 · In Order by Default

*November 25, 2026 · 2 min read*

**In short:** the particles are now kept in the order of their cells on every page, without being asked. And a step with no lists of neighbours works with sizes too: faster than the lists in the table, a little slower on a grid.

## The story

**A default that was not one.** "I thought the order was already the default with the tables," the user said, "but it seems not." It was not: since [chapter 041](./041-next-to-each-other.md) the particles were kept in order only with `?sorted` in the address. Every page people opened ran the slow way. Now it is the other way round, and `?sorted=off` is for comparing ([decision 033](../decisions/033-particles-in-order-by-default.md)). The benchmark page has its own code and still measures both.

**No lists, with sizes.** The user wants the lists of neighbours gone, after [chapter 051](./051-read-once.md), but first the same step for particles of different sizes. Two more copies, [round-cells-sized.wgsl](../../examples/mixed-sizes/round-cells-sized.wgsl) and its levels: the search through the cells of chapter 050, with each pair touching at the sum of its two radii.

**Counting to 8 again.** A round with no lists reads two buffers of positions, the counts and the starts of the cells, the planes, the levels, where each particle began the substep, and the properties: 8 storage buffers. The book would be the ninth. In order no book is needed, row 7 is particle 7, so with sizes and no lists the order is not a choice.

**Checking with sizes.** The page's count of deep overlaps assumed one diameter. It now reads the properties back with the positions, in one copy, since in order the rows change from one substep to the next. Deep means by more than a tenth of the smaller radius.

**The measure.** The page with sizes, 100 000 particles with friction, 2 to 1, in order, on our Mac M1, one run each. A step, in ms:

| | In the table | Deep | On a grid | Deep |
| --- | --- | --- | --- | --- |
| Lists | 15.1 | 40 | 9.3 | 53 |
| No lists | 12.1 | 46 | 10.0 | 56 |
| No lists, cells as wide as the largest | 11.0 | 52 | 9.3 | 54 |

Of 260 000 pairs that touch, about 50 are deep in every line. As with one size: without lists the table gains, a fifth here, and the grid loses a little.

## What we take away

- Check what the default is, not what we remember it to be.
- The limit of 8 buffers decided a design choice again: with sizes and no lists, particles must be in order.
- Three scenes now agree: without lists, a win in the table and about a draw on a grid.

## Open questions

- The lists are still there. Taking them out, with the shaders that make and watch them, is the next step, and its decision replaces 016.
- Still one Mac. A phone may read memory differently.

## Sources

- The page with sizes and `?lists=off&profile=60` ([main.ts](../../examples/heap-simulation/main.ts), `IN_ORDER` and `overlaps`).

## Next step

Take the lists of neighbours out, if the user confirms.
