# Advanced Character Physics

*Reading notes · Thomas Jakobsen, 2001 · [Link](https://edelkas.github.io/n/files/bib/jakobsen.pdf) (a copy on a personal site) · [Topic map](./README.md)*

**In short:** the physics of the game Hitman, told with almost no math. Remember where each point was, move it, then push it straight back to where the rules hold, and the velocity follows by itself. It is the ancestor of *position based dynamics*, the family of methods that repair positions instead of computing forces, which got its name in 2006 ([chapter 012](../logbook/012-the-family-tree.md)).

## The question it answers

How do you make cloth, plants, boxes and falling human bodies move in a game, inside a fixed slice of each frame, without the heavy math of the precise methods? Jakobsen states the goal in his introduction: not accuracy, but "believability" and "speed of execution". Nothing may drift through a wall, shake while lying still, or blow up.

## The key idea

Four pieces, each one simple, that only work together.

### 1. Remember the last position, not the velocity

Each particle stores where it is and where it was one step ago. The velocity is never stored: it is the difference between the two. A step is `new = now + (now - before) + acceleration * dt * dt`, with `dt` the length of a step: keep going as before, plus what the forces add. This is *Verlet integration*.

### 2. Put a broken rule right by moving the point

A point that ended up inside a wall is moved out by the shortest way: *projection*. For a box from 0 to 1000 that is one line, `clamp(x, 0, 1000)` in GLSL terms. Nobody touches the velocity, yet it changes, because the position it is read from changed.

Take a floor at y = 0 and leave gravity out, to keep the numbers clean. A point goes from y = 2 to y = −3 and is clamped to 0. The next step reads its speed as 0 − 2 = −2, moves it to −2, and the clamp brings it back to 0. The step after reads 0 − 0 = 0: the speed into the floor is gone. The clamp touched only y, so the point keeps sliding along x and z.

The same move works between two points. A stick is "these two stay 1 m apart": if they are at 1.2 m, each one moves in by 10 cm along the line between them. Jakobsen reads it as a spring made infinitely stiff. A real spring that stiff makes a simulation blow up ([numerical integration](./integration.md)); this one cannot.

### 3. Many rules: go round again

Fixing the stick can push one end out of the box, and fixing the box breaks the stick again. So he repeats both, and each round the error shrinks: this is *relaxation*. Say a step left a stick of 100 with its ends at −20 and 60: too short, and one end outside the box above.

| Round | After the clamp | After the stick | First end outside by |
| --- | --- | --- | --- |
| 1 | 0, 60 | −20, 80 | 20 |
| 2 | 0, 80 | −10, 90 | 10 |
| 3 | 0, 90 | −5, 95 | 5 |

The rounds do not have to finish inside one frame. The next frame starts from the corrected positions, so the work spreads over time: for cloth, he writes, "only one iteration is necessary". He reports 1 to 10 rounds in Hitman, depending on the object.

### 4. Everything is particles and sticks

- **Cloth:** a particle per vertex of the mesh, a stick per edge.
- **A rigid body:** four particles at the corners of a tetrahedron and six sticks, with no rotation math at all. He says 3 or 4 rounds are enough. The shape you see, a box for example, is fastened to the tetrahedron and used only for collisions.
- **A joint:** two bodies that share one particle are pinned together; with two shared particles they form a hinge.
- **A dead body in Hitman:** simpler still, a stick figure, with "at least this far apart" sticks so that joints do not fold too far and legs do not cross.

When something hits a stick between its ends, the hit point is a mix of them, like `mix()`. A point a quarter of the way from the first end is 75% first end and 25% second, so the first end moves three times as much as the second.

### The small tricks

- **No square root.** The stick needs a distance, so a square root. He estimates it from a guess that is already almost right, the rest length. The estimate is the average of the guess and the number divided by the guess: for √144 with a guess of 10, (10 + 14.4) / 2 = 12.2. This is one step of the *Newton-Raphson* method. For a stick of 1 m, 1.20 m is corrected to 0.984 m, 1.05 m to 0.9988 m, 1.01 m to 0.99995 m.
- **Masses.** Each end moves in proportion to its inverse mass, 1 / mass. With an inverse mass of zero it never moves: that is how a hand is pinned to drag a body.
- **Friction.** After the projection, the sliding is slowed in proportion to how deep the point had gone, by moving the stored previous position, and it is never reversed.

## What it means for FORCE

- **His Verlet is our integrator.** FORCE updates the velocity first and the position after ([decision 006](../decisions/006-semi-implicit-euler.md)). The two give the same positions: 0.00000000015 m apart after 600 steps of free fall. Only what is stored differs. Alone, Verlet loses nothing: a spring let go 1 m from rest swings as wide in its last 20 s as in its first 20 s.
- **Projection is where the energy goes.** The paper says "energy might leave the system". We let go a pendulum of 1 m from horizontal, with one projection onto its stick per step. It should climb back to 1 m above its lowest point forever:

  | Steps per second | Climbs back to, after 10 s | After 30 s |
  | --- | --- | --- |
  | 60 | 14 cm | 0.4 cm |
  | 240 | 52 cm | 17 cm |

  A smaller swing does not help: let go from 10 degrees, it keeps 1% of its height after 30 s at 60 steps per second, and 31% at 240. The share lost depends on the step, not on the size of the swing. So the real question for us is not "Verlet or not" but "projection or not": change the positions, as here, or change the velocities, the two branches of [chapter 012](../logbook/012-the-family-tree.md).
- **One round per frame** looks like an early sighting of *Small Steps*, a paper of 2019 that found many small steps with one round each beating one step with many rounds. The link is ours; this paper does not make it.
- **A rigid body as a group of particles** is one side of the open question of [decision 004](../decisions/004-rigid-bodies-and-particles-first.md). His own conclusion says the tetrahedron "needs some work".
- **His relaxation is a queue:** one rule at a time, each using what the last one wrote. A GPU runs thousands of threads at once, so it needs another order ([chapter 012](../logbook/012-the-family-tree.md)).
- **His friction rule** has the shape of the one on our ground ([decision 013](../decisions/013-a-flat-ground.md)). Ours slows the sliding in proportion to the change in vertical speed at the hit, his in proportion to the depth.
- **The square root trick** leaves one division per stick, and he writes that it "can't be done much faster". Whether it is worth anything in a shader today is our doubt: not checked.

The tables and worked examples are ours, computed by [advanced-character-physics.mjs](./advanced-character-physics.mjs): run it with `node docs/topics/advanced-character-physics.mjs` and change its constants. The numbers of rounds are the paper's.

## What we did not understand

- **A sign on page 6.** In our copy the stick code reads `x1 -= ...; x2 += ...`, which sends 1.2 m to 1.4 m instead of 1 m. The version without the square root, on page 9, pulls the right way. We did not check whether the original article has the same slip.
- **How far to move a body that was hit.** We followed the reasoning with the 75% and 25%, but the formula on page 12 came out scrambled in our text copy and we did not rebuild it. For a tetrahedron the four weights need "a small system of linear equations", which the paper does not show.
- **The angle rule.** A limit on an angle can be a rule on a dot product, but how to move the points "is slightly more complicated", and he stops there.
- **The math under it.** One paragraph names differential inclusions, interior-point algorithms and the Jacobian of the rules. For us they are still only names.
- **When it fails.** How many rounds are enough is given by eye, with no measure. Stacked boxes are said to work, with no example.
- **Why the pendulum loses the same share at any size.** We measured it; we have not explained it on a page.
- **The figures.** We read the text of all nine sections, but looked at the figures of page 6 only.
