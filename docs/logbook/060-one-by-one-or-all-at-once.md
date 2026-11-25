# 060 · One by One, or All at Once

*November 25, 2026 · 3 min read*

**In short:** before choosing where springs live in memory, a script in 3D on how several springs on one particle should be combined. Our rule for contacts blows up on a cloth. The safe rule is soft: it needs five times the rounds. Solving the springs one after the other is far tighter, and so is cutting a step into more substeps.

## The story

**Two choices that hang together.** Where the springs live, and how a particle with several springs adds up what they ask. "Here we need tests and measurements," the user said. The second first: it decides which shapes in memory are worth timing.

**The ways.** *One by one:* each spring moves its two ends at once, and the next spring sees them moved. The classic way (Gauss-Seidel); on a GPU the springs must be split into groups that share no particle, so that a group can run in parallel. *All at once:* every spring reads the same positions, and each particle then adds up what its springs ask (Jacobi), as our rounds do for contacts. Any thread does its own particle. Then how to add up: the *average*; *half and half*, our rule for contacts ([decision 015](../decisions/015-half-and-half-on-positions.md)); or the whole *sum*.

**The scenes.** [spring-rounds.mjs](../topics/spring-rounds.mjs), with the solver of the live pages, 2 substeps of 3 rounds: a chain of 30 weights hanging; a cloth of 20 × 20 held by one side, with 4 links per weight, or 8 with diagonals; the same cloth falling on a ball. Rods, which should not stretch at all. Mean stretch of the links over the last 3 seconds, and the worst:

| | Chain | Cloth, 4 links | Cloth, 8 links |
| --- | --- | --- | --- |
| One by one | 1.6%, worst 3.3% | 0.5%, worst 2.0% | 0.1%, worst 2.7% |
| All at once, average | 6.8%, worst 17% | 4.1%, worst 21%, never rests | 3.1%, worst 25%, never rests |
| All at once, half and half | 4.5%, worst 11% | 1.7%, worst 6.8% | blows up |
| All at once, sum | swings wildly | swings wildly | blows up |

**Half and half is not for springs.** It is the best of the three with 4 links and blows up with 8. A contact pushes one way; the springs around a particle pull against each other, and half of their sum is too much when they are many.

**The same rounds, cut differently.** 6 rounds in a step, as 2 substeps of 3 or as 6 substeps of 1, and more rounds, on the chain and on the cloth with 8 links:

| | Chain | Cloth, 8 links |
| --- | --- | --- |
| One by one, 2 × 3 | 1.6% | 0.13% |
| One by one, 6 × 1 | 0.55% | 0.04% |
| Average, 2 × 3 | 6.8% | 3.1%, never rests |
| Average, 6 × 1 | 2.1% | 1.1%, never rests |
| Average, 2 × 10 | 2.0% | 0.94% |
| Average, 2 × 30 | 0.65% | 0.31% |

Three times tighter for the same rounds, both ways. And the average needs about 30 rounds to do what one by one does with 6.

**Contacts apart.** With the ball, contacts in the same sum as the springs leave a weight 0.7 cm inside it. In a pass of their own after the springs: 0.04 cm.

### What surprised us

**Corrected in [chapter 064](./064-as-soft-as-asked.md): a wrong sum.** This paragraph said that a chain with compliance 1 / 10 000 should stretch 0.76%, found 8% one by one, and concluded that a soft spring comes out ten times softer than asked and that its running total does not help. The sum was wrong by a factor of ten: 15.5 weights × 9.81 / 10 000 / 0.2 m is 7.6%, not 0.76%. One by one, with its running total, the chain stretched 8.1% where 7.6% was asked: right, within a few rounds. The average gave 15%: twice too soft.

## What we take away

- What one end of a chain does reaches the other one link per round. A long chain needs many rounds, or many substeps.
- A rule that is safe for contacts is not safe for springs.
- Springs want a pass of their own, before the contacts: the buffers said so already ([decision 036](../decisions/036-names-and-a-register.md)), and now the numbers do.

## Open questions

- What one by one costs on a GPU: several small dispatches per round, one per group. To time.
- More substeps for everything, or for the springs only?

## Sources

- Our own script. The two ways are in Macklin and others, [XPBD](https://doi.org/10.1145/2994258.2994272), Algorithm 1, and Jolt's soft body reorders its constraints "so they can be executed in parallel" ([SoftBodySharedSettings.h](https://github.com/jrouwe/JoltPhysics/blob/master/Jolt/Physics/SoftBody/SoftBodySharedSettings.h)).

## Next step

Time the two ways on the GPU.
