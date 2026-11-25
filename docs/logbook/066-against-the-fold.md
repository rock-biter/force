# 066 · Against the Fold

*November 25, 2026 · 3 min read*

**In short:** a cloth that only resists stretching folds like chain mail. A spring from each particle to the one two places further resists the fold: the same spring as ever, only longer. It rounds a sharp corner, and how much it gives sets how sharp the cloth can crease.

## The story

**The third way to deform.** A cloth can stretch, lean into diamonds, and fold along a line. Links along the sides resist the first, diagonals the second ([chapter 063](./063-a-cloth.md)). Nothing resisted the third: two squares side by side could close like the pages of a book and no link got longer. Real cloth resists that a little, paper a lot. The name is *bend*.

**Two ways, and the simple one first.** Engines offer two; Jolt has both. A link on the *angle* between two neighbouring triangles: precise, a new rule on four particles. Or a link on a *distance*: join each particle to the one two places further. When the cloth folds between them, they come closer, and the link pushes them back. It is our spring, with a rest length of two diameters, and its own softness.

**A test that tested nothing.** [cloth-bend.mjs](../topics/cloth-bend.mjs): a strip held by one short side and let go flat, like a diving board. With or without bend links, even as rods, it hung straight down. The strip was held by one row of particles, and one row is a hinge: the whole strip swung down around it without folding anywhere. A diving board is clamped. With two rows held:

| Bend links | The free end, of 360 cm | The sharpest fold |
| --- | --- | --- |
| none | 363 cm below, 3 cm out | 90° |
| rods | 352 below, 23 out | 38° |
| give 0.1 mm per newton | 357 below, 15 out | 52° |
| give 1 mm per newton | 362 below, 7 out | 75° |
| give 10 mm per newton | 363 below, 3 out | 88° |

**It rounds corners, it does not hold a board.** Without bend links the strip turns a square corner at the clamp and hangs. With them it still hangs, but through a rounded corner. Two reasons it cannot hold itself out. Each of our particles weighs 1 kg: this strip is 108 kg of cloth. And a link on a distance is weak against small folds: the distance between two particles two places apart is 2 × cos(half the fold), which hardly changes when the fold is small. A fold of 10 degrees shortens it by 0.4%.

**On the page.** Four more groups of springs, twelve in all: a bend link from column a is in one group when a / 2, rounded down, is even, in another when it is odd, and the same down the columns. A menu, "links", chooses 4, 8 or 12 per particle, and a slider how much the bend links give. With 8 links the edges of the cloth crumple as it swings. With 12 and a give of 0.1 mm per newton it hangs like a sheet of card, its edges straight.

### What surprised us

**Bend links also hold the cloth's length.** With bend links as rods, the cloth of 10 000 particles stretches 0.41% on average and 5.5% at worst; without them, 1.3% and 24%. A link that spans two particles carries what happens at one end twice as far in a pass. The trouble of the tall cloth was the speed of that news ([chapter 060](./060-one-by-one-or-all-at-once.md)).

**With a compliance, the passes do not matter; with rods, they do.** A give of 10 mm per newton: 88°, 88° and 87° with 3 passes, 10 passes, and 8 substeps. Rods: 38°, 28° and 23°.

## What we take away

- The same spring, three jobs: a side, a diagonal, a jump of two. What changes is who it joins and how long it is.
- A test must be able to fail in the way that matters: one row held was a hinge.
- Long links are also a shortcut for the solver.

## Open questions

- A link on the angle, for cloth that should really hold a shape.
- Lighter particles: a cloth of 1 kg per particle is not a cloth.
- The cloth draped on the ball, and folded on itself: not looked at.

## Sources

- Our own script. Jolt Physics, [SoftBodySharedSettings.h](https://github.com/jrouwe/JoltPhysics/blob/master/Jolt/Physics/SoftBody/SoftBodySharedSettings.h): `EBendType`, by distance or by the angle between two triangles (dihedral).
- The page's code: [main.ts](../../examples/heap-simulation/main.ts), `cloth`.

## Next step

The user's choice: groups for any net, lighter particles, or the link on the angle.
