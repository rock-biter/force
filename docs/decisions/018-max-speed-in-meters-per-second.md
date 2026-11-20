# 018 · The speed limit, set in m/s

*Accepted · November 20, 2026 · The user, who wanted a knob people understand, after measuring the risk above the safe limit ([chapter 033](../logbook/033-the-speed-limit.md))*

**Decision:** we will let a world set its speed limit in m/s, `maxSpeed`; left unset, it is the safe one of [decision 017](./017-a-speed-limit-per-substep.md), one radius per substep.

## Why

The safe limit protects every world that does not think about it. But a game may want faster throws, and accept some splashes. "Never faster than 20 m/s" is a number anyone can picture, as in FleX's `maxSpeed`. The page shows the safe value next to it, so a higher number is a choice made knowing the risk. With 2 substeps and spheres of 10 cm, the safe limit is 12 m/s. Of 75 drops thrown down at 20 m/s, these rose more than 10 cm after landing:

| Limit | Onto a heap | Onto spheres held still |
| --- | --- | --- |
| 12 m/s, safe | 0 | 0 |
| 15 m/s | 7, up to 24 cm | 6, up to 18 cm |
| 18 m/s | 13, up to 45 cm | 16, up to 41 cm |
| none | 34, up to 1.3 m | 38, up to 22 m |

The risk grows slowly up to about one and a half radii per substep, then explodes.

## Not chosen

- **Radii per substep,** `k × radius × 60 × substeps`: it stays as safe when the substeps change, but nobody pictures "1.5 radii per substep". A world can still compute it that way.
- **No knob, the safe limit only:** it would forbid fast games, or force them to pay for more substeps.

## Consequences

- A number in m/s does not follow the substeps: 30 m/s is fine with 8 and risky with 1. The safe value must be easy to read, as the page does.
- Above the safe value, splashes are the world's own choice.

## Still open

- How to turn the limit off: `Infinity`, or 0.
