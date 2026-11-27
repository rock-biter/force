# Self-collision

*Theory · 7 min read · Updated November 27, 2026 · [Topic map](./README.md)*

**In short:** A cloth made of spheres is a wall with thin spots, and no memory of which side a thing was on. Engines for games keep it shut with fatter spheres, a cap on the move, a cap on stretch, or contacts that keep their side for a step. Nothing that promises no crossing at all runs at 60 Hz yet.

## The idea

Lay marbles on a table in a square net, each touching its neighbours. From above it looks closed. Now press a marble down on the middle of four: it sits in the dimple between them, and pushing it down spreads the four apart. Our cloth is that net, and its springs are all that holds the four together.

In three.js terms: we collide the vertices of the mesh, as spheres, and never its triangles. A triangle is drawn but nothing can hit it. Self-collision is a cloth hitting itself; two cloths hitting each other is the same problem, solved here by the same code.

## How it works

Two particles push each other apart when their centers are closer than the *contact distance*: one diameter, 2 r, on our pages, the same as the *spacing* between neighbours at rest. Three things let a particle through. The numbers are from [our script](./self-collision.mjs). Heights are from the plane through the cloth's centers to the center of the other particle.

**1. The cloth is thin between particles.** Coming straight down on a particle of the cloth, another one touches it 2 r above the cloth. Coming down on the middle of four, it first touches 1.41 r above. We call that height the *gate*.

**2. A push has no side.** A push goes along the line between two centers. Once the center of the falling particle is below the plane of the cloth, that line points down, and the four push it out of the other side. Near the plane the push is almost all along the cloth: at 0.5 r above, only a third of it is across.

**3. Stretch opens the gate.** The further apart the four, along both sides of the square, the lower the gate:

| Cloth stretched, both ways | 0% | 12% | 20% | 30% | 41% |
| --- | --- | --- | --- | --- | --- |
| Gate | 1.41 r | 1.22 r | 1.06 r | 0.79 r | 0.15 r |

At 41.4% a particle passes without touching anything. A paper proves when a mesh collided only at its vertices cannot be crossed: no edge longer than L, and any two vertices not joined by an edge at least L/√2 apart (Wu and others, 2020, [our notes](./safe-fast-repulsion-paper.md)). Our reading of it, not the paper's: on our cloth the longest edge is the diagonal of a square, 1.41 diameters at rest, so L/√2 is one diameter, exactly our contact distance. At rest there is no margin left, and any stretch takes it away. The 41% of the table is only the case of a particle through the middle of a square, not of an edge sliding through an edge.

**Why more substeps help less than hoped.** Our engine moves the world in *steps* of 1/60 s, and each step is cut into *substeps*: 2 on our pages. A *pass* is one run over all the springs, or all the contacts. Our speed limit is one radius per substep for each particle ([decision 027](../decisions/027-the-safe-speed-limit-by-default.md)): more substeps raise the limit in meters per second, and the distance per substep stays one radius. Two cloths meeting head on close 2 r in a substep, more than the gate between particles: a center can go from not touching yet to past the plane in one substep, with no push in between, at any number of substeps. And the limit cuts the speed only: the springs, and the hand that drags a cloth with the pointer, move particles after it.

**Squares or triangles.** Shift every other row of particles by half a spacing and each has six neighbours, and the holes are triangles. The middle of a triangle is closer to its corners: s/√3 of the spacing s, against s/√2 for a square. Part 6 of the script:

| | Squares | Triangles, same spacing | Triangles, as many particles |
| --- | --- | --- | --- |
| Gate at rest | 1.41 r | 1.63 r | 1.57 r |
| Open from | 41% | 73% | 61% |

