# 039 · A spring's softness is its compliance, with a running total

*Accepted · November 25, 2026 · The user, on Claude's proposal after a script and a measure on the ropes page ([chapter 064](../logbook/064-as-soft-as-asked.md))*

**Decision:** we will set how soft a spring is by its compliance, in meters per newton, 0 for a rod, and each spring will keep a running total of what it has asked for in the substep, as XPBD says.

## Why

Without the total, every pass takes back a share of what is left of a spring's stretch: one weight on a spring that should stretch 4.91% stretches 1.53% with 3 passes and 0.05% with 30. The spring's softness then depends on how many passes run, the very fault the compliance was meant to remove. With the total it stretches 4.91% with 3 passes, with 30, and with 8 substeps. On the ropes page, 29 weights that should stretch 7.4% stretch 8.3% with 3 passes and 7.5% with 10.

## Not chosen

- **The compliance without the total:** what the first ropes did. One number less per spring, and a softness that changes with the passes.
- **A coefficient from 0 to 1, as FleX:** it cannot be made right for both the passes and the substeps ([chapter 058](../logbook/058-how-engines-set-a-spring.md)).
- **Hertz and damping ratio, as Box2D:** they read well for a joint between two bodies. For a link in a net of particles of different masses, one compliance means one material.

## Consequences

- One more number per spring, 4 bytes, in a buffer of its own, and a flag for the first pass of a substep.
- With few passes a long chain is still a little off: 8.3% for 7.4% with 3 passes over 29 links.
- A spring that is as soft as asked keeps swinging: damping has to be added.

## Still open

- Damping.
- Whether whoever uses the engine should rather write a stiffness, and the engine turn it over.

## Revisit if

Springs between bodies of very different mass behave badly with one compliance.
