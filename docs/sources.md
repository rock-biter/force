# Sources

The status says how much we actually read:

- **Verified:** we checked the specific point we cite.
- **Index only:** we know it exists and what it covers, but we have not studied it yet.

## Engines: code and docs

| Source | What it gives us | Status |
| --- | --- | --- |
| [Box2D, Hello Box2D](https://github.com/erincatto/box2d/blob/main/docs/hello.md) | The flip book comparison, the 1/60 second step | Verified |
| [Box2D, physics_world.c](https://github.com/erincatto/box2d/blob/main/src/physics_world.c) | The real order of the steps: broad phase, collisions, solver | Verified |
| [Box2D, solver.c](https://github.com/erincatto/box2d/blob/main/src/solver.c) | The internal stages of the solver | Verified |
| [Rapier, integration_parameters.rs](https://github.com/dimforge/rapier/blob/master/src/dynamics/integration_parameters.rs) | The solver repeats 4 rounds by default | Verified |

## Articles and talks

| Source | What it gives us | Status |
| --- | --- | --- |
| [Glenn Fiedler, Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/) | Why the step must be fixed and how to separate it from frames | Verified |
| [Erin Catto, publications](https://box2d.org/publications/) | GDC talks by the creator of Box2D on solvers and collisions | Index only |
| [Matthias Müller, Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html) | Short videos with JavaScript demos on cloth, fluids, rigid bodies and GPU | Index only |
| [Witkin and Baraff, Physically Based Modeling](https://www.cs.cmu.edu/~baraff/sigcourse/) | The classic SIGGRAPH 1997 course notes | Index only |

## WebGPU

| Source | What it gives us | Status |
| --- | --- | --- |
| [WebGPU specification](https://www.w3.org/TR/webgpu/) | The official definition of the API | Index only |
| [WGSL specification](https://www.w3.org/TR/WGSL/) | The official definition of the shader language | Index only |
| [MDN, WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) | A readable API reference | Index only |
| [WebGPU Fundamentals](https://webgpufundamentals.org/) | Step-by-step lessons | Index only |

## Method

| Source | What it gives us | Status |
| --- | --- | --- |
| [Diátaxis](https://diataxis.fr/) | Keeping what you read to learn apart from what you look up | Verified |
