# 050 · The Price of Remembering

*November 25, 2026 · 3 min read*

**In short:** are the lists of neighbours still worth their buffers? With the particles in random order, yes, by far. With the particles kept in the order of their cells, almost nothing: a step without lists takes about the same, and gives back two buffers, 144 bytes per particle and the limit of 32 neighbours.

## The story

**The question.** "Several buffers are used to cache the list of neighbours, right?" the user asked after [chapter 049](./049-a-radius-each.md). "I would like to know if we still need it. Particles will need a buffer for springs, and more." Three of them: the lists, 32 neighbours per particle; the *anchors*, where each particle was when its list was made; and the counters that say when to make the lists again. We chose them in [chapter 030](./030-the-lazy-list.md), when a step was 8 rounds over a grid with 4 places per cell. Since then: an address book, wider cells, particles that can be kept in the order of their cells ([chapter 041](./041-next-to-each-other.md)), and 3 rounds in each of 2 substeps.

**The other way.** A list saves a search: without it, the levels of the pile and every round look into the 3 × 3 × 3 cells around each particle themselves. We wrote that, [round-cells.wgsl](../../examples/heap-simulation/round-cells.wgsl), behind `?lists=off` on the live page. The book of cells is then made at every substep, and nothing is remembered from one to the next.

**The measure.** 100 000 particles, the book on a grid, the GPU time of each shader over 60 steps, on our Mac M1. A pile with friction, still settling, where the lists are made again at every substep, and a liquid, where they last about two. A step, in ms, and the pairs deeper than 1 cm:

| | Pile, a step | Deep | Liquid, a step | Deep |
| --- | --- | --- | --- | --- |
| Lists, as today | 12.8 | 10 | 11.7 | 7 |
| Lists at every substep, no margin | 8.3 | 11 162 | 10.0 | 1 402 |
| No lists | 19.0 | 11 | 28.6 | 4 |
| No lists, cells as wide as a particle | 15.9 | 2 | 23.0 | 6 |
| **In order:** lists | 7.5 | 9 | 5.5 | 8 |
| **In order:** no lists | 7.2 | 15 | 6.5 | 3 |
| **In order:** no lists, cells as wide as a particle | 6.4 | 8 | 5.8 | 10 |

The three lines in order were run three times: no time moved by more than 0.3 ms.

**Random order: the lists win.** A search costs about 4 ms, and without lists it is paid 8 times a step, not twice. Even in the pile, where a list never lasts, a step is a third shorter with them.

**In order: a draw.** When the particles of a cell sit next to each other in memory, the search itself is cheap: a round over the cells takes 0.6 ms where it took 2.2. Without lists the pile is a little faster, the liquid a little slower, within 1 ms on 100 000 particles.

### What surprised us

**A list with no margin is wrong, not slow.** Made from where the particles are when the substep begins, it misses the pairs that meet during the rounds: 11 162 deep pairs. The margin is not only there to make a list last.

**The order matters more than the lists.** Keeping the particles in order takes the pile from 12.8 to 7.5 ms. It is not on by default on the live page.

## What we take away

- A cache saves what it does not repeat. Make the repeated thing cheap, and the cache has little left to save.
- Without lists: no lists and no anchors, 144 bytes per particle, 144 MB at a million; no shader to watch the moves; and no limit of 32 neighbours, which stopped sizes at 2 to 1.
- In order, a round needs no book either: it reads 7 storage buffers, 8 with the properties.

## Open questions

- Only a grid was tried. In a table two cells can share a slot, and telling them apart needs where a particle was filed.
- The properties do not move with the particles yet, so sizes and order do not go together.
- A phone, and other numbers of particles. One Mac is one device.

## Sources

- The live page with `?lists=off`, `?sorted`, `?margin=0` and `?profile=60` ([main.ts](../../examples/heap-simulation/main.ts)), [round-cells.wgsl](../../examples/heap-simulation/round-cells.wgsl) and [levels-cells.wgsl](../../examples/heap-simulation/levels-cells.wgsl).
- [Decision 016](../decisions/016-a-list-made-when-needed.md), which chose the lists.

## Next step

The user's choice: keep the lists, or go toward particles in order and no lists.
