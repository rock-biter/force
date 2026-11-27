# 073 · Eight Ways to Close a Net

*November 27, 2026 · 4 min read*

**In short:** We went through the sources of the cloth study together, one way at a time, with a question after each. A net of triangles has smaller holes than one of squares, but with rigid links it cannot bend; and three of the eight ways need contacts made before two particles touch.

## The story

**What we wanted.** [Chapter 072](./072-read-to-the-end.md) read 29 sources on why our cloths pass through each other. Before choosing what to test, the user wanted to know every method, and had a question of their own: would a cloth of triangles, instead of squares, help?

**How.** The sources fall into eight ways. One way per message, in chat, each ending with a question answered from memory. Our cloth is a net of spheres of radius r, joined by springs (we also call them links), and two particles that overlap push each other apart: a *contact*. The *gate*, from [chapter 071](./071-the-gate.md), is the height at which a particle coming down on the middle of four first touches them: 1.41 r. The more the cloth stretches, the lower the gate, and past 41% of stretch a particle slips through untouched: the net is *open*.

**The eight ways, one line each.**

1. *Fatter spheres.* Particles push at twice the spacing (the sample of PhysX, NVIDIA's engine), and pairs that are close in the cloth at rest are told not to collide, a *rest-pose filter*. Without it, the user answered, the cloth swells against itself: the manual of FleX, also NVIDIA's, warns of "erroneous buckling or folding".
2. *Squares or triangles*, below.
3. *A cap on the move* in a *substep*, one of the slices a step of 1/60 s is cut into: 0.4 r in Matthias Müller's tutorial Ten Minute Physics, against our 1 r ([decision 027](../decisions/027-the-safe-speed-limit-by-default.md)). Or a cap per particle, 0.45 of its distance to the nearest thing (*Offset Geometric Contact*, OGC 2025). With that one, the user worked out, two cloths brake to a stop just short of touching.
4. *A cap on stretch*: no spring more than 10% longer than at rest (Provot 1995), or a *tether*, a thread from each particle to where the cloth hangs. A cloth lying free has nothing to tie them to.
5. *The side kept for a step* (Chris Lewin at EA, 2018; for us the step would be a substep). At its start, note which side of each other two particles are, and push only toward that side. Its weak spot: a particle that still gets through is noted on the wrong side at the next start, and kept there.
6. *Colliding surfaces.* The triangles drawn between particles collide too, so stretch opens no hole. A push moves four particles at once: the one that hits and the three corners of the triangle.
7. *The whole path checked*, with a *barrier*, a push that grows without end as a gap closes. The solver, the part that moves the particles, goes in jumps, so the path must be checked too, or it jumps the wall. Nothing ever crosses, but the papers run from about twice (Wu 2020) to 150 times (C-IPC 2021) slower than real time, except OGC on small scenes.
8. *Repair*: find where two surfaces cross, and flip the kept side there so the push pulls them back (Chaos, Unreal Engine's physics). It needs surfaces, which our spheres are not.

**Squares or triangles.** Shift every other row by half a spacing: six neighbours each, triangular holes. The middle of a triangle is closer to its corners than the middle of a square: s/√3 of the spacing s, against s/√2. A new part of [the script](../topics/self-collision.mjs) gives a gate of 1.63 r instead of 1.41, and a net that opens only past 73% of stretch, not 41%. But the same spacing takes 15% more particles: does the gain come from them, or from the shape? The user did not know. The way to tell is to change one thing and keep the other: with as many particles as the squares, so far apart that neighbours no longer touch, 1.57 r and 61%. Most of it is the shape.

No source we read compares the two nets for collisions. But Goldenthal and others (2007) choose squares on purpose, because of *locking*. A particle can move in 3 directions, and each rigid link takes one away. Each link is shared by two particles, so a net of triangles has about 3 per particle and leaves nothing: the cloth turns to sheet metal. Squares with only their sides have 2, and the one left is the bend.

**The surprise.** Asked to count our own cloth, the user found 4 links per particle: the sides and both diagonals, all rigid on our demo pages. On paper, more locked than triangles. Yet it folds around a ball. Our guess: the links never quite reach their length, and that stretch is what lets it bend. If so, the stretch that opens the holes also keeps the cloth soft, and a hard cap on stretch could stiffen it.

**A thread.** Three ways need a contact made before two particles, drawn one radius each, touch: fatter spheres push from there, OGC needs a push before the cap stops them, and the kept side must know the pair early. Today a contact is born only when two spheres overlap.

### What is proven, and what is not

Proven: the geometry of the two nets, by the script; what each source says, from our reading notes. Guesses, not measured: that our cloth escapes locking by stretching, and that OGC's cap would leave our particles stuck without a push that starts earlier.

## What we take away

- Triangles close a net better by their shape, not by having more particles.
- Triangles with truly rigid links lock: three links per particle leave nothing to bend with.
- To tell two causes apart, change one and keep the other.
- Every way pays somewhere: thicker layers, slower falls, pushes on four particles, or speed.
- Contacts made before touching come back in three of the eight ways.

## Open questions

- How much do our links stretch on the ball, and does a cap on stretch lock the cloth?
- With our few passes over the springs, are links ever rigid enough to lock?
- How far before touching should a contact be made, and how many more neighbours does that bring?

## Sources

- The page [Self-collision](../topics/self-collision.md), with the comparison of the two nets.
- [Efficient Simulation of Inextensible Cloth](https://www.cs.columbia.edu/cg/pdfs/131-ESIC.pdf), Goldenthal and others, 2007: why squares.
- [Strain Based Dynamics](https://matthias-research.github.io/pages/publications/strainBasedDynamics.pdf), Müller and others, 2014: triangles that do not lock, by letting them lean.
- [Cloth Self Collision with Predictive Contacts](https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/gdc2018-chrislewin-clothselfcollisionwithpredictivecontacts.pdf), Chris Lewin, 2018: the kept side.
- [A Safe and Fast Repulsion Method for GPU-based Cloth Self Collisions](https://wanghmin.github.io/publication/wu-2020-sfr/), Wu and others, 2020: triangles of nearly equal sides.
- [Offset Geometric Contact](https://graphics.cs.utah.edu/research/projects/ogc/), Chen and others, 2025: the cap per particle.

## Next step

Choose which ways to try by script in 3D, on fixed scenes, starting from how much our links stretch on the ball.
