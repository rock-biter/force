# Cloth Self Collision with Predictive Contacts

*Reading notes · Chris Lewin, Electronic Arts, Game Developers Conference 2018 · [Link](https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/gdc2018-chrislewin-clothselfcollisionwithpredictivecontacts.pdf) · [Topic map](./README.md)*

**In short:** Once per step, find the pairs that might meet during it, and give each a plane: "stay on the side you are on now". The solver, the code that moves particles until every rule holds, then only pushes things back to their own side, however far they were dragged. It works for two points, a point and a triangle, two edges.

## The question it answers

How to keep a game's cloth from crossing itself with few solver passes, steps of 1/30 s, characters that move very fast, and a budget of fractions of a millisecond.

## The key idea

Trust the state at the start of the step. Run one cheap search for pairs that might come close during the step, and store for each a *half-space*: everything on one side of a plane. The pair must stay on the side it started on.

Example, with the same two particles throughout: A sits 1 cm above B and falls fast. The search sees they might meet, and stores the plane between them, facing from B to A. Later in the step a spring drags A 5 cm down. The contact pushes A back above B along that plane's direction, never out below: "it doesn't matter how far through the contact plane the point is pushed", it ends up on its own side.

**When a contact is made.** If the two might come within their radii plus a margin during the step. The margin is what he calls the *static collision radius*. For two points, the closest the two straight paths come, each point moving by its velocity times the step. The moves the springs will add are not counted: only the margin covers them.

**The three contacts** (section 4 and the patent US 10,692,266, which gives the formulas the write-up leaves out):

- **Point and point.** n is the direction from B to A at the start of the step, kept for the whole step. Rule: n · (A − B) ≥ 2 r. A and B are pushed apart along n, not along the line between them now.
- **Point and triangle.** The normal of the triangle is taken again at every pass; only which side the point is on is kept, as one bit. Rule: the point stays 2 r above the triangle's plane, on its side.
- **Edge and edge.** The closest points of the two edges at the start, and the direction between them, are kept; then it is like two points.

**Search.** A tree of boxes, each around one point or triangle, stretched along its move and grown by the margin.

**Numbers.** A whole game character, 0.4 ms per step of 1/30 s, on one CPU thread; a skirt 0.2 ms; two flaps on a leg 0.1 ms. Those use two shortcuts: the side between layers of a garment set by hand, and contacts computed once at load. The general method: a ribbon tied into a knot 20 ms, a cloth on a turning sphere 1 s, per step.

## What it means for FORCE

- Point and point is what we have, and the author says why he did not stop there: "an obvious problem when the density of points in the cloth is low". Game meshes have few points; ours has many.
- The direction from the start of the step is a change of one line in our push: we already keep the start positions, for friction. Our script works out what it gives over the middle of four particles: held 1.45 r above the cloth at rest, 0.84 r at 41% of stretch. That is for a particle starting 2 r above the cloth, and only if all four contacts exist: today we make a contact only when two spheres overlap, and at rest these start 2.45 r apart.
- It fixes the push with no side, and holds through stretch. It does not undo a crossing: if a step ends crossed, the next step's planes are taken from the crossed state and keep it.
- The kept plane is stricter than two spheres: two particles cannot roll around each other within a step. The author reports odd friction from it.

## What we did not understand

- How many contacts a point keeps, and their order against the springs: not said.
- Two of the write-up's formulas have a sign reversed; we read the one that makes the rule hold at the start.
- The later GPU cloth of the same studio (GDC 2024) could not be opened.
