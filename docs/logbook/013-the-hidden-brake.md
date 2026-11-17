# 013 · The Hidden Brake

*November 17, 2026 · 4 min read*

**In short:** we read our first paper from the first page to the last, Thomas Jakobsen's on the physics of the game Hitman. Its way of moving things turned out to be the one FORCE already uses, and its best trick hides a brake.

## The story

[Chapter 012](./012-the-family-tree.md) opened eleven sources and read none in full. This time we read one to the end: *Advanced Character Physics* (2001), the ancestor of the methods that repair a broken rule, such as "stay out of the wall", by moving positions. We went a chapter at a time, with questions, and came out with [reading notes](../topics/advanced-character-physics.md) and a script that recomputes every number in them.

The method is four simple pieces. Each particle remembers its last position instead of its velocity: *Verlet integration*. A point that breaks a rule is moved the shortest way back to where the rule holds: *projection*. That can mean out of a wall, or along the line to its neighbour when the two must stay 1 m apart. Nobody touches the velocity, yet it changes, because it is read from the positions. When rules fight each other you go round them again, *relaxation*, and the rounds need not fit in one frame, because the next frame starts from the corrected positions and carries on: for cloth, he writes, one round per frame is enough. And everything is particles and sticks: cloth, a rigid body made of four particles and six sticks, a falling human body.

### What surprised us

**His Verlet was already ours.** We asked whether Verlet could beat our integrator, the rule that moves everything forward by one step. Ours is semi-implicit Euler ([decision 006](../decisions/006-semi-implicit-euler.md)): update the velocity first, the position after. It cannot, because it is the same motion. Write our rule for two steps in a row, subtract one from the other, and the velocity drops out: what is left is Verlet's rule. The script agrees: after 600 steps of free fall the two are 0.00000000015 m apart. Only what is stored differs, the last position or the velocity.

**The brake is in the projection.** The paper warns that "energy might leave the system". Verlet alone loses nothing: a spring swings as wide after 100 s as at the start. The loss comes when a point is moved back: the part of its speed that went against the rule is deleted. We let go a pendulum of 1 m from horizontal, at 60 steps per second, one projection per step. It should climb back forever to the height it started from, 1 m above its lowest point. After 10 s it reached 14 cm, after 30 s 0.4 cm. With steps four times smaller, 52 cm after 10 s.

**A guess of Claude's, caught by a question.** Claude had said that a small, slow motion would lose far less. Every page of ours is read by a fresh reader, an AI agent that sees nothing but the page, and this one asked where that claim came from. Nowhere: so we tried. Let go from 10 degrees, the pendulum keeps 1% of its height after 30 s, against 0.4% from horizontal: no better. The share lost depends on the step, not on the size of the swing.

**A wrong sign in the PDF.** On page 6 of our copy the code for the stick moves the two points the wrong way: a stick that should be 1 m long and is stretched to 1.2 m ends at 1.4 m. We redid it by hand, then looked at the page itself to rule out a slip of our text copy. The version three pages later is right.

One fix on our side too: our topic map said that velocity Verlet, a variant that keeps a more accurate velocity and that we set aside in decision 006, computes its forces twice per step. Our own [theory page](../topics/integration.md) says once, reused by the next step, and the page is right.

## What we take away

- Verlet and semi-implicit Euler are one integrator, stored in two ways. The choice that matters is another: repair positions by projection, or not.
- Projection takes energy away at every correction, and the share depends on the length of the step. Smaller steps lose less: one more reason for substeps, splitting each step into smaller ones ([decision 011](../decisions/011-substeps-per-world.md)).
- One move, "put the point back", gives collisions, resting on the floor and sticks. The price is the brake, and, with few rounds, rules that are almost right instead of right.
- A claim with no number behind it is a guess. Ours lasted until someone asked for its source.
- A copy of a paper can carry mistakes: redo the examples by hand.

## Open questions

- A paper of 2001: what is still done this way today, and what is obsolete? His trick to skip a square root, the rigid body as four particles, the velocity that is never stored.
- Why does the pendulum lose about the same share from 10 degrees and from 90? We measured it, we did not explain it.

## Sources

- [Advanced Character Physics](https://edelkas.github.io/n/files/bib/jakobsen.pdf), Thomas Jakobsen, 2001 (a copy on a personal site): read in full. Our [reading notes](../topics/advanced-character-physics.md), and [the script](../topics/advanced-character-physics.mjs) behind every number here.
- The works it cites went on the [topic map](../topics/README.md) only after we checked that each exists: two papers on [Crossref](https://api.crossref.org/), a public index of papers, one thesis on [David Baraff's page](https://www.cs.cmu.edu/~baraff/papers/index.html), and one by opening its [title page](https://people.eecs.berkeley.edu/~jfc/mirtich/thesis/mirtichThesis.pdf).

## Next step

Erin Catto's paper of 2005, which repairs rules by changing velocities instead of positions. The engines used in video games, the next step until today, wait until we know both branches and can tell what we are looking at.
