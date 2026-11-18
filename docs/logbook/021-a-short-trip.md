# 021 · A Short Trip

*November 18, 2026 · 4 min read*

**In short:** we timed a trip of data from the GPU back to JavaScript in WebGPU. We expected it to be slow, or a frame late. On our Mac it took less than a thousandth of a second and came back before the next frame, 119 times out of 120 in a real window.

## The story

A *solver* repairs the rules of a physics engine when they are broken, such as "these two boxes must not overlap", and on a GPU two rules must not write the same box at the same instant. One way out is *turns*: rules that share no box run together, the others wait. But the turns must be decided at every *step*, each advance of time, because the boxes that touch keep changing. PhysX, the engine by NVIDIA, decides them on the CPU ([chapter 017](./017-taking-turns.md)). So the news must travel: from the GPU to JavaScript, and an answer back. Chapters 017 and [019](./019-the-price-of-copies.md) wrote that in WebGPU this trip would be "slow, or late", and that nobody had measured it. Claude, the AI assistant we study with, wrote a page that does: [round-trip](../../examples/round-trip/main.ts).

**How a trip works.** JavaScript cannot read the memory of the GPU. It asks the GPU to copy the numbers into a *buffer*, a block of memory, of a kind that JavaScript can open: *map*, in the words of WebGPU. Then it calls `mapAsync()` on that buffer, which answers with a promise: the buffer is open when the promise resolves. This is a *readback*, and it has its [guide](../guides/readback.md). The [specification](https://www.w3.org/TR/webgpu/#buffer-mapping) says why it is asynchronous: the browser must be sure the GPU has finished with the buffer first. All times below are in *milliseconds*, thousandths of a second. A frame at 60 per second lasts 16.7. Our numbers take 4 bytes each, and each time is the range over four runs of the page.

**One trip, with the GPU idle.** From asking to having the buffer open, then the time to copy the numbers out of it.

| Bytes | 16 | 65 536 | 1 048 576 | 8 388 608 |
| --- | --- | --- | --- | --- |
| Arrives after | 0.26 to 0.30 | 0.20 to 0.30 | 0.34 to 0.40 | 1.0 to 1.25 |
| Copied out in | 0.01 | 0.02 | 0.11 to 0.20 | 0.8 to 0.9 |

Up to 65 536 bytes, 64 KB, the size does not count: a trip costs about a quarter of a millisecond. It starts to count at a million bytes.

**A trip waits for the work before it.** A *dispatch* is one launch of a compute shader, a program that runs on the GPU. We put 40 of them, each working on a million numbers, in front of a copy of 64 KB. The work alone was done in 2.8 to 3.7. The trip arrived after 3.1 to 4.2: a few tenths more at most, less than what changes from one run to the next. The specification says so too: the promise resolves once the commands that use the buffer are done.

**A step cut in two.** Two dispatches over 65 536 numbers, sent to the GPU together: 0.26 to 0.40. The same two with a trip between them, all the 256 KB read back and sent to the GPU again: 0.76 to 0.90. Half a millisecond more.

**Inside the frames.** In a browser, `requestAnimationFrame()` calls your code once per frame, as the render loop of three.js does. At each of 60 frames the page asked for 64 KB. The answer came 0.55 to 0.81 after, and before the next frame 60 times out of 60, in each run. That is more than the quarter of a millisecond of the idle trip: we did not look into why.

**In a real window.** Chrome had run *headless* so far, with no window. So the user opened the page in a window, on the same Mac, on two screens. There the clock of a page moves in steps of 0.1.

| Screen | A trip, up to 64 KB | Step whole, and cut in two | Answer inside a frame | Before the next frame |
| --- | --- | --- | --- | --- |
| 50 frames per second, one every 20 | 0.2 | 0.3 and 0.8 | 0.7 | 59 of 60, once a frame late |
| 120 frames per second, one every 8.3 | 0.4 | 0.3 and 1.0 | 0.7 | 60 of 60 |

The numbers held, even with frames of 8.3. What did not hold still is the work alone: 40 dispatches took 1.8 on one screen and 4.2 on the other, against 2.8 to 3.7 headless. The user reloaded the page a few times on both screens, and it stayed between 2.0 and 2.6. The first two were the odd ones: one visit to the page is not a measure.

### What surprised us

**We had it wrong.** A frame late, we thought. Here a trip inside a frame is 20 to 30 times shorter than the frame. But this is one Mac, and a page that draws nothing. A game draws in the same frame, and a phone is another machine.

**"Asynchronous" is about shape, not about time.** The answer is quick, but JavaScript must let go to get it: the code after `await` runs later, once the browser has taken control back and returned it. A step with a trip inside is no longer one plain function. The `update()` of our [`World`](../../src/world.ts) is one today.

**The check that caught it.** The first version of the page also timed a trip of 16 MB, and every row looked right. Only its last line said `WRONG numbers came back`. A dispatch starts its threads in blocks, 64 threads each in our shader, and takes 65 535 blocks at most ([guide](../guides/dispatch-and-workgroups.md)). Four million numbers needed 65 536: one too many. Chrome refused the commands without throwing, and the page timed work that never ran. The page now prints what Chrome refuses.

## What we take away

- On our Mac a trip back costs the work in front of it plus a few tenths of a millisecond: a quarter with the GPU idle, up to 0.8 inside a frame.
- The size counts only from megabytes on. The news of a step, which pairs began or stopped touching, is small.
- Cutting a step in two with a trip added half a millisecond, and the answer was back in the same frame.
- What the trip changes is the code: the step becomes asynchronous.
- A timing with no check on the result can be the timing of nothing.

## Open questions

- Do the numbers hold on a page that also draws, on Windows, on a phone? The page is there to try.
- Why did one answer in 120 come a frame late in the window? And why did the same work take 1.8 at one visit and 4.2 at another?
- The trip was the part we feared. The other part of the price of turns is sorting the rules into turns, in JavaScript: not measured.
- If the answer comes after the frame's code has run, can the drawing of that frame still use it?
- Turns with a trip, or *copies*, the other way out, where each rule writes its own copy of a box and the CPU is not needed ([chapter 018](./018-half-a-box.md))? Both prices can now be measured on one scene.

## Sources

- Our page, [examples/round-trip](../../examples/round-trip/main.ts): the numbers of this chapter. Run it with `npm run dev`.
- [WebGPU specification, buffer mapping](https://www.w3.org/TR/webgpu/#buffer-mapping): why mapping is asynchronous, and when the promise of [`mapAsync()`](https://www.w3.org/TR/webgpu/#dom-gpubuffer-mapasync) resolves.
- [MDN, GPUBuffer.mapAsync()](https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/mapAsync): a mapped buffer cannot be used in GPU commands until `unmap()`.

## Next step

Open this page and [the one of chapter 020](../../examples/dispatch-cost/main.ts) on a phone: do the numbers hold?
