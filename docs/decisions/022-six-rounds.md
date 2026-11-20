# 022 · Six rounds per substep

*Accepted · November 20, 2026 · The user, to make a step cheaper on the live page ([chapter 034](../logbook/034-the-box-on-the-ramp.md))*

**Decision:** we will push touching particles apart in 6 rounds per substep by default, not 8. A world can ask for more or fewer.

This supersedes the number of rounds of [decision 015](./015-half-and-half-on-positions.md). The rest of 015 stays: moving positions, half and half, masses seen as m^0.5, levels in the pile.

## Why

At 100 000 particles a step takes longer than a frame on our M1, and the time goes into the rounds, not into drawing ([chapter 034](../logbook/034-the-box-on-the-ramp.md)). Each round reads every particle's neighbours again, so fewer rounds are the most direct saving. The 8 of decision 015 came from giving every method the same budget in a ranking ([chapter 028](../logbook/028-the-ranking.md)), not from what FORCE+ needs. With fewer rounds heaps sink a little more. FORCE+ after 8 s ([our script](../topics/mass-ratio.mjs), part 7, with its 8 rounds changed by hand):

| Rounds | Column of 10: centre of the top one (1.900 m if nothing sinks) | 1 kg under 100 kg | Box of 216 at 1 kg | Box of 216 at 1 to 10 kg |
| --- | --- | --- | --- | --- |
| 8 | 1.896 m | 0.2 mm | 0.7 mm | 2.7 mm, still |
| **6** | **1.894 m** | **0.5 mm** | **3.9 mm** | **5.6 mm, 2 moving** |
| 4 | 1.890 m | 0.9 mm | 4.6 mm | 7.1 mm, 9 moving |

Depths are the deepest pair, on spheres 200 mm wide; "moving" counts the spheres still faster than 0.1 m/s.

## Not chosen

- **8 rounds:** the most precise, at a third more rounds than 6.
- **4 rounds:** 9 spheres of the mixed box never rest.

## Consequences

- Heaps of equal spheres sink about 4 mm instead of 1, a fiftieth of a diameter.
- The compare page still gives every method 8 passes, FORCE+ included: its ranking keeps one budget for all.

## Still open

- How much time 6 rounds save: not measured. Rounds are most of a step, so about a quarter is our guess.
- The fewest rounds that still look right, with friction and on a phone. The user means to look for it when the engine is more mature.

## Revisit if

- Friction, rigid bodies or cloth need the rounds back.
