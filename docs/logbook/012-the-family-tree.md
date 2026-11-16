# 012 · The Family Tree

*November 16, 2026 · 4 min read*

**In short:** we looked for the papers behind the first things FORCE must do, particles and rigid bodies. They form a family tree with two branches and a newcomer, and one paper carries a warning for anyone writing WebGPU shaders.

## The story

The engine drops particles on a floor, but no particle knows about another. Before writing springs or collisions we took the second stop of the [study route](../README.md#study-route): which papers matter, and why? Our [topic map](../topics/README.md) listed 13 papers, all of them only names. We went through eleven sources, papers and posts, and read their summary, their main loop and their limits. None was read in full. One search went wrong: we looked for a paper under two authors who never wrote it. The results had the right authors, and we then checked titles, authors and years of six papers on Crossref, a public index of papers.

They all answer one question. A *constraint* is a rule the objects must obey: "these two points stay 1 m apart", "this box does not sink into the floor". After each step of the simulation some rules are broken, and a *solver* repairs them. The papers differ in **what the solver changes**.

### Two branches

**Change the velocities.** When two bodies touch, give them an instant kick, an *impulse*, strong enough to stop them going into each other. Go through the contacts one by one, then again: each pass over all of them is a *round*. This is Erin Catto's paper of 2005, written for games. Twenty years later the paper of the newcomer, below, still calls Catto's method "the cornerstone of most real time rigid body simulators used in video games".

**Change the positions.** Let everything move as if no rule existed, then put the points straight back where the rules hold, and read the velocity from how far each point really travelled. Two points of equal mass 1.2 m apart that should be at 1 m are pulled in by 10 cm each. That is *position based dynamics* (PBD), from 2006, and its whole loop is 17 lines. Its ancestor is Thomas Jakobsen's paper of 2001 on the physics of the game Hitman.

PBD had a flaw: a rope gets stiffer when the solver runs more rounds, or when the step gets smaller. *XPBD* (2016) fixes it by giving each rule a softness of its own, the *compliance*, at the price of one more number to store per rule. Then *Small Steps* (2019): a cloth of 150 000 particles stretches more with one step of 30 rounds (12.4 ms) than with 30 small steps, or *substeps*, of one round each (13.5 ms). Its authors call it a "surprising observation". In 2020 the same group brought in rigid bodies, each one a single body with a rotation and not a cluster of particles. Catto, in a post of 2024, writes that the gain of small steps "has long been known": there he compares eight solvers, the position one among them, and builds the next Box2D, his engine, on substeps too. On small steps the two branches agree.

### What changes on the GPU

Both branches repair one rule at a time, each using what the one before just wrote (*Gauss-Seidel*). That is a queue, and a GPU wants thousands of threads at once. The papers show two ways out:

- **Everybody at once, then average** (*Jacobi*). Each rule works out its correction from the same old state, and each particle takes the average of the corrections it got. NVIDIA's unified particle solver (2014) does this. To know who is near whom it uses a grid, of the kind Simon Green's note of 2010 describes: cells as big as a particle, filled again at every step by sorting the particles by cell.
- **Colors.** Give each body a color no neighbour has, then run one color at a time: the threads of a color never touch the same data. AVBD (2025), the newcomer, does this. It is a third way: it moves one body at a time toward the place where all the forces on it balance. Its authors report a pile of 110 000 blocks solved in 3.5 ms with 4 rounds, on a top desktop GPU.

### One warning

The rigid body paper of 2020 says: "for small time steps, double precision floating point numbers are required". WGSL, the shader language of WebGPU, has no 64-bit floats, only `f32` and `f16`. *Small Steps* names the same limit, though all its examples ran in 32 bits. We met that rounding ourselves in [chapter 010](./010-the-ground.md), where it moved a bounce by 7 cm.

### The reading list

| # | Source | What it gives |
| --- | --- | --- |
| 1 | Witkin and Baraff, *Physically Based Modeling* (1997) | The vocabulary: particles, constraints, rigid bodies |
| 2 | Jakobsen, *Advanced Character Physics* (2001) | PBD before it had a name, with little math |
| 3 | Catto, *Iterative Dynamics with Temporal Coherence* (2005) | The velocity branch, and its trouble when heavy rests on light |
| 4 | Müller et al., *Position Based Dynamics* (2006) | The position branch, in 17 lines |
| 5 | Macklin et al., *XPBD* (2016) | Stiffness that no longer depends on rounds and step |
| 6 | Macklin et al., *Small Steps in Physics Simulation* (2019) | Small steps beat rounds |
| 7 | Müller et al., *Detailed Rigid Body Simulation with XPBD* (2020) | Rigid bodies, contacts and joints, in detail |
| 8 | Macklin et al., *Unified Particle Physics* (2014) | Everything as particles, solved in parallel |
| 9 | Green, *Particle Simulation using CUDA* (2010) | Finding neighbours on the GPU |
| 10 | Giles et al., *Augmented Vertex Block Descent* (2025) | The newest answer, made for the GPU |

## What we take away

- Solvers differ in what they change: velocities, with impulses, or positions, as PBD does. Games use both.
- Both branches report that many small steps with one round each beat one big step with many rounds. FORCE already runs its shader once per substep ([decision 011](../decisions/011-substeps-per-world.md)), so that shape fits.
- On a GPU, "one rule at a time" becomes "all at once and average", or "one color at a time".
- Small steps eat digits, and WGSL stops at 32 bits. Check this before choosing a solver.
- A comparison inside a paper is its authors' claim. AVBD's numbers come from a top desktop GPU; none of these papers measures a phone.

## Open questions

- Which family for FORCE? Not yet: we read parts of each and none in full, and we do not know how many substeps 32-bit floats can take at our scale ([decision 009](../decisions/009-meters-seconds-y-up.md)).
- A rigid body as one body or as a cluster of particles ([decision 004](../decisions/004-rigid-bodies-and-particles-first.md))? The 2020 paper argues for one body: for a cluster, the cost "grows with the number of particles". The unified solver says its clusters suit "smaller debris-like rigid bodies".

## Sources

- Position branch: [Position Based Dynamics](https://matthias-research.github.io/pages/publications/posBasedDyn.pdf), [XPBD](https://matthias-research.github.io/pages/publications/XPBD.pdf), [Small Steps](https://mmacklin.com/smallsteps.pdf), [rigid bodies with XPBD](https://matthias-research.github.io/pages/publications/PBDBodies.pdf), and its ancestor, [Advanced Character Physics](https://edelkas.github.io/n/files/bib/jakobsen.pdf) (a copy on a personal site).
- Velocity branch: [Iterative Dynamics with Temporal Coherence](https://box2d.org/files/ErinCatto_IterativeDynamics_GDC2005.pdf), and Catto's post [Solver2D](https://box2d.org/posts/2024/02/solver2d/) with the eight solvers.
- On the GPU: [Unified Particle Physics](https://mmacklin.com/uppfrta_preprint.pdf), [Particle Simulation using CUDA](https://developer.download.nvidia.com/assets/cuda/files/particles.pdf), and [Broad-Phase Collision Detection with CUDA](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda), read only through a summary.
- [Augmented Vertex Block Descent](https://graphics.cs.utah.edu/research/projects/avbd/): the paper, and its page with demos and code. It has the quote on the cornerstone and the 3.5 ms.
- Checks: [Physically Based Modeling](https://www.cs.cmu.edu/~baraff/sigcourse/), only the index and the first page of three chapters; the [WGSL specification](https://www.w3.org/TR/WGSL/#floating-point-types), whose floating point types are `f32` and `f16`; the [Crossref REST API](https://api.crossref.org/), for titles, authors and years.

## Next step

The engines used in video games: which solver each one runs, and what it can do.
