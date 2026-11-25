# 036 · A spring names its particles, and a register says where they are

*Accepted · November 25, 2026 · The user, after timing two ways on the GPU ([chapter 059](../logbook/059-a-name-or-a-corrected-list.md))*

**Decision:** we will give every particle a name, a number that never changes, and let a spring say the names of its two ends. A register, written again at every substep, says in which row each name is now.

## Why

The particles are kept in the order of their cells ([decision 033](./033-particles-in-order-by-default.md)), so a particle's row changes at every substep, and a spring that kept rows would join the wrong particles. Timed on our Mac M1, with the rows in the order of the table, a substep of 3 rounds: with 12 springs per particle, as in a cloth, names take 2.9 ms at 100 000 particles where a corrected list takes 5.2; with 4 springs they take 0.77 ms against 0.52. Cloth is the heavy case, and names hold there. NVIDIA FleX does the same, with two maps between the order it was given and its own.

## Not chosen

- **Rows in the springs, corrected at every substep:** faster with few springs per particle, as in ropes and chains, slower with many. Its correcting pass grows faster than its data, for a reason we did not find.
- **Letting whoever uses the engine choose:** nobody can know which is faster for their scene and device.
- **Letting the engine choose by the number of springs:** two ways to write and test for everything that touches springs, and a threshold that is right on one device only.

## Consequences

- Names are also what a user of the engine holds: "move particle 12" keeps meaning the same particle.
- A round reads two more things for every spring: its record, kept under its owner's name, and the register. More jumps in memory than a list kept in rows.
- Three more buffers for a round: the names, the springs, the register. A contact round already reads 7 storage buffers, 8 with sizes, so springs need a pass of their own, or more packing ([decision 032](./032-a-buffer-of-particle-properties.md)).
- The name of a particle must move with it, as its properties do.

## Still open

- Where the name lives: one of the three free numbers of the properties is the first candidate.
- Where the springs live, and how several springs on one particle are combined: the next two choices.

## Revisit if

- A scene of ropes and chains only matters, where the corrected list is faster.
- A phone shows the jumps in memory costing much more than here.
