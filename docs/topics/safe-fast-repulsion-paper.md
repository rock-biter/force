# A Safe and Fast Repulsion Method for GPU-based Cloth Self Collisions

*Reading notes · Longhua Wu, Botao Wu, Yin Yang, Huamin Wang, 2020 · [Link](https://wanghmin.github.io/publication/wu-2020-sfr/) · [Topic map](./README.md)*

**In short:** A cloth collided only at its vertices can be proven never to cross itself, if no edge gets longer than L and no two vertices not joined by an edge get closer than L/√2. A cap on how far a vertex moves keeps that true between two checks. Fast for its kind, but not a game's 60 Hz.

## The question it answers

Can a cloth be kept from crossing itself using only pushes between vertices, with no test of a point against a triangle and no solving for the moment of touch, and with a proof?

## The key idea

A point can only pass through a triangle if, at that moment, it is close to one of the triangle's corners. How close depends only on the lengths of the edges:

- a point inside a triangle is at most the circumradius (the radius of the circle through its three corners) from the nearest corner, or half the longest edge if the triangle has an obtuse angle. With every edge at most L, the worst case is L/√3;
- where an edge crosses an edge, one of the four ends is at most ½·√(e₁² + e₂²) from another. With both at most L, that is L/√2, two edges crossing at right angles through their middles.

So: cap every edge at L, keep every pair of vertices not joined by an edge at least B = L/√2 apart, and no crossing can exist. Section 3 and appendix A prove the bounds.

**Between two checks.** A vertex moves in a straight line during a *collision step*, the unit of their solver. Ask for a little more distance at the end, B + B_tight, and let no vertex move more than √((B + B_tight)² − B²). Then no pair gets closer than B anywhere on the way (equations 7 to 10). With their numbers, B = 6 mm and B_tight = 0.5 mm, a vertex may move 2.5 mm.

**Enforcing it.** A quick phase of *penalty* pushes (a push that grows with the overlap), then a test of every pair over the whole move. If the test fails, a slow phase that is safe at every iteration, with a *barrier* (a push that grows without bound as the distance nears B). A test over all pairs is costly on a GPU, so they test only once every 12 collision steps, and redo the 12 carefully when it fails.

**Two copies of the positions.** One moves freely with the forces; the other, the one shown, follows it by at most 0.25 mm per collision step, a tenth of the 2.5 mm allowed, and is always safe. 72 collision steps per time step of 1/100 s.

**Stretched edges.** When an edge passes 6.5 mm, an extra point is switched on in its middle, and inside a triangle if needed, so the bound still holds. Edges are capped at twice their rest length.

**Numbers.** Edges of 4.2 mm at rest, L = 8.5 mm, B = 6 mm. Time step 1/100 s. Shirt, 56 000 vertices: 39 to 61 steps per second on an RTX 2080 Ti, so about half real time. Their I-Cloth comparison: 50 against 4.8 steps per second.

## What it means for FORCE

- It is the theory of what we do: collisions at the vertices only. Our script found the 41% by another way, for a point through the middle of a square: that is the bound for a right triangle, half its longest edge.
- Our reading, not theirs: on our grid the longest edge is a square's diagonal, 1.41 diameters at rest. L/√2 is then one diameter, our contact distance exactly. The proof leaves us no margin at rest, and none once stretched.
- They do not collide vertices within two rings of each other in the mesh (neighbours, and neighbours of neighbours): without that the method could not start. That is a rest-pose filter, and the proof does not cover those pairs.
- The cap counts every move of a vertex, springs included, not only its speed. Ours cuts the speed only.
- Nothing remembers a side. Safety is "never closer than B": once that fails, nothing brings it back.

## What we did not understand

- How the test over the whole move is written once the extra points in stretched triangles are on.
- How the stop of the slow phase is set: no values are given.
