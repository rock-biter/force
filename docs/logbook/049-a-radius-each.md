# 049 · A Radius Each

*November 25, 2026 · 3 min read*

**In short:** a new page where every particle has its own radius, the largest up to twice the smallest, of one material or of several. The radius brought us back to a wall we knew, 8 storage buffers per shader, and to a rule: a particle's properties share one buffer.

## The story

**What the user chose.** After the script of [chapter 048](./048-big-and-small.md): sizes up to 2 to 1, and one speed limit for all, from the largest radius, so that small particles do not fall slower than large ones ([decision 031](../decisions/031-particles-of-different-sizes.md)). And two kinds of scene. *One material:* every particle has the same density, so a larger one weighs more, 8 times at twice the radius. *Several materials:* each particle also has its own density, from 1 to 10, and weighs its density times its volume.

**Where a radius goes.** A particle on the GPU is four numbers: x, y, z and 1 / mass. There is no room for a radius. Three shaders need it: the one that makes the lists (two are neighbours when closer than their two radii plus the margin), the levels of the pile, and the rounds (two overlap by their two radii less their distance).

**The ninth buffer.** The first version gave the radii a buffer of their own, and failed: "The number of storage buffers (9) in the Compute stage exceeds the maximum per-stage limit (8)". The shader of the lists already read 8. A device gives 8 unless asked for more, and Chrome on our Mac has 10, so Claude made the page ask for 9. "Which are the 8?" the user asked. "Having used them all is a problem: we still have to add springs and the rest of the engine."

**The limit is per shader.** Each shader has its own 8, so springs, with shaders of their own, start from zero. But two of ours are full, the lists and the one that moves particles into order, and the rounds are at 7: that is where every new property of a particle would land.

**One buffer for what a particle is.** As a texture in GLSL carries four values in its channels, a buffer can carry four numbers per particle: the radius first, three free ([decision 032](../decisions/032-a-buffer-of-particle-properties.md)). To make room for it in the lists, a particle's row of neighbours now begins with its count, 33 numbers, and the buffer of the counts is gone. The lists read 8 buffers again, and the page asks the device for nothing.

**Not touching what people time.** The benchmark page runs our shader files, and people send us their times: the files must stay as they are. So the three shaders with sizes are copies, in [examples/mixed-sizes](../../examples/mixed-sizes/list-sized.wgsl). The user asked for it: copies, until the benchmarks are closed.

**The page.** [mixed-sizes](../../examples/mixed-sizes/index.html): 20 000 particles with friction at 60 frames a second on our Mac M1, a step in 4.0 ms, no neighbour left out of a list. The viewer reads each sphere's radius from the same buffer.

## What we take away

- A limit of a device is a default: the device gets more only if asked. But asking shuts out the devices that have no more.
- 8 storage buffers are for each shader, not for the engine. Count them shader by shader.
- Pack what belongs together: four properties in one buffer, a count at the head of its list.
- The margin of the lists follows the smallest particle, so lists are made more often: in 57% of the substeps while the pile settled.

## Open questions

- Three buffers serve the cached lists of neighbours. Are they still worth it, and can they be packed? The next study.
- Nothing was measured on this page beyond one reading: the cost of the properties, a phone, whether small particles pass through each other at 2 to 1. "Several materials" was not looked at on screen.

## Sources

- The page and its code: [main.ts](../../examples/heap-simulation/main.ts), `radiiOf` and `properties`; [particles.ts](../../examples/debug/particles.ts) for the drawing.
- The error message of Chrome 158, quoted above, and the [WebGPU specification](https://www.w3.org/TR/webgpu/#limits) for the 8 storage and 12 uniform buffers per shader.
- Ogarko and Luding, 2010, which the user read in full after chapter 048: its topics are on the map.

## Next step

The cached lists of neighbours: what they cost in buffers, and what they save.
