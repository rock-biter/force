# 026 · Two rounds, in each of two substeps

*Superseded by [029](./029-three-rounds-two-substeps.md) · November 23, 2026 · The user, after timing four mixes of rounds and substeps on the live page ([chapter 045](../logbook/045-a-million-and-one-pass.md))*

**Decision:** we will split a step into 2 substeps by default and push touching particles apart in 2 rounds in each, 4 rounds a step, not 6 rounds in 1 substep. A world can ask for other numbers.

This supersedes [decision 022](./022-six-rounds.md), and sets the default that [decision 011](./011-substeps-per-world.md) left to each world.

## Why

The rounds are most of a step. With the same rounds, two short steps leave fewer deep overlaps than one long one, so some rounds can go. 100 000 particles on our Mac M1 after 30 s, on the live page with `?rounds=` and `?substeps=`, one run each. "Deep" counts the pairs that overlap by more than 1 cm:

| Rounds × substeps | A step, liquid | Deep pairs | A step, friction 0.3 | Deep pairs |
| --- | --- | --- | --- | --- |
| 6 × 1 (decision 022) | 10.8 ms | 107 | 20.9 ms | 150 |
| 3 × 2 | 14.4 ms | 7 | 22.6 ms | 7 |
| 2 × 3 | 18.7 ms | 0 | 22.6 ms | 1 |
| **2 × 2** | **11.4 ms** | **41** | **14.4 ms** | **41** |

The times with friction are noisy: an hour earlier 6 × 1 took 11.6 ms. Earlier runs of 2 × 2 against 6 × 1, before [decision 025](./025-friction-in-one-pass.md), gave 14% less with friction and 17% more in a liquid.

## Not chosen

- **3 × 2 and 2 × 3:** the fewest deep overlaps, but as many rounds as before, and every substep also checks the lists and computes the levels again: slower than 6 × 1.
- **4 × 1 and 3 × 1:** the cheapest, with 4 to 13 times the deep overlaps of 6 × 1.

## Consequences

- A step has a third fewer rounds. In a liquid that is no saving: the second substep costs what the rounds give back.
- The default speed limit doubles, from 9 to 18 m/s: it is a share of one radius per substep ([decision 019](./019-default-speed-limit.md)), until [decision 027](./027-the-safe-speed-limit-by-default.md) sets it to 12 m/s.
- On the compare page FORCE and FORCE+ now run 2 × 2, 4 rounds a step, next to methods that keep 8: the panes no longer share one budget, as they did for the ranking of [chapter 028](../logbook/028-the-ranking.md).
- The slope of a pile changes with the substeps ([decision 020](./020-friction-after-the-pushes.md)): piles with friction will stand lower than before.

## Still open

- How it looks: the user will compare the two by eye. Rest was measured as about the same, with no mix at rest after a minute with friction.
- The same measure on a phone, and with several runs.

## Revisit if

- Heaps look softer or more restless than with 6 × 1, or rigid bodies and cloth need more rounds.
