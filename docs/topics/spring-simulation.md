# Simulating springs

*Theory · 5 min read · Updated November 25, 2026 · [Topic map](./README.md)*

**In short:** a stiff spring blows up when its force is applied one step of time at a time. There are three ways around it: work out the force as it will be, move the two ends instead of pushing them, or move them only part of the way. The third cannot blow up, like the second, and still has a stiffness you choose, like a real spring.

## The idea

What a spring is, its stiffness `k` and its pace ω = √(k / m), is in [Springs](./spring.md). Here: how to step one through time.

A computer does not follow a spring smoothly. It looks where the two ends are, works out the force, and applies it for a whole step of time as if nothing changed meanwhile. If the spring would have done half a swing in that time, the push comes too strong and too late: the spring ends further out on the other side, and further still at the next step. It blows up.

One test for everything on this page: a chain of 10 weights of 1 kg hangs from a fixed point, each on a spring 10 cm long, and is let go. Time advances in steps of 1/120 s, as on our pages, where each 1/60 s is cut into 2 *substeps*. The top spring carries ten weights and the bottom one a single weight, so with `k` = 10 000 N/m the chain should end up hanging 5.40 cm longer than at rest.

## How it works

### Forces, as they are now

The plain way, the *semi-implicit Euler* of [Numerical integration](./integration.md): force from the positions of now, then speed, then position.

| `k` | Should hang longer by | Does |
| --- | --- | --- |
| 1 000 N/m | 53.96 cm | 52.03 cm on average, still swinging by 110 cm |
| 10 000 N/m | 5.40 cm | 5.43 cm, still swinging by 11 cm |
| 14 000 N/m | 3.85 cm | 3.84 cm, still swinging by 7.7 cm |
| 15 000 N/m | 3.60 cm | blows up |

Right, as long as it holds. The **stability limit** is `step × ω < 2`. For one weight of 1 kg on one spring, ω = √(k / m) and the limit is `k` below 57 600 N/m. A chain is harsher: its links can also shake against each other, about twice as fast as one spring alone, so its limit is four times lower, 14 400 N/m, and the table finds it there. A lighter weight raises ω and lowers the limit: with 1/64 of a kilogram, 64 times lower. And nothing brakes the swing unless you add a damper.

### Way 1: forces, as they will be

Use the force the spring will have at the end of the step, not the one it has now: **implicit integration**. Like braking for where the car will be, not where it is.

| `k` | Should hang longer by | Does |
| --- | --- | --- |
| 10 000 N/m | 5.40 cm | 5.39 cm, swing gone |
| 100 000 N/m | 0.54 cm | 0.54 cm, swing gone |
| 10 000 000 N/m | 0.005 cm | under 0.01 cm, swing gone |

It never blows up. Two prices. It brakes by itself: the swing dies with no damper asked for. And "where it will be" depends on the springs next to it, which depend on theirs: all the speeds must be found together, as ten equations with ten unknowns here, a million for a cloth.

### Way 2: move the ends

Forget the force. Let the weights move, then look at each spring: if it is 12 cm long and should be 10, take its two ends and bring them 2 cm closer in all, the lighter end moving more. Each weight's new speed is how far it really went in this step, divided by the length of the step. This is a **distance constraint**, and the method is **position based dynamics** (PBD), the family our contacts belong to. A contact only pushes, when two particles are too close: its rule is "at least this far apart", an *inequality*. A distance constraint pushes and pulls: its rule is "exactly this far apart", an *equality*.

Moving one spring's ends disturbs the springs next to it, so the springs are gone over several times in each step: these passes are the **rounds**.

There is no `k`: it is a rod, which should not stretch at all.

| Rounds over the springs, each step | The rod stretches by |
| --- | --- |
| 1 | 3.07 cm |
| 3 | 1.00 cm |
| 10 | 0.28 cm |
| 100 | 0.01 cm |

It never blows up, and each spring is fixed on its own. But how stiff the rod is depends on the rounds, and on the step: with 10 rounds, 1.10 cm at 1/60 s and 0.07 cm at 1/240 s. Change either, and every rope in the scene changes with it.

### Way 3: move the ends part of the way

Do not take back the whole error: a **soft constraint**. How much is decided by the **compliance**, 1 / `k`, the inverse of the stiffness: 0 is the rod. Each spring also keeps a running total of the moves it has asked for in this step. Without it, every round would take back a share of what is left, and enough rounds would make any spring a rod again. This is **XPBD**, extended position based dynamics.

| Rounds, compliance 1 / 10 000 | Should hang longer by | Does |
| --- | --- | --- |
| 1 | 5.40 cm | 8.47 cm |
| 3 | 5.40 cm | 5.66 cm |
| 10 | 5.40 cm | 5.40 cm |
| 100 | 5.40 cm | 5.39 cm |

With enough rounds to get there, more rounds change almost nothing. And the step hardly matters: 5.53 cm at 1/60 s, 5.39 cm at 1/240 s. With too few rounds it is softer than asked, never unstable.

## Choices and trade-offs

| | Blows up | Stiffness is | Each spring on its own |
| --- | --- | --- | --- |
| Forces, as they are now | above the limit | `k` | yes |
| Forces, as they will be | never | `k`, with a brake you did not ask for | no |
| Move the ends (PBD) | never | whatever the rounds give | yes |
| Part of the way (XPBD) | never | `k`, as 1 / compliance | yes |

The physics engine Box2D uses a cousin of the last one, which it calls soft step, set in hertz and damping ratio ([our page on it](./soft-step.md)).

## On the GPU

"Each spring on its own" is what a GPU wants: one thread per spring, or per particle. The catch, for the fourth stop of this study: a particle with several springs gets several moves at once, and they must be combined, as our rounds already do for contacts.

## In FORCE

Our rounds already move positions. A spring would be one more thing a round reads. Not written yet.

## Check yourself

1. A spring holds at `k` = 10 000 N/m with a weight of 1 kg. You make the weight 100 times lighter. What happens with plain forces, and why?
2. Why can a thread not work out an implicit force for its own spring alone?
3. A rope made of distance constraints sags more after you halve the rounds. What would XPBD change, and what would it not?

## Sources

- Our own script, [spring-simulation.mjs](./spring-simulation.mjs), for every number here.
- Macklin, Müller and Chentanez, [XPBD](https://doi.org/10.1145/2994258.2994272), 2016: the abstract, for what goes wrong in PBD, sections 3 and 4 for the compliance as "inverse stiffness", its division by the square of the step, and the rule each spring follows (equation 18, Algorithm 1). Not read in full.
