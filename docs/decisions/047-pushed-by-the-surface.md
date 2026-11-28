# 047 · Pushed by the surface of a cloth

*Accepted · November 28, 2026 · The user, after trying it on the page ([chapter 077](../logbook/077-the-surface-of-a-cloth.md))*

**Decision:** we will push a loose particle that touches a cloth along the cloth's normal, blended over the cloth's particles in reach, until it rests at half the cloth's thickness from its middle; the contact is still made when two spheres overlap, and past an edge the push starts from the edge.

## Why

A push between two centers makes a cloth of spheres an egg tray: a grain as large as the spheres leaves a dimple only at 35°, and rests a radius above a cloth drawn thin. Along the normal it leaves at 1.9°, as on a true plane ([grains-on-cloth.mjs](../topics/grains-on-cloth.mjs)). All the particles of the cloth in reach are one contact: added up, they threw a grain back to 0.41 m of the 0.5 m it fell from. Blended, weighed by distance along the cloth, a grain rolling down a bowl drifts 10 cm where the deepest plane alone gave 18 ([grains-on-net.mjs](../topics/grains-on-net.mjs)). The edge is rounded because a contact is made up to a diameter past the last particle, and grains bounced there on nothing.

## Three levels, by what a cloth needs

The push along the normal is the best of the three and the one that costs: a choice for each cloth, not for the engine.

1. **The normal**, as above: for a cloth seen close, with particles as large as what falls on it.
2. **A net 3 times finer**, pushed between centers: 15° to leave a dimple, and the edges need nothing. Where 9 times the particles can be afforded, it is enough by itself.
3. **Plain spheres as large as the grains**, pushed between centers: 35°, and grains that stay where they land. For a cloth far away, or one that needs no such detail.

## Not chosen

- **A larger sphere touching the surface from inside** (Müller and Chentanez 2011): lowers the dimples, 13° to 22°, and does not remove them.
- **The normal of the nearest particle only:** flat tiles, more drift.
- **Contacts with triangles** (Obi, PBD 2006): another search for neighbours, where ours is of spheres.

## Consequences

- One more pass per substep, which works out a normal for every particle of a cloth, and one more buffer. The shader that pushes stays within 8 storage buffers by reading the floor and walls as a uniform.
- A cloth has a thickness for contacts, apart from the radius of its particles. It must stay under 0.41 radii for half of it, less on a stretched cloth, or a grain between four spheres touches none.
- The cloth sags a little more under grains that now gather at its lowest point.
- Only on the trial page for now: [round-cells-surface.wgsl](../../examples/net-surface/round-cells-surface.wgsl). The other pages push as before unless opened with `?surface=`.

## Still open

- Two cloths on each other: 6 thin ones hold, 12 tangle ([cloths-in-a-pile.mjs](../topics/cloths-in-a-pile.mjs) rules out their weight).
- A cloth against itself. Safari and a phone.
- What each of the three levels costs: none is measured yet, so where one stops being worth it is not known.

## Revisit if

Cloths become bodies of their own with triangles, or the pass costs more than a finer net would.