The same spacing takes 15% more particles; with as many particles, neighbours no longer touch at rest, and the gain is still most of it: it comes from the shape. No source we read compares the two nets for collisions. Wu 2020 works on triangles of nearly equal sides. Goldenthal and others (2007) choose squares on purpose, for another reason: *locking*. A particle can move in 3 directions and each rigid link takes one away. A net of triangles has about 3 links per particle and nothing is left: the cloth turns to sheet metal. A net of squares has 2, and the one left over is the bend. So they keep the diagonals soft, as Strain Based Dynamics (2014) does on triangles. Our demo pages with 8 links have 4 per particle (each link counts for its two ends), all as stiff as rods by default, and still fold around a ball. Our guess, to measure: the links never quite reach their length, and that stretch is what lets the cloth bend.

**A particle in every square.** One more sphere at the middle of each square, not simulated: it stays at the average of its 4 corners, ignores them, and passes its pushes on to them. Wu 2020 adds such points inside stretched triangles. [Our second script](./self-collision-middles.mjs), a copy of our step in 3D: the gate goes to 1.73 r, and to 1.20 r at 60% of stretch; two cloths head on hold up to 9 m/s each, not 6; grains on a cloth stretched by 45% no longer pass. The price: 3.4 times the pairs to look at, and on the GPU cloths too stiff. Dropped ([chapter 074](../logbook/074-a-particle-in-every-square.md)).

**What substeps do.** At a given speed, more substeps mean less distance in each. In the same script a curtain that falls and folds crosses itself with 2 substeps and never with 3, and two cloths head on are safe up to 6, 9 and 12 m/s each with 2, 3 and 4. Twice the passes over the springs do not help.

## Choices and trade-offs

| Way | Who, as read in their code or text | What it costs |
| --- | --- | --- |
| **Fatter spheres.** The contact distance is larger than the spacing, and pairs closer than it at rest do not collide (a *rest-pose filter*) | NvCloth's sample at 1.3 times the spacing, PhysX's at 2. FleX's demos mostly keep 1, as we do | Thicker layers, more neighbours. At 2 times, the gate is 94% of the contact distance and opens only past 183% of stretch |
| **A cap on the move**, tied to the thickness | Ten Minute Physics: 0.4 r per substep, with 10 substeps. Some FleX demos 0.5 r. Small Steps, for fluids: 0.3 r, "no particle crossings". OGC 2025: each vertex may move 0.45 of its distance to the nearest thing | Slow falls, or more substeps. The cap has to count the springs too, not only the speed. With OGC's, two cloths brake to a stop just short of touching: it needs a push that starts before the spheres touch |
| **A cap on stretch.** No spring left longer than 10% over its length (*strain limiting*), or a *tether* from each particle to where the cloth hangs (*long range attachment*) | Provot 1995, one pass; NvCloth and Unreal's Chaos use tethers | Tethers do nothing for a free cloth, and leave neighbours free to stretch. Passes spring by spring converge slowly: on a fine mesh, 512 still leave 3% of stretch on average (Wang 2010) |
| **A side kept for a step.** For pairs about to meet, keep a plane between them, taken at the start of the step (*predictive contacts*) | Lewin at EA ([our notes](./predictive-contacts-talk.md)); Unreal's Chaos keeps a side bit per point and triangle; Bullet's newer soft bodies; Houdini's Vellum | Contacts made before the spheres touch. A crossing that lasts to the end of a step is kept |
| **Triangles, not only vertices.** A point against a triangle, an edge against an edge | Chaos (point against triangle only), Blender, Bullet's newer soft bodies, Obi's surface collisions, PhysX's newer cloth, Rapier since September 2026 | Another search, and contacts on four particles. No holes at all |
| **The whole path checked**, so nothing ever crosses | Bridson 2002, the I-Cloth and C-IPC papers, Wu 2020, Lan 2022 and 2024, OGC 2025 | See below |
| **Repair**: find the line where two layers cross and pull them apart, or fix the order of layers by hand | Baraff 2003, Chaos; layers in Lewin, Chaos, Vellum | Works after the fact |

Jolt and Havok have no collision between two cloths, and Godot says nothing of one.

