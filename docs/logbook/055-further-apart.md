# 055 · Further Apart

*November 25, 2026 · 2 min read*

**In short:** with the lists gone, we tried sizes beyond 2 to 1 on the GPU. With sizes spread evenly, up to 8 to 1 costs little and stays clean enough. With two sizes only, the hardest mix, 4 to 1 is four times slower and one pair in seven is deep. The limit is now 4 to 1.

## The story

**Why try again.** [Chapter 048](./048-big-and-small.md) stopped sizes at 2 to 1 for two reasons, one behind the other: lists of 32 neighbours that overflowed at 3 to 1, then a large sphere, heavy, sinking into small ones. The lists are gone ([chapter 054](./054-without-the-lists.md)): a particle now reads every neighbour its cells hold, however many. What is left of the second reason?

**The measure.** `?sizes=` in the address of the [page with sizes](../../examples/mixed-sizes/index.html) asked for more than the panel's 2, up to 8 while we measured. 100 000 particles of one material, with friction, radii spread evenly between the largest, 10 cm, and the smallest, after 5 seconds, on our Mac M1, one run each. Of about 250 000 pairs that touch, the *deep* ones overlap by more than a tenth of the smaller radius of the two, and *worst* is the deepest, as a share of that radius:

| Largest over smallest | A step, 2 substeps | Deep | Worst | A step, 3 substeps | Deep | Worst |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 14.1 ms | 43 | 19% | 21.1 ms | 3 | 16% |
| 3 | 16.7 ms | 554 | 29% | 26.1 ms | 45 | 19% |
| 4 | 17.6 ms | 1 359 | 38% | 27.2 ms | 160 | 27% |
| 6 | 17.9 ms | 1 411 | 41% | 29.2 ms | 259 | 30% |
| 8 | 17.2 ms | 464 | 31% | 24.6 ms | 110 | 31% |

**It does not break.** No explosion, no particle thrown, at any ratio. In meters the deepest overlap is the same everywhere, about 1 cm, as with one size. What changes is what 1 cm means: a tenth of a radius of 10 cm, more than a third of one of 2.5 cm.

**It does not cost.** From 14 to 18 ms. The cells are made for the largest particle and hold more of the small ones, but the particles are in order, so more of them is a longer run of memory, not more jumps.

**A third substep buys cleanliness.** Ten times fewer deep pairs at 3 and 4 to 1, for half as much time again.

**The hard mix.** That scene is kind: few particles are very small. So a second one, `?two` in the address: only the largest and the smallest, half of the volume each, in a box narrow enough for a deep pile. Every large sphere then sits on small ones, 64 times lighter at 4 to 1.

| Two sizes | A step, 2 substeps | Deep | Worst | A step, 3 substeps | Deep | Worst |
| --- | --- | --- | --- | --- | --- | --- |
| 2 | 20 ms | 1 386 | 33% | 31 ms | 178 | 26% |
| 3 | 36 ms | 16 079 | 60% | 58 ms | 2 704 | 41% |
| 4 | 65 ms | 32 629 | 97% | 69 ms | 7 812 | 54% |
| 6 | 123 ms | 39 280 | 499% | 193 ms | 14 078 | 120% |
| 8 | 250 ms | 50 275 | 326% | 349 ms | 19 756 | 182% |

Both limits of chapter 048 are back, with numbers. *Cost:* a cell is made for the largest sphere and holds up to 64 of the smallest at 4 to 1, so every particle reads thousands at every round. *Weight:* at 4 to 1 one pair in seven is deep, and beyond, small spheres end up inside large ones, a worst overlap of several radii.

**What the user chose.** Before this second table: 4 to 1 in the panel, 8 to 1 as the most the engine takes. After it: 4 to 1 for both ([decision 035](../decisions/035-sizes-up-to-four-to-one.md)).

### What surprised us

**The first try of the hard mix measured nothing.** 100 000 particles, nearly all small, in a box of 12 m: a layer one particle thick, no pile, no deep pair at all from 4 to 1 up. It looked like good news. The count of pairs that touch had dropped from 260 000 to 20 000, and that gave it away.

**With sizes spread evenly, 8 to 1 is cleaner than 4 to 1.** We guess, without having checked: the wider the range, the fewer pairs of particles are both small, and those are the pairs that 1 cm hurts most.

## What we take away

- The solver's error is a length, about 1 cm here, whatever the particles: small particles feel it more.
- How sizes are mixed matters as much as how far apart they are: many small ones under a few large ones is the hard case, for the time and for the weight.
- A result that looks too good: check what the scene was before believing it.

## Open questions

- A grid in several levels, one for each class of sizes, is how the simulations of grains keep the cost down ([chapter 048](./048-big-and-small.md)): not studied.
- Small particles passing through each other at the speed limit of the largest: not counted here.
- Several materials, and what the levels of the pile mean when a layer of small ones is thinner.

## Sources

- The page with `?sizes=`, `?two`, `?half=`, `?substeps=` and `?profile=60`. Since the decision the page takes no more than 4 to 1: the lines for 6 and 8 need `MAX_SIZES` raised in the code ([main.ts](../../examples/heap-simulation/main.ts), `overlaps`).

## Next step

The user's choice: the springs, or the heavy sphere on light ones.
