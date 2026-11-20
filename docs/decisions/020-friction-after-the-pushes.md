# 020 · Friction on positions, measured after the pushes

*Accepted · November 20, 2026 · The user, after following a thrown drop substep by substep ([chapter 034](../logbook/034-the-box-on-the-ramp.md))*

**Decision:** we will give particles friction by moving positions, inside each round: a particle first works out the pushes of its contacts, then each contact asks to take back the slide the two have made since the start of the substep, measured from where those pushes bring the particle, up to µ × their overlap, and the particle moves by the average of what its contacts ask.

## Why

Without friction a heap is a liquid and a glancing hit sends particles upward ([chapter 032](../logbook/032-two-kinds-of-bounce.md)). Macklin's rule for NVIDIA FleX turns Coulomb's law into moves and fits the rounds of [decision 015](./015-half-and-half-on-positions.md). On a slope it gives the exact answer. Measured before the pushes, it threw drops up to 6.4 m: in a hollow between two spheres, what one contact sees as a slide is what the other pushes back, and the fall was undone twice. Of 75 drops thrown at 20 m/s onto spheres held still ([our script](../topics/friction.mjs)), rising above 10 cm:

| | µ = 0.5, 4 substeps | µ = 1, 1 substep | µ = 1, 4 substeps |
| --- | --- | --- | --- |
| before the pushes, in the same sum | 5, up to 87 cm | 4, up to 24 cm | 3, up to 6.4 m |
| before the pushes, averaged | 0 | 0 | 3, up to 2.2 m |
| **after the pushes, averaged** | **0** | **0** | **0** |

## Not chosen

- **Friction moves in the same sum as the pushes:** taller piles, 46° against 33° at µ = 0.5, but it throws drops, measured before the pushes or after.
- **A cap on the friction move at how far the particle moved:** it never triggered. The excess was friction plus pushes, not friction alone.
- **Damping,** to calm the heap instead: it slows every fall ([decision 014](./014-damping-off-by-default.md)).

## Consequences

- A round reads its neighbours twice, once for the pushes and once for friction, and also where each one was when the substep began. One more buffer bound, the positions, and one number, µ.
- A particle uses its own pushes of the round but its neighbour's position from the round before: the two sides of a contact do not ask exactly opposite moves.
- The slope of a pile changes with the substeps: 22° with 1 and 7° with 4 at µ = 0.3.

## Still open

- The default µ. The live page starts at 0.3, which stops the skating and makes a pile stand.
- One µ for all, or one per particle. Friction with the ball of the live page, which has none.
- The cost on the GPU: our timings, between 10% more and no difference, were too noisy to say.

## Revisit if

- We find a friction that does not change with the substeps: Macklin points to Müller and others, 2007.
