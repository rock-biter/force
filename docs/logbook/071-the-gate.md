# 071 · The Gate

*November 26, 2026 · 4 min read*

**In short:** Why our cloths pass through each other, and what engines and papers do about it besides more substeps. A cloth of spheres is thin between its particles and does not know which side a thing was on.

## The story

**What we saw.** The user noticed that cloths go through each other, and a cloth through itself: on fast moves with 2 substeps, much less with more. And when a cloth is pulled, the particles move apart and others slip between them. The question: what is going on, how others solve it, and what we can do besides raising the substeps.

**Our own cloth first.** Its particles are spheres one diameter apart, and only the spheres collide: the triangles we draw stop nothing. [A script](../topics/self-collision.mjs), geometry only, gave three facts.

- Coming down on the middle of four particles, another one first touches them 1.41 radii above the cloth, not 2. We called that height the *gate*.
- A push goes along the line between two centers. Past the plane of the cloth that line points the other way, and the cloth pushes the particle out of the far side.
- Stretch lowers the gate: 1.22 radii at 12%, 0.79 at 30%, and just past 41% a particle passes untouched.

**The surprise: our safe limit is not safe here.** [Decision 027](../decisions/027-the-safe-speed-limit-by-default.md) cuts every particle to one radius per substep, so that none crosses more than half of another. But two cloths that meet head on close two radii in a substep, more than the gate. More substeps do not change that sum: the limit is a distance per substep, whatever their number. They help for other reasons: the springs get more passes and stretch less, and things rarely fly at the limit.

**What engines do.** Three agents read code and manuals, papers, and one tutorial. Most engines for games stay with spheres, as we do. FleX, NvCloth and PhysX make the spheres fatter than the spacing, and tell two particles that are close in the cloth at rest not to collide: PhysX's own sample collides at twice the spacing. NvCloth and Unreal hold the stretch with *tethers*, a thread from each particle to where the cloth is held. Unreal and Obi can also collide points with triangles, which leaves no hole. Jolt has no collision between cloths at all.

**The tutorial.** Matthias Müller's demo on self-collision is our setup: thickness equal to spacing, spheres, no side. It holds with 10 substeps, springs that do not give, and a cap of 0.2 of the thickness per substep: 0.4 radii, where ours is 1.

**Two papers closest to us.** Wu and others (2020) prove when a mesh collided at its vertices cannot be crossed: no edge longer than L, and vertices that are not neighbours at least L/√2 apart. With our diameter that gives 41% of stretch, the number of our script, found another way. They add a cap on how far a vertex moves in a step, whatever moves it. Chris Lewin at EA (2018) keeps, for each pair about to meet, a plane they must stay on their own side of: a contact with a memory.

**Nothing is decided.** The page [Self-collision](../topics/self-collision.md) lists seven ways, cheapest first. Four fit the pass we have: fatter spheres, a cap on the move, a cap on stretch, and a side that is remembered.

### What is proven, and what is not

Proven: the geometry, by the script; what each source says, by quotes from its text. Not measured: how often each of the three causes is the one that fails on our pages. A guess of ours: that the side can be read from the positions at the start of the substep, which we already keep for friction.

## What we take away

- A cloth of spheres is thinnest at the middle of four: 1.41 radii, not 2.
- A push has no side. Past the plane of the cloth, the cloth helps the intruder out of the other face.
- A speed limit per particle is half a limit: two that meet close twice as much.
- Stretch is a collision problem too: just past 41% the net is open.
- Games keep the spheres and add: fatter, slower, less stretch, a side.

## Open questions

- Which cause fails most on our pages: to measure, not to guess.
- Fatter spheres, on pages where the same particles also pile up as grains: one radius to collide and one to space?
- A cap on the move that counts the springs and the pointer's drag too: what does it do to a fall?
- Unreal's code was read in an unofficial copy of version 4.26. A second paper by Provot, of 1997, and three more were not opened.

## Sources

- The page: [Self-collision](../topics/self-collision.md), with every source and how much of it was read.
- [Ten Minute Physics 15](https://github.com/matthias-research/pages/blob/master/tenMinutePhysics/15-selfCollision.html), Matthias Müller: the simulation's code, in full.
- [A Safe and Fast Repulsion Method for GPU-based Cloth Self Collisions](https://wanghmin.github.io/publication/wu-2020-sfr/), Wu, Wu, Yang, Wang, 2020: in parts.
- [Cloth Self Collision with Predictive Contacts](https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/gdc2018-chrislewin-clothselfcollisionwithpredictivecontacts.pdf), Chris Lewin, 2018: in full.
- FleX's [manual](https://github.com/NVIDIAGameWorks/FleX/blob/master/doc/_sources/manual.txt), NvCloth's and PhysX's docs: in parts.

## Next step

The user's choice: try the four cheap ways by script in 3D, on two fixed scenes, in one table.
