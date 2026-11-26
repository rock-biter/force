# 068 · One Page for the Demos

*November 26, 2026 · 2 min read*

**In short:** the demos were eleven links in a list on the home page. Now they have a page: a card with a picture for each on the left, the one chosen running on the right, and an address that says which.

## The story

**As the examples of three.js.** [The page](../../examples/demos/index.html) has a list that scrolls, a card per demo, and the rest of the window for the demo. On a narrow window the list is a drawer, closed until a button opens it, as the list of the topic map is.

**Nothing of the demos changed.** Each is still a page of its own, in its own folder. The new page shows it in a *frame*, an `<iframe>`: a page inside a page. The list of demos is one file, [demos.json](../../examples/demos/demos.json): a folder, a name and a line for each.

**The address says which demo.** What follows the `#` is the demo's folder: `demos/#cloth-pile`. A click on a card changes it, and a link with it opens on that demo with its card scrolled into view. The frame's address is *replaced*, not opened: so the frame adds nothing to the browser's history, and one step back is one demo back.

**The pictures take themselves.** [demo-shots.mjs](../../scripts/demo-shots.mjs), `npm run shots` while `npm run dev` runs: Chrome with no window opens each demo, lets it run seven seconds, hides the panel and saves what the canvas shows.

### What surprised us

**On the phone, every demo failed.** `GPUPipelineError`, and no other word. It was not the new page: it had been so since [chapter 051](./051-read-once.md), and nobody had opened a demo on a phone since. The same error came in Safari on the Mac, the phone's engine, and there a test page could try the shaders one by one. One never finished compiling: the check for two cells that share a slot, 351 comparisons joined by `||` in one expression. Chrome took it. Written as an `if` for each cell, 26 comparisons at most in a line, Safari takes it too.

## What we take away

- A frame lets a page gather others without touching them.
- A shader that Chrome compiles is not a shader that every browser compiles: open the demos in Safari after a change to a shader.
- An expression of hundreds of terms can stop a compiler. Many short lines cost the GPU the same.
- The part of an address after `#` never reaches the server: a page can use it to remember where it is.

## Open questions

- A new demo needs a line in demos.json and `npm run shots`: nothing checks that it was done.
- In most pictures the subject is small: the camera is the demo's own.

## Next step

The user's choice: what of the hand, the drift and the patches goes into the engine, or one of the three left from chapter 066.
