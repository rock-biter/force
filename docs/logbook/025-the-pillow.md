# 025 · The Pillow

*November 19, 2026 · 4 min read*

**In short:** two particles that touch must be pushed apart, and the first way we studied is a spring between them. On a GPU it needs no turns, but the spring is either soft and sinks, or stiff and blows up: at the stiffest spring that holds, the bottom of a column of 10 sinks 27 mm.

## The story

[Chapter 024](./024-twenty-seven-cells.md) found which particles touch, with a grid. Now they must be pushed apart. Take two spheres A and B, radius 0.1 m, with their centers 0.15 m apart: they have gone 0.2 − 0.15 = 0.05 m into each other. There are three ways out. Move them back, 0.025 each, as Jakobsen does ([chapter 013](./013-the-hidden-brake.md)). Change their velocities, so they stop coming closer, as Catto does ([chapter 014](./014-the-mirror.md)). Or put a spring between them, which is what NVIDIA's particle sample does. This chapter is the spring.

**The spring.** Simon Green's paper of chapter 024 comes with code, in CUDA, NVIDIA's language for the GPU, very close to GLSL. One line holds the idea:

```c
force = -spring * (collideDist - dist) * norm;
```

`collideDist - dist` is how far they went in, 0.05. `norm` is the direction from A to B, and the minus pushes A back, away from B. It is a pillow: the harder you press, the harder it pushes back. Two more forces follow in the code: a *dashpot*, a damper on the speed at which the two meet, and a sideways force against sliding. Takahiro Harada uses the same model for his rigid bodies made of particles, and calls it the *discrete element method*. A spring that pushes only where two bodies overlap is the *penalty method*.

**No turns.** On the GPU each particle gets a *thread*, a run of the program of its own. A's thread looks into the 27 cells of the grid around it, adds up the pushes of all its neighbours, and writes only A's velocity. B's thread does the same sum from its side and finds the same push, the other way. Do we still need the *turns* of [chapter 023](./023-the-first-free-turn.md), where contacts that share a particle wait for one another? "No, each particle writes itself," the user said. The pair is computed twice, once by each side, and nobody waits.

**The price.** A spring has one knob, *k*: how hard it pushes per meter of overlap. At rest it carries the weight, so it sinks by weight / k. One particle of 1 kg weighs 1 × 9.81 N, from gravity, so on another with k = 1000 N/m it sinks 9.81 / 1000 = 9.8 mm. In a column of 10, the bottom contact carries all 10: 98 mm, half a diameter. So make k bigger? Our [script](../topics/penalty-method.mjs) sets the column at rest, taps the top particle at 1 cm/s, and looks for the stiffest spring that stays calm, with nothing moved by more than 1 cm. A *substep* is a step cut into smaller ones: 2 substeps of 1/120 s instead of one of 1/60 s.

| | 60 steps per second | 2 substeps | 4 substeps |
| --- | --- | --- | --- |
| one particle on another | 14 100 N/m, sinks 0.7 mm | 54 600 N/m, sinks 0.2 mm | 187 000 N/m, sinks 0.1 mm |
| column of 10 | 3 600 N/m, sinks 27 mm | 14 700 N/m, sinks 6.7 mm | 58 900 N/m, sinks 1.7 mm |

Past those numbers the tap grows until particles fly away by meters. It is the limit of our [integration page](../topics/integration.md#the-step-limit): a spring that swings too fast for the step blows up. Halving the step lets in a spring about four times stiffer, as the column shows. And a substep does not stiffen the spring, it only lets us pick a stiffer one, as with the hanging chain of [chapter 015](./015-the-stiff-spring.md).

### What surprised us

**The column is four times weaker.** One particle on a fixed one holds up to 14 100 N/m, a column of 10 only 3 600. In the column each particle has two springs, one above and one below, and neighbours can move in opposite ways, so each spring is squeezed from both ends.

**A question without the arithmetic.** Claude, the AI assistant we study with, asked which k makes a column of 10 sink only 10 mm, and what happens then. "I don't know exactly, but I understood," the user said. The calculation on one line did it: 10 × 9.81 / 0.010 = 9 810 N/m, far above 3 600, and the script has the column fly apart after 0.23 s. With 2 substeps it holds.

**Green's code has no units.** It adds its force straight to the velocity, with no mass and no step, and its numbers (spring 0.5, damper 0.02, step 0.5) are tuned by eye for its own demo. The idea travels, the numbers do not.

## What we take away

- A spring per contact runs on a GPU with no turns: each particle adds up its pushes and writes only itself.
- One knob, two failures: too soft sinks by weight / k, too stiff blows up.
- Stacking makes it worse: a column of 10 holds a spring four times softer than one particle, and its bottom contact sinks 27 mm at 60 steps per second.
- Substeps let a stiffer spring in: 1.7 mm with 4 of them.

## Open questions

- The damper and the sideways force: how strong, and do they have a limit of their own?
- In 3D a particle can touch 12 others. Does the limit drop further? A guess, not tested.

## Sources

- Simon Green, [Particle Simulation using CUDA](https://developer.download.nvidia.com/assets/cuda/files/particles.pdf), NVIDIA, 2010: the three forces, by name.
- NVIDIA, the code of the particles sample at commit [0ec046d](https://github.com/NVIDIA/cuda-samples/tree/0ec046d5e99d7214cc8e9fbac2cc1e66f3019878/cpp/2_Concepts_and_Techniques/particles): `collideSpheres` in [particles_kernel_impl.cuh](https://github.com/NVIDIA/cuda-samples/blob/0ec046d5e99d7214cc8e9fbac2cc1e66f3019878/cpp/2_Concepts_and_Techniques/particles/particles_kernel_impl.cuh#L225-L256), the order of the passes and the constants in [particleSystem.cpp](https://github.com/NVIDIA/cuda-samples/blob/0ec046d5e99d7214cc8e9fbac2cc1e66f3019878/cpp/2_Concepts_and_Techniques/particles/particleSystem.cpp).
- Takahiro Harada, [Real-Time Rigid Body Simulation on GPUs](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-29-real-time-rigid-body-simulation-gpus), GPU Gems 3, 2007: sections 29.1.5 and 29.2.5, the same three forces and one shader that finds and pushes.
- Our script, [penalty-method.mjs](../topics/penalty-method.mjs): every number of this chapter.

## Next step

The second way, moving the particles, in [chapter 026](./026-the-marble-in-the-pocket.md).
