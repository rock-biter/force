# 032 · Two Kinds of Bounce

*November 20, 2026 · 4 min read*

**In short:** particles landing on a heap bounce for two reasons, and the one we suspected is not among them while the pile has levels. Too fast for one step, they end up deep inside others and come out at up to 12 m/s. With no friction, a glancing hit keeps its sideways speed, and the next sphere turns it upward.

## The story

On the [heap-simulation](../../examples/heap-simulation/main.ts) page of [chapter 031](./031-the-yellow-ball.md) the user saw particles splash and sometimes bounce high when they land, and asked whether FORCE needs friction and *damping*, which takes away a share of every speed. Claude suspected the *pop* described by Miles Macklin, the author of FleX, NVIDIA's particle engine. A step first moves each particle to its *predicted position*, where it would be if nothing touched it. Then come the *rounds*, the passes in which each particle is pushed out of the ones it overlaps. Last, `finish` sets its speed: end position minus start position, divided by the length of the step. When the rounds leave a particle a little inside another, the next step pushes it out, and `finish` counts that push as speed. A sphere ending a step 1 cm inside the floor leaves the next one at 0.01 × 60 = 0.6 m/s upward, the user worked out, and with 8 *substeps*, steps cut into 8, at eight times that. Macklin's cure, *pre-stabilization*, first moves the starting positions out of their overlaps, and the predicted positions along with them, so the move is not counted as speed.

We tried it in [a script](../topics/pre-stabilization.mjs): *FORCE+*, the way FORCE pushes particles apart ([decision 015](../decisions/015-half-and-half-on-positions.md)), in JavaScript, written as the GPU runs it. Rains of 25 spheres of 1 kg fall on what lies below, three rains for each row of the table, so 75 drops. The heap is 216 spheres of 1 to 100 kg. The table shows the runs without pre-stabilization:

| 75 drops | 1 substep | 8 substeps |
| --- | --- | --- |
| from 3 m onto the heap of 216 | none rises 10 cm | 1 rises above 10 cm |
| at 20 m/s onto the heap | 504 of the 648 heap spheres of the three runs thrown above 10 cm, up to 5.9 m | heap still, 11 drops above 10 cm, up to 57 cm |
| at 20 m/s onto a layer held still | every drop, half of them above 4.8 m | 12 drops above 10 cm, up to 46 cm |
| at 20 m/s onto the heap, without levels | the heap never rests, a drop up to 31 m | 28 drops above 10 cm |

With two passes of pre-stabilization the numbers barely change, except in the last row, where 28 drops become 10. The other rows show two different problems.

**Too far in one step.** At 20 m/s a sphere moves 33 cm in a step of 1/60 s, more than its radius of 10 cm. It ends up deep inside the others, 14 to 17 cm, past their middle, and the rounds push it out on the wrong side, fast. Two passes of pre-stabilization cannot undo 17 cm. With 8 substeps a sphere moves 4 cm at a time and this kind of bounce is gone.

**Skating.** With 8 substeps a few drops still went up, even onto spheres that cannot move. So we dropped one sphere at a time, from 264 spots of one *pocket*, the hollow between four spheres of the layer: half rose more than 10 cm, the highest 71 cm. Step by step, the highest one hit a sphere at a glancing angle. The part of its speed against the sphere went away, since our hits have no rebound, but the sideways part stayed, 8.7 m/s, because nothing rubs. It slid into the pocket, ran into the next sphere, and went up its side like a skateboard on a ramp, leaving at 3.8 m/s: 3.8² / (2 × 9.81) ≈ 0.72 m. That is what spheres without friction really do. Our rule is not to blame: half and half adds up a particle's pushes in its own way (chapter 026), but simply averaging them gives the same, the highest 74 cm.

**The levels.** FORCE+ counts each particle's *level* in the pile, and the lower of two counts as heavier ([chapter 029](./029-heavy-on-light.md)). Without levels the heap never comes to rest: the rounds do not finish their work, some overlap is left at the end of every step, and that is the pop. In that heap pre-stabilization does help.

### What went wrong

Claude measured wrong twice. First with one drop at a time: whether it bounced depended on where it touched and on how deep it was at that moment of the step, so we switched to rains. Then the drops of the rain were moved by up to 5 cm at random, enough to start inside each other: the scene itself made a pop, 113 cm high. Now they start at least 20 cm apart.

FleX, NVIDIA's particle engine, names both problems in its settings. `maxAcceleration` limits how fast a particle's speed can change, "useful to avoid popping due to large interpenetrations". `dissipation` slows a particle by how many contacts it has, a damping that spares free falls. And between particles "collisions are always inelastic", with no rebound, as in ours.

## What we take away

- Measure before curing: the pop we suspected is not what the page shows.
- A sphere must not move more than its radius in one substep, or the push can send it out the wrong side.
- Without friction a glancing hit keeps its sideways speed, and the next sphere turns it upward. The cure for that is friction, not damping.
- One drop can be lucky; trust many. And check that the scene does not make the problem itself.

## Open questions

- With one substep, can a limit like `maxAcceleration` stop the splashes, without the cost of eight?

## Sources

- Miles Macklin and others, [Unified Particle Physics for Real-Time Applications](https://doi.org/10.1145/2601097.2601152), 2014: section 4.4, pre-stabilization.
- NVIDIA, [FleX, NvFlex.h](https://github.com/NVIDIAGameWorks/FleX/blob/master/include/NvFlex.h): the settings `maxSpeed`, `maxAcceleration`, `dissipation`, `restitution`.
- Our script, [pre-stabilization.mjs](../topics/pre-stabilization.mjs): every number of this chapter.

## Next step

Friction on positions, measured on the same rains and on the slope of a pile.
