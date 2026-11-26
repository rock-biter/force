# 072 · Read to the End

*November 27, 2026 · 4 min read*

**In short:** Before trying anything, the user asked to read in full the sources the last step had only sampled. Twenty-nine readings, eight of them engines. Four things we had wrong, two good ideas, and one hard fact: nothing that promises no crossing runs at 60 Hz yet.

## The story

**What we wanted.** [Chapter 071](./071-the-gate.md) found why our cloths pass through each other, from parts of papers and grepped code. The user wanted the sources read from start to end before any test: what we had taken from a page might not be what the whole says.

**How.** Eight agents, other copies of Claude each reading on its own, in parallel, each with a group of sources and a list of our claims to confirm or correct, each writing notes on the same twelve headings. Halfway through, the model ran out of its usage allowance: thirteen notes were finished, the rest were picked up again with another model. Two papers have no free copy and were not opened: Volino 2006 and Thomaszewski 2009. Unreal's code exists only in unofficial copies of Epic's, so we read those and link none.

**What we had wrong.**

- *FleX does not make its spheres fatter.* Its demos mostly put cloth particles exactly one *contact distance* apart, the distance at which two of them start to push, as we do. NvCloth's sample collides at 1.3 times the spacing, PhysX's at 2.
- *Bullet's cloth does hit itself*, in its newer soft bodies: a point against a triangle, with the side taken at the start of the step. Rapier does too, since September.
- *"Frames per second" in the papers on the GPU are steps per second*, with steps of 1/100 to 1/1200 s. Wu 2020 runs at about half real time, I-Cloth 12 to 160 times slower, the others 3 to 42 times; C-IPC, on a CPU, 150 times or more. Only OGC 2025 runs its small scenes faster than real time, on an RTX 4090.
- *Lewin's 0.1 to 0.4 ms are with shortcuts*: layers set by hand, contacts computed once at load. His general method takes 20 ms to 1 s per step of 1/30 s.

**Sharper than we thought.** Wu's theorem: a mesh collided at its vertices cannot be crossed if no edge is longer than L and other vertices stay L/√2 apart. Our reading of it: on our cloth the longest edge is a square's diagonal, so L/√2 is already one diameter at rest, our contact distance. No margin at all. And long range attachments, a thread from each particle to where the cloth hangs: their paper asks for 3 to 5 passes per frame because of the collisions ("using less iteration results in collision detection failure"), not because of the stretch. And they leave neighbours free to stretch from each other.

**Two good ideas.**

- *Keep the side for a substep* (Lewin). Push two particles apart along the direction they had at the start of the substep, not the one they have now. We already keep those positions, for friction. The [script](../topics/self-collision.mjs) works out what it gives: a particle that starts 2 radii above the middle of four is held 1.45 radii above the cloth, over the gate, and still 0.84 at 41% of stretch. But only if the four contacts exist, and at rest they start 2.45 radii away: today we make one only when two spheres overlap.
- *A cap per particle* (OGC 2025, *Offset Geometric Contact*). Each particle may move 0.45 of its distance to the nearest other one, whatever moves it. One number per particle, from distances the search for neighbours already measures.

The page [Self-collision](../topics/self-collision.md) is rewritten, with reading notes for the two sources closest to us: [Wu 2020](../topics/safe-fast-repulsion-paper.md) and [Lewin 2018](../topics/predictive-contacts-talk.md).

### What is proven, and what is not

The facts are from the sources, with what each said in its own words in the notes. The geometry of the kept side is from our script. That the side can be taken from the start of the substep with no list of contacts kept between passes, and that OGC's cap works with spheres alone, are our guesses.

## What we take away

- A sampled source can say the opposite of the whole one: FleX, Bullet, the timings.
- A number needs its unit: steps per second are not frames.
- Engines for games choose, and pay: fatter spheres, a tighter cap, tethers, a side kept for a step.
- The side is the piece we lack, and the cheapest to try.

## Open questions

- Can the kept side work with contacts made a little before two spheres touch, and how far before?
- With fatter spheres, the cloth rests thicker: how much is acceptable on screen?
- The reading notes stay in `library/`, out of git: should some become pages of ours?

## Sources

- The page [Self-collision](../topics/self-collision.md), with every source and how it was read.
- [A Safe and Fast Repulsion Method for GPU-based Cloth Self Collisions](https://wanghmin.github.io/publication/wu-2020-sfr/), Wu, Wu, Yang, Wang, 2020.
- [Cloth Self Collision with Predictive Contacts](https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/gdc2018-chrislewin-clothselfcollisionwithpredictivecontacts.pdf), Chris Lewin, 2018, and his [patent](https://patents.google.com/patent/US10692266B2/en).
- [Offset Geometric Contact](https://graphics.cs.utah.edu/research/projects/ogc/), Chen and others, 2025.

## Next step

The user's choice: go through the sources one by one together, to know every method before deciding. Among them: would a cloth of triangles instead of squares help, and did any source consider it? Then which tests to run.
