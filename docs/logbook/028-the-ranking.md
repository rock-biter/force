# 028 · The Ranking

*November 19, 2026 · 3 min read*

**In short:** every way of pushing particles apart from the last three chapters, at the same low price: 8 passes over the contacts per step. A tuned spring came first, half and half on positions second and third, and no velocity variant settled at that price.

## The story

Chapters [025](./025-the-pillow.md), [026](./026-the-marble-in-the-pocket.md) and [027](./027-the-stored-nudge.md) tried three ways and many rules, each at its own price. The user asked for a final ranking at the same price for all, and a low one: "20 rounds seem too many to me". So every way gets 8 passes over the contacts per step. Moving positions gets 8 rounds. Changing velocities gets 4 rounds plus 4 relax rounds. The spring gets 8 *substeps*, each step cut into 8 smaller ones. Box2D spends about the same: 4 substeps, each with one round and one relax round ([chapter 015](./015-the-stiff-spring.md)).

**The spring, at last in 3D.** Each overlap pushes with a stiffness k, minus a damper on the speed at which the two meet, as in Simon Green's NVIDIA sample. Its two knobs were tried in six settings, and the best one goes in the ranking: k = 50 000 N/m on spheres of 1 kg, with a damper ratio of 0.3, where 1 is the damper that stops a bounce with no rebound.

**The rules of the game.** The scenes of chapter 026, with spheres of 10 cm radius at 60 steps per second: a column of 10 on the floor, a box into which 216 fall, set straight or turned by 45°, and 100 particles dropped on a floor of fixed spheres. A scene *fails* if it blows up, if anything still moves faster than 0.1 m/s in the last second of 8, or if a pair is more than 20 mm deep, a tenth of the diameter. Fewer failures rank first, then a smaller mean depth of the deepest pairs. For the column the cell gives the centre of the top particle, 1.900 m if nothing sinks; no column moved in these ten. The other cells give the deepest pair and how many particles still move. *Half and half* is the user's rule of chapter 026: half the sum plus half the average of the corrections.

| # | Way | Failed | Column | Box, straight | Box, turned | Floor of fixed spheres |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | spring, 8 substeps | 0 | 1.889 | 1.2 mm, 0 | 1.2 mm, 0 | 0.7 mm, 0 |
| 2 | positions, half and half, damping 0.5% | 0 | 1.858 | 11.4 mm, 0 | 16.1 mm, 0 | 2.9 mm, 0 |
| 3 | positions, half and half | 0 | 1.858 | 13.0 mm, 0 | 15.2 mm, 0 | 5.0 mm, 0 |
| 4 | positions, largest push per axis | 2 | 1.868 | 4.9 mm, 0 | 10.6 mm, 180 | 2.1 mm, 1 |
| 5 | positions, direction of the average, 35% toward the longest | 2 | 1.851 | 9.9 mm, 131 | 11.7 mm, 6 | 3.7 mm, 0 |
| 6 | positions, sum capped at the longest push | 2 | 1.868 | 12.6 mm, 90 | 13.0 mm, 121 | 3.1 mm, 0 |
| 7 | positions, direction of the sum, longest length | 2 | 1.868 | 14.7 mm, 215 | 11.8 mm, 210 | 4.0 mm, 0 |
| 8 | positions, direction of the average, mean length | 2 | 1.851 | 16.1 mm, 148 | 11.0 mm, 34 | 3.3 mm, 0 |
| 9 | positions, average | 2 | 1.840 | 32.8 mm, 1 | 29.1 mm, 4 | 4.4 mm, 0 |
| 10 | positions, largest push along the sum | 3 | 1.868 | 14.9 mm, 216 | 14.2 mm, 215 | 2.7 mm, 2 |

The sum came 11th, with 3 failures and deeper pairs than the 10th: 20.7 mm in the box, and 19 particles shaking on the floor. Below it come the average times 1.5, the contacts one after the other, and all seven velocity variants. Without the two pieces they sink 30 to 106 mm; with them, 213 to 216 particles out of 216 are still moving in the box. Chapter 027 needed 10 relax rounds to calm them, and here there are only 4.

### What surprised us

**The spring won.** In chapter 025 it looked trapped between sinking and blowing up. But the stiffest spring that holds grows with the square of how much shorter the step is: halving it let in a spring four times stiffer in chapter 025, so 8 substeps let in one 8 × 8 = 64 times stiffer. Its window is narrow, though. The same stiffness with a damper ratio of 1 shook: 35 particles moving in the box. Claude's guess is that a damper has a limit of its own, like a spring, and many contacts add up past it. A softer spring, 5 000 N/m, sank 18 to 26 mm. And the window will move with heavier bodies and with more neighbours. Half and half has no knob to set: only the number of rounds.

**Damping, a little.** The user proposed to give half and half a minimum of damping anyway. At 0.5% of the speed per step the effect was mixed: the straight box went from 13.0 to 11.4 mm and the floor from 5.0 to 2.9, but the turned box from 15.2 to 16.1, and nothing was moving that needed stopping. And a body falling for one second reaches 8.45 m/s instead of 9.81. Claude's advice: offer it as a knob, measured per second so it does not change with the substeps, and off by default.

## What we take away

- At 8 passes per step, only two ways settle in every scene: the spring and half and half on positions.
- The spring is the most precise, 1.2 mm against 13 to 15, but needs its two knobs tuned, and narrowly.
- Half and half sinks more but has nothing to tune, and stays still with no damping.
- Changing velocities needs more passes than we want to spend.

## Open questions

- Damping for half and half: on by default or not? The user decides.
- Heavy bodies on light ones, friction, different sizes: which of the two finalists holds?
- A pass is not the same work in every way: a spring substep also moves every particle. To measure on the GPU.

## Sources

- Our script, [collision-response.mjs](../topics/collision-response.mjs), part `ranking`: every number of this chapter, and the ten places below these.

## Next step

The two finalists, the spring and half and half, with heavy and light bodies. Then we decide, and write the code.
