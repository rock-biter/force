# 052 · What Follows a Particle

*November 25, 2026 · 2 min read*

**In short:** when particles are kept in the order of their cells, their properties now move with them. Sizes and order go together, and on the page with sizes a step with 100 000 particles goes from 24.9 to 13.2 ms.

## The story

**Two things that did not go together.** Keeping the particles in the order of their cells means moving them in memory: after the move, particle number 7 is whoever sits in row 7 of the address book ([chapter 041](./041-next-to-each-other.md)). Its position, its predicted position and its level in the pile move with it. Its properties, the buffer of [chapter 049](./049-a-radius-each.md) with the radius first, did not: row 7 would have kept the radius of the particle that was there before. So the page with sizes had the order switched off.

**No room in the shader that moves.** [book-move.wgsl](../../examples/heap-simulation/book-move.wgsl) reads three buffers and the book, writes three spare ones and reads the counters: 8 storage buffers, all a shader gets. The properties and their spare copy would be the ninth and the tenth. And that file is one the benchmark page times.

**A pass of their own.** Two small shaders, [properties-move.wgsl](../../examples/mixed-sizes/properties-move.wgsl) and its other half: each row of the book copies the properties of the particle written there into a spare buffer, then a second pass copies them back. Two passes, as for the positions, because a pass cannot read a buffer while other threads write it. They run only when the book is made again, right after the positions move.

**Does the radius still belong to its particle?** With one material a larger particle is heavier, and the viewer colors by mass, which travels with the position, and sizes the sphere by the properties. After 12 seconds in order every large sphere is still red and every small one blue: had the radii stayed behind, colors and sizes would be mixed.

**The measure.** The page with sizes, 100 000 particles with friction, 2 to 1, on our Mac M1, one run each. A step, in ms:

| | As before | In order |
| --- | --- | --- |
| In the table | 24.9 | 13.2 |
| On a grid | 22.2 | 8.1 |

Making the lists was most of a step, 22 ms in the table: the cells are made for the largest particle, so each one holds many small ones, scattered in memory. In order it takes 2.5 ms. Moving the properties is part of the 1.3 ms the whole move takes.

## What we take away

- What belongs to a particle must move when the particle moves. One buffer for the properties means one more thing to move, not four.
- A full shader is not a wall: a second small pass costs little, here well under a millisecond.
- With sizes, order pays even more than with one size, because the cells are fuller.

## Open questions

- The check was by eye. A test that reads the buffers back would be better.
- The order is still asked for with `?sorted` in the address, on every page.
- No lists and sizes together: not written yet.

## Sources

- The page with `?sorted&profile=60` ([main.ts](../../examples/heap-simulation/main.ts)), and the two shaders in [examples/mixed-sizes](../../examples/mixed-sizes/properties-move.wgsl).

## Next step

The user's choice: particles in order by default, and whether the lists go.
