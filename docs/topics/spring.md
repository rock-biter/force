# Springs

*Theory · 4 min read · Updated November 25, 2026 · [Topic map](./README.md)*

**In short:** a spring wants one length and pulls back harder the further it is from it. Left alone it swings forever at a pace set by its stiffness and the mass it carries; a damper makes it stop. Four numbers say it all: rest length, stiffness, damping, mass.

## The idea

Take an elastic band 10 cm long. Pull it to 12 cm and you feel a force. Pull it to 14 cm, twice the stretch, and the force is twice as strong. At 10 cm it does not pull at all. Squeeze a spring instead and it pushes back the same way.

In GLSL it would be one line. The result is how hard the spring pulls its two ends toward each other, along the line between them; below zero, it pushes them apart:

```glsl
float force = k * (length(b - a) - rest);
```

The 10 cm are the **rest length**. `k` is the **stiffness**: how many newtons for each meter of stretch (N/m), a newton being about the weight of a small apple. The rule itself is **Hooke's law**. A spring with `k` = 100 N/m and a rest length of 1 m, squeezed to 0.8 m, pushes its two ends apart with 100 × 0.2 = 20 newtons. Stretched to 1.2 m, it pulls them together with the same 20.

## How it works

**It does not stop: it swings.** Stretch a spring with a weight on it and let go. The force brings the weight back toward rest, but when it gets there the force is zero and the speed is at its highest, so it goes past, is pushed back, and starts again. A weight on a spring with nothing to brake it is a **harmonic oscillator**.

**The pace depends on two things only.** How many times a second it goes back and forth is its **frequency**, in **hertz** (Hz):

```
frequency = √(k / m) / (2π)
```

Only `k / m` is under the root. It grows with the stiffness and falls with the mass `m`, and it does not depend on how far you pulled. The 2π is the one of `sin(time * 2.0 * PI * frequency)`: a full swing is 2π radians. `√(k / m)` alone is the same pace in radians per second, which papers write ω.

| Spring | Weight | Let go at | Counted by our script | From the formula |
| --- | --- | --- | --- | --- |
| 100 N/m | 1 kg | 1 cm | 1.592 Hz | 1.592 Hz |
| 100 N/m | 1 kg | 10 cm | 1.592 Hz | 1.592 Hz |
| 100 N/m | 4 kg | 1 cm | 0.796 Hz | 0.796 Hz |
| 400 N/m | 1 kg | 1 cm | 3.183 Hz | 3.183 Hz |

Four times the mass: half the pace. Four times the stiffness: twice the pace.

**A damper makes it stop.** Real springs come to rest because something brakes them: in a car, the piston full of oil next to each spring. **Damping** is a second force, which does not look at how far the spring is stretched but at how fast its length is changing, and always works against that. Written as the force on the weight, where a minus means "against":

```
force = −k × stretch − c × speed
```

`c` says how strong the damper is, in newtons for each meter per second.

A spring that is stretched but not moving feels no damping at all.

**How much damping is a lot.** The same `c` brakes a light, soft spring hard and a heavy, stiff one hardly at all. The **damping ratio**, written ζ (zeta), says how strong the damper is for this spring and this mass:

```
ζ = c / (2 × √(k × m))
```

Think of a door with a closer. Below 1 it bounces before it shuts. At 1, **critical damping**, it shuts as fast as it can without ever bouncing. Above 1 it does not bounce, and takes its time. A weight of 1 kg on 100 N/m, let go at 10 cm:

| ζ | Goes past rest by | The next swing, as a share of the one before | Within 1 mm of rest after |
| --- | --- | --- | --- |
| 0 | 10 cm | 1 | never |
| 0.1 | 7.3 cm | 0.53 | 4.5 s |
| 0.3 | 3.7 cm | 0.14 | 1.4 s |
| 0.7 | 0.5 cm | — | 0.66 s |
| 1 | nothing | — | 0.66 s |
| 3 | nothing | — | 2.7 s |

At 0.7 it gets close as soon as at 1, but it has gone past rest by half a centimeter on the way: 1 is the least damping that never does.

## Choices and trade-offs

**Two ways to describe the same spring.** With `k` and `c`, what a physicist measures. But the same `k` and `c` swing fast under a light weight and slowly under a heavy one. Or with hertz and ζ, what you see: "swings 5 times a second and stops without bouncing", whatever it carries. Two physics engines show the choice: Box2D asks for `hertz` and `dampingRatio`, and Jolt offers both ways, frequency and damping by default, or stiffness and damping.

## On the GPU

Not yet: where springs live in memory, and how the many threads of a compute shader share them, is the fourth stop of this study.

## In FORCE

No springs between particles yet. A spring was one of the two ways we tried for pushing touching particles apart, set in hertz and ζ ([chapter 030](../logbook/030-the-lazy-list.md)); we chose the other. Why a stiff spring is hard to simulate, one small step of time after another, is in [Numerical integration](./integration.md#the-spring-test).

## Check yourself

1. A spring of 200 N/m with a rest length of 50 cm is stretched to 60 cm. What force, and which way on each end?
2. You swap the weight on a spring for one nine times as heavy. What happens to its frequency?
3. You want a spring that bounces two or three times and then rests. Which ζ, roughly, and what happens at ζ = 3?

## Sources

- Our own script, [spring.mjs](./spring.mjs), for every number in the two tables.
- Jolt Physics, [SpringSettings.h](https://github.com/jrouwe/JoltPhysics/blob/master/Jolt/Physics/Constraints/SpringSettings.h): the spring equation `F = -k * x - c * v`, and its two ways of setting a spring.
- Box2D, [types.h](https://github.com/erincatto/box2d/blob/main/include/box2d/types.h): `hertz` and `dampingRatio` on its joints, the links between two bodies.
