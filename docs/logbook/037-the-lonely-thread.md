# 037 · The Lonely Thread

*November 23, 2026 · 4 min read*

**In short:** a reader sent a chapter on how GPU threads share a running sum, the one our address book needs. We timed our own sum first: 0.2 ms with the hashed table, about 9 ms with a slot for every cell of the grid, and the thread that walks alone is not where the time goes.

## The story

**The first suggestion.** FORCE takes suggestions as GitHub issues, and the first one came from [fracabu](https://github.com/fracabu): [chapter 39 of GPU Gems 3](https://developer.nvidia.com/gpugems/gpugems3/part-vi-gpu-computing/chapter-39-parallel-prefix-sum-scan-cuda), by Mark Harris, Shubhabrata Sengupta and John D. Owens, 2007. It is about the *prefix sum*, a running sum, that [chapter 036](./036-the-address-book.md) needed for its address book, the list of all the particles sorted by cell. Ours is made by threads, runs of a program on the GPU, that never work together. We checked that the chapter exists and says what the issue says, and put it on the topic map. Thank you, Francesco.

**What the sum is for.** Halfway through the chapter's ideas, the user stopped us: "what do we need the sum for, exactly?" So we went back to the three buffers of the address book, with 6 particles and 4 slots. A *cell* is a cube of space 20 cm wide; a *slot* is a row in memory where a cell keeps its numbers.

```
counts  [ 3   0   2   1 ]             particles in each slot
starts  [ 0   3   3   5 ]             the row of book where each slot begins
book    [ 1   4   5 | 0   2 | 3 ]     the particles, grouped by slot
```

To read slot 2: `starts` says row 3, `counts` says 2 rows, so particles 0 and 2. The sum is only the step from `counts` to `starts`: each slot begins where the ones before it end. Claude, the AI assistant we study with, asked what a seventh particle in slot 1 changes. "Counts 3 1 2 1 and starts 0 3 4 6," the user said. One particle moved the start of every slot after it, which is why the plain way is to walk the slots in a row. The book can keep a slot for every cell of the grid: 3.9 million on our page with a box that tilts, almost all empty. Or it can keep a small table of slots, at least two per particle, and let a formula, the *hash*, say which slot a cell uses.

**Three ways to sum.** Ours: cut the slots into blocks of 512; a thread per block adds its block up, one thread alone walks the block sums, then a thread per block walks its block again, from the row where the block begins, and writes the `starts`. The GPU Gems chapter has two ways in which the threads of a block work together. In the first, by Hillis and Steele (1986), every element adds the one 1 place to its left, then the one 2 places away, then 4: 8 elements take 3 rounds instead of 7 steps, but 17 additions instead of 7. Each round reads one array and writes another, the ping-pong of two render targets. The second, by Blelloch (1990), adds pairs up like a tournament and then comes back down, with about twice the additions of the plain walk however long the array. The user followed the first and the way up of the second. The way down lost them, and we left it there.

**Measure first.** Before learning more, we timed what we have: our three shaders alone, on buffers as large as our pages use, in Chrome without a window on a Mac M1. Each time is the median of 30, from two runs of the [script](../topics/prefix-sum.mjs).

| | Slots | Whole sum | 1. block sums | 2. one thread | 3. walk the blocks |
| --- | --- | --- | --- | --- | --- |
| a slot per cell, the page that tilts | 3.9 million | 9.0 and 8.6 ms | 0.9 and 0.8 | 1.0 and 0.9 | 5.8 and 5.6 |
| table for 100 000 particles | 262 144 | 0.19 ms | 0.06 | 0.05 | 0.08 |
| table for 50 000 particles | 131 072 | 0.17 ms | 0.06 | 0.02 and 0.03 | 0.08 and 0.11 |

A whole step of the simulation, 1/60 s of it, took 10 to 17 ms with the table in chapter 036. The sum is 1 or 2% of that: a faster sum would not be noticed. With a slot per cell it is about 9 ms every time the book is made again, and a step took 21.8 ms while the book was being made again and 8.5 ms once the particles had come to rest. Our reading, not measured in the page: the sum is most of that gap.

### What surprised us

**The lonely thread is not the problem.** We expected the second of the three passes, one thread walking 7 639 block sums, to be the slow one. It takes 1 ms. The third takes almost 6. The three alone add up to 7.5 ms and the whole sum takes 9: we do not know where the rest goes.

**Many writes by one thread are slow.** The first pass walks the same 512 slots per thread, writes one number at the end, and takes 0.9 ms. The shader that sets `counts` back to zero writes 3.9 million rows too, one thread per row, in 0.7 ms by the same script. So neither the walk nor the amount written explains the third pass. Claude's guess, not tested: few threads each writing 512 rows one after the other suit a GPU badly, and a thread per row or two, as in the GPU Gems chapter, could do better.

**A grid pays for the world.** "With very few particles but a very large world, memory would be huge anyway," the user said. A slot per cell costs 8 bytes, full or empty: 31 MB for the box that tilts, 200 MB for a world of 100 × 100 × 20 m, 50 GB for a square kilometer 50 m tall, with ten particles in it. Emptying and summing grow with it. And a grid has a border: in our code a particle outside goes to the nearest cell on it. The table's memory follows the particles, and its space has no border.

## What we take away

- The sum turns `counts` into `starts`, and nothing else: the address book needs it once each time it is made.
- With the table the sum costs 0.2 ms: not worth a better one. With a slot per cell, about 9 ms.
- Measure each pass alone before speeding one up: the slow one was not the one we expected.
- A slot per cell pays for the volume of the world, in memory and in time. The table pays for the particles.

## Open questions

- The user leans to the table. In chapter 036 its steps took longer than those of the first way, a grid with 4 places per cell, and the sum is not why. Where does its time go?
- Why writing 512 rows per thread is slow, and whether a thread per row fixes it. It only matters with a slot per cell.
- How Blelloch's way down works, and all of this on a phone.

## Sources

- Mark Harris, Shubhabrata Sengupta and John D. Owens, [Parallel Prefix Sum (Scan) with CUDA](https://developer.nvidia.com/gpugems/gpugems3/part-vi-gpu-computing/chapter-39-parallel-prefix-sum-scan-cuda), GPU Gems 3, 2007: sections 39.1 and 39.2, the two scans and the blocks. Suggested by fracabu in [issue 1](https://github.com/rock-biter/force/issues/1).
- Our script, [docs/topics/prefix-sum.mjs](../topics/prefix-sum.mjs), and the `book-*.wgsl` shaders of [examples/heap-simulation](../../examples/heap-simulation/main.ts): every time of this chapter.

## Next step

Time each pass of a step with the table, to see where its time goes, then choose how the engine keeps its grid.
