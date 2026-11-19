# 030 · The Lazy List

*November 20, 2026 · 4 min read*

**In short:** we put the two finalists on the GPU and checked them against JavaScript. They cost about the same: 1 ms per step for 10 000 particles on our M1. A list of neighbours made only when it is needed made a step 2.3 times faster at 10 000 particles, 1.6 at 100 000. We chose half and half.

## The story

[Chapter 029](./029-heavy-on-light.md) left two candidates for pushing touching particles apart. One moves their positions back, and each particle adds half the sum and half the average of the corrections its contacts ask: the user's *half and half* rule. The other is a spring whose stiffness is set by how many times per second it would swing, its hertz. Only their price on the GPU was missing. A *step* moves the world by 1/60 s. In it, half and half makes 8 *rounds*, passes over all the contacts, and the spring cuts the step into 8 *substeps*. The particles are spheres of 20 cm. Everything here was measured on [our page](../../examples/contact-cost/main.ts), on an Apple M1 with Chrome 158 run headless.

**The grid.** First the cells of [chapter 024](./024-twenty-seven-cells.md): each particle takes one of the 4 places of its cell with `atomicAdd`, the ticket machine, which hands out numbers one at a time ([guide](../guides/atomics.md)). The counters must go back to zero at every step. Why? "Because the grid is built again from zero, otherwise the cells look full," the user said. A cube of 108 000 particles, packed as tightly as spheres go, finds its places in 67 µs, and no cell ever held more than 4, the number Simon Green of NVIDIA gives.

**Both candidates.** Half and half takes 12 *dispatches*, runs of a compute shader, per step: predict, grid, the levels of each particle in its pile, 8 rounds, finish. Two buffers take turns: each round reads one and writes the other, so nobody reads a position while it changes. The spring takes 9: the grid, then 8 substeps. Each was checked against the same algorithm in JavaScript. After 10 steps the GPU and JavaScript differ by at most 0.003 mm for half and half, 0.007 mm for the spring. And 1 kg under 100 kg ends 0.25 mm deep with half and half, 6.93 mm with the spring, the same on the GPU and in JavaScript, as in chapter 029. A round and a substep cost the same, since both read the 27 cells around each particle. On heaps 10 layers tall, typical of three runs:

| Heap | Half and half, a step | The spring, a step |
| --- | --- | --- |
| 980 | 0.38 ms | 0.36 ms |
| 10 580 | 1.0 ms | 0.86 ms |
| 106 580 | 9.1 ms | 8.2 ms |

**The lazy list.** "Is the grid built again at every pass, or once per step?" the user asked. Once per step. But every round searches the 27 cells again, 27 × 4 = 108 places, for the same neighbours. So each particle can write down its neighbours once, in a list: every particle closer than a diameter plus a margin. "We could make the list only every 2 or 3 rounds," the user said. A list made once per step already serves all 8 rounds, and making it more often costs more; the gain is in making it last several *steps*. It stays right as long as no particle has moved more than half the margin since. Claude remembered the trick from molecular dynamics, where it is called a Verlet list. Each particle measures how far it has moved, the GPU keeps the largest with `atomicMax`, and makes the lists again past 2 cm, a little before half the 5 cm margin. Half and half on heaps at rest, timed in turns, five times each (the GPU had slowed down by then, see below):

| Way | 10 580 particles | 106 580 particles |
| --- | --- | --- |
| 27 cells at every round | 1.01 ms | 18.4 ms |
| a list at every step | 1.04 ms | 20.6 ms |
| a list every 3 steps | 0.75 ms | 17.0 ms |
| **a list when needed, 5 cm margin** | **0.43 ms** | **11.6 ms** |

### What surprised us

**The GPU slows down.** The same 27 cells took 9 ms in one run and 17 to 18 ms in a later one: after minutes of load, our M1 runs slower. So the ways in the second table were timed in turns, and only their ratios count.

**Claude measured wrong twice.** A first table said 25 280 particles were left out of the grid, and a pair 572 mm deep. Both were measured after 20 steps with no rounds at all, timed to see what the rounds cost, in which the heap sank into itself. And the list's commands were all rejected without a sound: a binding declared but never read is left out of a `layout: 'auto'`, and the bind group no longer matched. Our [bind groups guide](../guides/bind-groups.md) describes exactly that mistake. The page now prints every WebGPU error.

**Eight buffers at most.** The shader that writes the lists first needed 9 storage buffers. WebGPU guarantees 8 per shader, and a device gets more only if it asks ([guide](../guides/adapter-and-device.md)). The small counters went into one buffer.

## What we take away

- On the GPU the two candidates cost about the same, the spring 10 to 15% less. The choice comes from the rest: half and half sinks less, handles masses and never blew up ([decision 015](../decisions/015-half-and-half-on-positions.md)).
- The cost of a step is the search for neighbours, repeated at every round. Keeping a list until particles have moved cut it most ([decision 016](../decisions/016-a-list-made-when-needed.md)).
- Time on a GPU in turns, and trust ratios more than single numbers.

## Open questions

- A phone: the same page, to try.
- A heap that falls as a whole makes new lists at almost every step: the check measures how far each particle moved, not how far from its neighbours.

## Sources

- Our page, [examples/contact-cost](../../examples/contact-cost/main.ts): every number of this chapter.
- [WGSL, atomic built-in functions](https://www.w3.org/TR/WGSL/#atomic-builtin-functions): `atomicAdd` and `atomicMax` return the value from before.

## Next step

A page that runs the best ways side by side, live, with a scene to choose.
