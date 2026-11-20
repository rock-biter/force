# 017 · A speed limit of one radius per substep

*Superseded by [019](./019-default-speed-limit.md) · November 20, 2026 · The user, after measuring the splashes of fast particles ([chapter 032](../logbook/032-two-kinds-of-bounce.md), [chapter 033](../logbook/033-the-speed-limit.md))*

**Decision:** we will cut every particle's speed, at the end of each substep, to one radius per substep, radius × 60 × substeps in m/s, on by default; the position stays where the substep left it.

## Why

A particle that moves more than its radius in one substep ends up past the middle of the ones it hits, and the rounds push it out on the wrong side, fast: in our tests, heap spheres thrown up to 5.9 m, drops onto spheres held still up to 22 m ([chapter 032](../logbook/032-two-kinds-of-bounce.md)). Cut to one radius per substep, no sphere is predicted to go that far, and the splashes are gone in every scene. With 2 substeps the limit is 12 m/s for spheres of 10 cm, and a fall from 9 m lands less than a step later than without it ([chapter 033](../logbook/033-the-speed-limit.md)). The limit comes from the substeps, not from a number to tune: choose the substeps, and the safe speed follows. NVIDIA FleX has the same knob, `maxSpeed`.

## Not chosen

- **A fixed speed, the same for every world:** unsafe with few substeps (12 m/s is 20 cm per step with one), needlessly strict with many.
- **Off by default:** every fast scene would splash until someone found the knob.
- **A limit on the change of speed,** FleX's `maxAcceleration`: with 1 or 2 substeps it stops particles from stopping, and they plow 18 cm into a heap.
- **Pre-stabilization** ([Macklin 2014](https://doi.org/10.1145/2601097.2601152), §4.4): it did not change these splashes.

## Consequences

- Nothing in a world goes faster than the limit: with 1 substep, 6 m/s, which visibly slows any fall of more than 1.8 m. A game that wants faster particles raises the substeps, and pays for them ([decision 011](./011-substeps-per-world.md)).
- One more length per particle in `finish`, and a number in the parameters.
- The limit leaves skating untouched: a glancing hit with no friction still turns sideways speed upward. Friction must handle that.

## Still open

- How a world turns it off or overrides it, such as `World.create({ maxSpeed })`. Settled: in m/s ([decision 018](./018-max-speed-in-meters-per-second.md)).
- Particles of different radii: the smallest radius, or each particle's own.

## Revisit if

- Friction or bigger bodies make the limit bite where players notice, such as throws or explosions.
