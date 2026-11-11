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

## Rules

- Claude proposes, the user decides. Only the user turns a decision into "Accepted".
- An accepted decision is never edited away: a new decision supersedes it, and both stay.
- Numbers are never reused, and the order is the order in which we decided.
