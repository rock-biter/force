# 003 · Desktop and mobile from the start

*Accepted · before November 11, 2026 · The user, during the [research with ChatGPT](../logbook/004-the-detour.md)*

**Decision:** we will support desktop and mobile GPUs from the start, with quality tiers that scale the same simulation to each device.

## Why

FORCE should run wherever immersive web experiences run, phones included. WebGPU does not promise the same resources on every device, so the difference has to be designed in, not discovered at the end.

## Not chosen

- **Desktop first, mobile later:** simpler at the start, and ChatGPT's own suggestion, but every early choice would have to be checked again for phones.
- **High-end hardware only.**

## Consequences

- Every algorithm is judged on a phone GPU too.
- The engine reads the limits of each device before choosing how to run.
- Quality tiers change the number of particles, substeps and solver rounds.
- Speed is measured over minutes, since phones slow down as they heat up.

## Still open

- Which tiers, and what each one changes.
