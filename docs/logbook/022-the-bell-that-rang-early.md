# 022 · The Bell That Rang Early

*November 18, 2026 · 4 min read*

**In short:** the measures of the last two chapters, repeated on an iPhone 16 Pro. A launch and a trip stay cheap there too. But one of our stopwatches rang well before the work was over, and it took four visits to the page and one wrong guess to see it.

## The story

FORCE must run on phones ([decision 003](../decisions/003-desktop-and-mobile.md)), and so far we had timed one Mac. Two pages do the timing. [dispatch-cost](../../examples/dispatch-cost/main.ts) times a *dispatch*, one launch of a compute shader, a program that runs on the GPU as many small *threads* at once ([chapter 020](./020-a-cheap-launch.md)). [round-trip](../../examples/round-trip/main.ts) times a *readback*, a trip of data from the GPU to JavaScript ([chapter 021](./021-a-short-trip.md)). Both are on the website, so the user opened them on the phone, in Chrome and in Safari. The two browsers gave the same numbers.

**A clock in whole milliseconds.** The first result was a table of 0.00 and 1.00. On that phone the clock of a page, `performance.now()`, moves in steps of one *millisecond*, a thousandth of a second, and most of our times are shorter. A single run reads 0 or 1. So each number is now the average of ten runs: if three of them read 1, the time is about 0.3.

**The numbers.** The first three rows are the price of each added dispatch by the GPU's own clock, a *timestamp query* ([guide](../guides/timestamp-queries.md)), in *microseconds*, millionths of a second. The others are in milliseconds. Each cell is the range over the visits to the page.

| | Mac, Apple M1 | iPhone 16 Pro |
| --- | --- | --- |
| A dispatch of 64 threads | 1 to 2 | 3 to 4 |
| A dispatch over 65 536 elements of 16 bytes | 10 to 11 | 9.4 |
| A dispatch over a million of them | 600 to 790 | 611 to 614 |
| A trip of up to 64 KB, with the GPU idle | 0.2 to 0.4 | 0.3 to 0.6 |
| Two dispatches sent together, and with a trip between them | 0.3, and 0.8 to 1.0 | 0.5 to 0.7, and 1.5 |
| 40 dispatches over a million numbers of 4 bytes, then a trip | 2 to 4 | 6.9 to 7.6 |
| 1000 small dispatches, each sent to the GPU on its own | 32 to 38 | 16 to 17 |

On the phone, a trip asked at the start of a frame was back after 1.1 to 1.3 milliseconds, and before the next frame every time: 60 of 60, in each visit.

**The bell.** One row did not add up. All the times here are in milliseconds. `onSubmittedWorkDone()` is a promise that resolves when the GPU has finished the work sent so far: our stopwatch for "the work alone". For 40 dispatches it rang at 3.7. The same work followed by a trip arrived at more than 7. On the Mac both were about 3.

- **First guess: the bell rings early.** Claude, the AI assistant we study with, added a measure: wait for the bell, and only then ask for the trip. With an honest bell, that is 3.7 plus a short trip. It took 8.1. Either the bell was early, or a trip right after work is slow.
- **Then a doubt.** On dispatch-cost the bell agreed with the GPU's clock. A third clock went in there, the time until JavaScript holds a number that the last dispatch wrote. For a dispatch over a million elements the three said 614, 616 and 616 microseconds: all honest. So Claude guessed that the work did take 3.7, and that the trip was the late one.
- **The fourth visit.** The GPU's clock went into round-trip too. It said 5.5 to 5.9 for the 40 dispatches, not 3.7. And with it switched on the bell moved to 6.6, just before the trip at 6.9.

So on this phone the bell rang at 3.7 for work that takes about 6, when the commands carried no timestamps, and on time when they did. dispatch-cost always carried them, which is why its clocks agreed. The first guess was right, the second wrong. We do not know why the bell behaves so.

### What surprised us

**The phone is not slow.** On a million elements of 16 bytes it does as well as the Mac, and a thousand dispatches sent one by one take it half the time. A launch costs it twice as much, and the 40 dispatches two to three times: the rest is close.

**The proof is a number.** The GPU's clock settled it, but the clock we could never doubt is the readback: JavaScript holds a number, checks that it is right, and the work is certainly over.

**Asking the user four times.** A change to a page reaches the phone only after a commit, a push and a reload. A slow loop for a guess, and one of Claude's two was wrong.

## What we take away

- On an iPhone 16 Pro a launch costs 3 to 4 microseconds. A trip costs about half a millisecond with the GPU idle and about one inside a frame, back before the next every time.
- The price is still the work inside: about 7 milliseconds for 40 dispatches over 4 MB, against 2 to 4 on the Mac.
- Do not time GPU work with `onSubmittedWorkDone()` alone. Read a number back, and check it.
- A coarse clock still measures tenths, if you average many runs.

## Open questions

- Why does the bell ring early without timestamps? A WebKit developer wrote in 2024 that the promise waits for the work to complete. Is this a bug to report?
- This is a top phone. A cheap one, and Android, where Chrome talks to the GPU in another way: not measured.
- Phones slow down as they heat up. Our pages run for seconds, a game for minutes.
- Why is the phone as fast as the Mac on 16 MB, and slower on 4 MB?

## Sources

- Our pages, [dispatch-cost](../../examples/dispatch-cost/main.ts) and [round-trip](../../examples/round-trip/main.ts), opened from the website by the user.
- [MDN, GPUQueue.onSubmittedWorkDone()](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/onSubmittedWorkDone): what the promise is meant to say.
- [WebKit bug 266793](https://bugs.webkit.org/show_bug.cgi?id=266793), about another problem: in comment 5 a WebKit developer says the promise waits for completion.

## Next step

Time what is left of the price of *turns*, a way to run the rules of a physics engine on the GPU that needs the CPU at every step: sorting the rules into turns, in JavaScript.
