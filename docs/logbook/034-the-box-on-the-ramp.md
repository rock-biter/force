# 034 · The Box on the Ramp

*November 20, 2026 · 4 min read*

**In short:** friction, done by moving particles back instead of with forces, holds a sphere on a slope with the exact answer, lets 216 spheres stand in a pile and stops them skating over each other. But the pile's slope changes with how finely a step is cut, and friction threw particles until we measured the slide after pushing them apart, not before.

## The story

Without friction, the rubbing that resists sliding, a heap of our particles is a liquid ([chapter 031](./031-the-yellow-ball.md)), and a sphere that hits another at a glancing angle keeps its sideways speed and is sent upward by the next one: the *skating* of [chapter 032](./032-two-kinds-of-bounce.md). So friction was next.

**The idea.** A box on a ramp. Friction can hold it only up to a point, and that point depends on how hard the box presses on the ramp. A number µ, the *friction coefficient*, says how much: with µ = 0.5 friction resists up to half the push that keeps the two surfaces apart. This is *Coulomb's law*. Below the limit the box does not move at all, *static friction*; above it the box slides, and friction brakes it with that limit and no more, *kinetic friction*.

**In positions.** *FORCE+*, our way of pushing touching particles apart ([decision 015](../decisions/015-half-and-half-on-positions.md)), has no forces, only moves: in each *round*, a pass over the contacts, every particle is moved out of the ones it overlaps. Miles Macklin, in the paper behind NVIDIA's particle engine FleX, translates Coulomb's law into moves. How hard two particles press is their overlap d in that round. How far they slid is how much they moved past each other since the start of the *substep*, one of the smaller steps a step of 1/60 s is cut into, sideways to the line between their centers. If the slide is shorter than µ × d the contact takes all of it back. Otherwise it takes back µ × d. The two particles share that move by their masses, like the push.

We tried it in [a script](../topics/friction.mjs), with spheres of 10 cm radius, FORCE+ as the GPU runs it and the speed limit of [decision 019](../decisions/019-default-speed-limit.md), 9 m/s with 1 substep. A particle already combines the pushes of its contacts with the *half and half* rule, half their sum plus half their average. The friction moves can go *in the same sum* as the pushes, or be *averaged apart*: added up on their own, divided by the number of contacts, then added to the pushes. The script tries both.

**A sphere on a slope** is the one case with an exact answer. It stays still if the tangent of the slope's angle is below µ, 26.6° for µ = 0.5, and otherwise speeds up by g × (sin θ − µ cos θ), with g gravity, 9.81 m/s², and θ the angle. After 1 s, with 1 substep or 4, both ways give the same:

| Slope | Speed in the script | Exact | Without friction |
| --- | --- | --- | --- |
| 25° | 0.00 m/s | 0.00 | 4.15 |
| 30° | 0.66 m/s | 0.66 | 4.90 |
| 40° | 2.55 m/s | 2.55 | 6.31 |

Claude, the AI assistant we study with, asked what happens to a sphere at rest on a slope of 20° if its mass doubles. "It stays still, the mass does not count," the user said. Right: a heavier sphere is pulled down the slope twice as hard and presses on it twice as hard, so only the angle and µ decide.

**A pile.** A block of 6 × 6 × 6 spheres of 1 kg is let go on a floor with no walls. After 8 s we measure how tall the pile is and how wide, the distance from its middle that holds 90% of the spheres; the two give a rough slope. And the skating: the rain of chapter 032, 75 spheres thrown down at 20 m/s onto a layer of spheres that cannot move, counting those that rise more than 10 cm after they land. With friction in the same sum, as we first wrote it:

| µ | Pile, 1 substep | Pile, 4 substeps | Skating, 1 substep | Skating, 4 substeps |
| --- | --- | --- | --- | --- |
| 0 | flat, 17 m wide, still spreading | flat, 27 m wide, still spreading | 1 of 75 | 13 of 75 |
| 0.3 | 0.92 m tall, 33° | 0.59 m tall, 9° | 0 | 0 |
| 0.5 | 1.17 m tall, 46° | 0.78 m tall, 17° | 0 | 5, up to 87 cm |
| 1 | 1.18 m tall, 51° | 0.97 m tall, 24° | 4, up to 24 cm | 3, up to 6.4 m |

### What surprised us

