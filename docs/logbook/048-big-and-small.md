# 048 · Big and Small

*November 25, 2026 · 4 min read*

**In short:** can our particles have different sizes? A script in 3D says yes up to a large one twice the small one, with nothing changed but a radius for each. Beyond that the lists of neighbours overflow, and then a heavy sphere on light ones is more than our solver holds.

## The story

**The question.** "With the table the particles no longer need to be as wide as the grid," the user said, "so we could have particles of different sizes, right?" And five questions: does it work, what limits it, how small can one be, who else does it, and is a sphere larger than a cell a rigid body?

**A correction first.** The table freed us from the size of the *world* ([chapter 040](./040-the-table.md)), not from the size of a particle. Each particle looks into 3 × 3 × 3 cells, so a cell must be as wide as the widest pair that can touch: two of the largest radii, plus the margin. Smaller particles fit in such a cell, on a grid as in a table. The price: with a large one 4 times the small one, a particle reads 660 others to make its list, not 26.

**Who does it.** NVIDIA FleX does not: one radius for the scene, and its paper says why, "to leverage efficient collision detection based on uniform grids". Houdini's Vellum does, a radius per particle, with a switch for when they are all the same, since then "faster acceleration structures can be used". In the science of grains, where sizes always differ (*polydisperse*, they say), Ogarko and Luding use several grids, one per class of sizes: a *hierarchical grid*. We read only the first page of their 2010 paper.

**The script.** [mixed-sizes.mjs](../topics/mixed-sizes.mjs) is the solver of the live page on the CPU, with a radius for each sphere: two touch when closer than the sum of their radii, and a sphere weighs as its volume. A mix of spheres of 10 cm and smaller ones, half of the volume each, falls into a box and settles for 4 s. "Deep" counts pairs that overlap by more than a tenth of the smaller radius:

| Large over small | Spheres | Longest list | Left out of lists of 32, per substep | Deep pairs |
| --- | --- | --- | --- | --- |
| 1 | 100 | 13 | 0 | 0 |
| 1.5 | 100 | 12 | 0 | 0 |
| 2 | 457 | 26 | 0 | 1 |
| 3 | 1452 | 44 | 18 | 44 |
| 4 | 3376 | 72 | 122 | 75 |

**Speed.** A small sphere of 2.5 cm shot at a large one never passes through, even at 24 m/s: the large one is thick. Two small ones head on, each at our limit of today, 12 m/s, pass through each other in 53% of 400 shots. At one small radius per substep each, 3 m/s, never. But a limit for each size makes a strange world, as the user feared: falling 3 m, the sphere of 10 cm lands after 0.78 s, the one of 2.5 cm after 1.13 s.

### What surprised us

**Longer lists were not enough.** With lists of 256 nothing is left out, and at 4 to 1 there are still 308 deep pairs. With every sphere given the same mass, 2. So it is the weight: a large sphere is 64 times a small one, and our solver, which sees masses as their square root, still sees 8 to 1 ([chapter 029](./029-heavy-on-light.md)). 4 substeps bring the 308 down to 37.

**The margin of today blows up.** Lists look 5 cm beyond touching. For spheres of 2.5 cm that is two radii: 5 400 neighbours left out per substep, and spheres thrown 30 m up. The margin must follow the small radius.

**A sphere larger than a cell is not a rigid body.** We already have one: the ball of the live page, 2 m, which every particle tests directly. A rigid body is a shape that turns.

## What we take away

- The cell follows the largest particle, the margin and the safe speed follow the smallest.
- Up to 2 to 1 our lists of 32 and our solver are enough. This is one scene, one run for each line.
- Beyond, two limits, one after the other: the lists, then the ratio of the masses.
- Large against small never passes through. Small against small does, above one radius per substep.

## Open questions

- With equal masses the deep pairs go, but spheres flew 35 m up: not understood.
- Half of the spheres still moved after 4 s in the large mixes. With no friction it is a liquid in a box: we cannot tell sloshing from a pile that does not rest.
- Friction, the levels of the pile when a layer of small ones is thinner, and the cost on the GPU: not tried.

## Sources

- [NvFlex.h](https://github.com/NVIDIAGameWorks/FleX/blob/master/include/NvFlex.h): `radius` and `solidRestDistance`, one for the scene. Macklin and others, [Unified Particle Physics](https://doi.org/10.1145/2601097.2601152), 2014, page 2.
- SideFX, [Vellum Solver](https://www.sidefx.com/docs/houdini/nodes/dop/vellumsolver.html), "Assume Uniform Radius".
- Ogarko and Luding, [Data structures and algorithms for contact detection](https://www2.msm.ctw.utwente.nl/sluding/PAPERS/OgarkoWCPT2010.pdf), 2010: first page only.

## Next step

The user's choice: stop at 2 to 1 and bring a radius per particle to the GPU, or study the heavy sphere on light ones first.
