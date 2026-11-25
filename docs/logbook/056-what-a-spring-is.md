# 056 · What a Spring Is

*November 25, 2026 · 2 min read*

**In short:** the first stop of a study on springs, before any code: what a spring is as physics. A force that grows with the stretch, a swing whose pace depends only on stiffness and mass, a damper that stops it, and one number that says how much damper is a lot.

## The story

**A study in five stops.** With two buffers free ([chapter 054](./054-without-the-lists.md)), the user wants particles joined by springs, and asked to start from a proper study: the physics first, then how engines set their springs, with the topic map read for what belongs on the route. The map already had much of it, seen in passing while we studied contacts. So five stops: what a spring is; why it is hard to simulate; how engines set one; springs in FORCE on the GPU; what to build with them.

**Four ideas, one at a time.** Each with an example and a question, in chat, before any page.

*A force that grows with the stretch.* An elastic band of 10 cm pulls twice as hard at 14 cm as at 12. Hooke's law. A spring of 100 N/m with a rest length of 1 m, squeezed to 0.8 m? "20 newtons, pushing the two ends outward," the user said.

*It does not stop, it swings.* Back at its rest length the force is zero but the speed is highest, so it goes past. 1 kg on 100 N/m goes back and forth 1.6 times a second, however far it was pulled. With 4 kg? "It halves." And a question back: "is the denominator under the root too?" No: frequency = √(k / m) / 2π, and the 2π only turns radians into whole swings.

*A damper stops it.* A second force, against the motion, that looks at speed and not at stretch. A damped spring held still, 5 cm beyond rest: how much damping? "Zero, because it is not moving."

*How much damper is a lot.* The damping ratio ζ measures a spring against itself: below 1 it bounces before it rests, at 1 it rests as fast as it can without bouncing, above 1 it is slow. For a rope that bounces two or three times? "0.1, because below 1 it swings before stopping."

**Checked by counting.** [spring.mjs](../topics/spring.mjs) simulates a weight on a spring in steps of a hundredth of a millisecond and counts the swings: 1.592 Hz for 1 kg on 100 N/m, exactly what the formula says, and 0.796 with 4 kg. With ζ = 0.1 each swing is 0.53 of the one before; with ζ = 1 it never passes rest, and is within 1 mm after 0.66 s; with ζ = 3, after 2.7 s.

## What we take away

- Four numbers make a spring: rest length, stiffness, damping, and the mass it carries.
- Stiffness and mass set the pace, as √(k / m). The size of the swing does not.
- The same spring can be given as k and c, or as hertz and ζ. The second pair reads the same on any mass, which is why Box2D and Jolt ask for it.

## Sources

- The theory page that came out of this stop: [Springs](../topics/spring.md).
- Jolt Physics, `SpringSettings.h`, and Box2D, `types.h`, opened for how they name a spring's settings.

## Next step

The second stop: why a stiff spring is hard to simulate, and the three ways around it.
