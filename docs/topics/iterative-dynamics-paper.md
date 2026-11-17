# Iterative Dynamics with Temporal Coherence

*Reading notes · Erin Catto, 2005 · [Link](https://box2d.org/files/ErinCatto_IterativeDynamics_GDC2005.pdf) · [Topic map](./README.md)*

**In short:** how to make rigid bodies touch, stack and rub in a game by correcting their velocities. Each rule finds how hard it must push, one rule at a time, and starts from the push it found one step before. It is the mirror image of [Jakobsen's paper](./advanced-character-physics.md), which corrects positions.

## The question it answers

Crates, vehicles, rag dolls and whole buildings, on the game consoles of 2005: how do you solve contacts and joints fast, in little memory, without anything blowing up? Catto wants time and memory that grow in line with the number of rules, and accepts a rough answer: "as long as the motion is visually plausible", accuracy comes second.

## The key idea

A *rigid body* here is one object with a position, a rotation, a mass and a velocity. A *constraint* is a rule the bodies must obey, such as "do not pass through each other".

### 1. A rule on velocities

Not "do not be inside the floor" but "do not move into the floor". A ball that lands at −5 m/s gets the push that brings its vertical speed to 0, and its position is then worked out from the corrected speed. Nobody moves the position by hand. This is a *velocity constraint*.

### 2. One number per rule

He lines up the velocities of all bodies in one long list. A rule is a row of weights, and `dot(weights, velocities)` says how fast the rule is being broken: for the floor, the weights pick the vertical speed. The table of all rows is the *Jacobian*. The push of a rule acts along the same weights, so the floor pushes along its vertical and never sideways. Only its strength is unknown: one number per rule, called λ, the *Lagrange multiplier*.

The solver looks for the λ that brings the speed into the floor to exactly zero, then keeps it between a lowest and a highest value. A ball of 2 kg landing at −5 m/s, with steps of 1/60 s, needs 600 N: 600 × 1/60 / 2 = 5. A ball leaving at +3 m/s would need a negative push to be brought to zero, a floor that pulls: λ is clamped to 0 and the ball goes.

| Rule | Limits of λ |
| --- | --- |
| Contact | 0 to ∞: it pushes, never pulls |
| Fixed distance, joint | −∞ to ∞: it pushes and pulls |
| Motor | between minus and plus a largest force |

### 3. One rule at a time, for a few rounds

Pushes depend on each other. Two boxes of 1 kg, A on the floor and B on A, both moving down at 1 m/s once gravity has acted: when A stops B, B pushes A back down. Pushes are counted here as force × step, in N·s, so a push of 1 changes the speed of a 1 kg box by 1 m/s. Between two equal boxes a push speeds one up and slows the other, so half is enough.

| Round | Floor on A | A on B | Both still move down at |
| --- | --- | --- | --- |
| 1 | 1 | 0.5 | 0.5 |
| 2 | 1.5 | 0.75 | 0.25 |
| 3 | 1.75 | 0.875 | 0.125 |

The pushes head for 2 and 1: the floor carries both boxes, A carries only B. Fixing one unknown at a time with the freshest values of the others is *Gauss-Seidel*; with the clamp on each λ it is *Projected Gauss-Seidel*. The clamp is on the total push, so a later round can take back part of an earlier one. He runs a fixed number of rounds, 10 in his tests, and never builds the big table an exact solution would need, of every rule against every other.

### 4. A nudge against overlap

Stopping a body does not pull it out: a box at rest, sunk 1 cm into the floor, obeys the velocity rule forever. So the rule asks for a small speed outward, in proportion to the depth, and each step removes a fixed share of the error. With his 5%, 1 cm becomes 0.95 cm after one step and 0.05 cm after 60. In his analysis of a simple case, up to 100% the error fades smoothly, up to 200% it fades while swinging in and out, and beyond that it grows. This is *Baumgarte stabilization*, and he tunes the share by trial.

### 5. Start from the last step's pushes

In a scene that changes little, today's pushes are almost yesterday's. Started from 2 and 1, the two boxes above have no error left after one round. But contact points are found again from scratch at every step, so each push is stored with a label to find its point again: its position, or better the two edges, one of each box, whose crossing made it. This is *contact caching*; the trick in general is called *warm starting*.

His results, with boxes of 110 kg, 60 steps per second and 10 rounds: without the cache a stack of three boxes falls, with it a stack of ten stands still. A heavy box on a light one is the weak spot: with the cache it holds until the lower box gets down to 3% of the density of the upper one. His rule: "heavy objects can support light objects, but not vice-versa".

### Two shortcuts he admits

- **Friction** is two more rules per contact, "do not slide", with a fixed limit: the friction coefficient, a number for how rough the surfaces are, times the weight of the body divided among its contact points. It ignores how hard the contact really pushes, so in a stack "lower boxes slide just as easily as upper boxes".
- **Rotation** drops one term of its equations, which he calls the inertial torque, because it "can lead to numerical instabilities".

## What it means for FORCE

| | Jakobsen 2001 | Catto 2005 |
| --- | --- | --- |
| A body is | particles and sticks | a rigid body with rotation and mass |
| It corrects | positions | velocities, through one push per rule |
| Memory between steps | free: the positions stay | to build: a cache with labels |
| Overlap | removed at once | removed slowly, with a knob to tune |
| Admitted weak spot | his rigid body made of four particles | heavy on light, friction in stacks |

- **Same integrator, again.** The integrator is the rule that moves everything forward by one step. Catto names his: semi-implicit Euler, ours ([decision 006](../decisions/006-semi-implicit-euler.md)).
- **It loses less energy.** We ran the pendulum of the [Jakobsen notes](./advanced-character-physics.md) with a velocity rule and his 5% nudge: 1 m long, 60 steps per second. The table gives how high it still climbs after 30 s, as a share of the height it was let go from.

  | Method | Let go from 90 degrees | From 10 degrees |
  | --- | --- | --- |
  | Projection, Jakobsen's way | 0.4% | 1% |
  | Velocity rule and nudge | 42% | 96% |

  The price is a stick that is never exact: let go from 90 degrees, it gets up to 3.6 cm too long. With no nudge at all it ends almost twice as long, 96 cm too many. There is one rule only here, so one round finds its push exactly: this says nothing about many rules and few rounds.
- **A rule is a row of weights, a number and two limits.** Contacts, joints and motors share one shape, which would sit well in a GPU buffer. This reading is ours.
- **Both papers solve in a queue,** each rule using what the last one wrote. A GPU runs thousands of threads at once and must solve them in another order ([chapter 012](../logbook/012-the-family-tree.md)).
- **A cache with labels** looks awkward on a GPU, and contacts between particles change far more often than between stacked boxes. Both are our doubts, not checked.
- **His friction does not confirm ours.** Our ground slows the sliding in proportion to the hit ([decision 013](../decisions/013-a-flat-ground.md)), which is closer than his fixed limit to Coulomb's law, where friction grows with how hard the surfaces press together. That rule is still unchecked against a source.

The tables and worked examples are ours, computed by [iterative-dynamics-paper.mjs](./iterative-dynamics-paper.mjs): run it with `node docs/topics/iterative-dynamics-paper.mjs`. The stacks, the 110 kg, the 3%, the 10 rounds, the 5% and the limits of the nudge are the paper's.

## What we did not understand

- **The big system.** Sections 5 and 6 turn "force = mass × acceleration" plus the rules into one equation per rule. We followed it in words and did not redo the algebra.
- **Why the push follows the weights.** The paper says constraint forces "do no work". We took it as given.
- **Rotation.** Every example of ours is a point that does not turn. The rotation part of the weights, and how a rotation is updated, are unread math.
- **When the rounds converge.** He writes that it is guaranteed for one kind of system, which he calls positive definite, and that his is often not of that kind, yet works. For us these are words.
- **Complementarity.** Section 7.3 gives the math name of the problem. A name only.
- **Why the velocity rule still loses height on a wide swing.** Measured, not explained.
- **The figures.** We read the text of all eleven sections and saw no figure.