**Fast on paper, slow in real time.** These papers count *steps* per second, with steps of 1/100 to 1/1200 s, not frames. Turned into time, on the GPU: Wu 2020 runs a shirt of 56 000 vertices at about half real time on an RTX 2080 Ti; I-Cloth 12 to 160 times slower than real time; Lan 2022 3 to 8 times for a skirt; Lan 2024 8 to 42 times. C-IPC, on a CPU, 150 times or more. Only OGC runs its small scenes, around 15 000 vertices, faster than real time, on an RTX 4090.

## On the GPU

Fatter spheres, the caps and a side read from the start of the substep fit the pass we have: each particle reads its neighbours and writes itself. The rest-pose filter needs no list for a cloth of ours: the number that names a particle, which it keeps while it changes place in memory, gives its row and column in the cloth. OGC's cap is one number per particle, from the distances the search for neighbours through the grid already measures, leaving out the neighbours in the cloth, which touch at rest and would make it zero. Triangles need a second search and a write to four particles at once, which our pushes never do. Tethers are one more run over the particles.

## In FORCE

The pages collide spheres one diameter apart, with the speed limit of decision 027. Cloths run at 3 substeps or more ([decision 043](../decisions/043-three-substeps-for-cloths.md)), where the limit is three quarters of a radius per substep ([decision 045](../decisions/045-a-tighter-limit-from-three-substeps.md)), and the hand that drags one moves no particle more than a radius in a substep ([decision 044](../decisions/044-a-hand-that-gives-way.md)). A cloth pulled hard through another still passes. The candidates left to try by script, none decided:

- a contact distance larger than the spacing, with the rest-pose filter;
- a tighter cap, or OGC's cap per particle, counting every move in a substep;
- a cap on stretch as the last pass over the springs;
- the side kept: the push along the direction the two had at the start of the substep, with contacts made from a little further away. Part 5 of the script: a particle that starts 2 r above the middle of four is held 1.45 r above the cloth, above the gate, because each contact keeps the direction it had at the start, which pointed more upward. That needs contacts made from 2.45 r away;
- a net of triangles, if it does not lock with rigid links.

Three of the ways need contacts made before two spheres touch: fatter spheres, OGC's cap and the kept side. Fatter spheres and OGC also push from there, and leave layers apart; the kept side only makes the contact early, and pushes at 2 r. The braking under OGC's cap and the need for that earlier push are our reading, not measured.

## Check yourself

1. Why does a particle on the middle of four meet less cloth than one on top of a particle?
2. Two cloths fly at each other at the speed limit. Why do 8 substeps not save them?
3. A push taken from where the two were at the start of the substep: what does it fix, and what can it not fix?

## Sources

Read in full, except where said. The notes of each reading stay in `library/notes/self-collision/`, out of git.

- Our own numbers: [self-collision.mjs](./self-collision.mjs), geometry only, and [self-collision-middles.mjs](./self-collision-middles.mjs), a copy of our step.
- Engines, one line each: Jolt's `Architecture.md`, Godot's `SoftBody3D` docs, Havok's cloth docs, Rapier's changelog and soft-body contacts.
- Engines in their code: FleX's manual, header and demos (its solver is closed); NvCloth's docs and self-collision code; PhysX 5.6's particle cloth and its newer cloth; Blender's `collision.cc`; Bullet's soft bodies, old and new; Unreal's Chaos 4.26 and 5.8, from unofficial copies of Epic's code. In their manuals: Obi, Houdini's Vellum. Ten Minute Physics 15: the code of the simulation.
- Papers on our case: Wu 2020 and Lewin 2018 (with his patent, US 10,692,266), see their notes; Unified Particle Physics 2014; Position Based Dynamics 2007; Small Steps 2019; the survey of position based methods, 2014.
- Stretch: Provot 1995; Long Range Attachments 2012; Goldenthal 2007; Wang 2010; Strain Based Dynamics 2014.
- The whole path and repair: Bridson 2002; Provot 1997; Baraff 2003; Air Meshes 2015; I-Cloth 2018; C-IPC 2021; Lan 2022 and 2024; Vertex Block Descent 2024; OGC 2025.
- Not opened, no free copy: Volino 2006 (contour minimization), Thomaszewski 2009 (strain limiting).
