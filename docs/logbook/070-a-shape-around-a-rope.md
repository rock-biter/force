# 070 · A Shape Around a Rope

*November 26, 2026 · 3 min read*

**In short:** The ropes can be drawn as boxes, cylinders or flat ribbons, not only as particles. A rope is a line, and a shape around a line needs to know which way is "sideways" at every particle: we carry that direction down the rope.

## The story

**What we wanted.** The ropes of [chapter 062](./062-the-first-ropes.md) were drawn as their particles. The user asked for three more looks on [the ropes page](../../examples/ropes/index.html): a box, a cylinder and a flat ribbon, each with its subdivisions, and with normals that follow the vertices as the rope moves. The rope's turning around its own axis is left out for now.

**A ring per particle.** Every particle gets a *ring* of vertices around it, and two rings in a row are joined by triangles. So the shape has one subdivision per particle, and bends where the rope bends. A ribbon's ring has 2 vertices, a cylinder's 8. A box's has 8 too, not 4: a corner belongs to two faces and needs a normal for each, or the light rounds the edge off. As for the cloth, nothing is copied: the vertex shader reads the particle's position from the simulation's buffer.

**The problem: which way is sideways?** A particle on a rope knows the rope's direction there, from the particle before it to the one after. A ring also needs two directions *across* the rope, and a line has none. The cheap answer is a fixed one: "sideways is whatever is square to the rope and to the Z axis". It fails as soon as a rope points along Z: the ring flips, and the box twists like a wrung towel.

**The answer: carry it.** Think of walking down the rope holding a stick out to your side. At every bend you turn with the rope, by the smallest turn that does it, and never spin the stick around the rope. That is what [rope.ts](../../examples/debug/rope.ts) does. At the first particle, the stick is the Z axis, turned by the smallest turn that brings "straight down" onto the rope's direction. At each next particle, it is turned by the smallest turn that brings the old direction of the rope onto the new one. The second direction across is the cross product of the rope's direction and the stick. The normal of a vertex is written in its ring along those two, so it turns with them.

**It is a loop in the vertex shader.** The vertex of the 20th particle walks the 20 before it. In three.js's shading language (TSL) that is a `Loop` inside an `Fn`, and it compiled to WGSL at the first try. The walk gives back three vectors, and a function gives back one value: they travel as the three columns of a `mat3`.

**No twist, by construction.** The simulation knows nothing about a rope turning around itself: particles are points. The drawing adds none either: the stick only turns as much as the bends force it to.

### What we checked, and what not

Seen in Chrome without a window, on the Mac: the three looks and the wires, 100 ropes leaning and starting to swing, with no error in the console. Not checked: Safari, a phone, and ropes pushed around by the ball for long. The time it costs was not measured.

## What we take away

- A line has a direction, not a side. A shape around it needs one, and it has to come from somewhere.
- A side taken from a fixed axis flips when the rope points along that axis. A side carried along the rope does not.
- One vertex per corner gives round edges. A hard edge needs a vertex per face.
- A vertex in no triangle is never drawn: every particle can have the vertices of a cap, and only the ends use them.

## Open questions

- The names are from Claude's memory, and no source was opened: carrying a direction this way is called *parallel transport*, the result a *Bishop frame*, the smallest turn *Rodrigues' rotation*. To check before they are cited anywhere else.
- The walk costs more the further down the rope a vertex is. An engine would keep the directions in a buffer, written by a compute pass.
- If the first piece of a rope points straight up, there is no smallest turn from "straight down". The code only avoids a division by zero there.
- These shapes cast no shadow and ignore the shadow settings, as the cloth's surface does.
- A real twist of the rope around its axis: left out, as asked.

## Sources

- Our own code: [rope.ts](../../examples/debug/rope.ts), and [cloth.ts](../../examples/debug/cloth.ts) for reading positions in the vertex shader.

## Next step

The user's choice: look at the ropes in the three shapes, then back to the engine.
