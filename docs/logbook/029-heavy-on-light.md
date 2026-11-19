# 029 · Heavy on Light

*November 19, 2026 · 4 min read*

**In short:** with particles of different masses, a light one under a heavy one sinks: 34 mm at a ratio of 1 to 100, when we move positions with the half and half rule. A spring measured in hertz helps. Two ideas of the user help more: let the solver see squeezed masses, and count each particle's level in its pile.

## The story

[Chapter 028](./028-the-ranking.md) left two finalists for the *solver*, the part that pushes touching particles apart. One is a spring with a damper, 50 000 N/m. The other is moving the particles back with the user's *half and half* rule, where each particle adds half the sum and half the average of what its contacts ask. Both were tested with spheres of 1 kg, radius 0.1 m, without friction, at 60 steps per second, with 8 passes over the contacts per step. The positions get 8 *rounds*, the spring 8 *substeps*: each step cut into 8. Now the masses change.

In a contact the lighter body moves more: each one takes a share equal to the other one's mass over the total. A sphere of 1 kg and one of 3 kg, 0.04 m deep: "the light one moves 0.03 and the heavy one 0.01," the user said.

**The messenger.** Put 1 kg on the floor and 100 kg on top of it. The floor tells the light one to rise, the heavy one tells it to go down by 99% of their overlap, and the heavy one itself rises only 1% per round. The light one passes the message a crumb at a time: after 8 s each contact is 34 mm deep ([our script](../topics/mass-ratio.mjs)). The other way round, 100 kg under 1 kg? "It works well, the light one on top is pushed out almost entirely," the user said: 0 mm.

**The spring** fails differently. It sinks by weight / k, so a heavy body sinks even when it is at the bottom: 19.8 mm for 100 kg on the floor. And the stiffest spring that holds is set by the lightest body, which swings fastest ([the step limit](../topics/integration.md#the-step-limit)). Box2D, Erin Catto's engine, measures a spring in *hertz*, swings per second, and gives every contact the stiffness that fits the masses it moves ([Soft Step](../topics/soft-step.md)). Why does 100 kg on the floor then sink as much as 1 kg? "Because the spring is 100 times stiffer," the user said. Box2D caps a contact at an eighth of the substeps per second, 60 Hz with our 480. At 60 Hz the spring holds mixed masses, but 1 kg under 100 kg still sinks 6.9 mm.

**Two ideas of the user.** First, the solver need not see the real masses; only gravity must. It can see `m^α`. On a logarithmic scale, where 100 is two powers of ten, α = 0.5 halves the distance: a ratio of 100 becomes 10. Second, Macklin, in the paper behind NVIDIA's particle engine FleX, makes lower particles look heavier during contacts, `e^(−c × height)`, so piles settle faster (*stiff stacks*). But take two spheres hitting in the air, one 10 cm higher: the lower one is treated as heavier, the hit pushes the upper one more, and the pair drifts sideways at 0.3 m/s, pushed by nothing. So the user asked to count *levels* instead: 0 on the floor, one more than the particle you rest on, none in the air. Macklin mentions this too, a search through the contacts, and uses the height for simplicity. Levels are kept from step to step and updated in one pass, and a contact uses `e^(−c × difference of levels)`.

Positions with half and half, 8 rounds, after 8 s. Depths are the deepest pair. "Moving" counts the particles, out of 216, still faster than 0.1 m/s:

| Way | Column of 10: centre of the top one (1.900 m if nothing sinks) | 1 kg under 100 kg | Box of 216 at 1 kg | Box of 216 at 1 to 10 kg | Sideways drift after a hit in the air |
| --- | --- | --- | --- | --- | --- |
| masses as they are | 1.858 m | 33.7 mm | 17.1 mm | 27.6 mm, 138 moving | 0 |
| α = 0.5 | 1.858 m | 3.1 mm | 17.1 mm | 18.1 mm, still | 0 |
| height, c = 5 per meter | 1.893 m | 14.3 mm | 1.1 mm | 2.6 mm, still | 0.298 m/s |
| levels, c = 2 per level | 1.896 m | 4.3 mm | 0.7 mm | 5.4 mm, 3 moving | 0 |
| **α = 0.5 and levels, c = 2** | **1.896 m** | **0.2 mm** | **0.7 mm** | **2.7 mm, still** | **0** |
| spring at 60 Hz, 8 substeps | not run | 6.9 mm | 0.7 mm | 4.1 mm, still | not run |

### What surprised us

**The two ideas add up.** Squeezing the masses mostly fixes the light one under the heavy one, and stops the mixed box shaking. Levels mostly fix the sinking of a pile of equal spheres, from 17.1 to 0.7 mm, and help the column too. Together they do better than the spring at 60 Hz in these scenes, with two numbers to set.

**What we give up.** Without friction a heap behaves like a liquid, and a ball of 100 kg dropped on it should sink to the floor. With α = 1 it does; with α = 0.5 it stops 0.67 m above the floor, about halfway down the heap. "If a particle is a liquid, its contacts could use the real masses," the user suggested. With the heap's particles marked as liquid, the ball reaches the floor again. FleX gives every particle a *phase*, a group label the solver reads. But a real liquid needs a rule of its own, density, so that design waits for the study of fluids.

**Claude's split masses did not pay.** Sharing each correction between lighter copies of both bodies, as with velocities in chapter 027, stopped the mixed box shaking but left 45 mm with 1 kg under 100 kg.

**Millimeters in a heap are noisy.** The same box of 1 kg spheres gives 13.0 mm in chapter 028 and 17.1 here, only because the corrections are added in another order. A gap of a few millimeters between two heaps is within that noise.

## What we take away

- Light under heavy is the hard case for every method. Heavy under light is easy when moving positions, and not for a spring with one k.
- The solver's masses need not be the real ones, only gravity's must. Squeezing them pays, at the price of heavy bodies pushing through light ones.
- Measure a pile in particles, not in meters: the same help in piles, and no harm in the air.
- Two candidates are left: half and half with α = 0.5 and levels, and the spring in hertz.

## Open questions

- A new pile of 10 needs 10 steps, a sixth of a second, before its levels are right.
- Liquids as their own kind of particle: when we study fluids.
- The real cost of the two candidates on the GPU.

## Sources

- Miles Macklin and others, [Unified Particle Physics for Real-Time Applications](https://doi.org/10.1145/2601097.2601152), 2014: section 5.2, stiff stacks, and section 5, phases.
- Box2D's Soft Step, in our [theory page](../topics/soft-step.md): springs in hertz, and the cap on contacts.
- Our script, [mass-ratio.mjs](../topics/mass-ratio.mjs): every number of this chapter.

## Next step

The two candidates on the GPU, with their real cost. Then we decide, and write the code.