**The same µ, another pile.** µ = 0.3 gives a slope of 33° with 1 substep and of 9° with 4, and the way we chose in the end does the same, 22° and 7°. Macklin says it himself: "friction strength is somewhat dependent on iteration count". A game that changes its substeps would see its heaps change shape.

**Friction threw particles, and Claude guessed wrong twice.** With µ = 1 some drops rose again, up to 6.4 m. Claude first blamed the friction moves of several contacts adding up past the slide. "Then friction should not move a particle more than the particle moved," the user said. A cap that enforces exactly that never triggered: the numbers did not change by a centimeter. Fewer or more rounds, and a lower speed limit, did not remove them either.

**The hollow.** So we followed the highest drop, substep by substep. In one substep of four, 1/240 s, it falls 84 mm straight down into the hollow between two held spheres, 59 and 68 mm deep in them. Each one pushes it out along the line between the centers, up and to one side, and the two pushes add up to 85 mm upward: as much as the fall. But each contact had measured the slide before those pushes. For each, most of the fall counts as sliding sideways to its own line, and each asks to take it back: the sideways parts cancel, the upward parts add up to 88 mm more. With two contacts, half and half keeps three quarters of the sum: 130 mm up after 84 mm down, and the 46 mm left over in 1/240 s are 11 m/s upward. What is a slide for one contact is the push of the other, so the fall was taken back twice.

**The slide after the pushes.** Macklin's text says it: friction comes "once interpenetration has been resolved". So each particle first works out its pushes of the round, then goes through its contacts a second time and measures its slide from where the pushes bring it. With the friction moves averaged apart, no drop rises above 10 cm in any of the nine settings with friction, µ = 0.3, 0.5 and 1 with 1, 2 and 4 substeps; with µ = 1 and 4 substeps the highest now rises 0.5 cm. Its piles are lower than with friction in the same sum, 33° against 46° at µ = 0.5 with 1 substep, and a little taller than averaged apart with the slide measured before, 31°. The user chose it ([decision 020](../decisions/020-friction-after-the-pushes.md)), and the [live page](../../examples/force-plus/round-push.wgsl) now has it, with a slider for µ: at 0.3 the block of 20 000 stays a pile instead of flowing flat.

**It was not the drawing.** Before this step the user wondered why 100 000 particles already strain our Mac, an M1, and suspected the drawing: each sphere is a flat triangle whose pixels compute the depth of a round surface. We added flat discs with a diagonal gradient and a way to draw nothing, on the [live page](../../examples/force-plus/main.ts). With 100 000 particles and the GPU cool: 34 frames per second with spheres, 35 with discs, 46 with nothing drawn. Once it warmed up, 14 to 16 in all three. So the round surface costs nothing over a flat disc, and drawing at all costs something only while the GPU is cool. The physics alone takes 18 to 32 ms per step, more than the 16.7 ms of a frame: most of the time goes into the rounds, not the pixels.

## What we take away

- Coulomb's law in moves: the overlap says how hard two particles press, and a contact may take back a slide up to µ times that.
- On a slope it matches the exact answer, and the mass does not count.
- µ = 0.3 already stops the skating and makes a pile stand: 0.68 m tall, 22°, in the way we chose.
- Measure the slide after the round's pushes: in a hollow, what one contact sees as sliding is what the other one pushes back.
- The slope of a pile still depends on the substeps: µ is not yet a number to trust across settings.

## Open questions

- In the script, with µ = 1 and 1 substep, 24 spheres of the pile of 216 still move after 8 s. Why?
- A friction that does not change with the substeps. Macklin points to Müller and others, 2007, not read yet.
- The price of friction on the GPU: a round now reads its neighbours twice. Our first timings were too noisy to say.

## Sources

- Miles Macklin and others, [Unified Particle Physics for Real-Time Applications](https://doi.org/10.1145/2601097.2601152), 2014: section 6.1, equations 23 to 25.
- NVIDIA, [FleX, NvFlex.h](https://github.com/NVIDIAGameWorks/FleX/blob/master/include/NvFlex.h): `particleFriction` between particles, `staticFriction` and `dynamicFriction` against shapes.
- Our script, [friction.mjs](../topics/friction.mjs): every number on friction. Our page, [examples/force-plus](../../examples/force-plus/main.ts): the frames per second.

## Next step

How particles find their neighbours: today a grid of cells with four places each, to replace with a list.
