# 045 · A tighter speed limit from 3 substeps on

*Accepted · November 27, 2026 · The user, after the tests of [chapter 074](../logbook/074-a-particle-in-every-square.md)*

**Decision:** we will cut every particle's speed to three quarters of a radius per substep when a world runs 3 substeps or more: 13.5 m/s with 3 and 18 m/s with 4, for spheres of 10 cm. With 1 or 2 substeps the limit stays one radius per substep, 6 and 12 m/s.

This changes [decision 027](./027-the-safe-speed-limit-by-default.md) from 3 substeps on. The rest of it stays: the limit follows the substeps, cuts only the speed, is on by default, and a world can set its own.

## Why

At one radius per substep, two particles flying at each other come 2 radii closer in a substep: more than the thinnest spot of a cloth of spheres, 1.41 radii ([Self-collision](../topics/self-collision.md)). In [our script](../topics/self-collision-middles.mjs), two cloths that meet at the limit pass through each other whole, at any number of substeps. At three quarters they come 1.5 radii closer, and 38% of the particles pass, not all. With 2 substeps, a curtain that falls and folds crossed itself for 27 steps where it was 251. More substeps raise the limit in m/s, so from 3 on there is speed to give back: 13.5 m/s is still above the 12 of today's pages.

## Not chosen

- **One radius at every number of substeps:** decision 027 as it was. Cloths, which now run at 3 substeps ([decision 043](./043-three-substeps-for-cloths.md)), would meet at up to 18 m/s each.
- **Three quarters at 1 and 2 substeps too:** 4.5 and 9 m/s, a slower fall on every page we have.
- **Half a radius:** two cloths would close 1 radius a substep, where the script saw none pass, but 9 m/s with 3 substeps is less than today.

## Consequences

- Anything that falls for more than 9.3 m with 3 substeps, or 16.5 m with 4, falls slower than it should.
- The limit no longer grows evenly with the substeps: 6, 12, 13.5, 18, 22.5 m/s.
- Not only for cloths: every world at 3 substeps or more.
- It does not close a cloth: at 1.5 radii a substep some particles still pass.

## Still open

- Three quarters at 3 substeps was not tried in the script on the curtain, where 3 substeps already crossed nothing.
- The hand ([decision 044](./044-a-hand-that-gives-way.md)) still moves a particle by a whole radius in a substep.

## Revisit if

Contacts that keep their side, or a cap on stretch, close a cloth at one radius per substep.
