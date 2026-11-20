# 015 · Particles pushed apart by moving positions, half and half

*Accepted, its 8 rounds superseded by [022](./022-six-rounds.md) · November 20, 2026 · The user, after timing both candidates on the GPU ([chapter 030](../logbook/030-the-lazy-list.md))*

**Decision:** we will push touching particles apart by moving their positions, in 8 rounds per step. Each particle adds half the sum and half the average of what its contacts ask (*half and half*). The solver sees each mass as m^0.5, and in a pile it weighs the lower particle e^(2 × difference of levels) more.

## Why

Chapters 025 to 029 tried three ways and many rules in 3D: springs, moving positions, changing velocities. At the same price, 8 passes over the contacts per step, only two settled in every scene: a spring with 8 substeps, and half and half ([chapter 028](../logbook/028-the-ranking.md)). With masses of 1 to 100 kg, half and half with compressed masses and levels sinks 0.2 mm where the spring in hertz sinks 6.9 ([chapter 029](../logbook/029-heavy-on-light.md)). On the GPU the two cost the same, within 10% ([chapter 030](../logbook/030-the-lazy-list.md)). Half and half has never blown up in our tests, and its knobs cannot make it.

## Not chosen

- **The spring in hertz:** 10% cheaper, but 7 to 10 mm deep in a heap of 100 000 against 4 to 5, 6.9 mm at a mass ratio of 100, and it blows up if its hertz or damper is set wrong.
- **Changing velocities:** needs stored pushes and relax rounds, 20 passes per step to settle ([chapter 027](../logbook/027-the-stored-nudge.md)).
- **The sum, the average, and the user's other rules:** each failed some scene at 8 passes ([chapter 028](../logbook/028-the-ranking.md)).

## Consequences

- The w of a position holds 1 / mass, the use [decision 008](./008-particles-in-two-vec4-buffers.md) kept it free for. A particle with w = 0 never moves.
- Each particle needs a predicted position, kept in two buffers that the rounds take turns writing, and a level, also in two buffers.
- Three knobs: the rounds, α (0.5) and the level strength c (2).
- Heavy bodies push through light ones less than they really would: a heavy ball no longer sinks to the bottom of a heap.
- The ground of [decision 013](./013-a-flat-ground.md) becomes one of the planes the rounds push particles out of.

## Still open

- Bounce and friction, which this rule does not have yet. Macklin does friction on positions too.
- Liquids, which may need their real masses ([chapter 029](../logbook/029-heavy-on-light.md)).

## Revisit if

- Friction, rotation or the timings on a phone change the comparison with the spring.
