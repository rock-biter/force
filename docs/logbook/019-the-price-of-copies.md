# 019 · The Price of Copies

*November 18, 2026 · 4 min read*

**In short:** turns and copies, the two ways to run a solver on a GPU, side by side on a hanging chain. Turns do almost as well as a CPU. Copies need four times the rounds, and when the rules are springs the chain hangs twice as far below its length.

## The story

A *solver* repairs rules such as "this link must stay 10 cm long", by giving a *push* to the two bodies of each rule. A *round* is one pass over all the rules. On a GPU thousands of rules run at once, and two of them must not write the same body at the same instant. Chapters [017](./017-taking-turns.md) and [018](./018-half-a-box.md) found two ways out. With *turns*, the rules that share no body run together in one launch on the GPU, a *dispatch*, and the others wait for the next launch. With *copies*, all the rules run in one launch, each on its own copy of a body with a share of its mass, and a second launch averages the copies.

We tried both on the chain of [chapter 015](./015-the-stiff-spring.md): 10 links of 10 cm hanging from a fixed point, particles of 1 kg, a weight at the end. It is a script on the CPU: only the order in which the links read and write changes. In a row, as a CPU does. In two turns, the even links and then the odd ones. With copies. We measured how much too long the chain is, with 1 kg at the end unless we say otherwise.

**Four times the rounds.** First the simplest solver, the one Erin Catto described in 2005 ([chapter 014](./014-the-mirror.md)). Time advances in *steps* of 1/60 of a second. In each step every round removes 20% of a link's error, and no push is kept for the next step.

| Rounds per step | 8 | 16 | 32 | 64 | 128 |
| --- | --- | --- | --- | --- | --- |
| In a row | 7.1 cm | 3.2 cm | 1.3 cm | 0.4 cm | 0.1 cm |
| Two turns | 7.7 cm | 3.5 cm | 1.4 cm | 0.4 cm | 0.1 cm |
| Copies | 33.1 cm | 16.2 cm | 7.8 cm | 3.5 cm | 1.4 cm |

Turns stay close to the row, and match it from 64 rounds on. Copies with 32 rounds do what turns do with 8, and with 64 what turns do with 16: the user read it off the table. With 100 kg it is the same: 148.5 cm for 8 rounds of turns, 148.6 cm for 32 of copies. In chapter 018 a push crossed a row of boxes one box per round with copies, faster with turns. Here it is measured.

**Counting launches.** A round of turns costs one launch per turn: 2 on the chain. A round of copies always costs 2. But copies need 4 times the rounds, so they pay 8 launches for the work of one round of turns. With fewer than 8 turns, turns win. With 8 it is a tie. A chain is the best case for turns: no particle is in more than two links. A wide box with thirty small ones on top needs thirty turns. PhysX, the engine by NVIDIA, stops at 8 turns by default ([chapter 017](./017-taking-turns.md)). It may be chance: our 4 comes from one chain.

**Twice the sag.** Then *Soft Step*, the solver of Catto's engine Box2D. It cuts the step into 4 slices, or *substeps*, and in each it runs one round where a rule acts as a stiff spring and one *relax* round, which takes back the speed the spring added. In a row or in turns, the chain comes to rest 0.7 cm too long with 1 kg, 1.8 cm with 10 kg and 13.0 cm with 100 kg. With copies, and 5 substeps, it is exactly double: 1.4, 3.6 and 26.0 cm. Eight rounds per substep give the same. Box2D sets a spring by how many times per second it would swing: 60 for a link. To swing 60 times a second with half a particle, a spring half as stiff is enough. With copies each link counts half of each particle, so it picks the spring for half a particle. But the weight hanging below is the real one. The formula of a spring with the mass shared gives the same three numbers.

**Not standing still.** Why 5 substeps? With the 4 of Soft Step's defaults the copies never rest: −0.7 cm after 2 seconds, 18.8 cm after 10, almost a kilometer after 40. One more substep, or one more round, and the chain stays still. We do not know why the limit falls there. Then we dropped the share of mass: each link counts whole particles, and all the pushes are added. The chain blows up in half a second. A particle in the middle gets two full corrections, each computed as if the other were not there: too much, the user said.

### What surprised us

**Too many words.** Turns, groups, rounds, launches, copies: halfway through the user got lost. There are two methods. A group is who works in the same turn, so the groups, the turns and the launches of a round are one number. Copies have no turns and no groups. One small table per method, on the row of four boxes of chapter 018, put it right.

**The spring with copies is our own mix.** The abstract of the paper *Mass Splitting* says the mass is divided inside the rule and the push applied in full. Claude, the AI assistant we study with, did the same inside Box2D's spring formula. We have not read how the paper or PhysX treat a rule that is a spring, so the double sag may be of our making.

## What we take away

- Turns cost almost nothing in quality: sorting the links into groups gives the result of the row.
- On our chain copies need 4 times the rounds: 8 launches, where turns pay one launch per turn. Copies pay off above 8 turns.
- With springs, sharing the mass softens the rule: twice the sag, and no rest with Soft Step's defaults.
- The share of mass is not a detail: without it the copies blow up.

## Open questions

- Does the factor 4 belong to chains, or to copies in general? A pile of boxes, where turns are many, is the scene to measure.
- Can a rule that is a spring keep its stiffness with copies?
- Why are 4 substeps not enough for the copies, and 5 are?
- Our count leaves out what turns need at every step: a trip to the CPU to sort the rules ([chapter 017](./017-taking-turns.md)). In WebGPU we expect it to be slow or late: not measured.

## Sources

- Our script, [mass-splitting.mjs](../topics/mass-splitting.mjs): every number of this chapter. Run it with `node`.
- The chain and the numbers of Soft Step come from our [theory page](../topics/soft-step.md).
- [Mass Splitting for Jitter-Free Parallel Rigid Body Simulation](https://doi.org/10.1145/2185520.2185601), 2012: only its abstract ([chapter 018](./018-half-a-box.md)).

## Next step

Measure in WebGPU what the two prices are made of: how much a dispatch costs, and how late a trip to the CPU comes back.
