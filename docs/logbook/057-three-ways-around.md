# 057 · Three Ways Around

*November 25, 2026 · 3 min read*

**In short:** the second stop of the study on springs. A stiff spring blows up when its force is applied step by step, and there are three ways around it. One chain, hung and simulated in four ways, shows what each one gives and what it costs.

## The story

**Why a stiff spring blows up.** We had met it in the [page on integration](../topics/integration.md), and took it up again with today's numbers. A computer applies a spring's force for a whole step as if nothing changed meanwhile; if the spring would have done half a swing in that time, the push lands too strong and too late. With our steps of 1/120 s and a weight of 1 kg, a spring holds while it swings less than about 38 times a second. And with a weight of 1/64 kg, one of our small particles at 4 to 1? "Harder," the user said, "because with less mass it swings faster." Eight times faster.

**Way 1: look ahead.** Use the force the spring will have at the end of the step: *implicit integration*. It never blows up, but it brakes by itself, and "where it will be" has to be found for all the springs together. Why can a particle not do it alone, in its thread? "Because it depends on where the other particles will be."

**Way 2: move the ends.** Forget the force: if a spring is 2 cm too long, bring its two ends 2 cm closer. A *distance constraint*, in the family our contacts belong to, position based dynamics (PBD). What is the difference from a contact? "The contact only pushes, the distance pushes and pulls." It cannot blow up. But it is a rod, not a spring: how stiff depends on how many rounds run.

**Way 3: move them part of the way.** A *soft constraint*: take back only a share of the error, set by the *compliance*, the inverse of the stiffness. For a rope that hardly stretches, large or small? "Small, because zero is a rigid rod." And a question back: what does XPBD stand for? Extended position based dynamics, the paper of 2016 that added the compliance to the PBD of 2007.

**One chain, four ways.** [spring-simulation.mjs](../topics/spring-simulation.mjs): 10 weights of 1 kg on springs of 10 cm, hung and let go, steps of 1/120 s. With `k` = 10 000 N/m it should hang 5.40 cm longer.

| Way | What happens |
| --- | --- |
| Forces, as they are now | 5.43 cm, swinging for ever; above 14 400 N/m it blows up |
| Forces, as they will be | 5.39 cm, the swing dies by itself; holds at 10 000 000 N/m |
| Move the ends, a rod | stretches 3.07 cm with 1 round, 0.28 with 10, 0.01 with 100 |
| Part of the way, compliance 1 / 10 000 | 8.47 cm with 1 round, 5.40 with 10, 5.39 with 100 |

The chain blows up between 14 000 and 15 000 N/m, not at the 57 600 of one weight on one spring: its links also shake against each other, about twice as fast, and twice the pace is a quarter of the stiffness.

### What surprised us

**The rod is as stiff as the clock.** With 10 rounds it stretches 1.10 cm in steps of 1/60 s and 0.07 cm at 1/240 s. Change the substeps of a scene and every rope in it changes. With the compliance: 5.53 and 5.39 cm.

**With too few rounds the soft one is softer, not wrong in a dangerous way.** 8.47 cm with one round: the chain sags more than asked and nothing blows up.

## What we take away

- The stiffest spring and the lightest weight together set the longest step plain forces can take.
- Moving positions cannot blow up, since no force can be too large.
- A stiffness is worth having only if it stays the same when rounds and steps change. That is what the compliance buys.
- What a GPU wants is in the last column of the page's table: each spring worked out on its own.

## Open questions

- A particle with several springs gets several moves at once. How to combine them is the fourth stop.
- Damping in XPBD has its own term in the paper: not read yet.

## Sources

- The theory page of this stop: [Simulating springs](../topics/spring-simulation.md).
- Macklin, Müller and Chentanez, XPBD, 2016, our local copy: the abstract and sections 3 and 4.

## Next step

The third stop: how the engines set their springs.
