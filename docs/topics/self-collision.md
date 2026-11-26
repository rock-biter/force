# Self-collision

*Theory · 5 min read · Updated November 26, 2026 · [Topic map](./README.md)*

**In short:** A cloth made of spheres is a wall with thin spots, and no memory of which side a thing was on. Engines keep it shut in four ways: fatter spheres, a cap on how far things move in a step, a cap on stretch, and contacts that remember the side.

## The idea

Lay marbles on a table in a square net, each touching its neighbours. From above it looks closed. Now press a marble down on the middle of four: it does not rest on top, it sits in the dimple between them, and pushing it down spreads the four apart. Our cloth is that net, and its springs are all that holds the four together.

In three.js terms: we collide the vertices of the mesh, as spheres, and never its triangles. A triangle is drawn but nothing can hit it.

Self-collision is a cloth hitting itself. Two cloths hitting each other is the same problem, and here it is solved by the same code.

## How it works

Three things let a particle through. The numbers are from [our script](./self-collision.mjs), for spheres of radius r one diameter apart. Heights are from the plane through the cloth's centers to the center of the other particle.

**1. The cloth is thin between particles.** Coming straight down on a particle of the cloth, another one touches it 2 r above the cloth. Coming down on the middle of four, it first touches 1.41 r above. We call that height the *gate*: it is all the cloth there is to stop it.

**2. A push has no side.** A push goes along the line between two centers. Once the center of the falling particle is below the plane of the cloth, that line points down, and the four push it out of the other side. And near the plane the push is almost all along the cloth: at 0.5 r above, only a third of it is across.

**3. Stretch opens the gate.** The further apart the four, along both sides of the square, the lower the gate:

| Cloth stretched, both ways | 0% | 12% | 20% | 30% | 41% |
| --- | --- | --- | --- | --- | --- |
| Gate | 1.41 r | 1.22 r | 1.06 r | 0.79 r | 0.15 r |

Just past 41%, at 41.4%, a particle passes without touching anything. A paper proves the same number in general: if no edge is longer than L, a mesh cannot be crossed as long as vertices that are not neighbours stay L/√2 apart (Wu and others, 2020). With our diameter as that distance, L is 1.41 diameters: a spring 41% longer than at rest.

**Why more substeps help less than hoped.** A *substep* is one of the smaller steps a frame is cut into: 2 on our pages. Our speed limit is one radius per substep for each particle ([decision 027](../decisions/027-the-safe-speed-limit-by-default.md)): with more substeps the limit in meters per second rises, and the distance per substep stays one radius. Two cloths meeting head on close 2 r in a substep. That is more than the gate between particles: a center can go from not touching to past the plane with no push in between, at any number of substeps. Against a cloth that stands still it is 1 r, and the gate holds. And the limit cuts the speed only: the springs, and the pointer that drags a cloth, move particles after it, as far as they like.

## Choices and trade-offs

What engines and papers do, from the cheapest change for us to the largest. "Prevents" means it cannot be crossed if the rule holds; "repairs" means it fixes a crossing afterwards.

| Way | Who | What it costs |
| --- | --- | --- |
| **Fatter spheres.** The collision distance is larger than the spacing, and two particles that are close in the cloth at rest do not collide (a *rest-pose filter*) | FleX, NvCloth, PhysX: its sample collides at twice the spacing | More neighbours per particle, a thicker-looking cloth, and the rest positions kept in memory. The gate is higher and opens later: at twice the spacing, past 180% of stretch |
| **A cap on the move, tied to the thickness.** | Ten Minute Physics: 0.2 of the thickness per substep, with 10 substeps. Wu 2020: a cap on the *displacement*, how far a vertex moves in a step whatever moves it | Slow falls, or more substeps |
| **A cap on stretch.** A spring is never left longer than, say, 10% over its length (*strain limiting*); or a *tether* from each particle to where the cloth is held (*long range attachments*) | Provot 1995; NvCloth and Unreal's Chaos use tethers | One more run over the particles. Tethers do nothing for a cloth held by nothing |
| **Contacts that remember the side.** Once per step, for pairs about to meet, keep a plane between them: they must stay on the side they started on (*predictive contacts*) | Lewin at EA, 2018; Obi calls its own speculative | A list of contacts to build and keep for the step |
| **Triangles, not only vertices.** A point against a triangle, an edge against an edge | Unreal's Chaos, Obi's surface collisions, Bullet between two bodies, the paper that introduced position based dynamics | Another search, and contacts on three or four particles. No holes at all |
| **The whole path.** Solve for the moment of touch (*continuous collision detection*), with a last resort for what is left | Bridson 2002; I-Cloth on a GPU at 2 to 8 frames per second | Not for games |
| **Repair.** Find what is tangled and pull it apart, or fix the order of the layers by hand | Baraff 2003; Lewin's layer order | Works after the fact |

Jolt has no collision between soft bodies at all, and Bullet's cloth hits itself only through clusters, groups of its vertices treated as small bodies.

Most engines for games stay with spheres, and combine the first three rows. Lewin's contacts work between two points too, but he put them on triangles, because a game's cloth has few points; ours has many.

## On the GPU

Fatter spheres, the caps and the side read from the start of the substep fit the pass we have: each particle reads its neighbours and writes itself. The rest-pose filter needs no list for a cloth of ours: a particle's name, the number it keeps while it changes row in memory, gives its row and column in the cloth. Triangles need a second search and a write to three particles at once, which our pushes never do. Tethers are one more run over the particles.

## In FORCE

Not yet. The pages collide spheres one diameter apart, with the speed limit of decision 027. Which of the four cheap ways to take is not decided: the next step tries them by script on fixed scenes.

A guess of ours, that no source makes: the side could be read from where two particles were at the start of the substep, positions we already keep for friction, with no list of contacts.

## Check yourself

1. Why does a particle on the middle of four meet less cloth than one on top of a particle?
2. Two cloths fly at each other at the speed limit. Why do 8 substeps not save them?
3. A cloth is pulled 30% longer both ways. How high is the gate, and what would keep it higher?

## Sources

- Our own numbers: [self-collision.mjs](./self-collision.mjs), geometry only.
- [15-selfCollision.html](https://github.com/matthias-research/pages/blob/master/tenMinutePhysics/15-selfCollision.html) and its slides, Ten Minute Physics: the code of the simulation read in full. Thickness equal to spacing, the cap, and no side.
- FleX's [manual](https://github.com/NVIDIAGameWorks/FleX/blob/master/doc/_sources/manual.txt) and `NvFlex.h`; NvCloth's pages on self-collision and tethers; PhysX 5.4's `SnippetPBDCloth.cpp`; an unofficial copy of Unreal 4.26's cloth code; Bullet's `btSoftBody`; Jolt's `Architecture.md`; Obi's manual. Read in parts, for what the table says.
- [A Safe and Fast Repulsion Method for GPU-based Cloth Self Collisions](https://wanghmin.github.io/publication/wu-2020-sfr/), Wu, Wu, Yang, Wang: sections 1, 3, 4.1 and 6.2.
- [Cloth Self Collision with Predictive Contacts](https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/gdc2018-chrislewin-clothselfcollisionwithpredictivecontacts.pdf), Chris Lewin, 2018: all five pages.
- [Robust Treatment of Collisions, Contact and Friction for Cloth Animation](https://www.cs.ubc.ca/~rbridson/docs/cloth2002.pdf), Bridson, Fedkiw, Anderson, 2002; Provot 1995; Long Range Attachments, 2012; Untangling Cloth, 2003; I-Cloth, 2018: read in parts.
