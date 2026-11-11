# 008 · The First Loop

*November 11, 2026 · 3 min read*

**In short:** the theory became code. FORCE now has a fixed-step loop and a semi-implicit Euler step on the GPU, and 1000 particles fall for ten seconds within a millimeter of the same steps computed in JavaScript.

## The story

Eight steps of study, zero lines of engine code. Two decisions were accepted, the [fixed timestep](../decisions/005-fixed-timestep.md) and [semi-implicit Euler](../decisions/006-semi-implicit-euler.md), and nothing had put them to the test yet.

Before the first line, the code asked three questions the theory had left open:

- **How long is a step, and how many per frame?** 1/60 s, and at most 4 per frame: below 15 FPS the game slows down instead of freezing ([decision 007](../decisions/007-step-length-and-limit.md)).
- **How do particles sit in GPU memory?** In a WGSL array a `vec3f` takes 16 bytes, not 12, as `vec3` does under `std140` in GLSL. So we use `vec4f`, and keep positions and velocities in two separate buffers, like the attributes of a three.js `BufferGeometry` ([decision 008](../decisions/008-particles-in-two-vec4-buffers.md)).
- **Which units, and which way is up?** Meters, seconds, and Y up, as in three.js ([decision 009](../decisions/009-meters-seconds-y-up.md)).

Then the code. [`FixedTimestep`](../../src/fixed-timestep.ts) is the accumulator, plain arithmetic, and its test replays the 50 FPS table of the [theory page](../topics/fixed-timestep.md#render-interpolation). [`integrate.wgsl`](../../src/shaders/integrate.wgsl) moves every particle by one step, one GPU thread each. [`World.update`](../../src/world.ts) takes the time of a frame and sends all the steps it needs to the GPU at once, one *dispatch* per step: a dispatch is the command that launches a shader on thousands of threads. The [falling-particles](../../examples/falling-particles/main.ts) example runs 600 steps and, every simulated second, reads the positions back and compares them with the same steps in JavaScript.

### A guess about the spec

Two steps in a row work only if the second sees what the first wrote. The [WebGPU specification](https://www.w3.org/TR/webgpu/) says that each dispatch is its own *usage scope*, a stretch of work whose parts may run at the same time. It does not say in so many words that one dispatch waits for the one before. That was our reading, so we let the numbers decide: a lost step would put particles at least 16 cm off. All ten checks passed.

### Predicting the noise

The GPU counts with 32-bit floats and JavaScript with 64-bit ones, so the two never agree exactly. The first draft of the check allowed a difference of 0.01% of each number. Before running it, a short Node script that rounds every operation to 32 bits showed it would fail for nothing: near the ground, where a height is close to zero, even a tiny drift is a large share. We switched to a fixed limit of 1 cm. The script predicted a worst drift of 0.9204 mm after 600 steps; the GPU gave 0.920 mm.

### The table, live

The page also counted the steps run in each frame: 400 frames with one, 100 with two. That is the pattern of the 50 FPS table on the theory page, four frames with one step and one with two, this time from a real browser that happened to draw about 50 frames per second. No frame reached the limit of 4, so simulated time kept pace with real time.

## What we take away

- Code asks the questions theory leaves open: three decisions came before the first line.
- A `vec3f` in an array takes 16 bytes anyway: better to see the fourth float and use it.
- Measure the noise before writing the test: a check tighter than float rounding fails for nothing.
- A guess about the spec becomes a fact only when a test could have proved it wrong.

## Open questions

- Who blends the last two states for drawing, the engine or the renderer ([decision 005](../decisions/005-fixed-timestep.md)).
- What goes in the free fourth slot ([decision 008](../decisions/008-particles-in-two-vec4-buffers.md)).
- Whether 4 steps per frame is the right limit on phones ([decision 007](../decisions/007-step-length-and-limit.md)).

## Sources

- [WebGPU specification](https://www.w3.org/TR/webgpu/), section 3.4.4: in a compute pass, each dispatch is one usage scope.
- [Box2D overview, Units](https://github.com/erincatto/box2d/blob/main/docs/overview.md#units): tuned for meters, kilograms and seconds, and for moving objects from 0.1 to 10 m.

## Next step

The first series of WebGPU guides, built from this code.
