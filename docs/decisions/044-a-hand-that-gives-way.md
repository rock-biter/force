# 044 · A hand that gives way

*Accepted · November 27, 2026 · The user, after the tests of [chapter 074](../logbook/074-a-particle-in-every-square.md)*

**Decision:** we will let the hand that drags a cloth move no particle more than that particle's radius in a substep.

## Why

The hand of [chapter 067](../logbook/067-a-hand-on-the-cloth.md) moves each particle it holds a share of the way to the pointer at every substep, whatever is in between. The speed limit ([decision 027](./027-the-safe-speed-limit-by-default.md)) cuts the speed only, and the hand moves particles after it. On the page of the pile, the user pulled a cloth hard from under the others and it passed through them, even at 4 substeps. In [our script](../topics/self-collision-middles.mjs), a hand pulls a cloth up through one held by its border: it passes at 2, 3 and 4 substeps alike, with links stretched by 69%. The pull asks for something impossible, and the hand never gives way, so the cloth does.

## Not chosen

- **The hand as it was:** see above.
- **A handle that waits**, the handle being the point the held particles are pulled toward, while a link under the hand is stretched over 20%: the particles are still pulled toward it, and the cloth ends stuck halfway through the other. Worse than no change in the script.
- **A hold that slips:** each particle pulled less the more its own links are stretched. With plain squares it also ends stuck halfway. The shader of the hand would also have to read the links, which it does not.

## Consequences

- One comparison more in [grab.wgsl](../../examples/cloth/grab.wgsl), with the radius the pass already reads.
- The hand moves a particle at 18 m/s at most with 3 substeps, above its own top speed of 10 m/s: a free cloth is dragged as before.
- It does not close the cloth by itself. In the script, with plain squares, a cloth pulled through a held one still passes: only with the middles of [decision 043](./043-three-substeps-for-cloths.md), now dropped, did the hand stop. The user keeps it because it helps in general, as tried on the page.

## Still open

- The share of the way is still taken at every substep, so more substeps make the same pull firmer.
- What stops a pull through a cloth that cannot move aside: a cap on stretch is the next thing to try.
