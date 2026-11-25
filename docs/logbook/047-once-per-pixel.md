# 047 · Once per Pixel

*November 25, 2026 · 3 min read*

**In short:** the debug viewer has its soft shadows, and a page of its own to try them. We timed every way of drawing the particles, from 10 000 to a million: with shadows, working out the light once per pixel always wins, and at a million it halves the time.

## The story

**What was built.** [Chapter 046](./046-a-promise-not-yet-kept.md) ended with a choice and no shadow. Now [shadows.ts](../../examples/debug/shadows.ts) draws a frame in three passes. The *shadow map*: the particles as the light sees them, keeping only how far the first thing is. The *surfaces*: every sphere writes its depth, its color with no light and its normal into three textures. The *screen*: one triangle that covers it all reads them, and works out light and shadow for each pixel. That is *deferred shading*. The light stands still in the world, the floor and the ball take the shadows, and the edge is soft because each pixel reads the shadow map 5 times, around the point, and averages.

**The other way, kept to compare.** The same shadows also run *forward*: no textures in between, each sphere reads the shadow map in its own shader, hidden or not. A new page, [debug-viewer](../../examples/debug-viewer/index.html), switches between the two from its panel, with shadows cast by spheres, by flat discs or by nothing, and shows the GPU time of a frame's drawing. Two pages changed name on the way: force-plus is now heap-simulation, force-tilt is tilted-box.

**The measure.** `?drawtime=40` in the address waits for the pile to settle, reads the GPU time of the drawing 40 times, all passes added up, and writes the middle value. One load of the page for each way, in a Chrome without a window on our Mac M1, on a canvas of 3024 × 1790 pixels, a pile with friction 0.3, a shadow map of 2048 texels:

| Milliseconds to draw a frame | 10 000 | 50 000 | 100 000 | 1 000 000 |
| --- | --- | --- | --- | --- |
| No particles | 2.2 | 4.6 | 4.8 | 3.1 |
| Flat discs | 3.6 | 3.5 | 4.3 | 31.6 |
| Spheres, forward, no shadows | 4.5 | 5.2 | 8.9 | 60.6 |
| Spheres, deferred, no shadows | 6.3 | 6.0 | 13.1 | 54.9 |
| Forward, shadows from spheres | 11.1 | 14.1 | 24.7 | 134.6 |
| **Deferred, shadows from spheres** | **9.8** | **9.5** | **18.4** | **70.2** |
| Forward, shadows from flat discs | 10.6 | 12.9 | 24.3 | 130.2 |
| Deferred, shadows from flat discs | 9.0 | 8.1 | 14.9 | 67.3 |

**What the shadows cost.** Take a row with shadows and subtract the one without. Forward, at a million: 74 ms more. Deferred: 15 ms more. The shadow map is the same picture in both, so the rest of those 74 ms is hidden spheres reading it for nothing: the waste chapter 046 expected, with a number on it.

**Flat discs as casters.** The GPU can skip a hidden disc before its shader, which it cannot do for a sphere that writes its depth. It saves 1 to 3.5 ms, less than we hoped. The page keeps spheres as the start: their depth in the shadow map is the true one.

### What surprised us

**Without shadows, deferred loses.** Up to 100 000 particles, lighting a sphere in its own shader is cheaper than writing three textures and reading them back: 8.9 ms against 13.1. Our light is a few lines of shader, so there is little to save. Doing the costly part once only pays when a costly part exists.

**An empty scene is not free.** 2 to 5 ms with no particles at all: the floor, its grid and 5.4 million pixels. At a quarter of the pixels the same scene takes 0.7 ms.

## What we take away

- Deferred shading pays by what it does not repeat: with 5 reads of a shadow map per pixel it wins everywhere, with a cheap light it does not.
- The count of pixels weighs as much as the count of particles: at 10 000, a canvas with a quarter of the pixels draws in 3.9 ms, not 9.8.
- Shadows cost about 5 ms at 10 000 particles on this canvas: more than a screen at 120 Hz leaves for a frame, 8.3 ms. So they have a switch, and stay off on the other pages.
- These are one run each, with the simulation running. At 100 000 one same way read from 20 to 63 ms: trust the large gaps, not the small ones.

## Open questions

- A phone: none of this was measured there.
- The promise, `@builtin(frag_depth, greater)`: when browsers take it, hidden spheres may be skipped for free, in the surfaces pass and in the shadow map. The [depth-promise](../../examples/depth-promise/main.ts) page tells when; then measure again, with the user's idea of sorting front to back.
- At a million the spheres are smaller than a pixel or two: is a triangle each still the right way to draw them?

## Sources

- The live page with `?drawtime=`, `?draw=` and `?shadows=` in the address ([main.ts](../../examples/heap-simulation/main.ts)): debug-viewer for 10 000 and 50 000, heap-simulation for the rest. At a million, 15 readings after 200 steps: the pile was still settling.
- three.js r187, `WebGPUTimestampQueryPool.js`: a reading is the sum of all the passes of the last frame.
- [Decision 030](../decisions/030-viewer-shadows-shaded-once-per-pixel.md), with these numbers in.

## Next step

Back to the engine: the devices people sent, read against the rules of chapter 042.
