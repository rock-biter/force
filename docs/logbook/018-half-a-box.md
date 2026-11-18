# 018 · Half a Box

*November 18, 2026 · 4 min read*

**In short:** on a GPU, each rule can write on its own copy of a body, and the copies are averaged afterwards. We went through it with four boxes in a row, one idea at a time: each copy must take a share of the body's mass, or part of the push is lost.

## The story

A physics engine keeps *rules*, such as "two boxes must not overlap". A *contact* is one such rule, between two boxes that touch: it reads their velocities, corrects them and writes them back. On a GPU thousands of rules run at once, and two of them must not write the same box at the same instant. [Chapter 017](./017-taking-turns.md) found two ways out in PhysX, the engine by NVIDIA. Rules that share a box take turns, and when the turns would be too many each rule works on its own copy of the box. The copies had stayed vague. So Claude, the AI assistant we study with, started again in chat: one idea per message, each with a question.

The scene: four boxes of 1 kg in a row, `[A][B][C][D]`, with three contacts: A–B, B–C, C–D. A arrives at 2 m/s, the others stand still. Mass times velocity is the *momentum* of a body: "the push", in our chat. Here the total push is 2, all of it in A. A contact with no bounce brings its two boxes to the same speed and loses no push: that speed is the total push divided by the total mass.

**One sheet each.** B is in two contacts, so it gets two copies of its velocity, one per contact. All three contacts run in the same launch on the GPU, a *dispatch*, and each writes only its own copy. A–B writes "B goes at 1 m/s": a push of 2 over 2 kg. B–C writes "B stays at 0": for it nothing happened. A second launch takes the average: 0.5 m/s. In GLSL terms, two passes want the same pixel, so each gets its own render target and a third pass does `mix(a, b, 0.5)`. The first question was about a box in three contacts. Three copies, the user said.

**Nobody is happy.** After the average A goes at 1 and B at 0.5, so A is still pushing into B. Two people pull a blanket and it stays in the middle. The contacts must go round again. A *round* is one pass over all the rules, and at each round A enters B a little slower, without stopping at once.

**One box per round.** Within a round no contact sees what the others write. B feels the push in round 1, C in round 2, D in round 3. With turns, the contacts are sorted into groups where no box appears twice, and the groups are launched one after the other: A–B and C–D, then B–C. So B–C reads what A–B has just written: C moves in round 1 already, and D in round 2. The user worked out both.

**Half a box.** The plain average loses push. After it the total is 1 + 0.5 = 1.5, not 2: A lost 1, one copy of B gained 1, and the average halved that gain. The remedy is in the name of the method, *mass splitting*, from a [paper of 2012](https://doi.org/10.1145/2185520.2185601): each copy takes a share of the mass too. The contact A–B now meets a B of half a kilo, easier to push, and both leave at 2 / 1.5 = 1.33 m/s. The other copy stays at 0. The average is 0.67, and with boxes of 1 kg the push is 1.33 + 0.67 = 2. Nothing is lost.

### What surprised us

**A number with no origin.** In chat, "A and B go at 1" was stated with no rule behind it. So when 1.33 appeared, the user read it as A speeding up after the hit, from 1 to 1.33. The rule came only then, with shopping carts. One of 1 kg at 2 m/s hits a still one and they stick: 2 / 2 = 1 if the other weighs the same, 2 / 1.5 = 1.33 if it weighs half. A always starts at 2 and always brakes, less in the second case.

**Too much in one message.** The first try put the copies, the average, the rounds and the turns around one table. "Not entirely clear." Cut into four messages, each one landed.

**The paper says it another way.** Its abstract has no copies: a rule counts each body's mass divided by the number of its contacts, and its push is then applied to the whole body. On our numbers the two agree. A–B, meeting half a kilo, hands over 0.5 × 1.33 = 0.67 of push, and that makes the whole B, 1 kg, go at 0.67 m/s. Claude worked this out after the chat: the user has not been through it yet.

## What we take away

- With copies every contact runs in one launch and one more launch averages. Nobody has to sort the rules into turns, which PhysX does on the CPU at every step.
- The price is paid in rounds. News travels one box per round: D moves in round 3, and in round 2 with turns.
- Each copy takes a share of the mass, or the average loses push: 1.5 instead of 2 in our row.
- Give every number its rule. A result with no origin is read wrong later.

## Open questions

- A stack of ten boxes: how many rounds until the weight of the top one reaches the ground, with copies and with turns? To measure, not to guess.
- If the push can be applied to the whole body, do we need copies in memory at all, or only a sum? [Chapter 017](./017-taking-turns.md) asked whether WGSL's *atomics*, operations that let many threads add to the same place, could do that sum.
- We read only the abstract of the paper, and still not the part of PhysX's code that shares the mass.

## Sources

- Richard Tonge, Feodor Benevolenski, Andrey Voroshilov, [Mass Splitting for Jitter-Free Parallel Rigid Body Simulation](https://doi.org/10.1145/2185520.2185601), 2012: only its abstract, as shown in the [SIGGRAPH history archive](https://history.siggraph.org/?p=110584).
- The numbers are ours: boxes of 1 kg and a contact with no bounce.

## Next step

Try turns and copies side by side on the hanging chain of [chapter 015](./015-the-stiff-spring.md).
