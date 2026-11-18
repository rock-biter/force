# 024 · Twenty-Seven Cells

*November 18, 2026 · 4 min read*

**In short:** the first real piece of the engine will be particles that collide. No code today, only how they find each other: a grid of cells as big as a particle, 27 cells to look into, two ways to fill the grid, and the test between two spheres. Explained in chat, one idea at a time.

## The story

[Chapter 023](./023-the-first-free-turn.md) wanted a decision on how the rules of physics take turns on the GPU. The user said it was too early: we have not chosen how objects are made, and we never studied how they find each other. So we start from the simplest object, a *particle*, a small sphere. In our code today particles fall on the ground and pass through each other.

The source is *Particle Simulation using CUDA* by Simon Green, of NVIDIA, where CUDA is NVIDIA's own way to program the GPU: twelve pages that Claude, the AI assistant we study with, read in full. It makes particles collide on a GPU in three moves: move them, build a grid, test the collisions. The user remembered another text by NVIDIA, where a cell kept its particles in the color channels of a pixel. It is a chapter of the book *GPU Gems 3* by Takahiro Harada: four particles per cell, in red, green, blue and alpha, written with four passes of rendering. The user remembered three per cell: close.

**The grid.** With 1000 particles, testing each against all the others is 1000 × 999, about a million tests at every step of the simulation, and almost all are useless. So space is cut into cubes as wide as a particle, and each particle belongs to the cube where its center falls. Two particles that touch have their centers less than one particle apart, so whoever touches it is in that cube or in one next to it: 3 × 3 × 3 = 27 cubes. Finding the candidates is the *broad phase*. Why cubes of that size? With half the size, the user said, particles would pass through each other: two that touch could be two cubes apart, outside the 27.

**Pigeonholes.** The grid is one long array with 4 places per cell, places 0 to 3 for the first cell, 4 to 7 for the second, and a counter per cell. On the GPU one *thread*, a small run of the same program, starts for each particle. It adds 1 to the counter of its cell, and writes the number of its particle in the place it got. Two particles of the same cell that start together both read 0, and both write in place 0, the user said: one is lost.

**The ticket machine.** At the deli counter two people arrive together, and the machine still gives them tickets 12 and 13. "Give me the number and raise it" is one move that nobody can cut in two: an *atomic operation*. In WGSL, the language of WebGPU shaders, it is `atomicAdd()`, which returns the value from before: that value is the place.

**The fifth particle.** "Does it all explode?", the user asked. Almost: written in place 4, it would land in the next cell. So it writes nothing and stays out of the grid. The others do not see it, while it still sees them, since it reads the grid like any other. Green says a cell of this size holds 4 particles at most, if they do not overlap. Ours will, a little. Bigger cubes are no way out: twice as wide, they hold about 32, and every particle would test 27 × 32 = 864 candidates, not 27 × 4 = 108.

**The test.** Two spheres touch if their centers are closer than the sum of their radii, like `distance(a, b) < 2.0 * radius` in a fragment shader. This is the *narrow phase*. It gives two things. A direction, from one center to the other: the *contact normal*. And how far they went into each other: the *penetration depth*. With radius 0.1 the two radii add up to 0.2. With centers 0.15 apart, 0.2 − 0.15 = 0.05. Shared in half, each sphere moves back by 0.025.

**An address book.** Green's second way to build the grid. Write one row per particle, "cell, particle", and sort the rows by cell. Then note where each cell starts, like the tabs of an address book. His example has six particles:

```
row:        0      1      2      3      4      5
          (4,3)  (4,5)  (6,1)  (6,2)  (6,4)  (9,0)     cell 6 starts at row 2
```

And a fifth particle in a cell? "Nothing, it gets longer", the user said: one more row. No limit and no empty places, but sorting on a GPU takes many launches of a program, and is the hard part.

### What surprised us

**One object per example.** Before all this, Claude asked why the ground, which thousands of boxes touch, does not use up the turns of chapter 023. The question failed three times, as the example moved from a floor to a tray to a wall. "I did not understand why you spoke of the floor and then moved to the wall", the user said. A drawing of one wall and two boxes fixed it: nothing writes a wall, so it blocks nobody.

**Numbers need their sum.** Asked how far the two spheres had gone into each other, the user answered 0.5. Asked where each one ends up, 0.05. The questions were Claude's, and unclear. Both times the sum on one line, and a drawing, put it right.

## What we take away

- Cells as big as a particle: smaller ones miss collisions, bigger ones mean more places and more tests.
- Each particle looks into 27 cells, and tests at most 108 candidates instead of all the others.
- Pigeonholes need an atomic counter and leave the fifth particle out. The address book has no limit and needs a sort.
- The test between two spheres gives a direction and a depth. What to do with them comes next.

## Open questions

- Pigeonholes or address book in WebGPU? Green found sorting faster, in 2010 and on CUDA. To measure, then to decide.
- How to push two particles apart: with a force like a spring, as Green and Harada do, by moving them ([chapter 013](./013-the-hidden-brake.md)), or by changing their velocities ([chapter 014](./014-the-mirror.md))?
- How often will a fifth particle be left out in our scenes?
- Meshes, and a tree of boxes such as the *bounding volume hierarchy*, which the user named: after the particles.

## Sources

- Simon Green, [Particle Simulation using CUDA](https://developer.download.nvidia.com/assets/cuda/files/particles.pdf), NVIDIA, 2010: read in full. The grid, its two ways, and the example of six particles.
- Takahiro Harada, [Real-Time Rigid Body Simulation on GPUs](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-29-real-time-rigid-body-simulation-gpus), GPU Gems 3, 2007: only the part on the grid, four indices per cell in the channels of a pixel.
- [WGSL specification, atomicAdd](https://www.w3.org/TR/WGSL/#atomic-add): it returns the value stored before the addition.

## Next step

How to push two particles apart once they touch. Then the code.
