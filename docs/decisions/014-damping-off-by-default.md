# 014 · Damping as a knob, off by default

*Accepted · November 19, 2026 · The user, after the ranking of contact methods ([chapter 028](../logbook/028-the-ranking.md))*

**Decision:** we will offer a damping knob for every particle, a share of the speed taken away per second in every direction, like air, and it will be off by default.

## Why

The user proposed a minimum of damping for "half and half", the strongest candidate for pushing particles apart ([chapter 026](../logbook/026-the-marble-in-the-pocket.md)). But in our tests that rule stands still without it in every scene. At 0.5% of the speed per step the effect was mixed: the straight box went from 13.0 to 11.4 mm deep, the turned one from 15.2 to 16.1. Meanwhile every motion slows: after one second of free fall a body goes at 8.45 m/s instead of 9.81, and at 2% per step at 5.63 ([chapter 027](../logbook/027-the-stored-nudge.md)). Damping treats the symptom of a weak rule, and it charges every motion for it.

Green's NVIDIA sample has the same knob, `globalDamping`, set to 1: no damping.

## Not chosen

- **On by default, with a small value:** it slows every fall and every throw, and it would hide a rule that trembles instead of fixing it.
- **A share per step:** with 8 substeps it would act 8 times per frame, and the same number would mean a different damping. Per second it stays the same whatever the step.
- **No knob at all:** some games want a heavy, slow look, or a medium like water, and the cost is one multiplication.

## Consequences

- A world option such as `World.create({ damping })`, in 1/s, with 0 by default. With 0 the shader can drop the line, like the ground ([decision 013](./013-a-flat-ground.md)).
- Free fall stays exact by default: `falling-particles` keeps its check.
- If a scene trembles, the first answer is the rule or the rounds, not this knob.

## Still open

- The exact formula from a share per second to a step: for example `v × e^(−damping × h)`.
- One value for the world, or one per particle.

## Revisit if

- Friction, rotation or heavy bodies bring a trembling that no rule and no number of rounds stops.
