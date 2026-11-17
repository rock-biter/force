# Soft Step

*Theory · 5 min read · Updated November 17, 2026 · [Topic map](./README.md)*

**In short:** the solver of Box2D since version 3, by Erin Catto, the author of the [paper of 2005](./iterative-dynamics-paper.md). Instead of one step with many rounds over the rules, it takes a few small steps with one round each, and treats every rule as a very stiff spring.

## The idea

A *solver* is the part of an engine that repairs broken rules, such as "do not pass through the floor". It does not look for collisions: *collision detection* finds who touches, and the solver repairs. For each rule it finds a push, a force times the time it acts, called an *impulse*. The solver of 2005 moves time forward by 1/60 s, then goes round the rules several times, ten in its tests. Soft Step cuts the same 1/60 s into 4 *substeps* of 1/240 s and goes round once in each. It is like drawing a circle with four times as many segments: each short one strays far less from the curve. And it is like running the simulation at 240 frames per second while looking for collisions at 60 only.

The second idea is in the name. Stopping a body does not put it back: a ball at rest, sunk 1 cm into the floor, breaks no rule about its speed and would stay there. So in 2005 a broken rule got a nudge: remove 5% of the error per step, a number found by trial. In three.js terms that is `position.lerp(target, 0.05)` on every frame, which moves faster at 144 frames per second than at 60, because the 5% is per frame. `MathUtils.damp(x, y, lambda, dt)` exists for that reason: it thinks in seconds. Soft Step does the same to the nudge. Here a rule behaves like a spring with a brake, tuned with two knobs that mean something: how many times per second it would swing (*hertz*), and how fast the swing dies (*damping ratio*: 0 swings forever, 1 comes back without overshooting, more than 1 comes back more slowly). This is a *soft constraint*.

## How it works

The order of one step, as written in Box2D's `solver.c`:

| When | Stage | What it does |
| --- | --- | --- |
| Once | Prepare | Reads the contact points found by collision detection, and the pushes stored one step before |
| Each substep | Integrate velocities | Gravity and forces change the velocities |
| | Warm start | Applies the stored pushes again, as a first guess |
| | Solve | One round over the rules, with the spring that removes the error |
| | Integrate positions | Velocities move the bodies |
| | Relax | One more round with the spring switched off; friction is solved only here |
| Once | Restitution | Adds the bounce, only for hits faster than 1 m/s |
| | Store | Saves the pushes for the next step |

**Contacts are found once.** Finding contact points again in every substep would cost too much. Each point is kept as two anchors, one on each body, and a substep only measures how far they have moved along the contact direction. Catto calls this the part that "has made sub-stepping a viable approach".

**The soft push.** From hertz, damping ratio and the length of the substep come three numbers. The push of a rule is then:

```
push = -massScale × mass × (speed + biasRate × error) - impulseScale × stored
```

`speed` is how fast the rule is being broken, `error` how much it is broken already, `mass` what the rule has to move, `stored` the push given so far. `biasRate` says how much of the error to remove per second. `massScale` is a little less than 1, so the rule does not stop the bodies completely, and the last term gives back part of the push: the more a rule has pushed, the more it yields. Box2D's defaults, for a *joint* (a stick or a hinge between two bodies) and for a contact, with 4 substeps:

| Rule | Hertz, damping ratio | biasRate | massScale | impulseScale | Error removed per substep |
| --- | --- | --- | --- | --- | --- |
| Joint | 60, 2 | 67.7 per second | 0.897 | 0.103 | 25.3% |
| Contact | 30, 10 | 9.1 per second | 0.942 | 0.058 | 3.6% |

A contact is also never pushed apart faster than 3 m/s, and one against a body that cannot move gets twice that hertz.

