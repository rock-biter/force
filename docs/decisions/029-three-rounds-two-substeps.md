# 029 · Three rounds, in each of two substeps

*Accepted · November 23, 2026 · The user, the same day as [decision 026](./026-two-rounds-two-substeps.md), from the same measures ([chapter 045](../logbook/045-a-million-and-one-pass.md))*

**Decision:** we will split a step into 2 substeps by default and push touching particles apart in 3 rounds in each, 6 rounds a step. A world can ask for other numbers.

This supersedes [decision 026](./026-two-rounds-two-substeps.md), which set 2 rounds in each of 2 substeps. The 2 substeps stay, and with them the speed limit of [decision 027](./027-the-safe-speed-limit-by-default.md).

## Why

The user chose precision over the saving of 026. 3 × 2 has the 6 rounds a step of [decision 022](./022-six-rounds.md), in two short steps, and leaves about a twentieth of its deep overlaps. 100 000 particles on our Mac M1 after 30 s, one run each; "deep" counts the pairs that overlap by more than 1 cm:

| Rounds × substeps | A step, liquid | Deep pairs | A step, friction 0.3 | Deep pairs |
| --- | --- | --- | --- | --- |
| 6 × 1 (decision 022) | 10.8 ms | 107 | 20.9 ms | 150 |
| 2 × 2 (decision 026) | 11.4 ms | 41 | 14.4 ms | 41 |
| **3 × 2** | **14.4 ms** | **7** | **22.6 ms** | **7** |
| 2 × 3 | 18.7 ms | 0 | 22.6 ms | 1 |

The times with friction are noisy: an hour earlier 6 × 1 took 11.6 ms.

## Not chosen

- **2 × 2:** cheaper, with six times the deep overlaps of 3 × 2.
- **2 × 3:** a little cleaner still, and the slowest in a liquid.

## Consequences

- A step costs more than with 6 × 1, about a third more in a liquid: as many rounds, and every substep also checks the lists and computes the levels again.
- On the compare page FORCE and FORCE+ run 3 × 2, 6 rounds a step, next to methods that keep 8 in 1 substep.

## Still open

- How it looks against 6 × 1 and 2 × 2, by eye. The same measure on a phone, and with several runs.

## Revisit if

- A step must get cheaper: 2 × 2 is the measured way back.
