# 019 · A default speed limit of 1.5 radii per substep

*Superseded by [027](./027-the-safe-speed-limit-by-default.md) · November 20, 2026 · The user, choosing the defaults of the base simulation after the measures of [chapter 033](../logbook/033-the-speed-limit.md)*

**Decision:** we will cut every particle's speed, at the end of each substep, to 1.5 radii per substep by default, 1.5 × radius × 60 × substeps, with 1 substep by default: 9 m/s for spheres of 10 cm.

This supersedes [decision 017](./017-a-speed-limit-per-substep.md), which set the default to one radius per substep. The rest of 017 stays: the limit follows the substeps, cuts only the speed, and is on by default. A world can still set its own in m/s ([decision 018](./018-max-speed-in-meters-per-second.md)).

## Why

The base simulation should be cheap and should not look slow. One radius per substep is safe, but with 1 substep it is 6 m/s, and every fall of more than 1.8 m visibly slows. Two substeps at 12 m/s cost twice the GPU time. With 1 substep at 9 m/s, 1.5 times the safe limit, the splashes almost vanish, and only falls of more than 4.1 m feel the limit. Of 75 drops thrown down at 20 m/s ([our script](../topics/speed-limit.mjs), part 3):

| 1 substep | Drops onto a heap, rising above 10 cm | Onto spheres held still | A fall from 9 m |
| --- | --- | --- | --- |
| 6 m/s, safe | 0 | 0 | 1.75 s, 6 m/s |
| **9 m/s, 1.5 × safe** | **6, up to 19 cm** | **1, 10 cm** | **1.43 s, 9 m/s** |
| no limit | heap spheres thrown up to 5.9 m | 75, up to 8.8 m | 1.35 s, 13.1 m/s |

## Not chosen

- **The safe limit by default:** with 1 substep it slows every high fall to 6 m/s.
- **2 substeps by default:** twice the cost of every step, for the few centimeters of bounce that 1.5 × safe leaves.

## Consequences

- A few drops bounce up to 20 cm in the worst scenes: the price of a cheap, fast default.
- With 1 substep nothing goes faster than 9 m/s unless the world asks: a fall from 9 m lands 80 ms later.

## Revisit if

- Friction changes how much the bounces above the safe limit show.
