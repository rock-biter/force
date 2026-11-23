# 024 · Cells kept in a hashed table

*Accepted · November 23, 2026 · The user, after comparing the three ways on the GPU ([chapter 039](../logbook/039-far-apart-in-memory.md) and [chapter 040](../logbook/040-the-table.md))*

**Decision:** we will keep the particles of each cell in an address book, one list of all the particles sorted by cell, filed in a hashed table with at least two slots per particle. The hash scrambles a cell's y and z and then adds its x, so that the cells of a row along x sit next to each other in memory.

This supersedes the grid with 4 places per cell of [decision 016](./016-a-list-made-when-needed.md). Its list of neighbours, and when it is made again, stay. So do the cells of [decision 023](./023-cells-as-wide-as-the-reach.md), and the cells along the world's axes of [decision 021](./021-a-grid-fixed-in-the-world.md).

## Why

FORCE is for games, where a world can be large and its particles few. A grid pays for the volume of the world: 8 bytes per cell, full or empty, and a running sum over all of them. The table pays for the particles, and its space has no border ([chapter 037](../logbook/037-the-lonely-thread.md)). It was the slowest way until we found why: neighbouring cells were far apart in memory. A step of 1/60 s on our M1, in ms:

| | 4 places, cells of 20 cm | Book on a grid, 25 cm | **Book on a table, 25 cm, rows together** |
| --- | --- | --- | --- |
| level box, 100 000 particles | 17.6 | 12.0 and 11.9 | **12.3 and 12.2** |
| corner of the tilted box, 50 000 | 11.0 and 10.7 | 10.4 and 10.7 | **7.9** |
| the same: left out of a full cell, each time the lists are made | 1 491 and 1 967 | 0 | **0** |
| memory for the cells, page that tilts | 78 MB | 31 MB with cells of 20 cm | **1 MB** |

## Not chosen

- **4 places per cell:** it loses particles in a pile under pressure, and cannot use wide cells.
- **The book on a grid:** 0.3 ms faster in the level box, but it pays for the volume of the world and needs a border.
- **The hash of Teschner and others,** which scrambles all three coordinates: 16.0 ms instead of 12.3 at 100 000 particles.

## Consequences

- A world needs no size for its cells: a particle can be anywhere.
- Two cells can share a slot, so whoever reads a slot checks which cell each particle is really in.
- Making the book takes six shaders instead of two.
- The page keeps the other two ways and the old hash, for measuring: `?cells=book`, `?cells=places`, `?hash=scattered`, `?narrow`.

## Still open

- How the row hash spreads the cells over the slots: not looked at. And a phone.

## Revisit if

- A phone, or a scene with many more particles, shows the table well behind the grid.
