# 046 · A Promise Not Yet Kept

*November 24, 2026 · 3 min read*

**In short:** before going on with the engine, we want soft shadows between the particles of the debug viewer. The trick that would make them cheap is in the WGSL specification but not in our browsers yet. We chose another way to draw, and wrote no shadow so far.

## The story

**What the user asked.** A shadow that the particles cast on each other, soft, that can be switched off, and light enough for a million particles. And a wider question we never studied: how to draw so many impostors well. An *impostor* is our sphere: one flat triangle that a shader paints round ([chapter 009](./009-the-first-picture.md)).

**Two things in the way.** The light of the viewer follows the camera, and a shadow needs a light that stands still in the world. And the usual way to make shadows, a *shadow map*, draws every particle once more, as seen from the light, keeping only how far the first thing is. Each pixel of the screen then asks: am I farther from the light than that? Then something is in front of me.

**The talk the user remembered.** A GPU normally compares a pixel's depth with what is already drawn *before* running its shader, and throws a hidden pixel away for free (the early depth test). Our spheres write their depth in the shader, like `gl_FragDepth` in GLSL, so the GPU has to run the shader first: in a pile, ten spheres behind one pixel run it ten times. The user had seen a talk about a way out. It exists in WGSL as `@builtin(frag_depth, greater)`: a promise that the depth written is never nearer than the triangle's. If the triangle sits at the front of the sphere and is already hidden, the sphere is too. That last step is our reading: the specification only states the promise.

**A yes that was a no.** We wrote a page, [depth-promise](../../examples/depth-promise/main.ts), that asks a browser whether it lists the feature, `fragment_depth`, and builds a pipeline with the promise. Claude ran it in a Chrome without a window and it said yes. The user ran it in Chrome 158 on the Mac and on the phone: no, and the pipeline refused. Claude's Chrome had been started with `--enable-unsafe-webgpu`, which also switches on features still being tried. Without the flag it answers as the user's does. Also, three.js r187 always writes the builtin without the second word.

**Can we fake it?** Not really: when a shader writes its depth, the test comes after it, and nothing in a shader can change that. But two things come close. *Shields:* draw cheap flat discs first, a little smaller and farther than each sphere, and let every sphere's shader read them and give up at once if it is behind one (a depth pre-pass). *Shading once:* let all ten spheres run a tiny shader that writes only depth, normal and color, then work out light and shadow in a second pass over the screen, once per pixel, for the winner only (deferred shading). The first tries to stop wasted work halfway; the second makes it cheap. The user chose the second, by hand: [decision 030](../decisions/030-viewer-shadows-shaded-once-per-pixel.md), with a floor and the ball of the live page in the shadows too.

**An idea kept for later.** "Could we sort the particles by the camera before drawing?" the user asked. Front to back, the near ones would be drawn first and hide the rest early. A rough order in bands of depth would do, counted as the engine counts its cells. But it only pays with the promise or the shields, so it waits.

## What we take away

- A shader that writes its own depth gives up the free test before it: every covered pixel runs.
- If hidden work cannot be skipped, make it small, and do the costly part once per pixel.
- A flag that "enables WebGPU" may enable more than the user's browser has: ask a browser as the user runs it.
- A feature in the specification is not a feature in the browser.

## Open questions

- Does Chrome with the flag really skip the hidden pixels, and how much is that worth on a pile?
- Flat discs or sphere depth in the shadow map; what the two passes cost at a million particles.

## Sources

- The WGSL specification, [the `frag_depth` builtin](https://www.w3.org/TR/WGSL/#built-in-values-frag_depth), for the promise and its two modes, and the [WebGPU specification](https://www.w3.org/TR/webgpu/) for when the depth test runs.
- three.js r187, `src/renderers/webgpu/nodes/WGSLNodeBuilder.js`, `getFragDepth()`.
- The talk the user remembered is not found yet: nothing here rests on it.

## Next step

Make the light stand still in the world, then the first pass that writes depth, normal and color.
