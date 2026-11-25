# 059 · A Name, or a Corrected List

*November 25, 2026 · 3 min read*

**In short:** the fourth stop of the study on springs begins with a question: our particles change row at every substep, so how does a spring find its two ends? Two ways, timed on the GPU before choosing. Neither wins everywhere: it depends on how many springs a particle has. We chose names.

## The story

**The problem.** A spring is four numbers: who its two ends are, how long it is at rest, how stiff ([chapter 058](./058-how-engines-set-a-spring.md)). But since [chapter 053](./053-in-order-by-default.md) a particle's place in the buffers, its *row*, changes at every substep. A spring that says "row 12 with row 13" joins two other particles one substep later.

**Two ways out.** Think of a class where the pupils change desk every hour, and a list of pairs.

*A, a name and a register.* Every particle has a name, a number that never changes. A spring says two names. A register says in which row each name is now, written again at every substep. NVIDIA FleX does this: it reorders its particles as we do and keeps two maps, `originalToSortedMap` and `sortedToOriginalMap`.

*B, a list corrected every time.* A spring says two rows, and its record sits next to its owner. At every substep the records move with their particles and their rows are rewritten.

**"Let us measure the two first,"** the user said. A page of the lab, [spring-lookup](../../examples/spring-lookup/main.ts): a square cloth lying flat, each particle joined to 4 neighbours, or to 12 as a cloth with diagonals and folds would be. No physics, only the reading and writing each way needs, on our Mac M1. With the rows in the order of our hashed table, the default, one substep of 3 rounds:

| Particles | Springs each | A: register + 3 rounds | B: correcting + 3 rounds |
| --- | --- | --- | --- |
| 100 000 | 4 | 0.77 ms | 0.52 ms |
| 100 000 | 12 | 2.86 ms | 5.16 ms |
| 1 000 000 | 4 | 14.5 ms | 9.9 ms |
| 1 000 000 | 12 | 46.6 ms | 50.3 ms |

**Where the time goes.** A round of B is always the faster, by a third to a half: it reads its springs where it stands, and the other end's position, nothing else. A round of A makes two more jumps in memory for every spring: to its records, kept under its name, and to the register. But B pays for that once per substep: correcting the list costs as much as two rounds with 4 springs, and as four with 12. The register of A costs almost nothing.

**The order of the rows matters again.** In the order of a grid, A wins more often. With the rows at random, the worst a cloth could be, B is twice as fast with 4 springs.

**Could the engine choose by itself?** The user's idea: a cloth in the scene, or more than so many springs per particle, and the engine takes A, otherwise B. It could: it knows how many springs each particle has when they are added. But everything that touches springs would be written and tested twice, and the threshold would be right on one device only. We took the lists of neighbours out five chapters ago to have one way, not two. So one way, A: it holds for cloth, loses a quarter of a millisecond on ropes, and gives whoever uses the engine a name to hold a particle by ([decision 036](../decisions/036-names-and-a-register.md)).

### What surprised us

**Correcting 12 springs costs 14 times correcting 4.** Three times the data, fourteen times the time. Not the branch in the shader: without it, the same. It grows in steps: 0.04 ms with 2 springs each, 0.2 with 4, 0.75 with 6, 2.4 with 12. Springs 1 and 2 join neighbours along x, which our table keeps next to each other in memory; the others reach into other rows of cells. So we guess it is the look-ups that land far apart, but a round makes the same jumps and costs a third.

**A word WGSL keeps.** The first shader would not compile: `register` is a reserved word, and the error did not say which word.

## What we take away

- With few springs each and several rounds, correct the list. With many springs each, keep names.
- Neither fits in the round we have: a contact round reads 7 storage buffers, 8 with sizes. A needs three more, B one. Springs want a pass of their own, or more packing.
- Names would be there for whoever uses the engine too: "move particle 12" needs a 12 that stays.

## Open questions

- Why the correcting pass costs three times a round for the same jumps in memory.
- The same on a phone, and with real motion: here the particles moved 2 cm between substeps.

## Sources

- The lab page, [spring-lookup](../../examples/spring-lookup/main.ts), run in Chrome 158 without a window.
- FleX, [NvFlex.h](https://github.com/NVIDIAGameWorks/FleX/blob/master/include/NvFlex.h), for its two maps.

## Next step

Where the springs live in memory.
