# Topic map

*Generated from [topics.json](./topics.json) by `npm run topics`: do not edit by hand.*

Everything we have met while building FORCE, concepts and sources, and how far we went with each
one. Use it to look up a term, to find what to read, or to pick what to explore next.

- **41 concepts:** ● 0 studied · ◐ 17 seen · ○ 24 mentioned
- **15 sources:** ● 0 studied · ◐ 8 seen · ○ 7 mentioned

| | Status | What it means |
| --- | --- | --- |
| ● | Studied | Studied in depth: it has its own page |
| ◐ | Seen | We know what it is: explained in a few lines, or opened to check what we cite |
| ○ | Mentioned | Only cited so far: still to explore |

## Physics

How things move, collide and stay together.

| | Concept | In short | Part of | First cited in |
| --- | --- | --- | --- | --- |
| ◐ | Bounding box | An invisible box around an object: testing two boxes is much cheaper than testing two real shapes |  | [001](../logbook/001-the-flip-book.md) |
| ○ | Bounding volume hierarchy (BVH) | Boxes nested inside boxes: a tree that skips whole groups of far-away objects at once | Broad phase | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ◐ | Broad phase | A rough check that discards pairs of objects too far apart to touch | Collision detection | [001](../logbook/001-the-flip-book.md) |
| ○ | Cloth | A sheet that bends and folds, like a flag or a curtain |  | [docs index](../README.md) |
| ◐ | Collision detection | Finding out which objects touch: first a rough pass, then a precise one | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ◐ | Constraint | A rule objects must obey, such as "do not pass through each other" |  | [001](../logbook/001-the-flip-book.md) |
| ◐ | Contact | The result of a collision: where two objects touch, in which direction, and how far they overlap |  | [001](../logbook/001-the-flip-book.md) |
| ◐ | Fixed timestep | Keeping every step the same length, and spending the time of each frame in equal steps | Timestep | [001](../logbook/001-the-flip-book.md) |
| ○ | FLIP water | Water simulated with particles that carry the motion, plus a grid that keeps it from compressing | Fluid | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ○ | Fluid | Water, smoke and anything else that flows instead of keeping its shape |  | [docs index](../README.md) |
| ◐ | Forces | Pushes such as gravity or wind: they change velocity, and change a light object more than a heavy one | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ○ | Gravity | The force that pulls everything down: on Earth it adds 9.81 m/s of downward speed every second | Forces | [001](../logbook/001-the-flip-book.md) |
| ○ | Grid fluid (Eulerian) | A fluid simulated on a fixed grid, tracking what flows through each cell | Fluid | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ○ | Implicit integration | A way of taking a step that stays stable even with stiff springs or long steps | Integration | [Physically Based Modeling: Principles and Practice](https://www.cs.cmu.edu/~baraff/sigcourse/) |
| ◐ | Integration | The calculation that updates position from velocity | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ◐ | Iterative solver | Fixing one constraint at a time, going over all of them a few rounds, and stopping when it looks right | Solver | [001](../logbook/001-the-flip-book.md) |
| ○ | Joint | A link that holds two bodies together but lets them move in some ways, like a hinge |  | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ◐ | Narrow phase | A precise check, on the real shapes, of the pairs that survived the broad phase | Collision detection | [001](../logbook/001-the-flip-book.md) |
| ○ | Particle | A point that moves but has no size or shape: the simplest thing to simulate |  | [000](../logbook/000-the-launch.md) |
| ◐ | Physics engine | A program that works out how objects move, one small step at a time |  | [001](../logbook/001-the-flip-book.md) |
| ○ | Position based dynamics (PBD) | Moving points straight to where the constraints want them, instead of going through forces: simple and stable |  | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ○ | Rigid body | An object that moves and rotates but never bends, like a box or a ball |  | [docs index](../README.md) |
| ◐ | Simulation step | What an engine repeats over and over: apply forces, find contacts, fix them, move everything | Physics engine | [001](../logbook/001-the-flip-book.md) |
| ○ | Soft body | An object that squashes and bounces back, like jelly |  | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ◐ | Solver | The part of the engine that corrects velocities so constraints are obeyed | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ○ | Spring | A link that keeps two points near a rest distance, pulling when stretched and pushing when squeezed |  | [docs index](../README.md) |
| ○ | Sweep and prune | A broad phase that sorts objects along an axis, so only neighbours in the list need checking | Broad phase | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) |
| ◐ | Timestep | The jump in time of each step, often 1/60 of a second | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ◐ | Tunneling | A fast object passing through a wall between two steps, without ever touching it | Collision detection | [001](../logbook/001-the-flip-book.md) |

