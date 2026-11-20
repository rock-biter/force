# 031 · The Yellow Ball

*November 20, 2026 · 4 min read*

**In short:** FORCE+ alone on the GPU, live: up to 100 000 particles in a box 24 m wide, pushed by a yellow ball under the pointer. On our M1, 50 000 still keep up with real time and 100 000 do not. And landing particles sometimes bounce too much.

## The story

After [chapter 030](./030-the-lazy-list.md) a page called [compare](../../examples/compare/) ran eight ways of pushing particles apart side by side, in JavaScript. Then the user asked for the chosen one alone, on the GPU: *FORCE+* ([decision 015](../decisions/015-half-and-half-on-positions.md)). There, each particle moves by half the sum and half the average of what its contacts ask, the solver sees each mass as m^α, and the lower of two particles in a pile counts as heavier, by e^(c × difference of levels). They wanted α and the level strength c on sliders, many particles in a big box, and the mouse pushing them away. The new page, [force-plus](../../examples/force-plus/main.ts), reuses the shaders of chapter 030, already checked against JavaScript. three.js draws the particles straight from their GPU buffer. Masses go from 1 to 100 kg, light blue to red.

**A speed is not enough.** The first push gave every particle near the pointer at least 4 m/s outward. No hole opened. A heap without friction behaves like a liquid, and a liquid 1 m deep flows back at about √(2 × 9.81 × 1) ≈ 4.4 m/s. So the push became a solid obstacle that the rounds, the passes over the contacts, treat like the walls: a particle inside it is moved out. First an upright pole, then, as the user asked, a matte yellow ball. Its center sits on the floor, it follows the pointer with a *lerp*, covering a tenth of the remaining way at each step, and a slider sets its radius, 2 m at the start. It moves at 20 m/s at most and grows at 8 m/s, so it pushes particles instead of throwing them.

**The ball must move at every substep.** The user asked for *substeps*: the step of 1/60 s cut into N smaller ones, each with its own 8 rounds. With 8, particles flew everywhere as soon as the ball appeared. The ball moved once per step, so a step's growth of 13 cm happened in the first substep, 1/480 s: 64 m/s. Now JavaScript writes where the ball is at every substep into a small buffer. Before each substep the GPU copies the right one into the *uniform*, the small buffer every thread reads alike, with `copyBufferToBuffer`.

**Bigger.** The box grew from 8 to 12 to 24 m, 120 cells of the grid per side and 9 m tall, and the slider from 20 000 to 100 000 particles. At the start they stand in a block at most 28 layers tall, so it stays inside the grid. The time of one step on the GPU of our M1, in Chrome run without a window:

| Particles | 1 substep | 4 substeps |
| --- | --- | --- |
| 20 000 | 1.8 to 3 ms | 6.7 ms |
| 50 000 | 6.3 ms | 17 to 20 ms |
| 100 000 | 25 ms | 41 to 53 ms |

A frame at 60 per second lasts 16.7 ms. Past that, the page shows fewer steps per second and the world runs in slow motion: 13 frames per second at 100 000.

### What surprised us

**A liquid never rests.** The list of neighbours of [decision 016](../decisions/016-a-list-made-when-needed.md) is made again only when some particle has moved 2 cm since the last one. In a heap without friction one particle always has, so lists are made at almost every step. Decision 016 had noted it. Here we saw it on the page.

**The masses sort themselves.** At 100 000, after a while the top is light blue and the red sits at the bottom, as heavy things sink in a liquid.

**Splashes and bounces.** A fast sweep of the ball throws particles high, as a ball 4 m wide at 20 m/s would. But some particles also bounce too much when they land. Claude's guess, not measured yet: a particle that lands fast still overlaps others at the end of the step, and at the next step the push that moves it out becomes speed. With 2 cm left, that is 1.2 m/s with one substep and 9.6 m/s with eight. Macklin describes this "pop" and its cure, *pre-stabilization*: first move the starting positions out of their overlaps, so that the move does not count as speed.

## What we take away

- Without friction a heap is a liquid. To push it you need a solid obstacle, not a speed.
- Anything the page moves, like the ball, must move at every substep, or a whole step of motion happens in a fraction of it.
- The lazy list pays only when the world rests.
- On our M1, real time ends somewhere between 50 000 and 100 000 particles.

## Open questions

- Is the bounce Macklin's pop? Measure it, then try pre-stabilization.
- Friction, which this rule still lacks.
- The same page on a phone.

## Sources

- Miles Macklin and others, [Unified Particle Physics for Real-Time Applications](https://doi.org/10.1145/2601097.2601152), 2014: section 4.4, pre-stabilization, and 6.1, friction on positions.
- Our page, [examples/force-plus](../../examples/force-plus/main.ts): every number of this chapter.

## Next step

Measure the bounces in a script, then try pre-stabilization.
