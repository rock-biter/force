# 011 · Substeps, chosen when the world is created

*Accepted · November 11, 2026 · The user, when the debug viewer needed a substeps control ([step 009](../logbook/009-the-first-picture.md))*

**Decision:** we will split every step into equal substeps, one dispatch each, with their number chosen when the world is created: `World.create({ substeps })`, 1 by default.

## Why

[Decision 006](./006-semi-implicit-euler.md) chose [substeps](../topics/integration.md#substeps) against stiffness, and as a knob for the quality tiers, but the code had none. The debug viewer needs the knob now, to compare runs. A substep is only a shorter step: the shader stays the same and receives `step / N`, and `update` sends N dispatches for each step.

## Not chosen

- **A loop over the substeps inside the shader, in one dispatch:** fewer dispatches, but it only works while every particle moves on its own. Once particles touch, each substep must wait for all of them to finish the one before, and inside one dispatch there is no such wait across workgroups. This is our reasoning, still to check against a source.
- **Changing substeps on a running world:** possible, but the viewer restarts on every change, so that every run starts from the same state, and nothing else needs it yet.

## Consequences

- `world.time` still counts whole steps: substeps change the accuracy, not the time.
- N substeps cost N dispatches: the GPU work for each step grows N times.
- With gravity only, 4 substeps cut the drift from exact free fall by 4: 8.2 cm become 2.0 cm after one second. The GPU and the same steps in JavaScript agree to 5 decimal places.

## Still open

- How many substeps each tier gets ([decision 006](./006-semi-implicit-euler.md)).
