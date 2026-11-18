# 020 · A Cheap Launch

*November 18, 2026 · 4 min read*

**In short:** we timed what one more dispatch costs in WebGPU. On our Mac the launch itself takes the GPU 1 to 2 millionths of a second. What costs is the work inside it, and sending each dispatch on its own.

## The story

A *compute shader* is a program that runs on the GPU to compute, not to draw. A *dispatch* is one launch of it: many *threads*, small runs of the same program, start together. A physics engine moves time forward in *steps*, and inside a step its *solver* repairs rules such as "these two boxes must not overlap". On a GPU that takes many launches per step: 45 by our count of PhysX, the engine by NVIDIA ([chapter 017](./017-taking-turns.md)), a hundred by a guess of ours ([chapter 015](./015-the-stiff-spring.md)). [Chapter 019](./019-the-price-of-copies.md) compared two solvers by counting launches, as if a launch had one price. Nobody had told us what it is. So Claude, the AI assistant we study with, wrote a page that measures it: [dispatch-cost](../../examples/dispatch-cost/main.ts).

**The measure.** A *buffer*, a block of memory on the GPU, holds numbers, and each thread adds 1 to its own. JavaScript writes many dispatches in a row as a list of commands, and hands the list to the GPU. Three clocks run. The page's, `performance.now()`, while JavaScript writes. The GPU's own, from the first dispatch to the last: a *timestamp query*, new for us, with its [guide](../guides/timestamp-queries.md). The page's again, until the browser says all the work is done. Sending anything has a fixed fee, so the page times 1000 dispatches and 100, and divides the difference by 900: what is left is the price of one more. At the end it reads one number of the buffer back. After N dispatches it must be N, and it was.

**The table.** Time on the GPU for one more dispatch, in *microseconds*, millionths of a second. A frame at 60 per second lasts 16 700. Each cell is the range over a few runs.

| Threads per dispatch | 64 | 4 096 | 65 536 | 1 048 576 |
| --- | --- | --- | --- | --- |
| Microseconds | 1 to 2 | 1.3 to 2.5 | 10 to 11 | 600 to 790 |

**The launch is almost free.** A hundred small dispatches keep the GPU busy for 100 to 200 microseconds, about a hundredth of a frame. JavaScript writes one down in 0.03 to 0.06 microseconds, timed over 100 000 of them. On this Mac neither the 45 nor the hundred is a problem in itself.

**The work inside is what costs.** From 64 to 4096 threads the price barely moves. Then it grows: a dispatch over a million numbers takes 600 to 790 microseconds, and 21 to 28 of them fill a frame. It grows faster than the threads, too. From 65 536 to a million they are 16 times as many, and the time is about 60 times as long.

**How they are packed.** A *pass* is a stretch of commands, and a *submit* hands the list to the GPU. We sent the same 1000 small dispatches in three ways, and timed until the work was done, in *milliseconds*, thousandths of a second. All in one pass: 1.6 to 1.9. A pass each, in one submit: 3.6 to 3.9. A submit each: 32 to 38, about twenty times the first. This will matter next. Reading from the GPU in the middle of a step means cutting the step into more submits.

### What surprised us

**Chapter 019 may have counted the wrong thing.** Two rules must not write the same body at the same instant. With *turns*, rules that share no body go in one launch, and the others wait for the next. With *copies*, all the rules go in one launch, each on its own copy of a body, and a second launch averages the copies. A *round* is one pass over all the rules. Copies needed four times the rounds, so chapter 019 counted 8 launches for them against one per turn. With today's numbers that count holds in a small scene, where every launch costs the same. In a big scene a launch costs what its threads cost. A round of turns runs each rule once, however many the turns. Four rounds of copies run each rule four times, plus the averages. Turns would then win even with many turns. This is Claude's reasoning, not a measure, and it leaves out what turns need: sorting the rules on the CPU. The user has seen the table, and has not gone through this reasoning yet.

**An empty pass has no time.** Claude's first try also timed a pass with no dispatch at all, and the GPU's clock said 12 milliseconds: the time of the run before it. With nothing to run, Chrome did not write the two timestamps, and the old ones were still there.

**The clocks are coarse on purpose.** A precise clock can be used to spy on other pages. Chrome's blog says it rounds the GPU's timestamps to 100 microseconds. On our Mac every value was a multiple of 65 536 nanoseconds, about 66 microseconds. `performance.now()` moved in steps of 100 microseconds. One dispatch is far below both, another reason to time a thousand.

## What we take away

- One more dispatch costs the GPU 1 to 2 microseconds on our Mac: a hundred per step are affordable.
- The price is in the threads: 600 to 790 microseconds for a dispatch over a million numbers.
- All the dispatches of a step go in one pass and one submit. A submit each costs about twenty times more.
- `performance.now()` around the commands times JavaScript writing, not the GPU working. For that, ask the GPU's clock.

## Open questions

- One Mac, an Apple M1 with Chrome 157 run headless, that is with no window. A phone, and Windows, where Chrome talks to the GPU in another way: not measured.
- Why does a thread cost about four times more at a million than at 65 536? We did not look.
- Our shader does one addition. What does a thread cost when it solves a rule, reading two bodies?
- Does the count of chapter 019 change as Claude reasons above? To measure on a scene with many turns.
- Why steps of 65 536 nanoseconds, when the blog says 100 microseconds?

## Sources

- Our page, [examples/dispatch-cost](../../examples/dispatch-cost/main.ts): the numbers of this chapter. Run it with `npm run dev`.
- [WebGPU specification, timestamp query](https://www.w3.org/TR/webgpu/#timestamp): timestamps are in nanoseconds, and their precision must be reduced.
- [Chrome, What's New in WebGPU 120](https://developer.chrome.com/blog/new-in-webgpu-120): the rounding to 100 microseconds.
- [MDN, GPUQueue.onSubmittedWorkDone()](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/onSubmittedWorkDone): the promise that resolves when the work sent so far is done.

## Next step

Measure the other price: how late a trip from the GPU to the CPU comes back.
