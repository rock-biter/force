# 037 · Springs in one list, solved one by one in groups

*Accepted · November 25, 2026 · The user, on Claude's proposal after a script and a timing ([chapter 060](../logbook/060-one-by-one-or-all-at-once.md) and [061](../logbook/061-a-dispatch-per-group.md))*

**Decision:** we will keep the springs in one list, each written once, sorted into groups that share no particle. In each round a group is one dispatch, where every spring moves its own two ends at once. The springs have passes of their own, before the contacts.

## Why

How several springs on one particle are combined decides everything else. With 2 substeps of 3 rounds, rods on a cloth with 8 links per particle stretch 0.1% when solved one by one and 3.1% when every particle averages what its springs ask; our rule for contacts, half and half, blows up there. The average needs about 30 rounds to do what one by one does with 6. On the GPU a round costs about the same either way, 0.36 ms against 0.60 at 100 000 particles with 8 links, so the same tightness costs ten times less one by one. And contacts solved after the springs, not in the same sum, leave a particle 0.04 cm inside a ball, not 0.7.

## Not chosen

- **All at once, the average:** any thread does its own particle, with no groups to work out. Soft, and it needs every spring written at both ends.
- **Half and half, as for contacts:** blows up when a particle has many springs.
- **Springs in the contact rounds:** no room for their buffers there ([decision 036](./036-names-and-a-register.md)), and worse contacts.

## Consequences

- Someone must split the springs into groups: easy for a cloth or a rope, a graph coloring for any other net. On the CPU, when springs are added.
- As many dispatches per round as groups: 2 for a rope, 4 to 8 for a cloth, more for a denser net.
- A thread per spring writes two particles in place: the positions are read and written by the same pass, which is safe only because a group shares no particle. A wrong grouping is a silent error.
- Half the memory of springs kept at both ends.

## Still open

- How to group any net, and how many groups it takes.
- How soft a spring is: chapter 060 said softer than asked with few rounds, by a wrong sum. [Chapter 064](../logbook/064-as-soft-as-asked.md) measures it again.
- Damping, and the rest of what a link can be: tethers, limits.

## Revisit if

- Groups turn out too many for the nets people build.
- A phone pays much more for writes far apart in memory.
