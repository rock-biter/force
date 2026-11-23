# 043 · Other People's Devices

*November 23, 2026 · 3 min read*

**In short:** every number of the cells study came from one Mac. A public page now runs a short version of it in anyone's browser, a phone too, and prepares a GitHub issue with the numbers. On a device with no GPU clock it times with the page's clock, and on our Mac the two clocks agree.

## The story

[Chapter 042](./042-no-best-way.md) ended with rules for choosing how FORCE keeps the cells where particles look for their neighbours, and with a warning: all of it was measured on a Mac M1. "I need a public page that runs the benchmarks, to send to people to try on their own devices, desktop and mobile," the user said, "and to collect the results somewhere. Best of all, on the repo, through an issue."

**One measure, two users.** The study was a script that carried its measuring code inside. A copy for the page would have drifted from it, and numbers from two different measures cannot be compared. So the code moved to [one file](../../examples/bench/study.ts), with two plans: the full one, 174 rows, for our machine, and a short one for anyone's, 30 rows with no more than 100 000 particles. The [script](../topics/cells-study.mjs) imports that file and sends the text of its function to the page it measures in; the [bench page](../../examples/bench/index.html) of the site imports it too.

**A clock for phones.** The study timed each shader, a program run on the GPU, with *timestamp queries*, the GPU's own clock ([guide](../guides/timestamp-queries.md)). Not every browser has it. [Chapter 022](./022-the-bell-that-rang-early.md) had taught us what to do then on an iPhone: do not trust the promise that says the work is done; read back a number the last shader wrote, and time that on the page's clock. That clock can move in steps of a whole millisecond, so the page sends the shaders enough times to last about 50 ms, and takes off the time of a readback of nothing. On our Mac, where both clocks exist, a step with 100 000 particles:

| | The GPU's clock | The page's clock |
| --- | --- | --- |
| book on a grid | 3.0 ms | 3.0 ms |
| table, blocks of 32 | 3.3 | 3.4 |
| 4 places per cell | 14.3 | 14.4 |
| grid, 100 heaps in a world of 40 m | 12.1 | 12.7 |

**The way back.** The page sends nothing by itself. When it is done it shows a table for each scene, and under it the exact text it would send: a header with the date, the GPU and the browser as they name themselves, and a row of numbers per measure. A field asks for the device in words, since a browser does not tell the model of a phone. A button opens a new issue on GitHub with a [form](../../.github/ISSUE_TEMPLATE/benchmark.yml) already filled: the text travels in the address of the link, 4 000 characters of it. If it were too long for an address, the page says to copy and paste it. The visitor reads it, and submits it or not.

### What surprised us

**Five seconds.** We wrote "one to three minutes" on the page before running it. On the Mac the 30 rows take about 5 seconds with the GPU's clock and 25 with the page's. How long a phone takes we do not know yet, so the page now says so.

**A zero that looked like a result.** The first run on the page's clock gave 0.00 ms for everything. The readback of nothing was timed by the same function, which divided by how many times the shaders were sent: zero. Its time came out infinite, and every measure minus infinity was cut to zero. A number that is exactly zero is never a measure.

## What we take away

- One file holds the measure, and both the script and the public page run it: only so are their numbers comparable.
- Without a GPU clock, time a readback of something the last shader wrote, many times over, minus an empty readback.
- A page that asks strangers for data shows them the exact text first, and lets them send it themselves.

## Open questions

- No phone has run it yet: whether it finishes, and in how long.
- Whether GitHub fills the form from the link, as its docs say: to try once the form is online.
- Gathering the issues into one file of results by device, and drawing them next to ours: not built.
- An issue is written by a stranger: the numbers are data to weigh, and to read with a parser, never to run.

## Sources

- Our page, [examples/bench](../../examples/bench/main.ts), run in Chrome without a window on a Mac M1 with `?auto`, and with `?auto&clock=page`: the numbers of the table.

## Next step

Publish the page, run it on the iPhone, and send the first issue ourselves.
