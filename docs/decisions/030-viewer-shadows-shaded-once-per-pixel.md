# 030 · Shadows in the debug viewer, shaded once per pixel

*Accepted · November 25, 2026 · The user, after a page that asked the browsers for a promise they do not take yet ([chapter 046](../logbook/046-a-promise-not-yet-kept.md))*

**Decision:** we will draw the debug viewer's spheres in two passes, written by hand: a first one where every particle writes only its sphere's depth, its normal and its base color, and a second one, over the whole screen, that works out light and shadow once per pixel. The shadow comes from a shadow map, a picture of the depths seen from a light that stands still in the world.

This is a choice about our viewer, a tool, not about the engine in the npm package.

## Why

The user asked for soft shadows that the particles cast on each other, cheap enough for a million. A soft shadow reads the shadow map several times per pixel. Our spheres are impostors that write their own depth ([particles.ts](../../examples/debug/particles.ts)), and WebGPU tests the depth of such a pixel only after its shader has run: in a pile, ten spheres behind one pixel run the shader ten times. The promise that would let the GPU skip the hidden ones, `@builtin(frag_depth, greater)`, is refused by Chrome 158 and by the user's phone today. So the hidden pixels must at least be cheap: they write three values, and the costly part runs for the winner only.

## Not chosen

- **Waiting for the promise:** in the WGSL specification, but behind an experimental flag in Chrome. See "Later".
- **Real geometry, a small dome per particle:** the GPU skips hidden pixels by itself, at ten times the triangles.
- **Shields:** flat discs drawn first, that each sphere's shader reads to give up early. Every shader still starts, and it needs one more pass. It can be added later.
- **three.js's own shadows:** not checked against our impostors, and we would learn less.
- **Darkening only where spheres touch,** from the screen alone: cheaper, but it casts nothing.

## Consequences

- The scene is drawn into textures, not straight to the screen. The grid, the axes and the ball keep their materials and still hide each other correctly.
- What we asked for: a switch in the panel, and no shadow passes at all when the particles are drawn as flat discs or not drawn. A floor that receives the shadow, and a ball that casts and receives it.
- The light no longer follows the camera: the spheres will look different when orbiting.
- One more pass over every particle, from the light. The floor paints its own grid, in the last pass.

## Measured

On November 25, on a Mac M1 and a canvas of 3024 × 1790 pixels ([chapter 047](../logbook/047-once-per-pixel.md)): with shadows the two passes draw a frame in 9.8 ms at 10 000 particles, 18.4 at 100 000 and 70 at a million, where each sphere reading the shadow map itself takes 11.1, 24.7 and 135. Without shadows the two passes cost more up to 100 000 (13.1 ms against 8.9), so the other pages keep the spheres lit in their own shader.

The shadow map holds the sphere's depth, on 2048 texels a side, read 5 times per pixel. Flat discs save 1 to 3.5 ms and stay a choice in the panel.

## Later

- **The promise,** `@builtin(frag_depth, greater)`: WebGPU's own way to skip hidden spheres. When browsers take it, add it to the surfaces pass and to the shadow map, and measure again. The [depth-promise](../../examples/depth-promise/main.ts) page tells when. three.js r187 does not write it: it will need a change there, or a shader of ours. Then the user's idea too: sorting the particles front to back, for the camera and for the light.

## Revisit if

Browsers ship `fragment_depth`, or a phone tells a different story: nothing was measured there.