**The relax round.** The spring adds speed to remove the error. Once the positions have moved, a second round with `biasRate` at zero takes that extra speed back, and the positions do not move again in that substep. It is like closing a drawer left 1 cm open: push it, let it move, then stop your hand. Stop the hand before the drawer moves and it stays open; never stop it and the drawer bounces back. Careful with the word: in [Jakobsen's paper](./advanced-character-physics.md) *relaxation* is going round the rules again. Here it is one round with the correction off.

## Choices and trade-offs

**With one rule, a soft rule is only a stronger nudge.** Our pendulum of 1 m, let go from horizontal, 60 steps per second: how high it still climbs after 30 s, and the worst error of the stick.

| Method | Height left | Stick error |
| --- | --- | --- |
| Nudge of 5%, 1 step ([chapter 014](../logbook/014-the-mirror.md)) | 42% | 3.6 cm |
| Nudge of 5%, 4 substeps | 93.4% | 0.32 cm |
| Nudge of 25%, 4 substeps | 99.7% | 0.07 cm |
| Soft rule, 1 step | 84.2% | 1.14 cm |
| Soft rule, 4 substeps: Soft Step | 99.7% | 0.07 cm |

A nudge of 25% per substep, what the soft joint removes in the table above, gives the same numbers as Soft Step. The gain comes from the substeps and from a stronger correction, not from the spring. The pendulum does not show why soft is better.

**With many rules, the stored nudge can blow up.** A chain of 10 links of 10 cm hangs straight down, 1 kg per particle, with a weight at the end. Every method gets 8 passes over the links per step. The nudge is 20%, the value in Catto's post.

| Method | Carrying 1 kg | Carrying 100 kg |
| --- | --- | --- |
| 2005: 1 step, 8 rounds, nudge of 20%, stored pushes | 0 cm too long after 10 s | blows up |
| The same, forgetting the pushes | 7.1 cm | 148 cm |
| Soft rule, 1 step, 4 rounds and 4 relax | 11 cm | 214 cm |
| Soft Step: 4 substeps, 1 round and 1 relax each | 0.7 cm | 12.9 cm |

The speed added by the nudge ends up in the stored pushes, and comes back at the next step. In our test that feeds itself, like a microphone in front of its own speaker, until the numbers explode, with 10 kg already. Catto writes that the nudge "can lead to energy creation and jitter if not tuned carefully". Soft Step never blew up, up to 1000 kg. In our test its last term makes the difference: with `impulseScale` forced to zero it is a stored nudge again, and blows up with 1 kg. We did not do the math of why.

**A soft rule is a spring, and it sags.** At rest, each link is too long by `force × w / ω²`: the force it carries, times `w`, the sum of the inverse masses of its two particles, divided by the square of 2π × hertz. Summed over the ten links that gives 0.7 cm and 13 cm, where the table is heading, and the length of the substep is not in the formula. The sag comes from the same last term that stops the blow-up: it gives back a share of the whole stored push, the part that carries the weight included, so the spring must stay stretched to make up for it. One link carrying 100 kg is 0.069 mm too long with that term, as the formula says, and 0 mm without. So more substeps alone do not shorten the chain: 8 substeps still leave 13 cm. Higher hertz does: 120 Hz, with 8 substeps, leaves 3.2 cm. But the hertz cannot be raised freely. Box2D caps it at a quarter of the substeps per second for joints and an eighth for contacts, and with 4 substeps the defaults sit exactly on those caps: Catto's rule is to keep the hertz well below the number of steps per second. So substeps buy stiffness only if the hertz is raised with them. With 1 step the cap is 15 Hz, and that is the 11 cm above.

**The price.** Box2D recommends 4 substeps. In Catto's count of all the loops over the rules in one step, Soft Step makes 10, against 6 for the solver of 2005 with 4 rounds. A heavy body on light ones is still the weak spot: it no longer falls apart, it sags. And the pushes must still be stored, each with a way to find its contact again at the next step.

## On the GPU

Each round still fixes one rule at a time, using what the rule before it wrote. Box2D runs it on many CPU threads by *graph coloring*: a contact takes the first color where neither of its bodies is already taken, so rules of one color touch different bodies and can be solved together. Colors go one after the other, and what fits in no color is solved on one thread. Box2D picks the colors one contact at a time, when two bodies start to touch.

On a GPU each color would be one dispatch, one run of a compute shader, and each substep has three passes per color: warm start, solve, relax. Our guess, not checked: with 8 colors, a number we made up, 4 substeps make about a hundred dispatches per step. Catto's post lists "GPU friendly solvers. Jacobi, mass-splitting", two ways to solve all the rules at once, among the things still to try: he does not count this one as GPU friendly.

## In FORCE

Not yet: FORCE has no solver, only a ground ([decision 013](../decisions/013-a-flat-ground.md)).

- **Our substep repeats everything,** the ground check included ([decision 011](../decisions/011-substeps-per-world.md)). For a plane that is one line. Between particles, finding the contacts once per step, as Box2D does, will matter.
- **Friction.** Box2D limits the push that resists sliding to the friction coefficient times the push that keeps the two bodies apart. Our ground uses the same rule. One difference: Box2D solves friction before it adds the bounce, and we count the push of the bounce too.

## Check yourself

1. In which order do the stages run, and which ones run once per step instead of once per substep?
2. A chain carries 100 kg and is 13 cm too long. Why do 8 substeps alone not help, and what does?
3. Which term of the soft push kept the chain from blowing up in our test, and what does it do?

## Sources

- [Solver2D](https://box2d.org/posts/2024/02/solver2d/), Erin Catto, 2024: read in full. The eight solvers, the soft constraint formulas, the relax round, the count of loops.
- Box2D at commit [2b14ae3](https://github.com/erincatto/box2d/tree/2b14ae3feebce864131e24799e3c1c5484b431bc), read in parts: [solver.c](https://github.com/erincatto/box2d/blob/2b14ae3feebce864131e24799e3c1c5484b431bc/src/solver.c) for the stages, [contact_solver.c](https://github.com/erincatto/box2d/blob/2b14ae3feebce864131e24799e3c1c5484b431bc/src/contact_solver.c) for the pushes of a contact, [distance_joint.c](https://github.com/erincatto/box2d/blob/2b14ae3feebce864131e24799e3c1c5484b431bc/src/distance_joint.c) for a stick, [constraint_graph.c](https://github.com/erincatto/box2d/blob/2b14ae3feebce864131e24799e3c1c5484b431bc/src/constraint_graph.c) for the colors, and [simulation.md](https://github.com/erincatto/box2d/blob/2b14ae3feebce864131e24799e3c1c5484b431bc/docs/simulation.md) for the 4 substeps.
- The tables, the pendulum, the chain and the sag formula are ours, from [soft-step.mjs](./soft-step.mjs): run it with `node docs/topics/soft-step.mjs`. The stages, the defaults and the caps are Box2D's.
