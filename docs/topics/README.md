# Topic map

*Generated from [topics.json](./topics.json) by `npm run topics`: do not edit by hand.*

Everything we have met while building FORCE, concepts and sources, and how far we went with each
one. Use it to look up a term, to find what to read, or to pick what to explore next.

- **134 concepts:** ● 14 studied · ◐ 51 seen · ○ 69 mentioned
- **80 sources:** ● 5 studied · ◐ 11 seen · ○ 64 mentioned · read by Claude: 17 parts, 0 in full

| | Status | What it means |
| --- | --- | --- |
| ● | Studied | We can explain how it works, with an example, and when it fails: it has a page of ours |
| ◐ | Seen | We can say what it is and why it exists, in two sentences |
| ○ | Mentioned | Only the name so far: still to explore |

The status is what the user knows. For sources, a separate column says what Claude has read:

| Claude read | What it means |
| --- | --- |
| Parts | Claude opened it to check what we cite: other topics in it may be missing from the map |
| In full | Claude read all of it, and put on the map every topic in it that matters for FORCE |
| *(empty)* | Not opened by Claude, or not recorded |

## Physics

How things move, collide and stay together.

| | Concept | In short | Part of | First cited in |
| --- | --- | --- | --- | --- |
| ◐ | Angular momentum | Inertia times angular velocity: the quantity a torque changes over time | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Angular velocity | How fast a body spins and around which axis, as one vector in radians per second | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Articulated bodies | Chains of bodies linked by joints, such as robots and ragdolls |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Bounding box | An invisible box around an object: testing two boxes is much cheaper than testing two real shapes |  | [001](../logbook/001-the-flip-book.md) |
| ○ | Bounding volume hierarchy (BVH) | Boxes nested inside boxes: a tree that skips whole groups of far-away objects at once | Broad phase | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ◐ | Broad phase | A rough check that discards pairs of objects too far apart to touch | Collision detection | [001](../logbook/001-the-flip-book.md) |
| ○ | Center of mass | The balance point of an object: a rigid body's position, and the point it spins around when free | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Cloth | A sheet that bends and folds, like a flag or a curtain |  | [docs index](../README.md) |
| ◐ | Collision detection | Finding out which objects touch: first a rough pass, then a precise one | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ◐ | Collision response | What to do once a contact is found: push the objects apart and change their velocities | Simulation step | [010](../logbook/010-the-ground.md) |
| ◐ | Conservation of energy | Without friction, the energy of motion plus the stored energy stays constant: a simple test for an integrator |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Constraint | A rule objects must obey, such as "do not pass through each other" |  | [001](../logbook/001-the-flip-book.md) |
| ◐ | Contact | The result of a collision: where two objects touch, in which direction, and how far they overlap |  | [001](../logbook/001-the-flip-book.md) |
| ○ | Contact events | Telling game code when two objects start or stop touching |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Contact manifold | All the contact points between two touching shapes, such as the four corners of a box resting on the floor |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Continuous collision detection | Checking the whole path between two steps, so fast objects cannot tunnel through walls | Collision detection | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Destruction | Breaking objects into pieces while the game runs |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Discrete element method (DEM) | Particles that push each other apart when they overlap, like small springs, with dampers to absorb the bounce |  | [Real-Time Rigid Body Simulation on GPUs](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-29-real-time-rigid-body-simulation-gpus) |
| ○ | Distance constraint | A rule that keeps two points at a fixed distance: the building block of chains, ropes and cloth | Constraint | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | EPA | Run after GJK when two shapes overlap, to find how deep and in which direction | Narrow phase | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ● | **[Explicit Euler](integration.md#explicit-euler)** | Move with the old velocity, then update the velocity: simple, but it makes oscillations gain energy | Integration | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Finite element method (FEM) | Splitting a solid into small pieces, such as tetrahedra, and working out how each one deforms |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ● | **[Fixed timestep](fixed-timestep.md)** | Keeping every step the same length, and spending the time of each frame in equal steps | Timestep | [001](../logbook/001-the-flip-book.md) |
| ○ | FLIP water | Water simulated with particles that carry the motion, plus a grid that keeps it from compressing | Fluid | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ○ | Fluid | Water, smoke and anything else that flows instead of keeping its shape |  | [docs index](../README.md) |
| ◐ | Forces | Pushes such as gravity or wind: they change velocity, and change a light object more than a heavy one | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ◐ | Friction | The force that resists sliding between two surfaces in contact |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Gauss-Seidel | Fixing constraints one after another, each using the latest results: converges fast, but it is sequential | Iterative solver | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | GJK | A test that tells whether two convex shapes overlap, using only their farthest points in each direction | Narrow phase | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Granular materials | Sand, snow and grains: solid up close, flowing in bulk |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Gravity | The force that pulls everything down: on Earth it adds 9.81 m/s of downward speed every second | Forces | [001](../logbook/001-the-flip-book.md) |
| ○ | Grid fluid (Eulerian) | A fluid simulated on a fixed grid, tracking what flows through each cell | Fluid | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ◐ | Hooke's law | A spring pulls back in proportion to how far it is stretched (F = −kx) | Spring | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ● | **[Implicit integration](integration.md#implicit-euler)** | Uses the force at the end of the step: stable with stiff springs, but it must solve equations and it drains energy | Integration | [Physically Based Modeling: Principles and Practice](https://www.cs.cmu.edu/~baraff/sigcourse/) |
| ○ | Impulse-based dynamics | Resolving collisions by changing velocities at once, with an instant kick called an impulse |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Inertia tensor | The moment of inertia in 3D: a 3×3 matrix, because the resistance to spinning changes with the axis | Moment of inertia | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ● | **[Integration](integration.md)** | Moving a simulation forward in small steps, updating velocity and position from the current state | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ◐ | Inverse mass | Storing 1/m instead of m: no divisions in hot loops, and zero means a body that never moves | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Islands | Groups of bodies that touch each other, solved apart from the rest | Solver | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Iterative solver | Fixing one constraint at a time, going over all of them a few rounds, and stopping when it looks right | Solver | [001](../logbook/001-the-flip-book.md) |
| ○ | Jacobi | Fixing every constraint at once from the same old state, then combining: parallel, but slower to converge | Iterative solver | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Joint | A link that holds two bodies together but lets them move in some ways, like a hinge |  | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ○ | Mass-spring system | Particles linked by springs: the simplest model of cloth and soft bodies |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Material point method (MPM) | Particles carry the material while a grid works out the forces: good for snow, sand and deformables |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Mesh sampling | Turning a mesh's surface or volume into points, for example to build a body out of particles |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Moment of inertia | How hard an object is to spin: it depends on its mass and on how far that mass is from the axis | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Narrow phase | A precise check, on the real shapes, of the pairs that survived the broad phase | Collision detection | [001](../logbook/001-the-flip-book.md) |
| ○ | Neighbour search | Finding the particles near each particle: a major cost of particle fluids |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Newton's second law | Force equals mass times acceleration (F = ma): the same push moves a light object more | Forces | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ● | **[Numerical stability](integration.md#when-it-fails-stability)** | Whether a simulation's errors stay small or grow until it explodes: not the same thing as accuracy |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Orientation | How a body is rotated, stored as a quaternion and updated each step by a small rotation | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Particle | A point that moves but has no size or shape: the simplest thing to simulate |  | [000](../logbook/000-the-launch.md) |
| ◐ | Particle-based rigid bodies | A rigid body's shape approximated by spheres, so every collision becomes a cheap test between spheres | Rigid body | [Real-Time Rigid Body Simulation on GPUs](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-29-real-time-rigid-body-simulation-gpus) |
| ◐ | Physics engine | A program that works out how objects move, one small step at a time |  | [001](../logbook/001-the-flip-book.md) |
| ◐ | Plausibility over accuracy | Games need motion that looks right, fast and stable, more than exact physics | Physics engine | [001](../logbook/001-the-flip-book.md) |
| ○ | Position based dynamics (PBD) | Moving points straight to where the constraints want them, instead of going through forces: simple and stable |  | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ○ | Position based fluids (PBF) | Fluids kept from compressing with position constraints, the PBD way | Fluid | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Raycast | Shooting a line into the world to find what it hits first, for aiming, picking or line of sight |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ● | **[Render interpolation](fixed-timestep.md#render-interpolation)** | Drawing a blend of the last two physics states, so motion looks smooth between steps | Fixed timestep | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Restitution | How bouncy a collision is: how much speed comes back after the impact |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Rigid body | An object that moves and rotates but never bends, like a box or a ball |  | [docs index](../README.md) |
| ◐ | Runge-Kutta 4 (RK4) | Samples the rate of change four times per step: very accurate, but four times the work, and it slowly loses energy | Integration | [Integration Basics](https://gafferongames.com/post/integration_basics/) |
| ○ | Self-collision | Cloth or a soft body hitting itself | Cloth | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Semi-fixed timestep | Splitting long frames into steps no longer than a maximum: safer, but steps still differ in length | Fixed timestep | [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/) |
| ● | **[Semi-implicit Euler](integration.md#semi-implicit-euler)** | Update the velocity first, then move with the new one: a small swap that keeps a spring's energy bounded when the step is small enough | Integration | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Sequential impulses (PGS) | Applying impulses to one contact or joint at a time, over several rounds: the classic rigid body solver | Iterative solver | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Shape matching | Pulling a group of particles back toward the best rigid fit of their original shape |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Signed distance field collision | Describing a shape by the distance from it at every point of space, so a contact test becomes a lookup | Narrow phase | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Simulation step | What an engine repeats over and over: apply forces, find contacts, fix them, move everything | Physics engine | [001](../logbook/001-the-flip-book.md) |
| ○ | Sleeping | Pausing bodies that have come to rest, until something wakes them up |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Soft body | An object that squashes and bounces back, like jelly |  | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ○ | Soft Step | The solver of recent Box2D versions, built around substeps | Solver | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Solver | The part of the engine that corrects velocities so constraints are obeyed | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ○ | Spatial hashing | A uniform grid stored in a hash table, so it can cover endless space with little memory | Broad phase | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | SPH | Smoothed particle hydrodynamics: a fluid's density and pressure at each particle, estimated from its neighbours | Fluid | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ● | **[Spiral of death](fixed-timestep.md#the-spiral-of-death)** | When catching up on physics takes so long that every frame falls further behind | Fixed timestep | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Spring | A link that keeps two points near a rest distance, pulling when stretched and pushing when squeezed |  | [docs index](../README.md) |
| ● | **[Stiffness](integration.md#the-step-limit)** | How strongly a spring or constraint resists: the stiffer it is, the faster it oscillates and the smaller the safe timestep |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ● | **[Substepping](integration.md#substeps)** | Splitting each step into smaller ones, to follow fast motion and stiff constraints | Timestep | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Sweep and prune | A broad phase that sorts objects along an axis, so only neighbours in the list need checking | Broad phase | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ◐ | Symplectic integrator | An integrator that keeps energy steady on average over long runs, such as semi-implicit Euler or Verlet | Integration | [Integration Basics](https://gafferongames.com/post/integration_basics/) |
| ○ | TGS solver | PhysX's temporal Gauss-Seidel solver, designed to converge better with complex constraints | Solver | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ● | **[Time accumulator](fixed-timestep.md#the-accumulator)** | Keeps the real time not simulated yet, and spends it in fixed steps | Fixed timestep | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ● | **[Timestep](fixed-timestep.md)** | The jump in time of each step, often 1/60 of a second | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ◐ | Torque | The turning effect of a force: the same push turns more the farther it is from the center (τ = r × F) | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Tunneling | A fast object passing through a wall between two steps, without ever touching it | Collision detection | [001](../logbook/001-the-flip-book.md) |
| ○ | Two-way coupling | Different materials pushing on each other both ways, like a ball floating on water |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Unified particle physics | Building every material, from solids to cloth and fluids, out of particles held by constraints |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Uniform grid | Space split into equal cells: only objects in the same or nearby cells get compared | Broad phase | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Units and scale | Engines tune their tolerances for one size of object: meters and everyday objects, from soup cans to buses | Physics engine | [Box2D, Overview](https://github.com/erincatto/box2d/blob/main/docs/overview.md) |
| ◐ | Velocity Verlet | Uses the acceleration both before and after moving: more accurate, but forces are computed twice | Integration | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Warm starting | Starting the solver from the previous step's answer, so fewer rounds are needed | Solver | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | XPBD | Extended PBD: each constraint gets a softness, called compliance, so stiffness no longer depends on step size or rounds | Position based dynamics (PBD) | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |

| | Source | Kind | What it gives us | About | First cited in | Claude read |
| --- | --- | --- | --- | --- | --- | --- |
| ○ | [A Material Point Method for Snow Simulation](https://doi.org/10.1145/2461912.2461948)<br>*Alexey Stomakhin, Craig Schroeder, Lawrence Chai, Joseph Teran, Andrew Selle, 2013* | Paper | The material point method applied to snow | Material point method (MPM), Granular materials | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [A Survey on Position-Based Simulation Methods in Computer Graphics](https://doi.org/10.1111/cgf.12346)<br>*Jan Bender, Matthias Müller, Miguel A. Otaduy, Matthias Teschner, Miles Macklin, 2014* | Paper | An overview of the whole position based family | Position based dynamics (PBD) | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Ammo.js](https://github.com/kripken/ammo.js) | Project | Bullet compiled to JavaScript for the browser | Physics engine | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Animating Sand as a Fluid](https://doi.org/10.1145/1073204.1073298)<br>*Yongning Zhu, Robert Bridson, 2005* | Paper | Sand simulated with a mix of particles and a grid | Granular materials, FLIP water | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Avian](https://github.com/avianphysics/avian) | Project | A physics engine for Bevy, written in Rust | Physics engine, Entity component system (ECS) | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Bevy](https://bevy.org/) | Project | A Rust game engine built on ECS, with physics from plugins such as Rapier and Avian | Entity component system (ECS) | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ◐ | [Box2D](https://github.com/erincatto/box2d)<br>*Erin Catto* | Project | One of the most widely used 2D physics engines, open source | Physics engine, Simulation step, Solver | [001](../logbook/001-the-flip-book.md) |  |
| ◐ | [Box2D, Hello Box2D](https://github.com/erincatto/box2d/blob/main/docs/hello.md) | Documentation | The flip book comparison, and the 1/60 second step | Physics engine, Timestep | [001](../logbook/001-the-flip-book.md) |  |
| ○ | [Box2D, Overview](https://github.com/erincatto/box2d/blob/main/docs/overview.md) | Documentation | The units Box2D is tuned for, and the size of objects it handles well | Units and scale | [008](../logbook/008-the-first-loop.md) | Parts |
| ◐ | [Box2D, physics_world.c](https://github.com/erincatto/box2d/blob/main/src/physics_world.c) | Source code | The real order of the steps: broad phase, collisions, solver | Simulation step | [001](../logbook/001-the-flip-book.md) |  |
| ○ | [Box2D, Simulation](https://github.com/erincatto/box2d/blob/main/docs/simulation.md) | Documentation | Box2D's guide to the world and its step, including substeps | Substepping, Soft Step | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ◐ | [Box2D, solver.c](https://github.com/erincatto/box2d/blob/main/src/solver.c) | Source code | The internal stages of the solver | Solver, Semi-implicit Euler | [001](../logbook/001-the-flip-book.md) |  |
| ○ | [Bullet Physics](https://github.com/bulletphysics/bullet3) | Project | A long-lived open source C++ library: rigid bodies, collision detection and soft bodies | Rigid body, Collision detection, Soft body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [cannon-es](https://github.com/pmndrs/cannon-es) | Project | A 3D physics engine written in JavaScript | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Detailed Rigid Body Simulation with Extended Position Based Dynamics](https://diglib.eg.org/items/114b20b0-8543-4c54-bd04-42ee60c71946)<br>*Matthias Müller, Miles Macklin, Nuttapong Chentanez, Stefan Jeschke, Tae-Yong Kim, 2020* | Paper | Rigid bodies, contacts and joints solved with XPBD, with implementation details | XPBD, Rigid body, Joint | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Erin Catto, publications](https://box2d.org/publications/)<br>*Erin Catto* | Talk | GDC talks by the creator of Box2D on solvers and collisions | Solver, Collision detection | [001](../logbook/001-the-flip-book.md) |  |
| ● | [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/) · **[our page](fixed-timestep.md)**<br>*Glenn Fiedler* | Article | Why the step must be fixed, and how to separate it from frames | Fixed timestep, Timestep, Time accumulator, Render interpolation, Spiral of death, Semi-fixed timestep | [001](../logbook/001-the-flip-book.md) |  |
| ○ | [Godot](https://godotengine.org/) | Project | Open source game engine with its own physics, and alternative backends | Physics engine | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Havok](https://www.havok.com/) | Project | A commercial physics engine, available as an option in Unity | Physics engine | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ● | [Integration Basics](https://gafferongames.com/post/integration_basics/) · **[our page](integration.md)**<br>*Glenn Fiedler* | Article | How numerical integrators behave, explained for game developers | Integration, Numerical stability, Explicit Euler, Semi-implicit Euler, Implicit integration, Runge-Kutta 4 (RK4), Symplectic integrator, Stiffness, Hooke's law | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Jolt Physics](https://github.com/jrouwe/JoltPhysics) | Project | A fast C++ engine for rigid bodies in games | Rigid body, Bounding volume hierarchy (BVH), Sequential impulses (PGS), Job system | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Jolt Physics, Architecture](https://github.com/jrouwe/JoltPhysics/blob/master/Docs/Architecture.md) | Documentation | How Jolt is built: AABB trees, GJK and EPA, sequential impulses, islands, sleeping and jobs | Bounding volume hierarchy (BVH), GJK, EPA, Sequential impulses (PGS), Warm starting, Islands, Sleeping, Job system | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [JoltPhysics.js](https://github.com/jrouwe/JoltPhysics.js) | Project | Jolt compiled to WebAssembly, for the browser | Physics engine | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Matter.js](https://github.com/liabru/matter-js) | Project | A 2D physics engine written in JavaScript | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Meshless Deformations Based on Shape Matching](https://doi.org/10.1145/1073204.1073216)<br>*Matthias Müller, Bruno Heidelberger, Matthias Teschner, Markus Gross, 2005* | Paper | Deformable objects made of points pulled back toward their rest shape | Shape matching, Soft body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [MuJoCo](https://github.com/google-deepmind/mujoco) | Project | A physics engine for robotics: contacts and articulated systems | Articulated bodies, Contact | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [NVIDIA FleX](https://developer.nvidia.com/flex) | Project | NVIDIA's unified particle library: rigid bodies, cloth and fluids all made of particles | Unified particle physics, Shape matching, Mesh sampling | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [NVIDIA FleX, extensions API](https://gameworksdocs.nvidia.com/FleX/1.2/lib_docs/_static/api/_nv_flex_ext_8h.html) | Documentation | Creating particle assets from a mesh: voxels, surface sampling and clusters | Mesh sampling, Shape matching | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [NVIDIA FleX, manual](https://gameworksdocs.nvidia.com/FleX/1.2/lib_docs/manual.html) | Documentation | How FleX turns materials into particles, and why it is meant for effects more than gameplay | Unified particle physics, Shape matching | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [NVIDIA PhysX](https://developer.nvidia.com/physx-sdk) | Project | NVIDIA's physics SDK: rigid bodies, particles and soft bodies, partly accelerated on the GPU with CUDA | Rigid body, Parallel work on the GPU, TGS solver, Finite element method (FEM) | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [O3DE](https://o3de.org/) | Project | Open 3D Engine, an open source game engine that uses PhysX | Physics engine | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Particle-Based Fluid Simulation for Interactive Applications](https://matthias-research.github.io/pages/publications/sca03.pdf)<br>*Matthias Müller et al., 2003* | Paper | SPH fluids fast enough for interactive use | SPH | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Physically Based Modeling: Principles and Practice](https://www.cs.cmu.edu/~baraff/sigcourse/)<br>*Andrew Witkin, David Baraff, 1997* | Course | The classic SIGGRAPH course notes: particles, rigid bodies, constraints and implicit methods | Particle, Rigid body, Constraint, Integration, Implicit integration, Inertia tensor, Angular momentum | [001](../logbook/001-the-flip-book.md) |  |
| ○ | [PhysX, GPU simulation](https://nvidia-omniverse.github.io/PhysX/physx/5.7.0/docs/GPURigidBodies.html) | Documentation | Which parts of PhysX run on the GPU with CUDA | Parallel work on the GPU, Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [PhysX, Rigid Body Dynamics](https://nvidia-omniverse.github.io/PhysX/physx/5.2.1/docs/RigidBodyDynamics.html) | Documentation | The PhysX guide to rigid bodies, and to its two solvers, PGS and TGS | Rigid body, Sequential impulses (PGS), TGS solver | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Planck.js](https://github.com/piqnt/planck.js) | Project | A JavaScript rewrite of Box2D | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Position Based Dynamics](https://doi.org/10.1016/j.jvcir.2007.01.005)<br>*Matthias Müller, Bruno Heidelberger, Marcus Hennix, John Ratcliff, 2007* | Paper | The paper that introduced moving positions directly to satisfy constraints | Position based dynamics (PBD) | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Position Based Fluids](https://mmacklin.com/pbf_sig_preprint.pdf)<br>*Miles Macklin, Matthias Müller, 2013* | Paper | Fluids that do not compress, built on position constraints, for real time | Position based fluids (PBF) | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [PositionBasedDynamics](https://github.com/InteractiveComputerGraphics/PositionBasedDynamics) | Project | An open source C++ library of position based methods: PBD, XPBD, cloth and deformables | Position based dynamics (PBD), XPBD, Cloth, Soft body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Project Chrono](https://projectchrono.org/) | Project | A C++ engine for multibody dynamics and engineering simulation | Articulated bodies | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ◐ | [Rapier](https://github.com/dimforge/rapier) | Project | An open source 2D and 3D physics engine written in Rust | Physics engine, Solver | [001](../logbook/001-the-flip-book.md) |  |
| ◐ | [Rapier, integration_parameters.rs](https://github.com/dimforge/rapier/blob/master/src/dynamics/integration_parameters.rs) | Source code | The solver repeats 4 rounds by default | Iterative solver | [001](../logbook/001-the-flip-book.md) |  |
| ◐ | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a)<br>*2026* | Conversation | Days of study before this logbook resumed: the engine landscape, the first papers, then lessons on time, stability and rigid bodies | Physics engine, Integration, Fixed timestep, Numerical stability, Rigid body, Broad phase, Position based dynamics (PBD), Quality tiers | [004](../logbook/004-the-detour.md) |  |
| ○ | [Small Steps in Physics Simulation](https://mmacklin.com/smallsteps.pdf)<br>*Miles Macklin et al., 2019* | Paper | Many substeps with one solver round each can beat one step with many rounds | Substepping, XPBD, Iterative solver | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Stable Fluids](https://doi.org/10.1145/311535.311548)<br>*Jos Stam, 1999* | Paper | A grid fluid method that stays stable even with large timesteps | Grid fluid (Eulerian), Numerical stability | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Strain Based Dynamics](https://matthias-research.github.io/pages/publications/strainBasedDynamics.pdf)<br>*Matthias Müller, Nuttapong Chentanez, Tae-Yong Kim, Miles Macklin, 2014* | Paper | PBD constraints that control stretching in any direction, not only along the edges of the mesh | Position based dynamics (PBD), Cloth, Soft body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html)<br>*Matthias Müller* | Video | Short videos with JavaScript demos: PBD, cloth, soft bodies, fluids, rigid bodies, collisions and the GPU | Position based dynamics (PBD), Cloth, Soft body, Fluid, Rigid body, Broad phase, Parallel work on the GPU | [001](../logbook/001-the-flip-book.md) |  |
| ○ | [Unified Particle Physics for Real-Time Applications](https://doi.org/10.1145/2601097.2601152)<br>*Miles Macklin, Matthias Müller, Nuttapong Chentanez, Tae-Yong Kim, 2014* | Paper | The paper behind NVIDIA FleX: solids, cloth and fluids as particles and constraints, solved in parallel | Unified particle physics, Position based dynamics (PBD), Two-way coupling | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Unity](https://docs.unity.com/en-us/engine/6000.0/manual/physics-section) | Project | Game engine: PhysX for 3D physics, Box2D for 2D | Physics engine, Entity component system (ECS) | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Unity, Rigidbody](https://docs.unity.com/en-us/engine/6000.7/manual/physics-section/physics-overview/rigidbody/class-rigidbody) | Documentation | The manual page of Unity's rigid body component | Rigid body | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Unity, Rigidbody.inertiaTensor](https://docs.unity.com/en-us/engine/6000.6/script-reference/unityengine/rigidbody/inertiatensor) | Documentation | How Unity exposes a body's inertia tensor, and lets you change it | Inertia tensor | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/physics-in-unreal-engine) | Project | Game engine with its own physics system, Chaos, which also covers destruction, cloth and fluids | Physics engine, Destruction, Cloth, Fluid | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [XPBD: Position-Based Simulation of Compliant Constrained Dynamics](https://matthias-research.github.io/pages/publications/XPBD.pdf)<br>*Miles Macklin, Matthias Müller, Nuttapong Chentanez, 2016* | Paper | Adds compliance to PBD, so stiffness stops depending on the timestep and the number of rounds | XPBD | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |

## Math

The math behind motion: change over time, rotations, numbers on a computer.

| | Concept | In short | Part of | First cited in |
| --- | --- | --- | --- | --- |
| ◐ | Derivative | How fast a quantity changes at an instant: velocity is the derivative of position, acceleration that of velocity |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Floating point precision | Numbers on a computer have a limited number of digits: 32-bit floats are fast on the GPU, but rounding errors add up |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Integral | The reverse of a derivative: adding up small changes over time, such as velocity into position |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |

## GPU

WebGPU, WGSL and how to make thousands of threads work.

| | Concept | In short | Part of | First cited in |
| --- | --- | --- | --- | --- |
| ● | **[Adapter and device](../guides/adapter-and-device.md)** | How a page gets the GPU: the adapter stands for a GPU on the system, the device is our own connection to it | WebGPU | [guides index](../guides/README.md) |
| ○ | Atomic operations | Memory updates that stay correct even when thousands of threads write to the same place |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Billboard | A flat shape turned to face the camera in every frame, the base of most impostors | Impostor | [009](../logbook/009-the-first-picture.md) |
| ○ | Bind group | Connects real buffers to the numbered slots a shader reads from | WebGPU | [guides index](../guides/README.md) |
| ● | **[Buffer](../guides/buffers.md)** | A block of GPU memory holding raw bytes, declared up front with everything it will be used for | WebGPU | [guides index](../guides/README.md) |
| ○ | Commands and queue | GPU work is recorded first, and runs only when it is submitted to the queue | WebGPU | [guides index](../guides/README.md) |
| ○ | Compatibility mode | A restricted WebGPU that also runs on older graphics APIs, such as OpenGL ES 3.1 | WebGPU | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Compute pipeline | A compiled shader plus its fixed settings, ready to run | WebGPU | [guides index](../guides/README.md) |
| ○ | Compute shader | A GPU program that calculates instead of drawing | WebGPU | [000](../logbook/000-the-launch.md) |
| ○ | Constraint graph coloring | Splitting constraints into groups that share no body, so each group can be solved in parallel |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Device limits | What a given GPU guarantees, such as buffer sizes and workgroup memory: to check before choosing a pipeline | WebGPU | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Device loss | The browser can take the GPU back at any time: every buffer and pipeline, and the data in them, must then be created again | Adapter and device | [adapter-and-device](../guides/adapter-and-device.md) |
| ○ | Error scope | Catches WebGPU errors in code: push a scope before the calls, pop it after to get the first error, or null | WebGPU errors | [buffers](../guides/buffers.md) |
| ○ | GPU-resident simulation | Keeping the simulation's data on the GPU, and not reading it back every frame |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Impostor | A flat shape that a shader paints to look like a 3D object, such as a sphere drawn on one triangle |  | [009](../logbook/009-the-first-picture.md) |
| ◐ | Instancing | Drawing the same geometry many times in one call, each copy with its own data, like InstancedMesh in three.js |  | [009](../logbook/009-the-first-picture.md) |
| ◐ | Memory alignment | Where a value may start in memory: a vec3f starts on a multiple of 16 bytes, so in an array it takes 16 bytes, not 12 | WGSL | [008](../logbook/008-the-first-loop.md) |
| ○ | Override constant | A WGSL constant set from JavaScript when the pipeline is created, such as the workgroup size | WGSL | [free-fall](../../examples/hello-compute/free-fall.wgsl) |
| ○ | Parallel sorting | Sorting many keys at once on the GPU, for example objects by grid cell |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Parallel work on the GPU | The GPU runs the same code on thousands of items at once, and is fastest when each one can go its own way |  | [001](../logbook/001-the-flip-book.md) |
| ○ | Prefix sum (scan) | Turning a list of counts into running totals, in parallel: the GPU's way of packing results |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Readback | Copying results from the GPU back into JavaScript | WebGPU | [guides index](../guides/README.md) |
| ◐ | Structure of arrays (SoA) | One array per property, all positions together and all velocities together, instead of one object per particle |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | TSL (Three Shading Language) | How three.js writes shaders in JavaScript, compiled to WGSL for its WebGPU renderer |  | [009](../logbook/009-the-first-picture.md) |
| ○ | Uniform buffer | A small read-only buffer of values shared by every thread, like a GLSL uniform | Buffer | [008](../logbook/008-the-first-loop.md) |
| ○ | Usage scope | A stretch of GPU work whose parts may run at the same time: in a compute pass, each dispatch is one | WebGPU | [WebGPU specification](https://www.w3.org/TR/webgpu/) |
| ○ | WebGPU | The browser API that lets a page use the GPU, both to draw and to calculate |  | [README](../../README.md) |
| ◐ | WebGPU errors | Most mistakes do not throw: the call returns, the work is skipped, and the browser prints a warning in the console | WebGPU | [buffers](../guides/buffers.md) |
| ○ | WGSL | The shader language of WebGPU, the counterpart of GLSL | WebGPU | [guides index](../guides/README.md) |
| ○ | Workgroups and dispatch | How the work is split into groups of threads and launched on the GPU | WebGPU | [guides index](../guides/README.md) |

| | Source | Kind | What it gives us | About | First cited in | Claude read |
| --- | --- | --- | --- | --- | --- | --- |
| ○ | [Broad-Phase Collision Detection with CUDA](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-32-broad-phase-collision-detection-cuda)<br>*Scott Le Grand, 2007* | Book | A parallel broad phase built from spatial subdivision, sorting and prefix sums | Broad phase, Uniform grid, Parallel sorting, Prefix sum (scan) | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Chrome, WebGPU overview](https://developer.chrome.com/docs/web-platform/webgpu/overview) | Documentation | Chrome's introduction to WebGPU | WebGPU | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ◐ | [Chrome, What's New in WebGPU 146](https://developer.chrome.com/blog/new-in-webgpu-146) | Documentation | Chrome 146 brings WebGPU compatibility mode to OpenGL ES 3.1 | Compatibility mode, WebGPU | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [GPU Gems 3](https://developer.nvidia.com/gpugems/gpugems3)<br>*2007* | Book | NVIDIA's free book of GPU techniques, with a whole part on physics simulation | Parallel work on the GPU | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [MDN, GPU.requestAdapter()](https://developer.mozilla.org/en-US/docs/Web/API/GPU/requestAdapter) | Documentation | How to ask for an adapter, and why it can be null | Adapter and device | [adapter-and-device](../guides/adapter-and-device.md) | Parts |
| ○ | [MDN, GPUAdapter.requestDevice()](https://developer.mozilla.org/en-US/docs/Web/API/GPUAdapter/requestDevice) | Documentation | How to ask for a device, its options, and why a second call rejects | Adapter and device, Device limits | [adapter-and-device](../guides/adapter-and-device.md) | Parts |
| ● | [MDN, GPUBuffer.usage](https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/usage) · **[our page](../guides/buffers.md)** | Documentation | Every buffer usage flag and what it allows | Buffer | [buffers](../guides/buffers.md) | Parts |
| ● | [MDN, GPUDevice.createBuffer()](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createBuffer) · **[our page](../guides/buffers.md)** | Documentation | How to create a buffer, and which usage flags may go together | Buffer | [buffers](../guides/buffers.md) | Parts |
| ○ | [MDN, GPUDevice.lost](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/lost) | Documentation | When a device is lost, and how to start over | Device loss | [adapter-and-device](../guides/adapter-and-device.md) | Parts |
| ● | [MDN, GPUQueue.writeBuffer()](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/writeBuffer) · **[our page](../guides/buffers.md)** | Documentation | How to fill a buffer from JavaScript: offsets in bytes or elements, and what throws | Buffer, WebGPU errors | [buffers](../guides/buffers.md) | Parts |
| ○ | [MDN, GPUSupportedLimits](https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits) | Documentation | Every limit with its default value | Device limits | [adapter-and-device](../guides/adapter-and-device.md) | Parts |
| ○ | [MDN, Navigator.gpu](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/gpu) | Documentation | The entry point of WebGPU, only on HTTPS or localhost | WebGPU | [adapter-and-device](../guides/adapter-and-device.md) | Parts |
| ○ | [MDN, WebGLRenderingContext.bufferData()](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/bufferData) | Documentation | How WebGL fills a buffer; its usage is only an intended pattern, for speed | Buffer | [buffers](../guides/buffers.md) | Parts |
| ○ | [MDN, WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) | Documentation | A readable API reference | WebGPU | [guide skill](../../.claude/skills/guide/SKILL.md) |  |
| ◐ | [Real-Time Rigid Body Simulation on GPUs](https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-29-real-time-rigid-body-simulation-gpus)<br>*Takahiro Harada, 2007* | Book | Rigid bodies built from particles: collisions found on a uniform grid and pushed apart with springs and dampers, all on the GPU | Rigid body, Inertia tensor, Parallel work on the GPU, Particle-based rigid bodies, Uniform grid, Discrete element method (DEM) | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [Taichi](https://github.com/taichi-dev/taichi) | Project | A language embedded in Python for writing parallel simulations that run on the GPU | Parallel work on the GPU | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [three.js](https://github.com/mrdoob/three.js) | Project | The 3D library for the web; its WebGPU renderer draws our debug viewer, on the same device as FORCE | Adapter and device, Buffer, Instancing, TSL (Three Shading Language) | [010-device-from-outside](../decisions/010-device-from-outside.md) | Parts |
| ○ | [three.js r187, WebGLAttributes.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgl/WebGLAttributes.js) | Source code | How the WebGL renderer uploads a BufferAttribute, and uploads it again after needsUpdate | Buffer | [buffers](../guides/buffers.md) | Parts |
| ○ | [three.js r187, WebGPUAttributeUtils.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgpu/utils/WebGPUAttributeUtils.js) | Source code | createAttribute() makes a GPU buffer for an attribute only when it has none yet | Buffer | [009](../logbook/009-the-first-picture.md) | Parts |
| ○ | [three.js r187, WebGPUBackend.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/webgpu/WebGPUBackend.js) | Source code | The WebGPU renderer accepts a device from outside, and destroys only a device it created | Adapter and device | [009](../logbook/009-the-first-picture.md) | Parts |
| ○ | [WebGPU Best Practices: Device Loss](https://toji.dev/webgpu-best-practices/device-loss) | Article | What makes a device get lost, how to recover, and how to test it | Device loss | [adapter-and-device](../guides/adapter-and-device.md) | Parts |
| ○ | [WebGPU Fundamentals](https://webgpufundamentals.org/) | Course | Step-by-step lessons | WebGPU | [002](../logbook/002-the-toolbox.md) |  |
| ○ | [WebGPU on web-features](https://web-platform-dx.github.io/web-features-explorer/features/webgpu/) | Documentation | Which browsers support WebGPU | WebGPU | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |  |
| ○ | [WebGPU specification](https://www.w3.org/TR/webgpu/) | Specification | The official definition of the API | WebGPU, Device limits, Usage scope, Adapter and device, Device loss, Commands and queue, Buffer, WebGPU errors, Error scope | [README](../../README.md) | Parts |
| ○ | [WGSL specification](https://www.w3.org/TR/WGSL/) | Specification | The official definition of the shader language | WGSL, Memory alignment | [guide skill](../../.claude/skills/guide/SKILL.md) | Parts |

## Engine design

How an engine is organized, measured and scaled across devices.

| | Concept | In short | Part of | First cited in |
| --- | --- | --- | --- | --- |
| ○ | Benchmark scenes | Standard test scenes, such as a stack of boxes or a dam break, to compare algorithms fairly |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Entity component system (ECS) | Organizing a game as plain data components processed by systems, instead of objects with methods |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Frame budget | The slice of each frame the physics may use, for example 2 to 4 ms of the 16.7 ms available at 60 FPS |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Job system | Splitting the work of a step into small jobs spread over the CPU cores |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ◐ | Quality tiers | The same simulation at different costs: fewer particles, substeps and solver rounds on weaker devices |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |
| ○ | Thermal throttling | Phones slow down as they heat up, so speed must be measured over minutes, not seconds |  | [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a) |

## Method

How we learn and write things down.

| | Concept | In short | Part of | First cited in |
| --- | --- | --- | --- | --- |
| ◐ | Decision record | A short page per design choice: what we chose, why, and what we left out, so nobody has to accept or reverse it blindly |  | [006](../logbook/006-the-decision-log.md) |
| ◐ | Kinds of documentation | Texts for learning, for doing, for looking up and for understanding work best kept apart |  | [002](../logbook/002-the-toolbox.md) |

| | Source | Kind | What it gives us | About | First cited in | Claude read |
| --- | --- | --- | --- | --- | --- | --- |
| ◐ | [Diátaxis](https://diataxis.fr/) | Documentation | Keeping what you read to learn apart from what you look up | Kinds of documentation | [002](../logbook/002-the-toolbox.md) |  |
| ◐ | [Documenting Architecture Decisions](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)<br>*Michael Nygard, 2011* | Article | The post that proposed decision records: context, decision, status and consequences, superseded but never deleted | Decision record | [006](../logbook/006-the-decision-log.md) |  |
