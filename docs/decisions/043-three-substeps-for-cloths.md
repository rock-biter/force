# 043 · Three substeps for cloths, at least

*Accepted · November 27, 2026 · The user, after the tests of [chapter 074](../logbook/074-a-particle-in-every-square.md)*

**Decision:** we will run a scene with cloths at 3 substeps or more, where everything else starts at 2 ([decision 029](./029-three-rounds-two-substeps.md)).

## Why

A cloth made of spheres has thin spots between its particles ([Self-collision](../topics/self-collision.md)). In [our script](../topics/self-collision-middles.mjs), a copy of our step on the CPU, a curtain dropped on a floor from 3 to 10 m folds onto itself: with 2 substeps its surface passes through itself for 251 steps of 1/60 s in all, over 4 falls from 6 m, and can end crossed; with 3 or 4 substeps, never. More substeps make smaller the two things that open a cloth: the most stretched link goes from 74% to 48% and 40%, and the largest move of a particle in a substep from 1.67 to 1.08 and 0.87 radii. For two cloths flying at each other, only the distance covered in a substep counts: each substep more adds 3 m/s to the speed they can safely meet at, 6 m/s each with 2 substeps, 9 with 3, 12 with 4.

## Not chosen

- **More passes over the links, 8 in a substep where we have 4:** the curtain still crosses, for 71 steps where it was 251, and the most stretched link is no shorter. Our guess: the pushes come after the links and stretch them again.
- **A particle at the middle of every square**, that only collides (the user's idea): in the script it holds what 3 substeps do not: cloths that meet faster than 9 m/s each, and stretched ones. On the GPU, tried on the page of the pile, the cloths became too stiff and the step too heavy: 3.4 times the pairs to look at. Dropped by the user.
- **4 substeps:** as good as 3 on the curtain, for a third more time. A page can still ask for them.

## Consequences

- A step with cloths costs about 1.5 times what it did, and their speed limit, a radius per substep ([decision 027](./027-the-safe-speed-limit-by-default.md)), goes from 12 to 13.5 m/s ([decision 045](./045-a-tighter-limit-from-three-substeps.md)).
- Two cloths can still pass through each other: above 9 m/s each, when one is stretched by a few tens of percent, or when one is pulled through another ([decision 044](./044-a-hand-that-gives-way.md)).
- On the pages it is `MIN_SUBSTEPS` in [main.ts](../../examples/heap-simulation/main.ts). In the engine, a scene will have to know it has cloths.

## Still open

- One scene of folding, 4 starts each, with no friction and without the levels of decision 028: not yet measured on the GPU.
- Ropes stay at 2: not tested.

## Revisit if

A cap on stretch, or contacts that keep their side, close a cloth at 2 substeps.
