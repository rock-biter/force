# 077 · The Surface of a Cloth

*November 28, 2026 · 4 min read*

**In short:** Loose particles lodge between the spheres of a cloth as large as they are, and do not roll. Pushed along the cloth's normal, blended with its neighbours, they slide as on a plane, and the cloth can be as thin as it is drawn. Two cloths on each other are still open.

## The story

**What we wanted.** On [the net](./076-cloths-and-loose-particles.md) the particles that fall on it stay where they land. A net 3 times finer hides it. The user wanted to know why, and what to do when the cloth's particles cannot be made smaller.

**Why.** A cloth is a net of spheres, and two spheres push each other along the line between their centers. To a grain the cloth is then an egg tray. With spheres as large as the grain, the way out of a dimple climbs 0.32 radii. By geometry the net must tilt 35° before a grain leaves; [the script](../topics/grains-on-cloth.mjs), which runs our step, measures 36°. A net 3 times finer gives 15°, a cloth stretched by 10% gives 41°.

**What others do.** We read the passages that matter in two papers by Müller and Chentanez (2011). Theirs is the nearest to our case: a particle on the surface of a body knows which way is out, and pushes not as its own sphere but as a larger one, placed so that its top is where the small one's was. Larger spheres side by side make shallower dimples. FleX gives every particle of a rigid body a direction to push along. Obi and the first PBD paper leave spheres and use triangles with a thickness.

**The user's idea.** Keep the spheres to find who touches whom, but push along the *normal* of the cloth, the direction that leaves it, as in shading, and stop at half the cloth's thickness. The cloth is drawn as a thin slab: a grain then rests on the slab, not a radius above it.

**By script.** On a flat net tilted slowly, a grain pushed along the normal moves off at 1.9°, the same as on a true plane in that test, where the larger sphere of Müller and Chentanez still needs 13° to 22°. Two findings on the way:

- Every sphere of the cloth in reach asks the same push, and a particle of ours moves by half the sum of what its contacts ask, plus half their average. So the push is multiplied: a grain dropped from 0.5 m bounced back to 0.41 m. With the cloth counted as *one* contact it stays down.
- On [a net hung by its corners](../topics/grains-on-net.mjs) a grain rolling down a bowl drifted sideways by 18 cm. Each particle of the cloth stands for a flat plane across its normal, and a grain that takes only the plane it is deepest under feels flat tiles. Blending the normals of the particles in reach, and how deep the grain is under each, weighed by distance along the cloth, as a normal is blended across a triangle, brought it to 10 cm. A true bowl gives 0.

**On the GPU.** [A page](../../examples/net-surface/index.html) with a menu for each way. The user chose the blended normal, and found what the script had not: at the edges grains bounced on nothing. A contact is made up to a diameter past the last particle, and there the cloth went on as a flat slab. Now past an edge the push starts from the edge: the cloth ends rounded.

**Not for every cloth.** The user closed the step with a rule of use. The normal is the best way and the one that costs: one more run of a shader over every particle, a *pass*, and a buffer more. Where a net 3 times finer can be afforded, it is enough by itself, edges included. And a cloth far away, or one that needs no such detail, keeps its plain spheres and gives up some quality.

**The ninth buffer.** The normals are one more buffer for the shader that pushes, which read 8 *storage buffers* already, the kind that holds large arrays: all a device gives unless asked. For a day the page asked for 9. Then the floor and the walls, 6 planes at most, came in as a uniform ([guide](../guides/uniform-buffers.md)), and we are back to 8.

**Two cloths.** We tried the same push between cloths. A pile of 6 cloths 4 cm thick holds, flat and thin; one of 12 tangles. We guessed twice and were wrong twice. First, that they fall too fast for a gap of 4 cm: but cutting a step into more *substeps*, smaller steps, does not help. Then, that the weight of the pile closes the lowest gap: [a script](../topics/cloths-in-a-pile.mjs) shows that even 20 cloths close it by 2 mm, not by 4 cm. One real cause was found and fixed on the way: cloths 4 cm apart are all within a diameter, so a particle "touched" ten layers, and now leaves out those too far to lie on. The pile of 12 still tangles.

### What is proven, and what is not

Measured by script: the slopes, the bounce, the drift, the pile at rest. Seen by the user on the page: grains slide, the edges behave. Checked in Chrome on this Mac only. Not measured: the cost of the pass that works out the normals. Not read: the two papers in full, Obi's code.

## What we take away

- A push between centers makes a cloth an egg tray: 35° to leave a dimple, more when the cloth stretches.
- Find contacts with spheres, push along the normal: the grain slides, and the cloth gets a thickness of its own ([decision 047](../decisions/047-pushed-by-the-surface.md)).
- Many spheres saying the same thing must count once, or the push is multiplied.
- A surface made of particles goes on past its last one: it needs an edge.
- Three levels for a cloth: the normal, a finer net, or plain spheres. Which one is a choice for each cloth.
- A few fixed values do not need a storage buffer: a uniform array leaves the place to something else.

## Open questions

- Why do 12 thin cloths tangle when they fall on each other, and 6 do not?
- What does the normals pass cost? Does it all run in Safari and on a phone?

## Sources

- Müller and Chentanez, [Solid Simulation with Oriented Particles](https://matthias-research.github.io/pages/publications/orientedParticles.pdf) and [Adding Physics to Animated Characters with Oriented Particles](https://matthias-research.github.io/pages/publications/animParticles.pdf), 2011: passages only.
- Macklin and others, [Unified Particle Physics](https://doi.org/10.1145/2601097.2601152), 2014; Müller and others, [Position Based Dynamics](https://doi.org/10.1016/j.jvcir.2007.01.005), 2007.
- Manuals: [Obi, surface collisions](https://obi.virtualmethodstudio.com/manual/7.0/surfacecollisions.html), [PhysX 5.6, particle system](https://nvidia-omniverse.github.io/PhysX/physx/5.6.1/docs/ParticleSystem.html), [Vellum, collisions](https://www.sidefx.com/docs/houdini/vellum/collisions.html), FleX.

## Next step

A net that catches a pile of cloths, and why thin cloths tangle when they fall.
