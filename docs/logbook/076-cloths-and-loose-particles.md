# 076 · Cloths and Loose Particles Together

*November 27, 2026 · 2 min read*

**In short:** Two new demos where cloths and loose particles share a scene: a net held by its corners that catches a block of them, and curtains over a heap, with a ball that throws the particles around. They are the first use of the number that says which body a particle is part of.

## The story

**What we wanted.** Until now a page had either cloths or loose particles. The user asked for both at once: a cloth held by its 4 corners that catches particles falling from above, with a ball under it to make them jump; then the curtains over the heap, with the ball that hits the curtains and throws the particles at them.

**What was missing.** The physics was ready: to the engine a cloth is particles joined by springs, and it pushes every pair of touching particles apart, joined or not. Two things around it were not.

*Who is what.* A page gave all its particles to the cloths. Now the cloths take theirs and the rest stay loose, as a block above the net or on the floor under the curtains. When the panel asks for more particles, the cloths stay as they are and the loose ones grow. The user caught that: at first more particles made more curtains.

*What to draw.* A cloth is drawn as a surface in place of its particles, and loose particles as spheres. With both in a scene, the spheres of the cloth must not be drawn. Since [chapter 075](./075-which-side-you-came-from.md) every particle carries the number of its *body*, the cloth or rope it is part of, 0 for none: the view gives a radius of 0 to every particle whose body is not 0. Its triangle becomes a point and nothing is drawn. The same number colors a cloth apart from the particles on it when everything is drawn as spheres.

**The body, twice in a day.** That number was added to keep a push's side only between two bodies ([decision 046](../decisions/046-the-side-kept.md)). Hours later it chose what to draw and in what color. The user had said it: an engine needs to know what belongs to what.

**The pages.** [A net full of particles](https://rock-biter.github.io/force/net/): a cloth of 40 by 40, held 3.5 m up, and 3 000 loose particles. [Curtains and a heap](https://rock-biter.github.io/force/curtains-heap/): six curtains and 4 000 loose particles. Both run at 3 substeps, with the side kept between each cloth and the particles.

### What is proven, and what is not

Checked in Chrome on this Mac: both pages start with no error, and the net holds its particles. Not measured: what they cost. Not tried: Safari and a phone.

## What we take away

- A cloth and a loose particle are the same thing to the solver: only the springs differ.
- One number per particle, its body, already serves the pushes, the drawing and the colors.
- To hide a sphere drawn by instancing, give it no radius.

## Next step

Open the pages in Safari and on the phone, then springs for any net.
