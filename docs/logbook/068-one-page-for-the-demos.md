# 068 · One Page for the Demos

*November 26, 2026 · 3 min read*

**In short:** the demos were eleven links in a list on the home page. Now they have a page: a card with a picture for each on the left, the one chosen running on the right, and an address that says which.

## The story

**As the examples of three.js.** [The page](../../examples/demos/index.html) has a list that scrolls, a card per demo, and the rest of the window for the demo. On a narrow window the list is a drawer, closed until a button opens it, as the list of the topic map is.

**Nothing of the demos changed.** Each is still a page of its own, in its own folder. The new page shows it in a *frame*, an `<iframe>`: a page inside a page. The list of demos is one file, [demos.json](../../examples/demos/demos.json): a folder, a name and a line for each.

**The address says which demo.** What follows the `#` is the demo's folder: `demos/#cloth-pile`. A click on a card changes it, and a link with it opens on that demo with its card scrolled into view. The frame's address is *replaced*, not opened: so the frame adds nothing to the browser's history, and one step back is one demo back.

**The pictures take themselves.** [demo-shots.mjs](../../scripts/demo-shots.mjs), `npm run shots` while `npm run dev` runs: Chrome with no window opens each demo, lets it run seven seconds, hides the panel and saves what the canvas shows.

### What surprised us

**On the phone, every demo failed.** `GPUPipelineError`, and no other word. It was not the new page: it had been so since [chapter 051](./051-read-once.md), and nobody had opened a demo on a phone since. The same error came in Safari on the Mac, the phone's engine, and there a test page could try the shaders one by one. One never finished compiling: the check for two cells that share a slot, 351 comparisons joined by `||` in one expression. Chrome took it.

**The first fix was slower.** An `if` for each cell, with a `return true`, 26 comparisons at most in a line: Safari on the Mac took it. But timed in Chrome on 100 000 particles, five runs each, taking turns, the levels went from about 1.85 ms to 2.1. A line for each cell that only keeps its answer, `let c5 = s0 == s5 || ...`, was as fast as the one expression. The first time we compared, both runs were the new code, and differed by 3.8 ms: a step's time moves that much from one run to the next.

**The second fix did not start on the phone.** An empty page, no error. A probe that writes each step of the start on the page ([startup-probe.ts](../../examples/debug/startup-probe.ts), `?probe`) showed the eight shaders with the check still waiting, for ever. And once a compile hung, the phone gave no GPU to any page until restarted, so the next error said there was no WebGPU at all. So a page that tries the ways one after the other, on the phone ([compile-probe](../../examples/compile-probe/index.html)): two loops, vectors, four comparisons in a line, 26 joined by `|`: all compiled in 3 ms. 26 joined by `||`: still compiling after 8 seconds. It is the long chain of `||` that the phone's compiler does not take. Four at a time, each four with a name, the names joined four at a time: the phone takes it, and in Chrome the levels take 1.75 ms over four runs, as before.

**And the phone could not reach the Mac's server.** A browser gives WebGPU only to pages on https or on localhost: at `http://192.168…` there is none, on any phone. `npm run dev:phone` serves the same pages on https, with a certificate it makes itself.

## What we take away

- A frame lets a page gather others without touching them.
- A shader that Chrome compiles is not a shader that every browser compiles, and Safari on a Mac is not Safari on a phone: try the phone.
- A compiler that hangs gives no error. A page that tries the candidates one by one, with a time limit, asks the device itself.
- An expression of hundreds of terms can stop a compiler. How it is cut into lines can change the time: measure each way, more than once, taking turns.
- The part of an address after `#` never reaches the server: a page can use it to remember where it is.

## Open questions

- A new demo needs a line in demos.json and `npm run shots`: nothing checks that it was done.
- In most pictures the subject is small: the camera is the demo's own.

## Next step

The user's choice: what of the hand, the drift and the patches goes into the engine, or one of the three left from chapter 066.
