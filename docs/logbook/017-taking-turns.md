# 017 · Taking Turns

*November 17, 2026 · 4 min read*

**In short:** how PhysX runs its solver on the GPU. Rules that touch the same body take turns, the turns are decided on the CPU, and when they would be too many each rule gets its own copy of the body. The explanation stopped halfway: this chapter says what we found, and where we got lost.

## The story

[Chapter 016](./016-the-same-road.md) ended on a question. A *solver* repairs broken rules, such as "two boxes must not overlap", one rule at a time, each using what the one before wrote. One pass over all the rules is a *round*. A GPU runs thousands of threads at once. How does PhysX, the engine by NVIDIA, do both? Its guide says what runs on the GPU, not how. The code is public, so Claude, the AI assistant we study with, read parts of it and explained it in chat.

**The problem.** Four boxes in a row, `[A][B][C][D]`, make three contacts: A–B, B–C, C–D. A contact reads the velocities of its two boxes, corrects them and writes them back. Run A–B and B–C at the same instant and both write the velocity of B: one of the two is lost. It is like two fragment shaders that want the same pixel.

**Turns.** Sort the contacts into groups where no box appears twice: A–B and C–D together, then B–C alone. Each group is one launch on the GPU, a *dispatch* for us: one run of a compute shader. The groups go one after the other. This is the *graph coloring* of [chapter 015](./015-the-stiff-spring.md): a color is the label of a group. PhysX calls the groups *partitions*, and a comment in its code calls the sorting "edge coloring".

**Who decides the turns.** Nobody knows ahead which boxes touch: contacts change at every step. In PhysX the GPU finds the contacts, then copies results back to the CPU, among them the news: the pairs that began or stopped touching. The CPU updates the groups, adding the new pairs and dropping the lost ones, and sends them back. Then the GPU runs the solver. The code that sorts is plain C++, not GPU code.

**A ceiling.** A wide box with three small boxes side by side on top needs three groups, one per contact, since all three write its velocity. With thirty on top it needs thirty, in every round of the solver. So PhysX allows 8 groups by default, 32 at most. Past the ceiling the code wraps the group number around: the ninth group runs together with the first, the tenth with the second.

**Copies.** A box may then be written twice in one launch. So each contact works on its own copy of the box's velocity, and one more launch averages the copies. The code calls this *mass splitting* and counts in how many copies a body is active. In the paper of that name ([chapter 012](./012-the-family-tree.md)) each copy takes a share of the body's mass: we did not read that part of the code. When the bodies that touch each other are few, the code solves them in a single launch instead: we did not read how.

### What surprised us

**The question that found the weak spot.** "I cannot know ahead which objects touch, can I?" No, and that is the cost of taking turns: a trip from the GPU to the CPU and back at every step. PhysX runs on CUDA, NVIDIA's own way to program the GPU, where the CPU can stop and wait for it. In WebGPU reading a buffer back is asynchronous: the data comes later. This is our reasoning, not a measure.

**A wrong example of Claude's.** It asked how many groups a floor with thirty boxes needs, expecting thirty. The floor needs none: a body that never moves is never written, so its contacts do not clash. Box2D ([chapter 015](./015-the-stiff-spring.md)) and PhysX both treat fixed bodies apart in their code. The example needed a box that moves.

**A metaphor that did not work.** Claude first told this as a tournament, with matches and days. The user got lost. Four boxes in a row worked at once.

**Where we stopped.** At the copies. The user said it had all become a bit vague, after a long day of new ideas piled on each other. What PhysX does is checked in its code. What the user can explain is not there yet, so on our map these ideas stay "seen" or "mentioned", not "studied".

**Atomics, the user's last question.** Could WGSL's atomic operations help? They make sure that no write is lost when many threads add to the same place. That fits a variant of the copies: instead of one copy per rule, every rule adds its correction into one slot of the body, and a later pass divides by how many added. But the WGSL specification allows atomics on integers only, and velocities are not. And like the copies, they do not give turns: no rule sees what another has just written. Not tried.

## What we take away

- Two rules must not write the same body at the same instant. There are two ways out: take turns, or work on copies and average.
- PhysX takes turns, picked on the CPU, and uses copies only past its ceiling of groups.
- Turns cost a trip to the CPU at every step. On the web we expect that trip to be slow, or late: not measured.
- Copies need no turns, so no trip. Erin Catto, the author of Box2D, lists mass splitting among the "GPU friendly solvers" he has not tried ([chapter 015](./015-the-stiff-spring.md)): we now read that list as the solvers that need no turns.

## Open questions

- With copies, a rule learns what the others did only after the average. How many more rounds does that cost, and does a stack still stand?
- Can the sum of the copies be done with atomics on integers, without losing too much precision?
- How many dispatches per step can WebGPU take? PhysX's solver with substeps ([chapter 016](./016-the-same-road.md)) runs 5 rounds per step by default, 4 substeps and a last round, and each round is 8 launches for the groups and 1 for the average: at least 45 launches per step, by our count of its loop.

## Sources

- PhysX at commit [7d6f6ac](https://github.com/NVIDIA-Omniverse/PhysX/tree/7d6f6ac8b83e1610bdf715f1f2f1d6b718aee586), read in parts: [PxgConstraintPartition.cpp](https://github.com/NVIDIA-Omniverse/PhysX/blob/7d6f6ac8b83e1610bdf715f1f2f1d6b718aee586/physx/source/gpusolver/src/PxgConstraintPartition.cpp) for the groups, [PxgTGSCudaSolverCore.cpp](https://github.com/NVIDIA-Omniverse/PhysX/blob/7d6f6ac8b83e1610bdf715f1f2f1d6b718aee586/physx/source/gpusolver/src/PxgTGSCudaSolverCore.cpp) for the launches, [solverMultiBlockTGS.cu](https://github.com/NVIDIA-Omniverse/PhysX/blob/7d6f6ac8b83e1610bdf715f1f2f1d6b718aee586/physx/source/gpusolver/src/CUDA/solverMultiBlockTGS.cu) for the average, [PxgNarrowphaseCore.cpp](https://github.com/NVIDIA-Omniverse/PhysX/blob/7d6f6ac8b83e1610bdf715f1f2f1d6b718aee586/physx/source/gpunarrowphase/src/PxgNarrowphaseCore.cpp) for the copy to the CPU, and [PxSceneDesc.h](https://github.com/NVIDIA-Omniverse/PhysX/blob/7d6f6ac8b83e1610bdf715f1f2f1d6b718aee586/physx/include/PxSceneDesc.h) for the ceiling.
- PhysX 5.6.1, [GPU Simulation](https://nvidia-omniverse.github.io/PhysX/physx/5.6.1/docs/GPURigidBodies.html): what runs on the GPU.
- [WGSL specification, atomic types](https://www.w3.org/TR/WGSL/#atomic-types): integers only.

## Next step

Pick up the copies again, from the four boxes in a row, then try turns and copies side by side on our chain.
