# 061 · A Dispatch per Group

*November 25, 2026 · 2 min read*

**In short:** solving springs one by one was far tighter in the script. On the GPU it means a dispatch for each group of springs that share no particle. Timed: a round costs about the same either way, so for the same tightness one by one is ten times cheaper.

## The story

**What the script left open.** In [chapter 060](./060-one-by-one-or-all-at-once.md) springs solved one after the other held a cloth with 6 rounds a step as tightly as the average did with 60. But the script runs on one thread. On a GPU, two springs that share a particle cannot run at the same moment: both would write that particle. So the springs are split into *groups* that share no particle, and each group is one dispatch: inside it every thread has its own two particles. For a cloth the groups are easy: the links along a side that start at an even column, those at an odd one, the same along the other side: 4 groups, 8 with diagonals. Splitting any net of springs this way is called *graph coloring*.

**What changes in memory.** *All at once* wants the springs next to their particle: a few places for each, every spring written twice, once at each end. *One by one* wants one list of springs, each written once, sorted by group.

**The measure.** The lab page of chapter 059, second part: the same cloth, names and a register ([decision 036](../decisions/036-names-and-a-register.md)), our Mac M1, rows in the order of the table. A round, in ms:

| Particles | Links each | All at once, 1 dispatch | One by one, a dispatch per group |
| --- | --- | --- | --- |
| 100 000 | 4 | 0.27 | 0.18 in 4 |
| 100 000 | 8 | 0.60 | 0.36 in 8 |
| 1 000 000 | 4 | 3.9 | 3.7 in 4 |
| 1 000 000 | 8 | 8.6 | 7.3 in 8 |

About the same, a little less one by one. The dispatches are more but each is small, and a dispatch costs little by itself ([chapter 020](./020-a-cheap-launch.md)).

**For the same tightness.** 3 rounds one by one against the 30 of the average, in a substep:

| Particles | Links each | 3 rounds one by one | 30 rounds all at once |
| --- | --- | --- | --- |
| 100 000 | 4 | 0.54 ms | 8.1 ms |
| 100 000 | 8 | 1.1 ms | 18 ms |
| 1 000 000 | 8 | 22 ms | 259 ms |

### What surprised us

**Two lost runs, one silly cause.** The page stayed on "Measuring…" for five minutes, twice. A comment added inside a shader had backticks in it, and the shader is a JavaScript string between backticks: the file no longer parsed, and the page never started. The typecheck said so at once; we had not looked at it. And `move`, like `register` before it, is a word WGSL keeps for itself.

**With the rows in the order of a grid, a million one by one is slower than all at once:** 4.5 ms against 2.1. In the order of the table, the same. Not looked into.

## What we take away

- More dispatches is not more time, when together they do the same work.
- Tightness per round is what to buy: both ways cost alike, and one gives ten times more.
- A list of springs written once is also half the memory of springs written at both ends.

## Open questions

- Groups for any net of springs, not a square cloth: how many, who works them out, and what when a spring is added while the simulation runs.
- A thread per spring writes two particles far apart in memory. On a phone?

## Sources

- The lab page, [spring-lookup](../../examples/spring-lookup/main.ts), with `?part=2` in the address.
- Jolt Physics, [SoftBodySharedSettings.h](https://github.com/jrouwe/JoltPhysics/blob/master/Jolt/Physics/SoftBody/SoftBodySharedSettings.h): `Optimize` "will reorder constraints so they can be executed in parallel", and keeps where each group ends.

## Next step

The first springs on a live page: the user accepted [decision 037](../decisions/037-springs-one-by-one-in-groups.md).
