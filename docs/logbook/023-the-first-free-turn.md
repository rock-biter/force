# 023 · The First Free Turn

*November 18, 2026 · 4 min read*

**In short:** on a GPU, rules that touch the same body must take turns, and the turns are sorted on the CPU. We timed that sorting in JavaScript: on our Mac, 100 000 rules take 1.3 thousandths of a second from scratch, and 0.05 when only one in twenty has changed. The last unknown price of turns is small too.

## The story

A *contact* is a rule between two boxes that touch. On a GPU, two contacts that share a box must not run at the same instant: both would write its velocity, and one result would be lost. One way out is *turns*: contacts that share no box run together in one launch of a program on the GPU, and the others wait for the next launch. But the turns must be decided at every *step*, each advance of time, since the boxes that touch keep changing, and they are decided on the CPU ([chapter 017](./017-taking-turns.md)). That has three prices: the launches, a trip of data from the GPU to JavaScript and back, and the sorting. The first two are cheap ([chapter 022](./022-the-bell-that-rang-early.md)). The sorting was left.

**How Box2D sorts.** Claude, the AI assistant we study with, read it in the code of Box2D, the engine by Erin Catto. Each contact takes the first turn where neither of its boxes is busy, and marks them busy in it. Box2D calls a turn a *color*. Take four boxes in a row, `[A][B][C][D]`, with contacts that arrive as B–C, A–B, C–D. B–C takes turn 1. A–B finds B busy in turn 1, and takes turn 2. C–D finds C busy in turn 1, and in turn 2 both C and D are free. So turn 1 is B–C alone, and turn 2 is A–B with C–D. Three more things from the code. A box that never moves, like the ground, is never marked: nothing writes it. There are 24 colors, and a contact that fits none is set apart and handled one at a time. And the work is not redone at each step: a contact gets its color when the boxes start touching, and gives it back when they stop.

**Our page.** [turn-sorting](../../examples/turn-sorting/main.ts) uses the same rule. Each box keeps one number of 32 bits, a bit for each turn it is busy in: 31 turns, and one bit for "left out". The scene is a block of boxes, each touching up to six others, and the bottom ones touching the ground too. The contacts are mixed, since the GPU finds them in no order. Times are in *milliseconds*, thousandths of a second. A frame at 60 per second lasts 16.7.

| Contacts | Turns | All, from scratch | The 5% that changed | Grouping by turn |
| --- | --- | --- | --- | --- |
| 931 | 8 | 0.004 | less than 0.001 | 0.002 |
| 9 675 | 9 | 0.13 | 0.004 | 0.02 |
| 96 256 | 10 | 1.3 | 0.05 | 0.22 |
| 976 005 | 10 | 11.2 to 11.5 | 0.65 | 2.2 |

In the third column one contact in twenty ends and begins again, and the others keep their turn. "Grouping" writes the list the GPU needs: the contacts turn by turn, and where each turn starts. It is paid in both cases.

**Reading it.** A hundred thousand contacts cost 1.5 from scratch with the grouping, a tenth of a frame. Keeping the turns from the step before and touching only what changed, they cost 0.27. A million from scratch is 13.5 with the grouping: too much. With the turns kept, 2.9.

**A tray.** One wide box that moves, with small boxes on it. Every contact writes the wide box, so each needs a turn of its own. With 8 small boxes, 8 turns. With 31, 31. With 100, the turns are still 31 and 69 contacts are left out. This is the limit we met in chapter 017: PhysX, the engine by NVIDIA, stops at 8 turns by default, Box2D at 24.

### What surprised us

**More turns than needed.** Six turns are enough for the block. The contacts along x go in two turns, the ones that start from an even box and the ones that start from an odd box, and the same along y and z. A bottom box puts its contact with the ground in the one y turn where it is free. Taking the first free turn used 8 to 10: the order in which contacts arrive counts.

**One number per box.** A comment in Box2D says a colleague suggested what our page does: a number per box, with a bit per color. Catto kept a row of bits per color instead, a bit per box: easier to debug, and free to have more colors than a number has bits.

**The sum.** For 100 000 contacts on our Mac: the trip back, about 0.4. The sorting and the grouping, 0.3 to 1.5. Sending the list to the GPU, with the step now cut into two batches of commands, about 0.5 in [chapter 021](./021-a-short-trip.md). The launches are millionths of a second. Between 1.2 and 2.4 milliseconds per step. This is Claude's sum of separate measures, not one measure.

## What we take away

- Sorting is cheap up to 100 000 contacts: 1.3 from scratch, 0.05 with the turns kept, plus 0.22 to group in both cases.
- Keep the turns from one step to the next, as Box2D does: give a turn to what began, take it back from what ended.
- The first free turn is simple and not the best: 8 to 10 turns where 6 would do.
- A box in more contacts than there are turns leaves contacts out. They need another way.
- On our Mac the three prices of turns are all small: the launch, the trip, the sorting.

## Open questions

- A phone's CPU: the page is there to try.
- To touch only what changed, the CPU must know which contacts began and which ended. How will the GPU tell?
- The contacts left out: *copies* only for them, as PhysX does? With copies each contact writes its own copy of a box, and the copies are averaged ([chapter 018](./018-half-a-box.md)).
- We timed the sorting alone. The whole step, with the trip and the list sent back: to measure on a real scene.

## Sources

- Our page, [examples/turn-sorting](../../examples/turn-sorting/main.ts): the numbers of this chapter, from an Apple M1 with Chrome 157 run headless, that is with no window.
- Box2D at commit [8b3286b](https://github.com/erincatto/box2d/tree/8b3286b26a40766f278ddf9abe2198159ad553a4), read in parts: [constraint_graph.c](https://github.com/erincatto/box2d/blob/8b3286b26a40766f278ddf9abe2198159ad553a4/src/constraint_graph.c) and [constraint_graph.h](https://github.com/erincatto/box2d/blob/8b3286b26a40766f278ddf9abe2198159ad553a4/src/constraint_graph.h) for the colors, and [constants.h](https://github.com/erincatto/box2d/blob/8b3286b26a40766f278ddf9abe2198159ad553a4/include/box2d/constants.h) for their number.

## Next step

Not the decision between turns and copies, the other way out: the user said it is too early. We have not chosen how bodies are made, as shapes or all as particles, and we have never studied how they find each other. So we start from the particles: how each one finds the ones it touches on a GPU, with a grid. Meshes, and trees of boxes such as the *bounding volume hierarchy*, come after.
