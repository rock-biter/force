# 030 · Shadows in the debug viewer, shaded once per pixel

*Proposed · November 24, 2026 · The user, after a page that asked the browsers for a promise they do not take yet ([chapter 046](../logbook/046-a-promise-not-yet-kept.md))*

**Decision:** we will draw the debug viewer's spheres in two passes, written by hand: a first one where every particle writes only its sphere's depth, its normal and its base color, and a second one, over the whole screen, that works out light and shadow once per pixel. The shadow comes from a shadow map, a picture of the depths seen from a light that stands still in the world.

This is a choice about our viewer, a tool, not about the engine in the npm package.

## Why

The user asked for soft shadows that the particles cast on each other, cheap enough for a million. A soft shadow reads the shadow map several times per pixel. Our spheres are impostors that write their own depth ([particles.ts](../../examples/debug/particles.ts)), and WebGPU tests the depth of such a pixel only after its shader has run: in a pile, ten spheres behind one pixel run the shader ten times. The promise that would let the GPU skip the hidden ones, `@builtin(frag_depth, greater)`, is refused by Chrome 158 and by the user's phone today. So the hidden pixels must at least be cheap: they write three values, and the costly part runs for the winner only.

## Not chosen

- **Waiting for the promise:** in the WGSL specification, but behind an experimental flag in Chrome. It can be added to the first pass later.
- **Real geometry, a small dome per particle:** the GPU skips hidden pixels by itself, at ten times the triangles.
- **Shields:** flat discs drawn first, that each sphere's shader reads to give up early. Every shader still starts, and it needs one more pass. It can be added later.
- **three.js's own shadows:** not checked against our impostors, and we would learn less.
- **Darkening only where spheres touch,** from the screen alone: cheaper, but it casts nothing.

## Consequences

- The scene is drawn into textures, not straight to the screen. The grid, the axes and the ball keep their materials and still hide each other correctly.
- What we asked for: a switch in the panel, and no shadow passes at all when the particles are drawn as flat discs or not drawn. A floor that receives the shadow, and a ball that casts and receives it.
- The light no longer follows the camera: the spheres will look different when orbiting.
- One more pass over every particle, from the light. The smoothing of the grid's lines must be asked of the texture, and is not tried yet.

## Still open

- In the shadow map: flat discs, which the GPU can skip when hidden, or the sphere's depth as the user proposed. To measure.
- The size of the shadow map and how many reads make the shadow soft.
- Sorting the particles front to back before drawing, for the camera and for the light: the user's idea, worth it only with the promise or the shields.

## Revisit if

- The two passes cost more than drawing the spheres directly at 100 000 or at a million particles.
- Browsers ship `fragment_depth`.
