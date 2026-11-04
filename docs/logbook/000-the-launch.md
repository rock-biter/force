# 000 · The Launch

*November 4, 2026 · 2 min read*

**In short:** from an empty folder to the first 1000 particles falling on the GPU. Almost everything worked first try. The fun part was finding out when "it works" was not true.

## The story

It all starts with a dream from five years ago, an empty folder and one rule: no three.js for now.

The first obstacle was the name. On npm, `force` is taken by an old Salesforce library, deprecated by its own author but still downloaded about 44,000 times a month. So the package is called `force-gpu`, at least for now.

Then the first test: `hello-compute`, a small shader that drops 1000 particles for 0.1 seconds and compares the result with the CPU. It is not an engine yet, but it proves we can put the GPU to work from the browser.

All green, then? Not quite. Three surprises:

**The switched-off linter.** An update command in Biome, the tool that checks our code, turned off every rule without warning. The check passed because it was no longer checking anything. We found out by writing bad code on purpose.

**The clashing types.** Everything was fine inside the project, but installing the package from the outside produced 182 errors: TypeScript 7 already ships part of the WebGPU types, and they collided with the ones we had added. An option was hiding this inside the project. The fix was `@types/web`, as recommended by the maintainers of those types.

**The false alarm.** The last GPU test got stuck on `Running…`. It looked like a failure, but it was Chrome speeding up time in test mode and reading the page too early. Repeated in real time: 12 out of 12, on Apple Metal 3.

Then came the logo, the cover, the announcement post and the first commit: *where everything began*.

## What we take away

- A green check is not enough: every now and then, make it fail on purpose.
- Test a package from the outside, installing it the way its users will.
- Before blaming the code, check the tool you are measuring with.

## Open questions

- The final name on npm: `force-gpu` or `@rock-biter/force`?
- Should `package-lock.json` be versioned? It is currently excluded by the global `.gitignore`.

## Next step

Understand what a physics engine really does.
