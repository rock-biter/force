# 025 · Friction in the same pass as the pushes

*Accepted · November 23, 2026 · The user asked for one pass, for now, after seeing the rounds take twice as long with friction; Claude chose which one, by measuring three ([chapter 045](../logbook/045-a-million-and-one-pass.md))*

**Decision:** we will, for now, work out friction in the same loop as the pushes: a contact measures the slide of the two particles up to where the last round left them, not from where this round's pushes bring them.

This supersedes the "measured after the pushes" of [decision 020](./020-friction-after-the-pushes.md). The rest of 020 stays: friction moves positions, inside each round, up to µ × the overlap, averaged over the contacts.

## Why

To measure the slide after the pushes, a round read every neighbour twice. Reading neighbours is what a round costs, so with friction the 6 rounds took twice as long. 100 000 particles on our Mac M1, µ = 0.3, 6 rounds and 1 substep, one run each:

| Friction | The 6 rounds | A step | Mean height of the pile after 30 s |
| --- | --- | --- | --- |
| none (a liquid) | 5.5 ms | 10.6 ms | 0.71 m |
| after the pushes, neighbours read twice (020) | 12.3 ms | 17.8 ms | 1.17 m |
| **in the same loop, slide up to the last round** | **7.0 ms** | **11.6 ms** | **1.17 m** |

## Not chosen

- **Neighbours read once and kept in the thread's own variables,** for the same result as 020: two arrays of 32 vec4 per thread made the rounds three times longer, 36 ms, even with no friction.
- **Friction in the last round only:** 6.9 ms, but the pile sinks to 0.78 m, nearly a liquid.

## Consequences

- With friction a step costs about a tenth more than without, not two thirds more.
- 020 chose "after the pushes" because, measured before, drops thrown at 20 m/s onto still spheres flew up to 2.2 m at µ = 1 with 4 substeps ([our script](../topics/friction.mjs)). That risk is back. On the live page with µ = 1 and 4 substeps we saw a pile that stands and nothing thrown, but that is one look, not that test.

## Still open

- Friction was added in a hurry, the user says, and we will come back to all of it: this record only stops the double cost meanwhile.

## Revisit if

- Particles are thrown upward by glancing hits at high µ or with many substeps.
- We find a way to measure after the pushes without a second reading of the neighbours.
