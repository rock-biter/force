# 013 · A flat ground, the simplest way

*Accepted · November 11, 2026 · The user, asking for particles that bounce instead of falling forever ([step 010](../logbook/010-the-ground.md))*

**Decision:** we will give a world an optional ground, an infinite flat plane. A particle that ends up below it goes back on top. Its speed into the ground comes back weakened by the restitution, and friction slows its sliding in proportion to the hit. One radius for every particle sets how far above the ground the center stops.

## Why

Particles fell forever, and the fountain needed a floor. A plane is the easiest shape there is: one check per particle, inside the shader that already moves it, with no extra pass and no talk between particles. Testing "are you below it?" instead of "did you cross it?" also means that nothing can tunnel through it.

## Not chosen

- **No friction:** whatever lands would slide away forever.
- **A radius per particle, in the free w slot:** [decision 008](./008-particles-in-two-vec4-buffers.md) keeps w as a candidate for the inverse mass.
- **A real contact solver, with impulses or position based dynamics:** what engines do, and a study of its own, for the rigid bodies.
- **A ground that is always there:** falling-particles must stay a free fall check.

## Consequences

- `World.create({ radius, ground: { y, restitution, friction } })`, with no ground by default. The defaults are radius 0.05 m, y 0, restitution 0.5 and friction 0.3, picked by eye.
- The ground is switched on by an override constant: with no ground, the shader is built without that code.
- A particle at rest stays on the ground, but its vertical speed keeps flickering by about g·h on each step: the bounce never dies completely.
- At rest, the friction slows a slide by exactly μ·g, as Coulomb's law says: 2 m/s stop in 0.68 s.
- Near a contact, rounding can move a bounce by one step: runs in 32-bit and in 64-bit floats part by 7 cm. Checks against the CPU must count in 32 bits.

## Still open

- One plane only, flat and infinite: no slopes, no walls, no other shapes.
- Restitution and friction are the same for every particle.
- The friction rule, sliding kick at most μ times the bouncing kick, is the usual one as we remember it: still to check against a source.

## Revisit if

- We study contacts for the rigid bodies: the ground becomes a body like the others, and this code gives way to the contact solver.
