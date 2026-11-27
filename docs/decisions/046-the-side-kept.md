# 046 · The side kept

*Accepted · November 27, 2026 · The user, after trying it on the pages ([chapter 075](../logbook/075-which-side-you-came-from.md))*

**Decision:** we will push two touching particles apart along the line their centers were on when the substep began, not the one they are on now, and ask that they stay their two radii apart along it. Not when the two belong to the same body, a cloth or a rope: there the push stays as it was.

## Why

A push along the line between two centers has no side: once a particle is past another, the line has turned, and the push helps it out of the wrong side ([Self-collision](../topics/self-collision.md)). The line the two had when the substep began still points to the side each came from. In [our script](../topics/self-collision-middles.mjs), part 13, with 3 substeps: two cloths flying at each other at the speed limit, where 38% of the particles passed, none; a cloth pulled by the hand through one that cannot move aside, which passed whole, stops the hand at 0.5 m of 1.5 with no crossing. On the page of the pile the user pulled hard, and the cloths held. The idea is Chris Lewin's ([our notes](../topics/predictive-contacts-talk.md)); we keep only the direction.

## Not chosen

- **The push as it was:** see above.
- **The side kept for every pair:** tried first. The side kept does not know which side is the right one: a fold that has crossed another of the same cloth cannot cross back, though its springs pull it. On the page of the cloth and the ball, whose free edge crosses itself often, the user saw more of it stay crossed than before.
- **Contacts made before the touch**, for every pair that began the substep closer than 3.5 radii, as Lewin does: in the script no better than the direction alone, and worse on the fast pull, for 125 cells to read where we read 27.
- **A cap on stretch after the pushes** (Provot 1995): links end 17% long where they were 69%, and the pulled cloth passes all the same. It was not stretch that let it through.
- **A particle at the middle of every square:** [decision 043](./043-three-substeps-for-cloths.md).

## Consequences

- Two more reads for every touching pair, of positions the round already had for friction: the rounds took 5 to 7% longer on the pile of cloths, about 0.1 ms of a step of 4.
- Every particle now says which body it is part of, in the third of its properties: a whole number from 1 on, 0 for a particle on its own. The engine will need it for more than this.
- In [round-cells.wgsl](../../examples/heap-simulation/round-cells.wgsl), where no particle has a body, for every pair; in [round-cells-sized.wgsl](../../examples/mixed-sizes/round-cells-sized.wgsl) between bodies. The benchmark page keeps its own shader and its numbers.
- A cloth that folds fast onto itself has only the 3 substeps of decision 043 to keep it shut.
- It needs the 3 substeps of decision 043: with 2, in the script, a cloth pulled through another ends stuck halfway, with more crossings than before. Two cloths that do cross each other stay crossed.
- A hole wider than a particle is still a hole: grains fall through a cloth stretched by 41% as before.

## Still open

- Piles of loose particles, rolling and friction with the new direction: seen on the pages, not measured.
- Not tried in Safari or on a phone.

## Revisit if

Cloths are found stuck through each other on the pages, or a pile behaves worse than it did.
