# 058 · How Engines Set a Spring

*November 25, 2026 · 3 min read*

**In short:** the third stop of the study on springs: six engines, read in their own code. They mean two different things by "spring", they ask for its stiffness in four different ways, and they all keep the same four numbers for it.

## The story

**Two things with one name.** A *joint* between two rigid bodies, like a car's suspension: two anchor points, one on each body, a few per scene, with a shortest and a longest length. And a *link* between two particles of one soft thing, like the threads of a cloth: thousands, each one two particle numbers, a rest length and a stiffness. A rope of 100 particles in a row? "The second kind, and it has 99 springs," the user said.

**A correction.** Claude wrote that FORCE needs the second kind "because we have particles, not rigid bodies yet". "You are taking for granted that we will make rigid bodies out of groups of particles," the user answered, "and that is not decided." It is not. Links between particles are needed for ropes and cloth either way; if rigid bodies become things of their own, joints will be needed too. Both stay in view.

**Four ways to say how stiff.**

| Engine | What it asks for | Which is |
| --- | --- | --- |
| Rapier, PhysX, cannon-es | `stiffness` and `damping` | `k` and `c` |
| Box2D | `hertz` and `dampingRatio` | hertz and ζ |
| Jolt, joints | frequency and damping, or stiffness and damping | either, by a switch |
| Jolt, soft bodies | `mCompliance` on each edge | compliance, 1 / `k` |
| NVIDIA FleX | a `stiffness` coefficient | none of the three |

FleX says it itself: "these are not springs in the traditional sense, but behave somewhat like a traditional spring when lowering the stiffness coefficient". It is the rod of [chapter 057](./057-three-ways-around.md), softened by a number. Rapier and Jolt also let a spring ignore the mass it carries, by a switch: the same settings then swing a light body and a heavy one alike. And Rapier warns that its springs brake by themselves, since they are stepped implicitly: the first way of chapter 057.

**"Could the coefficient be adjusted to the steps?"** The user's question, after working out that a rope tuned at 2 substeps gets stiffer at 4. The paper that introduced position based dynamics does half of it: with `n` rounds it uses `k' = 1 − (1 − k)^(1/n)`, so that the error left after all the rounds is the same whatever `n`. And then says: "the resulting material stiffness is still dependent on the time step", which it accepts because games use a fixed one. Our substeps are a slider. The XPBD paper adds that the effect of the rounds is not linear, so no simple rescaling exists: that is why it changed the rule and not the number.

**The same four numbers.** FleX keeps three flat buffers: the particle numbers, two per spring, the rest lengths, the coefficients; a negative coefficient makes a *tether*, which only resists being pulled, like a thread. Jolt keeps a small record per spring, `Edge`: two vertex numbers, a rest length, a compliance, and the same shape again for the diagonals of a cloth (*shear*) and for its folds (*bend*). And a last question: a spring says "particle 12 with particle 13", and our particles change number at every substep. "The spring would join two wrong particles."

## What we take away

- Who are the two ends, how long at rest, how stiff: four numbers, the size of our properties.
- Stiffness as a number with a meaning, `k`, hertz or compliance, survives a change of rounds and substeps. A bare coefficient does not, and can be patched for the rounds only.
- Hertz and ζ read the same on any mass; `k` and `c` do not, unless the engine divides by the mass for you.

## Open questions

- How a spring names its particles when their numbers change: the fourth stop.
- Damping for a link between particles: Jolt's soft body has one damping for the whole body, FleX none per spring. Not studied.

## Sources

All opened as source code, for the names and comments of their settings, none read in full:

- Box2D, [types.h](https://github.com/erincatto/box2d/blob/main/include/box2d/types.h), `b2DistanceJointDef`. Rapier, [spring_joint.rs](https://github.com/dimforge/rapier/blob/master/src/dynamics/joint/spring_joint.rs).
- Jolt Physics, [SpringSettings.h](https://github.com/jrouwe/JoltPhysics/blob/master/Jolt/Physics/Constraints/SpringSettings.h), [DistanceConstraint.h](https://github.com/jrouwe/JoltPhysics/blob/master/Jolt/Physics/Constraints/DistanceConstraint.h) and [SoftBodySharedSettings.h](https://github.com/jrouwe/JoltPhysics/blob/master/Jolt/Physics/SoftBody/SoftBodySharedSettings.h).
- PhysX, [PxDistanceJoint.h](https://github.com/NVIDIA-Omniverse/PhysX/blob/main/physx/include/extensions/PxDistanceJoint.h). cannon-es, [Spring.ts](https://github.com/pmndrs/cannon-es/blob/master/src/objects/Spring.ts). FleX, [NvFlex.h](https://github.com/NVIDIAGameWorks/FleX/blob/master/include/NvFlex.h), `NvFlexSetSprings`.
- Müller and others, Position Based Dynamics, 2007, section 3.3 of our local copy, and the abstract of XPBD.

## Next step

The fourth stop: springs in FORCE on the GPU.
