# 064 · As Soft as Asked

*November 25, 2026 · 3 min read*

**In short:** a spring that should give a little must give that much, whatever the passes and the substeps. Ours did not: it got stiffer with every pass. A running total for each spring fixes it. And the script that showed this also found a wrong sum of ours, four chapters old.

## The story

**Two knobs, both half done.** How much a spring gives is its *compliance*, the inverse of its stiffness: metres per newton. How fast its swing dies is its *damping*. The ropes of [chapter 062](./062-the-first-ropes.md) had a slider for the first, used the short way, and nothing for the second. This chapter is the first.

**The short way.** At every pass a spring asked for its error divided by a little more than the masses allow: `error / (w + w + compliance / substep²)`. So each pass took back a share of what was left. And the next pass, a share of the rest.

**The script.** [spring-softness.mjs](../topics/spring-softness.mjs): one weight of 1 kg on one spring with a compliance of 1 mm per newton. Under 9.81 newtons it should be 9.81 mm longer, 4.91% of its 20 cm.

| | The short way | With a running total |
| --- | --- | --- |
| 2 substeps × 3 passes | 1.53% | 4.91% |
| 2 substeps × 10 passes | 0.36% | 4.91% |
| 2 substeps × 30 passes | 0.05% | 4.91% |
| 8 substeps × 3 passes | 1.63% | 4.91% |

Thirty passes make the soft spring a rod. It is the fault XPBD was written to remove ([chapter 057](./057-three-ways-around.md)), and we had put it back by leaving out half of its rule.

**The other half.** Each spring keeps a *running total* of what it has asked for in this substep, λ in the paper, and asks for `(error − compliance / substep² × total) / (w + w + compliance / substep²)`. When the total has grown to what the spring should hold, it asks for nothing more. A chain of 30 with 0.1 mm per newton should stretch 7.6%: with the total, 8.1% with 3 passes and 7.2% with 30.

**A wrong sum.** That same chain is in [chapter 060](./060-one-by-one-or-all-at-once.md), where Claude wrote that it should stretch 0.76%, found 8%, and concluded that a soft spring is ten times softer than asked and that the running total does not help. The sum was wrong by ten: 15.5 weights × 9.81 newtons × 0.0001 / 0.2 m is 7.6%. The measure was right and the conclusion was not, and it was repeated in a decision and in chapter 062. All three now say so. It was this script that caught it: it also hangs one weight on one spring, where the sum can be done in the head.

**On the GPU.** One number more per spring, in a buffer of its own, and a flag that says "first pass of the substep: start from zero". The ropes page, 29 weights hanging, should stretch 7.4% with 0.1 mm per newton:

| | Before | Now |
| --- | --- | --- |
| 3 passes | 4.5% | 8.3% |
| 10 passes | | 7.5% |
| 3 passes, 4 substeps | | 7.0% |
| 0.5 mm per newton, should be 36.8% | | 36.5% |

### What surprised us

**A right number can pass for a wrong one.** 8% against an expected 0.76% looked like a finding, and it had an explanation ready: too few rounds. Nobody checked the 0.76.

**With the total, the rope swings on.** The short way braked the swing, as a stiff rod does. A spring that gives what it should also gives the swing back: after 10 seconds the script's chain of 30 still swings by 45 cm. Damping is no longer a detail.

## What we take away

- Half of a rule is another rule. The running total is what makes the compliance mean something.
- Check the simplest case by hand before trusting the hard one: one weight, one spring.
- A wrong number we wrote is told where it was written, not quietly fixed.

## Open questions

- Damping: the next chapter.
- The cloth with a compliance was not measured.

## Sources

- Our own script, and Macklin and others, [XPBD](https://doi.org/10.1145/2994258.2994272), equation 18 and Algorithm 1, lines 4, 7 and 9: the total, set to zero and added to.
- The page's code: [springs.wgsl](../../examples/ropes/springs.wgsl), `totals` and `fresh`.

## Next step

Damping: how to make a swing die as fast as asked.
