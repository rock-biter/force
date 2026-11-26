# 067 · A Hand on the Cloth

*November 26, 2026 · 3 min read*

**In short:** three more pages with cloths: curtains, a pile on the floor, one with no gravity. And the pointer becomes a hand that takes hold of a cloth and drags it, firmly in the middle and less and less around it.

## The story

**Three pages, one function.** The cloth of [chapter 063](./063-a-cloth.md) was one net, written for one shape. Now a cloth is a *patch*: so many particles wide and tall, named from a first one on, with a place for each and a rule for which are held. A page is a list of patches. [Curtains](../../examples/curtains/index.html): seven of 20 by 70, held by their top rows. [A pile](../../examples/cloth-pile/index.html): twelve squares of 24 by 24 dropped on each other, held by nothing; the panel sets how many cloths, and how many particles on a side of each. [No gravity](../../examples/cloth-float/index.html): three of 60 by 60 in the air, each bent into a wave from the start, the way a sheet of paper bends, so that no spring starts stretched. The groups of springs did not change: two cloths share no particle, so they use the same twelve groups. Each cloth has its own color, as a surface and as particles.

**A hand needs three answers.** Which particle is under the pointer, whom the hand holds with it, and where it takes them.

**Which particle.** The positions live on the GPU, and the pointer in JavaScript. So every few frames the page reads the positions back, and when the pointer goes down it looks in that copy for the particle nearest to the eye among those the pointer's ray passes within 15 cm of. The copy is a few frames old. A hand does not notice.

**Whom.** Dragging one particle pulls the cloth into a spike. So the hand also holds its neighbours, each with a *weight*: 1 for the one picked, falling smoothly to 0 one meter away. That meter is counted along the cloth, in particles, not through the air: a fold lying under the hand, or the cloth below in a pile, is not taken along.

**Where.** The point picked becomes a *handle*. It moves on the plane through it that faces the camera, to stay under the pointer: dragging never pushes the cloth toward the eye or away. Like the ball, the handle does not jump: it covers a share of the way at each step, at 10 m/s at most, and the GPU is told where it is at every substep.

**On the GPU, one small pass.** [grab.wgsl](../../examples/cloth/grab.wgsl) runs before the springs. Each particle with a weight moves toward its place around the handle by a share of the way: its weight times a *pull*, 0.5 at the start. It moves the predicted position, as our springs and contacts do: nothing is a force. The springs then drag the rest of the cloth along, and when the hand lets go the cloth keeps the speed it had: it can be thrown.

**With no gravity, something must move.** A cloth left alone would stand still for ever. [predict-drift.wgsl](../../examples/cloth-float/predict-drift.wgsl) adds a *drift* where gravity was: a push that changes from place to place and with time, a few sine waves added up, 0.5 m/s² at most. Each part of the push depends on the other two coordinates, so neighbours are pushed almost alike and the cloth waves instead of shaking. The box got a ceiling, since nothing keeps the cloth down.

### What surprised us

**The first drift was a wind.** At 2 m/s² the cloth was a crumpled ball in a corner of the ceiling in ten seconds. With a drag of 0.5 per second, a steady push of 2 m/s² ends at 4 m/s.

**A page that draws nothing in a screenshot.** Chrome without a window, when its clock is driven by hand, ran a few steps and drew no surface. Driven in real time, with a mouse sent by script, it showed all three pages and the drag.

## What we take away

- A hand is a weight per particle and a handle that moves: the same pass could hold a cloth to anything that moves.
- Count the reach along the cloth, not through the air.
- The plane of the drag faces the camera, through the point picked.

## Open questions

- All of this lives in the pages. What of it the engine should offer, and how: a hand, a force that changes in space, several cloths. To decide.
- The pull is taken at every substep: more substeps make the same pull firmer.
- Picking reads every particle back and tries them all in JavaScript: fine for 10 000, not for a million.
- A cloth drawn as a surface casts no shadow.
- Checked on the Mac only, with a mouse. A finger on a phone: not tried.

## Sources

- Our own code: [main.ts](../../examples/heap-simulation/main.ts), `patchesOf` and "the hand".

## Next step

The user's choice: what of the hand, the drift and the patches goes into the engine, or one of the three left from chapter 066.
