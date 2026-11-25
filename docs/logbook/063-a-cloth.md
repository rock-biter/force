# 063 · A Cloth

*November 25, 2026 · 2 min read*

**In short:** the ropes' springs, joined into a net: a cloth of particles hangs by its top row, swings and gives way to the ball. Eight groups of springs where a rope had two, made by hand. It stretches more than the script foretold.

## The story

**From a rope to a net.** A rope is a row of particles, each joined to the next ([chapter 062](./062-the-first-ropes.md)). A cloth is rows and columns: each particle joined to its neighbour on the right and to the one below, 4 links per particle counting both ways. A new page, [cloth](../../examples/cloth/index.html), with the same two shaders: a spring does not know whether it is in a rope or in a cloth.

**Diamonds.** With links along the sides only, a square of cloth can lean into a diamond and no link gets longer. Two more links per square, along its diagonals, stop that: the *shear* links, each √2 times as long as a side. 8 links per particle. The panel switches them on and off.

**Eight groups by hand.** Springs are solved one by one inside a group that shares no particle ([decision 037](../decisions/037-springs-one-by-one-in-groups.md)). On a rope the links alternate: two groups. On a cloth: the links along a row that start at an even column, those that start at an odd one; the same down the columns; and the same for each of the two diagonals. Eight groups, each one a dispatch. This works because a cloth is regular. For any net of springs the groups must be found, by *graph coloring*, which we have not studied.

**A rest length each.** Until now every spring was a diameter long. A diagonal is not, so the rest length, already in each spring's record, is now read for real, and the page measures each spring against its own.

**The measure.** A square cloth of 40 × 40, 1 600 particles, rods, 2 substeps, on our Mac M1, after 20 seconds:

| | Mean stretch | Worst spring | A step |
| --- | --- | --- | --- |
| 8 links, 3 passes over the springs | 0.74% | 12% | 1.5 ms |
| 4 links, 3 passes | 1.1% | 8.1% | 1.2 ms |
| 8 links, 6 passes | 0.35% | 6.0% | 1.6 ms |
| 8 links, 10 passes | 0.20% | 3.0% | 1.8 ms |
| 8 links, 3 passes, 4 substeps | 0.18% | 5.6% | 2.9 ms |

**Twice as wide as tall.** The first cloth was 40 rows tall whatever its size, and only grew wider. The user asked for one shape at every size, 2 wide to 1 tall. The count of the panel is now rounded down to the nearest cloth of 2 r columns by r rows, so that its last row is whole: 62 × 31 for 2 000, 244 × 122 for 30 000.

**"Why only 3 000?"** Because the box was 9 m tall, and 40 rows of 20 cm fill it. Nothing else stood in the way: the box now grows taller with the cloth, and the page goes to 30 000, the limit the user chose. A larger cloth costs little, and stretches more:

| Particles | A step | Mean stretch, worst | With 10 passes over the springs |
| --- | --- | --- | --- |
| 2 000 | 1.8 ms | 0.59%, 9.6% | |
| 10 000 | 2.5 ms | 1.3%, 25% | 0.37%, 6.8% |
| 30 000 | 4.9 ms | 2.2%, 40% | 0.67%, 14%, in 6.4 ms |

A taller cloth has more rows hanging from its top ones, and with 3 passes in a substep what the bottom does reaches the top only 3 links at a time ([chapter 060](./060-one-by-one-or-all-at-once.md)). The top row of the largest stretches by 40%, and the cloth narrows below it like a waist.

**A surface, not beads.** The user asked to see the cloth as a sheet too, full or as its wires, with a simple normal. [cloth.ts](../../examples/debug/cloth.ts) draws two triangles for each square of four neighbours, and copies nothing: a vertex has no position of its own. Its number is the particle's name; the vertex shader asks the register where that particle is now and reads its position from the simulation's buffer. The register, made for the springs, is what lets a mesh follow particles that change row. The normal is the cross product of "from my left neighbour to my right one" and "from the one above to the one below". The page now starts with 10 000 particles and a ball of 3 m, whose largest radius grows with the cloth.

### What surprised us

**More than the script said.** For a cloth with 8 links the script of [chapter 060](./060-one-by-one-or-all-at-once.md) gave 0.13% on average and 2.7% at worst. The page: 0.74% and 12%. This cloth is 40 rows tall, not 20, so its top links carry twice the weight; it swings; and its particles also touch each other, which the script's did not. Which of the three counts most, we did not find out.

**Small dispatches are not free in bulk.** 8 groups, 3 passes, 2 substeps: 48 dispatches for the springs in a step. They take 0.27 ms with 1 600 particles and 0.38 ms with 8 000: five times the springs, hardly more time. At this size the price is the dispatches, not the springs.

## What we take away

- One shader for a spring, whatever it is part of. What changes from rope to cloth is the list and its groups.
- A cloth needs its diagonals, or it is a net.
- 10 passes over the springs bring the worst one from 12% to 3% for 0.3 ms.
- A name and a register serve whoever needs to find a particle: the springs first, now the drawing.

## Open questions

- Why the top of the cloth stretches so much more than in the script.
- Groups for any net: graph coloring.
- A cloth that folds on itself, or lies on a pile.
- Nothing resists bending: this cloth folds like a chain mail.

## Sources

- The page's code: [main.ts](../../examples/heap-simulation/main.ts), `cloth` and `springGroups`, and [cloth.ts](../../examples/debug/cloth.ts) for the surface. Jolt Physics keeps the same three kinds of link, edge, shear and bend ([chapter 058](./058-how-engines-set-a-spring.md)).

## Next step

The user's choice: graph coloring for any net, or what is left open about the springs themselves, how soft and how damped.
