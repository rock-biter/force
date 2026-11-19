# 027 · The Stored Nudge

*November 19, 2026 · 4 min read*

**In short:** the third way to push particles apart changes their velocities, as Erin Catto, the author of Box2D, does. Alone it sinks. With two pieces of his solver it sinks far less, but never stops shaking, until Box2D's relax rounds calm it, at twice the price. At that price, moving positions does as well.

## The story

[Chapter 026](./026-the-marble-in-the-pocket.md) moved particles. Now we change their velocities, the way of [chapter 014](./014-the-mirror.md). A rule on velocities says "stop coming closer". Sphere A runs at 2 m/s into B, which stands still: the rule shares the change, and both go on at 1 m/s, like the shopping carts of [chapter 018](./018-half-a-box.md). But they still overlap by 0.05 m. "It stays the same, since they move at the same speed," the user said.

**The nudge.** So the rule also asks them to move apart, fast enough to remove a share of the overlap in this step: with 20%, 0.05 × 0.2 = 0.01 m in 1/60 s, so 0.6 m/s apart. A goes on at 0.7 m/s, B at 1.3. This is *Baumgarte stabilization*. Why not 100%? "Too strong, and they would keep moving apart," the user said: 0.05 / (1/60) = 3 m/s, a bounce out of nothing.

**On the GPU,** a step adds gravity to the velocities, measures the contacts, corrects the velocities for a few rounds, then moves. Each particle's thread again combines what its contacts ask, so the rules of chapter 026 return: the sum, the average, and the user's *half and half*, half the sum plus half the average. On velocities, averaging is *mass splitting*: each particle meets its n contacts as n lighter copies of itself, as in chapter 018. Half and half is the same with 2n / (n + 1) copies. As in Box2D, a pair that does not touch yet may close its gap but not more: a *speculative contact*.

**Alone, it sinks.** We used the scenes of chapter 026, with spheres of 1 kg and 10 cm radius at 60 steps per second: a column of 10 on the floor, a box into which 216 fall, and 100 dropped on a floor of fixed spheres. In the *pocket*, a sphere resting on three fixed ones, the rules behave as with positions: the sum goes too far, the average is slow, half and half is in between. But with 10 rounds the deepest pair in the box is 31 mm deep, against 12 mm when we move positions.

**The two pieces.** Catto's solver keeps each contact's push from the step before and starts from it, *warm starting*. And a later round may take back part of an earlier push, as long as the total stays a push. With both, the deepest pair drops to 3 mm, but 180 particles out of 216 never stop moving. The hanging chain of [chapter 015](./015-the-stiff-spring.md) blew up for the same reason: the push a contact stores includes the extra speed of the nudge, so warm starting gives that speed back at the next step, and again, and again. A nudge of 5%, Catto's, does not help: 211 still move. Box2D's cure is the *relax* round: after the particles move, more rounds with the nudge off take that speed back. One relax round leaves 149 moving. Ten leave none, with no overlap at all, in the box and on the floor of fixed spheres. Only the column of 10 still trembles.

| Half and half, after 8 s | Column of 10: centre of the top one (1.900 m if nothing sinks) | Box: deepest pair, particles still moving | Floor of fixed spheres |
| --- | --- | --- | --- |
| velocities, 10 rounds | 1.726, still | 31 mm, 7 | 9.9 mm, still |
| + the two pieces | 1.951, trembles | 3.2 mm, 180 | 1.0 mm, 18 |
| + 10 relax rounds | 1.905, trembles | 0 mm, still | 0 mm, still |
| positions, 10 rounds | 1.867, still | 12 mm, still | 4.9 mm, still |
| positions, 20 rounds | 1.884, still | 1.7 mm, still | 0.3 mm, still |

Still moving means faster than 0.1 m/s in the last second. A top above 1.900 m means the column is pushed apart and bounces. Ten rounds plus ten relax rounds are 20 passes over the contacts. With 20 rounds, moving positions comes within 1.7 mm, with no memory per pair, no relax and nothing that trembles.

### What surprised us

**A bug of Claude's,** the AI assistant we study with. When splitting a particle into copies it counted only the contacts already overlapping. A particle falling into a pocket of four fixed spheres touched nothing yet, so it was not split into copies at all, and each of its four speculative contacts pushed it with full force: the sum. In that first version of the script one was thrown at over 1 000 m/s. Counting every contact that pushes fixed it.

**Friction reaches only sideways.** "Shouldn't friction calm the trembling?" the user asked. Friction acts along the surface, while the column trembles along the line between the centers, where friction does nothing. It would help a heap stop sliding. Not tested yet.

**Two patches, both in our sources.** The user proposed to take a little speed away in every direction, like air, and to ignore tiny moves. Simon Green's NVIDIA sample has the first, `globalDamping`, and Macklin's paper the second, *particle sleeping*. Taking 2% of the speed at each step stops the trembling column, but a body falling for one second then reaches 5.6 m/s instead of 9.8. Sleeping under 1 mm per step made the box of half and half on positions, which stood still, jump: 137 particles moving instead of 0. Claude's guess: a frozen particle stores up small errors, then moves all at once.

## What we take away

- Velocities need three extras to compete: stored pushes, pushes that can be taken back, and relax rounds.
- Without the relax rounds, the stored nudge keeps a heap shaking forever.
- At the same price, 20 passes, moving positions comes within 1.7 mm of it, and is simpler.
- Damping and sleeping treat the symptoms of a weak rule: one slows every fall, the other can make things jump.

## Sources

- Erin Catto, [Iterative Dynamics with Temporal Coherence](https://box2d.org/files/ErinCatto_IterativeDynamics_GDC2005.pdf), 2005: the nudge and warm starting, in our [reading notes](../topics/iterative-dynamics-paper.md).
- Box2D, [contact_solver.c](https://github.com/erincatto/box2d/blob/main/src/contact_solver.c), read in chapter 015: the relax round and speculative contacts.
- Richard Tonge, Feodor Benevolenski and Andrey Voroshilov, [Mass Splitting for Jitter-Free Parallel Rigid Body Simulation](https://doi.org/10.1145/2185520.2185601), 2012: the copies, on velocities.
- Miles Macklin and others, [Unified Particle Physics for Real-Time Applications](https://doi.org/10.1145/2601097.2601152), 2014: section 4.5, particle sleeping.
- NVIDIA's particle sample, [particles_kernel_impl.cuh](https://github.com/NVIDIA/cuda-samples/blob/0ec046d5e99d7214cc8e9fbac2cc1e66f3019878/cpp/2_Concepts_and_Techniques/particles/particles_kernel_impl.cuh#L72): `globalDamping`.
- Our script, [collision-response.mjs](../topics/collision-response.mjs), parts `velocities` and `patches`: every number of this chapter.

## Next step

All the ways at the same low price, in [chapter 028](./028-the-ranking.md).