| | Source | Kind | What it gives us | About | First cited in |
| --- | --- | --- | --- | --- | --- |
| ◐ | [Box2D](https://github.com/erincatto/box2d)<br>*Erin Catto* | Project | One of the most widely used 2D physics engines, open source | Physics engine, Simulation step, Solver | [001](../logbook/001-the-flip-book.md) |
| ◐ | [Box2D, Hello Box2D](https://github.com/erincatto/box2d/blob/main/docs/hello.md) | Documentation | The flip book comparison, and the 1/60 second step | Physics engine, Timestep | [001](../logbook/001-the-flip-book.md) |
| ◐ | [Box2D, physics_world.c](https://github.com/erincatto/box2d/blob/main/src/physics_world.c) | Source code | The real order of the steps: broad phase, collisions, solver | Simulation step | [001](../logbook/001-the-flip-book.md) |
| ◐ | [Box2D, solver.c](https://github.com/erincatto/box2d/blob/main/src/solver.c) | Source code | The internal stages of the solver | Solver | [001](../logbook/001-the-flip-book.md) |
| ○ | [Erin Catto, publications](https://box2d.org/publications/)<br>*Erin Catto* | Talk | GDC talks by the creator of Box2D on solvers and collisions | Solver, Collision detection | [001](../logbook/001-the-flip-book.md) |
| ◐ | [Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/)<br>*Glenn Fiedler* | Article | Why the step must be fixed, and how to separate it from frames | Fixed timestep, Timestep | [001](../logbook/001-the-flip-book.md) |
| ○ | [Physically Based Modeling: Principles and Practice](https://www.cs.cmu.edu/~baraff/sigcourse/)<br>*Andrew Witkin, David Baraff, 1997* | Course | The classic SIGGRAPH course notes: particles, rigid bodies, constraints and implicit methods | Particle, Rigid body, Constraint, Integration, Implicit integration | [001](../logbook/001-the-flip-book.md) |
| ◐ | [Rapier](https://github.com/dimforge/rapier) | Project | An open source 2D and 3D physics engine written in Rust | Physics engine, Solver | [001](../logbook/001-the-flip-book.md) |
| ◐ | [Rapier, integration_parameters.rs](https://github.com/dimforge/rapier/blob/master/src/dynamics/integration_parameters.rs) | Source code | The solver repeats 4 rounds by default | Iterative solver | [001](../logbook/001-the-flip-book.md) |
| ○ | [Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html)<br>*Matthias Müller* | Video | Short videos with JavaScript demos: PBD, cloth, soft bodies, fluids, rigid bodies, collisions and the GPU | Position based dynamics (PBD), Cloth, Soft body, Fluid, Rigid body, Broad phase, Parallel work on the GPU | [001](../logbook/001-the-flip-book.md) |

## GPU

WebGPU, WGSL and how to make thousands of threads work.

| | Concept | In short | Part of | First cited in |
| --- | --- | --- | --- | --- |
| ○ | Adapter and device | How a page gets the GPU: the adapter stands for a GPU on the system, the device is our own connection to it | WebGPU | [guides index](../guides/README.md) |
| ○ | Bind group | Connects real buffers to the numbered slots a shader reads from | WebGPU | [guides index](../guides/README.md) |
| ○ | Buffer | A block of GPU memory holding raw bytes, declared up front with everything it will be used for | WebGPU | [guides index](../guides/README.md) |
| ○ | Commands and queue | GPU work is recorded first, and runs only when it is submitted to the queue | WebGPU | [guides index](../guides/README.md) |
| ○ | Compute pipeline | A compiled shader plus its fixed settings, ready to run | WebGPU | [guides index](../guides/README.md) |
| ○ | Compute shader | A GPU program that calculates instead of drawing | WebGPU | [000](../logbook/000-the-launch.md) |
| ◐ | Parallel work on the GPU | The GPU runs the same code on thousands of items at once, and is fastest when each one can go its own way |  | [001](../logbook/001-the-flip-book.md) |
| ○ | Readback | Copying results from the GPU back into JavaScript | WebGPU | [guides index](../guides/README.md) |
| ○ | WebGPU | The browser API that lets a page use the GPU, both to draw and to calculate |  | [README](../../README.md) |
| ○ | WGSL | The shader language of WebGPU, the counterpart of GLSL | WebGPU | [guides index](../guides/README.md) |
| ○ | Workgroups and dispatch | How the work is split into groups of threads and launched on the GPU | WebGPU | [guides index](../guides/README.md) |

| | Source | Kind | What it gives us | About | First cited in |
| --- | --- | --- | --- | --- | --- |
| ○ | [MDN, WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) | Documentation | A readable API reference | WebGPU | [guide skill](../../.claude/skills/guide/SKILL.md) |
| ○ | [WebGPU Fundamentals](https://webgpufundamentals.org/) | Course | Step-by-step lessons | WebGPU | [002](../logbook/002-the-toolbox.md) |
| ○ | [WebGPU specification](https://www.w3.org/TR/webgpu/) | Specification | The official definition of the API | WebGPU | [README](../../README.md) |
| ○ | [WGSL specification](https://www.w3.org/TR/WGSL/) | Specification | The official definition of the shader language | WGSL | [guide skill](../../.claude/skills/guide/SKILL.md) |

## Method

How we learn and write things down.

| | Concept | In short | Part of | First cited in |
| --- | --- | --- | --- | --- |
| ◐ | Kinds of documentation | Texts for learning, for doing, for looking up and for understanding work best kept apart |  | [002](../logbook/002-the-toolbox.md) |

| | Source | Kind | What it gives us | About | First cited in |
| --- | --- | --- | --- | --- | --- |
| ◐ | [Diátaxis](https://diataxis.fr/) | Documentation | Keeping what you read to learn apart from what you look up | Kinds of documentation | [002](../logbook/002-the-toolbox.md) |
