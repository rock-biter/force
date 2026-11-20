# 033 · The Speed Limit

*November 20, 2026 · 3 min read*

**In short:** no particle may move more than its radius in one substep. With 2 substeps that means 12 m/s at most: the splashes of fast particles are gone, and a fall from 9 m lands at 12 m/s instead of 13.1, as soon as without the limit. The live page now does it.

## The story

On the [force-plus](../../examples/force-plus/main.ts) page, up to 100 000 particles fill a box and a yellow ball under the mouse pushes them away ([chapter 031](./031-the-yellow-ball.md)). Swept fast, it made *splashes*: particles thrown meters high, some bouncing high again where they landed. [Chapter 032](./032-two-kinds-of-bounce.md) found two causes. The first: a sphere that moves more than its radius in one *substep*, one of the smaller steps a step of 1/60 s is cut into, ends up past the middle of the ones it hits and is pushed out on the wrong side, fast. The second, *skating*: with no friction, a sphere that hits another at a glancing angle keeps its sideways speed, and the next sphere turns it upward, like a skateboard on a ramp. Only friction, the rubbing that takes sideways speed away, can fix that one. The user asked whether to put pre-stabilization and a speed limit on the page right away. Pre-stabilization, which moves overlapping particles apart before a step so that the move gives them no speed, no: chapter 032 showed it does not change what the page shows. The speed limit is the right idea, but it needed numbers first.

The safe speed follows from the cause: one radius per substep, 0.1 m × 60 = 6 m/s with 1 substep, 12 with 2, 24 with 4. NVIDIA's particle engine FleX has two settings for this ([NvFlex.h](https://github.com/NVIDIAGameWorks/FleX/blob/master/include/NvFlex.h)). `maxSpeed` cuts the speed at the end of each step. `maxAcceleration` cuts how much the speed may change in one. We apply both at the end of each substep, since each substep is a whole small step. We tried them in [a script](../topics/speed-limit.mjs), on the rains of chapter 032: three rains of 25 spheres thrown down at 20 m/s, onto a heap of 216 spheres (648 over the three runs), and onto a layer of spheres held still, which nothing can push. And on the price: a sphere alone falling from 9 m, the height of the page's box.

| Setting | Heap spheres thrown above 10 cm | Drops onto spheres held still, rising above 10 cm | A fall from 9 m: lands after, at |
| --- | --- | --- | --- |
| 1 substep, no limit | 504 of 648, up to 5.9 m | 75, up to 8.8 m | 1.35 s, 13.1 m/s |
| 1 substep, max speed 6 m/s | 0 | 0 | 1.75 s, 6 m/s |
| 2 substeps, no limit | 31, up to 75 cm | 38, up to 22 m | 1.35 s, 13.1 m/s |
| **2 substeps, max speed 12 m/s** | **0** | **0** | **1.35 s, 12 m/s** |
| 4 substeps, max speed 24 m/s | 0 | 13, up to 28 cm | 1.35 s, 13.1 m/s |

With 1 substep the limit works, but every fall slows to 6 m/s, which shows. With 2 it costs almost nothing: the fall reaches 12 m/s only for its last 1.6 m, which takes about 6 ms longer, less than one step. With 4 the limit never triggers at 20 m/s, and what is left is the skating.

### What surprised us

**Two substeps alone can be worse than one.** Onto spheres held still, drops went up to 22 m. At 20 m/s a sphere still moves 17 cm per substep, more than its radius. And a speed is a move divided by the time it took: the same wrong push, in a substep half as long, becomes twice the speed.

**Limiting the change of speed backfires.** `maxAcceleration`, which FleX calls "useful to avoid popping due to large interpenetrations", that is, against particles thrown out of deep overlaps, at 100 m/s² still threw 499 heap spheres with 1 substep. Stopping is a big change of speed too, so a sphere that cannot stop plows on into the heap, up to 18 cm deep. With 4 substeps it removed everything, skating included, but it would also soften every real, hard hit.

**On the page.** At the end of each substep a shader called `finish` sets every particle's speed, from how far it moved in that substep, and its final position. The new `finish-limit.wgsl` is the same plus three lines: if the speed is above the limit, scale it down to the limit. The position stays where the substep left it: only the speed is cut, as in FleX. The page now starts with 2 substeps and a "max speed" switch on, showing the limit it gives. With 50 000 particles, a fast sweep of the ball throws them above the 9 m box without the limit, and less than 2 m above the heap with it. A step took 10 to 20 ms on our M1 across runs, as the GPU slows under load (chapter 030); the limit itself adds only one length to compute per particle.

**Faster, at a risk.** The user wanted to be able to ask for more, in m/s, a number people picture ([decision 018](../decisions/018-max-speed-in-meters-per-second.md)). So we measured the risk with 2 substeps, where 12 m/s is safe. Of the 75 drops onto spheres held still, 6 rose above 10 cm at 15 m/s, up to 18 cm, and 16 at 18 m/s, up to 41 cm. With no limit, at 20 m/s, 38 did, up to 22 m. The page's limit now reads "safe (auto)", "in m/s" with a slider, or "off", and always shows the safe value next to it.

**The defaults.** Last, the user chose the defaults of the base simulation: 1 substep, as always, and a limit of 1.5 times the safe one, 9 m/s ([decision 019](../decisions/019-default-speed-limit.md)). Measured the same way, 6 of the 75 drops onto the heap still rise above 10 cm, up to 19 cm, against heap spheres thrown up to 5.9 m with no limit. A fall from 9 m lands at 9 m/s, 80 ms late. The page now starts that way.

## What we take away

- The safe speed is one radius per substep: radius × steps per second × substeps.
- Pick the substeps first, then the limit follows. 2 substeps and 12 m/s cost almost nothing to see.
- Limiting the speed is not the same as limiting its change: the second also stops particles from stopping.
- The engine takes it, tied to the substeps and on by default ([decision 017](../decisions/017-a-speed-limit-per-substep.md)); a world may ask for more, in m/s, at a risk that grows slowly up to about 1.5 radii per substep. The default is 1.5 radii with 1 substep.

## Open questions

- A ball of 4 m can throw particles no faster than 12 m/s now. Enough for games?

## Sources

- NVIDIA, [FleX, NvFlex.h](https://github.com/NVIDIAGameWorks/FleX/blob/master/include/NvFlex.h): `maxSpeed` and `maxAcceleration`.
- Our script, [speed-limit.mjs](../topics/speed-limit.mjs), parts 1 to 3, and our page, [examples/force-plus](../../examples/force-plus/finish-limit.wgsl): every number of this chapter.

## Next step

Friction on positions, measured on the same rains and on the slope of a pile.
