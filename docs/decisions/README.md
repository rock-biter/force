# Decisions

The choices that shape FORCE, one per page: what we decided, why, what we left out, and what is still open. The format follows Michael Nygard's [architecture decision records](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

| Status | What it means |
| --- | --- |
| Proposed | Suggested, waiting for the user's answer |
| Accepted | The user said yes |
| Superseded | Replaced by a later decision, kept as history |

## The log

| # | Decision | Status | Date |
| --- | --- | --- | --- |
| 001 | [Physics on the GPU, with WebGPU](./001-gpu-with-webgpu.md) | Accepted | November 4, 2026 |
| 002 | [Real-time physics for games and immersive 3D](./002-real-time-for-games.md) | Accepted | Before November 11, 2026 |
| 003 | [Desktop and mobile from the start](./003-desktop-and-mobile.md) | Accepted | Before November 11, 2026 |
| 004 | [Rigid bodies and particles first](./004-rigid-bodies-and-particles-first.md) | Accepted | Before November 11, 2026 |
| 005 | [A fixed timestep](./005-fixed-timestep.md) | Accepted | November 11, 2026 |
| 006 | [Semi-implicit Euler, with substeps](./006-semi-implicit-euler.md) | Accepted | November 11, 2026 |
| 007 | [A step of 1/60 s, at most 4 per frame](./007-step-length-and-limit.md) | Accepted | November 11, 2026 |
| 008 | [Particles in two vec4 buffers](./008-particles-in-two-vec4-buffers.md) | Accepted | November 11, 2026 |
| 009 | [Meters, seconds, and Y up](./009-meters-seconds-y-up.md) | Accepted | November 11, 2026 |
| 010 | [The device comes from outside](./010-device-from-outside.md) | Accepted | November 11, 2026 |
| 011 | [Substeps, chosen when the world is created](./011-substeps-per-world.md) | Accepted | November 11, 2026 |
| 012 | [Renderers draw from the world's GPU buffer](./012-renderers-read-the-gpu-buffer.md) | Accepted | November 11, 2026 |
| 013 | [A flat ground, the simplest way](./013-a-flat-ground.md) | Accepted | November 11, 2026 |
| 014 | [Damping as a knob, off by default](./014-damping-off-by-default.md) | Accepted | November 19, 2026 |
| 015 | [Particles pushed apart by moving positions, half and half](./015-half-and-half-on-positions.md) | Accepted, rounds superseded by 022, level strength by 028 | November 20, 2026 |
| 016 | [Neighbours: a grid, and a list made when needed](./016-a-list-made-when-needed.md) | Accepted, cell width superseded by 023, grid with 4 places by 024 | November 20, 2026 |
| 017 | [A speed limit of one radius per substep](./017-a-speed-limit-per-substep.md) | Superseded by 019 | November 20, 2026 |
| 018 | [The speed limit, set in m/s](./018-max-speed-in-meters-per-second.md) | Accepted | November 20, 2026 |
| 019 | [A default speed limit of 1.5 radii per substep](./019-default-speed-limit.md) | Superseded by 027 | November 20, 2026 |
| 020 | [Friction on positions, measured after the pushes](./020-friction-after-the-pushes.md) | Accepted, "after the pushes" superseded by 025 | November 20, 2026 |
| 021 | [A grid fixed in the world](./021-a-grid-fixed-in-the-world.md) | Accepted | November 20, 2026 |
| 022 | [Six rounds per substep](./022-six-rounds.md) | Superseded by 026, then 029 | November 20, 2026 |
| 023 | [Cells as wide as the lists reach](./023-cells-as-wide-as-the-reach.md) | Accepted | November 23, 2026 |
| 024 | [Cells kept in a hashed table](./024-cells-in-a-hashed-table.md) | Accepted | November 23, 2026 |
| 025 | [Friction in the same pass as the pushes](./025-friction-in-one-pass.md) | Accepted | November 23, 2026 |
| 026 | [Two rounds, in each of two substeps](./026-two-rounds-two-substeps.md) | Superseded by 029 | November 23, 2026 |
| 027 | [The safe speed limit by default](./027-the-safe-speed-limit-by-default.md) | Accepted | November 23, 2026 |
| 028 | [A level strength of 1.5](./028-level-strength.md) | Accepted | November 23, 2026 |
| 029 | [Three rounds, in each of two substeps](./029-three-rounds-two-substeps.md) | Accepted | November 23, 2026 |
| 030 | [Shadows in the debug viewer, shaded once per pixel](./030-viewer-shadows-shaded-once-per-pixel.md) | Accepted | November 25, 2026 |
| 031 | [Particles of different sizes, up to 2 to 1](./031-particles-of-different-sizes.md) | Accepted | November 25, 2026 |
| 032 | [One buffer for the properties of a particle](./032-a-buffer-of-particle-properties.md) | Accepted | November 25, 2026 |

## Rules

- Claude proposes, the user decides. Only the user turns a decision into "Accepted".
- An accepted decision is never edited away: a new decision supersedes it, and both stay.
- Numbers are never reused, and the order is the order in which we decided.
