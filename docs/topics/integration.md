# Numerical integration

*Theory · 6 min read · Updated November 11, 2026 · [Topic map](./README.md)*

**In short:** an engine cannot work out motion exactly, so it moves forward in small steps, guessing the next position and velocity from the current ones. Which values each guess uses decides whether a spring keeps swinging, explodes, or dies out.

## The idea

You have probably written this in a three.js animation loop:

```js
velocity.y -= 9.81 * dt
position.y += velocity.y * dt
```

That is numerical integration. Velocity says how fast position changes: it is its **derivative**. Going back from velocity to position means adding up all those small changes over time: an **integral**. When forces keep changing, that sum usually has no formula, so the engine approximates it one step `dt` at a time. Every step is a guess with a small error; what matters is what those errors do over thousands of steps.

## How it works

The three methods differ only in *which* velocity and force each step uses.

### Explicit Euler

```js
position += velocity * dt          // the old velocity
velocity += (force / mass) * dt
```

Everything comes from the start of the step. The most obvious version, and the worst one for games.

### Semi-implicit Euler

```js
velocity += (force / mass) * dt
position += velocity * dt          // the new velocity
```

The same two lines, swapped: the order of your three.js loop above, so you were already using it. Just as cheap, but it keeps energy steady on average, a property called **symplectic**. Glenn Fiedler recommends it and writes that most commercial game physics engines use it. Box2D does too: its solver integrates velocities before positions.

### Implicit Euler

It uses the force at the *end* of the step: `velocity₁ = velocity₀ + force(position₁) / mass * dt`, then `position₁ = position₀ + velocity₁ * dt`. That force depends on the end position, which is what we are looking for, so each step is an equation to solve. For one spring it has a direct answer, `v₁ = (v₀ − dt·(k/m)·x₀) / (1 + dt²·k/m)`; with many connected springs it becomes a whole system. In exchange it stays stable even with very hard springs, but it drains energy, like a hidden brake.

## When it fails: stability

Free fall hides the problem. A ball dropped from 10 m at 10 steps per second: after 1 s the exact height is 5.10 m, explicit Euler says 5.59 m, semi-implicit 4.60 m. With a constant force the errors are equal and opposite, and they stay that way. Trouble starts when the force depends on position.

### The spring test

A spring pulls back in proportion to its stretch: `force = −k · x` (Hooke's law), where `k`, the **stiffness**, says how hard it is to stretch, in N/m. With no friction, the energy of the swing, ½·m·v² + ½·k·x², must stay the same forever: a lie detector for integrators. A 1 kg mass on a 100 N/m spring, released 1 m from rest, at 60 steps per second:

| Method | Energy after 1 s | After 10 s |
| --- | --- | --- |
| Explicit Euler | ×5.2 | ×14 million |
| Semi-implicit Euler | ×0.93 | ×1.06 |
| Implicit Euler | ×0.19 | almost 0 |

Why? A spring swings with an angular frequency ω = √(k/m): one full swing takes 2π/ω seconds. Explicit Euler moves with a velocity that ignores the pull of the current step, so it overshoots outward every time: the energy grows by 1 + (dt·ω)² at every single step, ×1.028 here, ×5.2 after 60 steps. Implicit Euler divides it by the same amount. Semi-implicit Euler moves with the velocity already pulled back, so its errors alternate and roughly cancel over each swing: it never leaves ×0.92 to ×1.09. **Accurate and stable are different things.**

### The step limit

Semi-implicit Euler has a limit too: `dt × ω < 2`, a step shorter than about a third of a swing. Our script confirms it: at dt × ω = 1.9 the energy swings up to ×20 but stays bounded; at 2.1 it explodes. With 100 N/m the limit is 0.2 s, far above 1/60 s. With 1,000,000 N/m it is 0.002 s, and at 60 steps per second the spring explodes. **The stiffest thing we simulate sets the largest step we can take.**

### Substeps

When a step is too long, split it. 9 substeps of 1/540 s bring that stiff spring to dt × ω = 1.85: bounded, but so close to the limit that it still swings a lot, so in practice you leave a margin. Each substep costs a full integration: it trades time for quality.

## Choices and trade-offs

| Method | Forces computed per step | Energy over time | Catch |
| --- | --- | --- | --- |
| Explicit Euler | 1 | grows | explodes on springs |
| Semi-implicit Euler | 1 | steady on average | unstable when `dt × ω ≥ 2` |
| Velocity Verlet | 1, reused by the next step | steady, within 1% here | the velocity waits for the end-of-step force |
| RK4 | 4 | slowly lost | four times the work |
| Implicit Euler | a system to solve | lost | slow, and hard to parallelize |

Velocity Verlet averages the force at the start and at the end of each step; RK4 samples it four times along the step. Both are more accurate than Euler, and neither is free. For real time, semi-implicit Euler is the usual choice: one force per step, steady energy, substeps for the stiff cases.

## On the GPU

Once the forces are known, each particle's update needs only its own position, velocity and force, so one thread per particle updates thousands of them at once. Implicit methods are the opposite: solving a system ties every particle to its neighbours. *Our reading, not tested yet:* one more reason to prefer semi-implicit Euler with substeps on the GPU.

## In FORCE

Not yet. [hello-compute](../../examples/hello-compute/free-fall.wgsl) moves each particle with the exact free-fall formula for one step from rest, `0.5 * g * dt²`, and stores no velocity. The likely first integrator is semi-implicit Euler, with more substeps on fast devices and fewer on phones: a proposal, not a decision.

## Check yourself

1. Swap the two lines of explicit Euler. Why does a spring care, when free fall does not?
2. A spring explodes at 60 steps per second. Name two fixes that keep the same stiffness.
3. Why does implicit Euler fit the GPU worse than semi-implicit Euler?

## Sources

- [Glenn Fiedler, Integration Basics](https://gafferongames.com/post/integration_basics/) (2004): the three Euler methods, RK4, and the advice for games.
- [Box2D, solver.c](https://github.com/erincatto/box2d/blob/main/src/solver.c): the solver stages, velocities first and positions later.
- [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a): where we first met the spring test.
- [integration.mjs](./integration.mjs): our experiment, behind every number on this page. Run it with `node docs/topics/integration.mjs` and change its constants.
