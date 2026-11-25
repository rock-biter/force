# 065 · Two Kinds of Brake

*November 25, 2026 · 3 min read*

**In short:** what stops a spring's bounce does not stop a rope's swing. Two brakes, then: a damping inside each spring, given as a damping ratio, and a drag on every particle, like air. The first matches the formula within what the solver dissipates by itself; the second brings the ropes to rest.

## The story

**The need.** Since [chapter 064](./064-as-soft-as-asked.md) a spring is as soft as asked, and gives back the swing it used to swallow. The ropes of the live page leaned from one side to the other for ever.

**One name, two things.** *Damping* brakes the change of a spring's *length*: a weight bobbing up and down on an elastic. It is the damping ratio ζ of [the page on springs](../topics/spring.md): 0 never stops, 1 comes to rest without going past it. But a rope that swings like a pendulum does not change length at all, so no damping of its springs can stop it. That takes a brake on the speed of every particle, whatever it does: *drag*, as air gives. FleX has both, under those names; Jolt gives a soft body one number for the second.

**Damping in the spring.** XPBD has a term for it (equation 26 of the paper): besides its error, a spring also resists how much its length has changed since the substep began. We give it a damping ratio and work out the rest from the spring's stiffness and the two masses: a damper of 2 ζ √(k m).

**The script.** [spring-damping.mjs](../topics/spring-damping.mjs): one weight on one spring, pulled 2 cm and let go. The next swing, as a share of the one before:

| | ζ = 0 | ζ = 0.1 | ζ = 0.3 | ζ = 1 |
| --- | --- | --- | --- | --- |
| An exact spring | 1.00 | 0.53 | 0.14 | no swing |
| 1.6 swings a second, 2 substeps | 0.77 | 0.41 | 0.11 | no swing |
| The same, 8 substeps | 0.94 | 0.50 | 0.13 | no swing |
| 5 swings a second, 2 substeps | 0.44 | 0.24 | 0.06 | no swing |
| The same, 8 substeps | 0.81 | 0.43 | 0.11 | no swing |

The passes over the springs change nothing, 3 or 10. With ζ = 1 it never goes past rest, in every line.

**The solver brakes by itself.** Look at ζ = 0: a spring that should swing for ever loses a quarter of its swing each time at 1.6 swings a second, and more than half at 5. It is the price of a method that cannot blow up ([chapter 057](./057-three-ways-around.md)), and it grows with how much of a swing fits in a substep. What we ask for is added to it: the damping we get is never less than asked, and for a stiff spring it is more.

**A second way gave the same numbers.** Taking the speed away after the positions are settled, along the spring: the same table to two decimals. It would need one more pass over the springs. The term inside the spring needs none.

**Drag.** One line where a substep ends: the speed is divided by 1 + drag × the substep. With a drag of 1 per second, a particle left alone keeps about a third of its speed after a second. On the ropes page with 0.5: after 30 seconds the ropes hang straight. With 0, they still lean.

### What surprised us

**A rod has no damping.** XPBD scales its damping by the compliance, and a rod has none: nothing of its length swings. So on a page of rods the damping slider does nothing, and only the drag brakes.

## What we take away

- Ask what moves before choosing the brake: the length of a spring, or the particles themselves.
- A damping ratio reads the same on any spring: the engine works out the damper from stiffness and mass.
- The solver's own brake is there whether asked or not. More substeps, less of it.

## Open questions

- The spring's damping was checked in the script, not measured on the GPU: there it is the same formula, seen only not to break anything.
- Drag as air really is, growing with the square of the speed, and wind.
- Should a soft spring that is too damped by the solver get more substeps by itself?

## Sources

- Macklin and others, [XPBD](https://doi.org/10.1145/2994258.2994272), section 5, equation 26. FleX, [NvFlex.h](https://github.com/NVIDIAGameWorks/FleX/blob/master/include/NvFlex.h): `damping`, "viscous drag force", and `drag`.
- The page's code: [springs.wgsl](../../examples/ropes/springs.wgsl) and [finish-limit.wgsl](../../examples/heap-simulation/finish-limit.wgsl).

## Next step

The user's choice: what resists a cloth's folding, groups for any net, or the tall cloth that stretches.
