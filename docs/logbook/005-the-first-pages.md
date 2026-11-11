# 005 · The First Pages

*November 11, 2026 · 3 min read*

**In short:** we agreed on what "studied" means, and wrote our first two theory pages: numerical integration and the fixed timestep. Twelve concepts and two articles are now "studied".

## The story

After the ChatGPT detour, the map said "seen" for things we felt we had studied: the fixed timestep, the difference between explicit and semi-implicit Euler, both covered by Glenn Fiedler's articles we had read. So who was right?

Both, in a way. "Studied" had been defined by the docs, "it has a page", instead of by the person learning. We turned each status into a question to ask yourself:

| | Status | The test |
| --- | --- | --- |
| ○ | Mentioned | "I have heard the name." |
| ◐ | Seen | "I can say in two sentences what it is and why it exists." |
| ● | Studied | "I can explain how it works, with an example, and when it fails." |

We kept the page, though. "Studied" still needs a page of ours, but the page is no longer paperwork: it is the last step of studying. Writing it together is the review, and it is what lets anyone check the status.

### Two pages, one script

[Numerical integration](../topics/integration.md) and [Fixed timestep](../topics/fixed-timestep.md). Before writing, we reread Fiedler's two articles, then checked every number with a short script that now lives next to the page: `node docs/topics/integration.mjs`.

The script had its own surprises:

- **Free fall is a bad test.** Explicit and semi-implicit Euler miss by the same 0.49 m, in opposite directions. The difference only shows when the force depends on position, as in a spring.
- **Explicit Euler is worse than it sounds.** On a spring it multiplies the energy by 5 in one second, and by 14 million in ten.
- **RK4 looked perfect.** At three digits its energy never moved. It does lose energy, as Fiedler writes, but only 0.02% in ten seconds: we had to print more digits to see it.

One page can cover many topics: each concept on the map can point to a section, such as `integration.md#substeps`, and the check now makes sure that section exists. We broke an anchor on purpose to see it fail.

### The reader test

Before closing, an agent with no context read both pages as a JavaScript developer new to physics. It caught a claim we had inherited from ChatGPT: velocity Verlet does not cost two force computations per step, because the force at the end of one step is reused by the next.

It also asked *why* where the pages only said *what*. Why does explicit Euler gain energy? Because at every step it multiplies it by 1 + (dt·ω)², where ω says how fast the spring swings: our script confirmed it to the third digit. Why does blending remove the stutter? A five-frame table at 50 FPS now shows it, and it held one more surprise: the blended picture is not "up to" one step behind the simulation, as we first wrote, but exactly one step.

### An old acquaintance

One more source moved on the map. In the ChatGPT conversation, the NVIDIA paper remembered from years ago, the one with meshes turned into particles, was taken for FleX. It was something else: [Real-Time Rigid Body Simulation on GPUs](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-29-real-time-rigid-body-simulation-gpus), by Takahiro Harada, chapter 29 of GPU Gems 3. Chess pieces made of spheres fall and collide, found through a uniform grid and pushed apart by springs and dampers. It was the starting point of a first attempt at a WebGL engine. Read only in part, so for now it is "seen".

### When a studied topic grows

The second question was about the future: what happens when we learn more about something already studied? Pages stay alive. A new detail updates the page, its date and its sources. A new idea becomes a new branch on the map, attached to the old topic, which stays "studied": depth grows as branches, not as a higher grade. A mistake gets fixed, and told in the logbook.

## What we take away

- A status describes what you know; the page is how we show it.
- Depth grows as new branches, not as a higher grade.
- A number in the docs needs the script that produced it.
- A claim copied from a summary is a claim not checked yet.

## Next step

To decide: turn the theory into code, with a fixed-step loop and semi-implicit Euler in FORCE, or write the third page, on rigid bodies.
