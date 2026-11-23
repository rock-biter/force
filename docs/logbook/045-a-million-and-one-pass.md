# 045 · A Million, and One Pass

*November 23, 2026 · 3 min read*

**In short:** the live page now goes up to a million particles, in a box that grows with them. Trying fewer rounds, we found that friction made every round read its neighbours twice. It reads them once now, and a step is 3 rounds in each of 2 substeps.

## The story

**A million.** The slider of the [live page](../../examples/force-plus/index.html) stopped at 100 000. A million do not fit in its box of 24 m: the block they start in is 39.7 m wide. So beyond about 230 000 particles the floor widens, to stay 1.25 times as wide as that block: 50 m for a million. It runs with no error and loses no particle, at 3 frames a second on our Mac M1: a step takes 135 ms, nearly all in the lists of neighbours and in the rounds. On the page that tilts, a grid around the tilted box would need 12 million cells, where the device takes 4.2 million: the page then switches to the hashed table by itself, and says so. The limit of [chapter 040](./040-the-table.md), met for real.

**Rounds or substeps.** A step pushed touching particles apart in 6 *rounds*, each a pass over every particle's neighbours ([decision 022](../decisions/022-six-rounds.md)). "What if we did 3, in 2 substeps?" the user asked: a *substep* is a step cut in shorter ones, each with its own rounds. That is the same 6 rounds, so it cannot be cheaper, and each substep also checks the lists and computes the levels of the pile again. But is it better? 100 000 particles after 30 s, one run each. "Deep" counts the pairs that overlap by more than 1 cm, on spheres 20 cm wide:

| Rounds × substeps | A step, liquid | Deep pairs | A step, friction 0.3 | Deep pairs |
| --- | --- | --- | --- | --- |
| 6 × 1 | 10.8 ms | 107 | 20.9 ms | 150 |
| **3 × 2** | **14.4 ms** | **7** | **22.6 ms** | **7** |
| 2 × 3 | 18.7 ms | 0 | 22.6 ms | 1 |
| 2 × 2 | 11.4 ms | 41 | 14.4 ms | 41 |

With the same rounds, two short steps leave far fewer deep overlaps than one long one. So some rounds could go: the user first chose 2 × 2, a third fewer rounds and still cleaner than before ([decision 026](../decisions/026-two-rounds-two-substeps.md)), then, the same evening, 3 × 2: the cleaner one, at a higher price than where we began ([decision 029](../decisions/029-three-rounds-two-substeps.md)). The level strength c of FORCE+ became 1.5 for all, as the pages already started ([decision 028](../decisions/028-level-strength.md)). The speed limit follows the substeps: with 2 of them the safe limit, one radius per substep, is 12 m/s, more than the 9 m/s we had gone past it to get, so the default goes back to safe ([decision 027](../decisions/027-the-safe-speed-limit-by-default.md)).

**At rest.** We also measured how still a heap is: read the positions, wait a second, read them again. A liquid of 20 000 comes to rest in every mix. A pile with friction does not, in any, 6 × 1 included: after a minute almost half of its particles still move faster than 1 cm/s.

**Friction, twice as long.** The same tables showed the rounds taking 11.6 ms with friction and 5.5 without. The shader said why. Friction takes back the slide of two touching particles, measured from where this round's pushes bring them ([decision 020](../decisions/020-friction-after-the-pushes.md)). The pushes are known only after a loop over the neighbours, so friction looped over them again. "We must avoid the two passes," the user said. "We added this in a hurry, and we will come back to it." Three ways, at 100 000 particles and friction 0.3:

| Friction | The 6 rounds | Mean height of the pile after 30 s |
| --- | --- | --- |
| none, a liquid | 5.5 ms | 0.71 m |
| neighbours read twice (020) | 12.3 ms | 1.17 m |
| read once, each contact kept in the thread's own variables | 36 ms | the same |
| in the last round only | 6.9 ms | 0.78 m |
| **in the loop of the pushes, slide up to the last round** | **7.0 ms** | **1.17 m** |

The third wins: friction one round late ([decision 025](../decisions/025-friction-in-one-pass.md)).

### What surprised us

**Keeping what we read was the slowest.** Two arrays of 32 values in each thread, to avoid a second reading of memory, made the rounds three times longer, even with no friction. We guess the GPU clears and stores them for every particle at every round; we did not look further.

**One round late costs nothing we can see.** The pile stands as tall. But 020 chose "after the pushes" because, measured before, thrown drops flew up to 2.2 m. We did not run that test again.

## What we take away

- With the same rounds, more substeps mean fewer deep overlaps. A substep is not free: lists and levels run again.
- Before making a loop cheaper, count how many times it runs: friction doubled the neighbours read.
- Memory a thread keeps for itself is not free on a GPU.
- A grid has a size limit a device sets; the table does not. The page now knows.

## Open questions

- Why a pile with friction never rests, and the drops thrown by friction measured one round late.
- The times with friction were noisy, 11.6 and 20.9 ms for the same scene an hour apart: several runs are needed.

## Sources

- The live page with `?rounds=`, `?substeps=` and `?profile=` in the address ([main.ts](../../examples/force-plus/main.ts)), and its round shader ([round-push.wgsl](../../examples/force-plus/round-push.wgsl)).

## Next step

Look at 3 × 2 by eye, then read the new benchmark issues.
