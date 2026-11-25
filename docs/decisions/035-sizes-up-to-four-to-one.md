# 035 · Sizes up to 4 to 1

*Accepted · November 25, 2026 · The user, after trying sizes beyond 2 to 1 without the lists ([chapter 055](../logbook/055-further-apart.md)). Supersedes the limit of [031](./031-particles-of-different-sizes.md)*

**Decision:** we will let the largest particle be up to 4 times as wide as the smallest, in the engine and in the panel of the page.

## Why

The limit of 2 to 1 came from the lists of 32 neighbours, which are gone ([decision 034](./034-no-lists-of-neighbours.md)). With radii spread evenly between the two ends, 100 000 particles on our Mac M1 take 14 ms a step at 2 to 1 and 18 at 4 to 1, and no pair overlaps by more than half the smaller radius. The user first chose 4 to 1 for the panel and 8 for the engine; then a harder scene, with two sizes only, showed small spheres ending up inside large ones at 6 and 8 to 1, and the user brought the engine down to 4 as well.

## Not chosen

- **Staying at 2 to 1:** the reason for it no longer exists.
- **8 to 1 in the engine:** with two sizes only it does not hold: overlaps of several radii, and a step of 250 ms.
- **A limit for each kind of mix:** the engine cannot know how a scene will mix its sizes.

## Consequences

- At 4 to 1 the kind of mix decides. Sizes spread evenly: 18 ms a step, the worst overlap 38% of the smaller radius. Two sizes only, half of the volume each: 65 ms, and one pair in seven overlaps by more than a tenth of the smaller radius. So 4 to 1 is fine for the first and rough for the second.
- A third substep cuts the deep pairs by four to ten times, for about half the time again.
- The rest of decision 031 stands: one speed limit from the largest radius, a weight of density times volume, cells for the largest and a margin for the smallest.

## Still open

- A grid in several levels, so that small particles are not searched through cells made for large ones.
- Holding a heavy sphere on light ones: the ratio of the masses, which α softens but does not solve.
- Whether small particles pass through each other at the speed limit of the largest.

## Revisit if

Either of the first two open points is solved: then sizes can go further apart.
