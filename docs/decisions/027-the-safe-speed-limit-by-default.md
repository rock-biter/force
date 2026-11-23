# 027 · The safe speed limit by default

*Accepted · November 23, 2026 · The user, after making 2 substeps the default ([chapter 045](../logbook/045-a-million-and-one-pass.md))*

**Decision:** we will cut every particle's speed, at the end of each substep, to one radius per substep by default: radius × 60 × substeps, 12 m/s for spheres of 10 cm with the 2 substeps of [decision 026](./026-two-rounds-two-substeps.md).

This supersedes [decision 019](./019-default-speed-limit.md), which set the default to 1.5 radii per substep. The rest of [017](./017-a-speed-limit-per-substep.md) and [018](./018-max-speed-in-meters-per-second.md) stays: the limit follows the substeps, cuts only the speed, is on by default, and a world can set its own in m/s.

## Why

019 went past the safe limit because, with 1 substep, the safe one was 6 m/s and every fall of more than 1.8 m visibly slowed. It paid with a few drops bouncing up to 20 cm. With 2 substeps by default the safe limit is 12 m/s, faster than the 9 m/s of 019, and 1.5 times it would be 18 m/s. At one radius per substep no particle can cross more than half of another in a substep, which is what "safe" means ([chapter 033](../logbook/033-the-speed-limit.md)).

## Not chosen

- **1.5 × safe, as before:** 18 m/s with 2 substeps, past the safe limit with no slow fall left to fix.

## Consequences

- A fall is cut at 12 m/s, reached after 7.3 m: higher falls land a little later than they should.
- A world that asks for 1 substep gets 6 m/s back, and the slow falls of 019 with it, unless it sets its own limit.

## Still open

- Not measured again: the thrown drops of [our script](../topics/speed-limit.mjs) with 2 substeps at 12 m/s.

## Revisit if

- The default substeps change again.
