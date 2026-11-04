# 001 · The Flip Book

*November 5, 2026 · 4 min read*

**In short:** a physics engine does not work out an object's whole path. It can do only one thing: look at the world now and calculate what it will look like a moment later. It repeats that 60 times a second, and it looks real.

## The story

We wanted to understand what a physics engine really does. The clearest answer came from the docs of Box2D, one of the most widely used 2D engines, which compares it to a **flip book**: those little pads of drawings you riffle with your thumb.

Each page is drawn by looking at the previous one. The engine does the same: it does not ask "where will the ball be in 3 seconds?" but "where will it be in a sixtieth of a second?". Then it starts again from there. That jump is called the **timestep**.

### Why delta time is not enough

In three.js you multiply by delta time and movement comes out right at any screen speed. In physics that is not enough, because every step is an approximation: steps of different lengths give slightly different paths. And if a frame runs slow, the step gets longer: a fast object can jump from one side of a wall to the other without ever touching it.

That is why the timestep stays fixed. The screen loop sets aside the time that has passed and spends it in equal steps: sometimes one per frame, sometimes two, sometimes none.

### What happens in a step

Five questions, always the same:

```text
1. What is pushing?      forces
2. What is nearby?       broad phase
3. What is touching?     narrow phase
4. How do I fix it?      solver
5. Where do they end up? integration
   ...and start again
```

1. **What is pushing?** Gravity, wind, explosions: every force changes the velocity of objects, and a light object changes faster than a heavy one.
2. **What is nearby?** With 10,000 objects, trying every pair means about 50 million checks per step. So we start with a rough check, using invisible boxes around the objects, and discard the pairs that are far apart. It is the same idea as frustum culling in three.js: discard early and cheaply. This is the **broad phase**.
3. **What is touching?** Only for the remaining pairs do we look at the real shape: this is the **narrow phase**. The result is a **contact**: where they touch, in which direction and how far they overlap.
4. **How do I fix it?** This is the heart of the engine. Each contact becomes a rule, a **constraint**: "these two must not pass through each other". The **solver** corrects velocities to obey them, and the overlap tells it how hard to push the objects apart. The catch is that in a stack of boxes, fixing one pair breaks another. So it goes over everything a few times (Rapier, another open source engine, does 4 rounds by default) and stops even if the result is not perfect: the next step is already coming, and it only has to look right.
5. **Where do they end up?** With corrected velocities, positions are updated: `position += velocity * timestep`. This update is called **integration**.

The exact order changes from engine to engine: Box2D, for example, looks for collisions before applying forces. The idea stays the same.

### And FORCE, today?

FORCE is our engine, designed to run on the GPU. Its only example, `hello-compute`, takes a single step with gravity alone and moves the particles without remembering their velocity. Compared with the five questions, it is still a sketch.

This is where you see why the project is ambitious. The GPU is at its best when each calculation can go its own way without waiting for the others. Points 1 and 5 are perfect: each object minds its own business. Points 2 and 3 compare objects, but each pair can be checked separately. Point 4 is the opposite, because every correction depends on the others. It will probably be our biggest challenge.

## What we take away

- A physics engine is a loop: look at the world, calculate the next step, repeat.
- The timestep must stay fixed, and 1/60 of a second is a typical value.
- First discard cheaply, then calculate precisely.
- The solver does not look for the perfect answer: it looks for a believable one, in time.
- On the GPU, the solver will probably be the hardest piece.

## Sources

- [Box2D, Hello Box2D](https://github.com/erincatto/box2d/blob/main/docs/hello.md)
- [Box2D, physics_world.c](https://github.com/erincatto/box2d/blob/main/src/physics_world.c)
- [Rapier, integration_parameters.rs](https://github.com/dimforge/rapier/blob/master/src/dynamics/integration_parameters.rs)
- [Glenn Fiedler, Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/)

## Next step

Find the foundational papers: which ones matter and why.
