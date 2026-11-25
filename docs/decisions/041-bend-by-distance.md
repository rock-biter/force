# 041 · Bend links by distance, with a softness of their own

*Accepted · November 25, 2026 · The user, on Claude's proposal after a script and a look at the cloth page ([chapter 066](../logbook/066-against-the-fold.md))*

**Decision:** we will let a cloth resist folding with springs that join each particle to the one two places further along each side, and give those springs a compliance of their own, apart from the one of the other links.

## Why

A cloth with links along its sides and diagonals folds freely. A spring that skips a particle gets shorter when the cloth folds between its ends, and pushes back. It is the spring we already have: the same shader, the same record, four more groups. In the script a clamped strip turns a corner of 90° without bend links, of 38° with them as rods, and of 52°, 75° and 88° as they give 0.1, 1 and 10 mm per newton: one number sets how sharp the cloth creases.

## Not chosen

- **A link on the angle between two triangles (dihedral):** right for small folds too, where a distance hardly changes. A new rule on four particles, a new shader, groups of its own. Later, if needed.
- **One compliance for every link:** a cloth should hardly stretch and fold easily.
- **Nothing:** chain mail.

## Consequences

- 12 links per particle, not 8: half as many springs again, and 12 dispatches for each pass over them.
- Weak against small folds: a fold of 10° shortens the link by 0.4%. A cloth does not hold a shape with them, it only folds less sharply.
- They also carry the cloth's length further in a pass: with rods the cloth stretches a third as much.

## Still open

- What compliance means to whoever sets it: millimeters per newton say little about cloth.

## Revisit if

A cloth must hold a shape, as a flag in wind or a stiff sheet does.
