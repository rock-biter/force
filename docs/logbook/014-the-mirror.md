# 014 · The Mirror

*November 17, 2026 · 4 min read*

**In short:** chapter 013 read Thomas Jakobsen's paper, which repairs a broken rule by moving positions back. This one reads Erin Catto's of 2005, which changes velocities instead. It is the same method seen in a mirror, and on our pendulum it loses far less energy, at the price of rules that are never exact.

## The story

[Chapter 013](./013-the-hidden-brake.md) left one question: repair positions, or not? The other answer is in *Iterative Dynamics with Temporal Coherence*, the paper behind the solver, the part of an engine that repairs broken rules, of most game engines ([chapter 012](./012-the-family-tree.md)). It is full of matrices, so we went through it as five ideas, each with an example small enough to redo by hand. The [reading notes](../topics/iterative-dynamics-paper.md) keep all five, with a script behind their numbers.

A *constraint* is a rule the bodies must obey. Jakobsen writes it on positions: "do not be inside the floor". Catto writes it on velocities: "do not move into the floor". A ball that lands at −5 m/s gets the push that brings its vertical speed to 0, and its position follows from the corrected speed. For every rule the direction of the push is known, so one number is left to find, how hard, between a lowest and a highest value: a floor pushes and never pulls, so its number starts at zero, while a joint may push or pull. A rule is then a row of weights that says which velocities it watches, one number and two limits, and contacts, joints and motors all take that shape.

Pushes depend on each other, so he fixes one rule at a time and goes round again. Two boxes of 1 kg are stacked on the floor, and gravity has just set both moving down at 1 m/s. The floor stops the lower box, the lower box stops the upper one, and that pushes the lower one down again. After one round both still move down at 0.5 m/s, then 0.25, then 0.125.

### What surprised us

**The same loop, in other clothes.** That halving is the table of chapter 013, where a stick in a box was 20, then 10, then 5 units off. Both papers solve one rule at a time, for a fixed number of rounds, and spread the work over frames. Catto even cites Jakobsen, and names his own integrator, the rule that moves everything forward by one step: semi-implicit Euler, the one FORCE uses.

**Memory is free on one side only.** Jakobsen's next frame starts from the corrected positions, which are simply there. Catto's pushes are not: he stores each one with a label, to find the same contact point at the next step. It is the heart of his paper and the "temporal coherence" of its title: a scene changes little from one step to the next. With 10 rounds, a stack of three boxes topples without that memory, and a stack of ten stands with it. A heavy box on a light one stays his weak spot: it holds until the lower box is down to 3% of the density of the upper one.

**A velocity rule alone drifts.** Stopping a body does not pull it out of where it already is. We held our pendulum of 1 m with a velocity rule only: after 30 s its stick was 96 cm too long. So Catto adds a nudge, a small speed outward in proportion to the error. How strong is found by trial: in his test it removes 5% of the error per step.

**It loses less energy.** With that nudge, the pendulum let go from horizontal still climbs to 42% of the height it started from after 30 s. With projection, Jakobsen's move of putting a point straight back, it kept 0.4%. From 10 degrees, 96% against 1%. But the stick is never exact: up to 3.6 cm too long.

**Two slips of Claude's,** the AI assistant we study with. It said the nudge adds energy. That holds for a box at rest that gets pushed out; the pendulum loses height here too, only less. And it first reported 99% for the small swing: a height rounded too early. The script says 96%.

**His friction is rougher than ours.** Each contact can resist sliding up to a fixed force, whatever the weight above it, and he admits that in a stack the lower boxes slide as easily as the upper ones. Our ground ([decision 013](../decisions/013-a-flat-ground.md)) slows the sliding in proportion to how hard the particle hit it. So this paper does not confirm our rule, which still waits for a source.

## What we take away

- Positions or velocities, the loop is the same: one rule at a time, a few rounds, and the rest of the work left to the next frames.
- Correcting positions removes the error of a rule at once and takes energy away. Correcting velocities takes less and leaves an error to push out slowly.
- A solver that starts from the last answer needs a memory. Positions are a memory that comes for free; pushes must be stored, with labels to find them again.
- Heavy on light is the weak spot of these solvers: his stack holds until the lower box is down to 3% of the upper one.

## Open questions

- Positions or velocities for FORCE? Our pendulum has a single rule, so one round finds its push exactly: its 3.6 cm come from the method, not from too few rounds. Many rules and few rounds are another matter, for both papers.
- Both solve the rules one after the other, each using what the last one wrote. How do the two look once every rule must run at the same time on a GPU?
- A store of labelled pushes on a GPU, and contacts between particles that change at every step: does starting from the last answer survive there?
- Rotation: nothing in our examples turns. The pendulum is a point, and the boxes only move up and down. Half of this paper's math is about turning.

## Sources

- [Iterative Dynamics with Temporal Coherence](https://box2d.org/files/ErinCatto_IterativeDynamics_GDC2005.pdf), Erin Catto, 2005: the text read in full. Our [reading notes](../topics/iterative-dynamics-paper.md), and [the script](../topics/iterative-dynamics-paper.mjs) behind every number of ours here.
- Four of the papers it cites went on the [topic map](../topics/README.md) after a check of title, authors and year on [Crossref](https://api.crossref.org/), a public index of papers.

## Next step

The engines used in video games: which solver each one runs, and what it can do.
