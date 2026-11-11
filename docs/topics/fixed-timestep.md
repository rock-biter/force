# Fixed timestep

*Theory · 5 min read · Updated November 11, 2026 · [Topic map](./README.md)*

**In short:** the engine always advances by the same small step, often 1/60 s, whatever the frame rate. The screen produces time, the physics consumes it in equal steps, and a blend of the last two steps keeps the motion smooth.

## The idea

In three.js you multiply by `deltaTime`, and objects move at the right speed at 30 or 144 FPS. But not along exactly the same path: every step is an approximation whose error depends on its length (see [numerical integration](./integration.md)). In physics those differences add up, and one long step can make a spring explode or let a fast object jump through a wall.

So the **timestep**, the length of one physics step, stays fixed, and rendering and physics each run at their own pace.

## How it works

### The accumulator

In Glenn Fiedler's words, the renderer *produces* time and the simulation *consumes* it in steps of fixed size. A variable, the accumulator, holds the time not simulated yet. Here a *state* is everything the physics knows, such as all positions and velocities:

```js
const STEP = 1 / 60
let accumulator = 0

function frame(frameTime) {          // in seconds: requestAnimationFrame gives milliseconds
  accumulator += Math.min(frameTime, 0.25)
  while (accumulator >= STEP) {
    previous = current
    current = physics.step(current, STEP)
    accumulator -= STEP
  }
  render(blend(previous, current, accumulator / STEP))
}
```

At 30 FPS every frame runs two steps; at 120 FPS, one step every other frame; at 50 FPS, mostly one and now and then two. Leftover time is never lost: it waits in the accumulator for the next frame. The `0.25` cap comes from Fiedler's code; *our reading:* after a long pause, such as a tab left in the background, the engine skips ahead instead of replaying every lost step.

### The spiral of death

If computing a step takes longer than the time it simulates, the engine falls behind. To catch up it runs more steps per frame, which takes even longer, and so on until the page freezes. Fiedler calls it the spiral of death.

Two defences: leave headroom, so a step costs much less than the 16.7 ms it simulates; and clamp. Clamping the frame time to 0.25 s still allows up to 15 steps in one frame, so clamping the number of steps per frame is the tighter defence. The price is the same either way: under heavy load the simulation runs slower than real time.

### Render interpolation

Leftover time makes the motion stutter. At 50 FPS with steps of 1/60 s, a frame lasts 20 ms:

| Frame | Steps run | Left over | alpha | Picture moves, latest step | Picture moves, blended |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 6.7 ms | 0.4 | 16.7 ms | 20 ms |
| 2 | 1 | 10.0 ms | 0.6 | 16.7 ms | 20 ms |
| 3 | 1 | 13.3 ms | 0.8 | 16.7 ms | 20 ms |
| 4 | 2 | 0 ms | 0 | 33.3 ms | 20 ms |
| 5 | 1 | 3.3 ms | 0.2 | 16.7 ms | 20 ms |

Drawing the latest step, the picture advances 16.7 ms four times and then jumps 33.3 ms: that is the stutter. The fix is to draw a blend of the last two states, a linear interpolation like three.js `lerp`, weighted by `alpha = accumulator / STEP`. Every frame then advances exactly the 20 ms that really passed. The cost: the picture is always exactly one step, 16.7 ms, behind the simulation.

## Choices and trade-offs

Fiedler builds the loop in four stages:

| Approach | What it does | Problem |
| --- | --- | --- |
| Variable step (`deltaTime`) | Physics follows the frame | Results change with the frame rate, and long frames can explode |
| Semi-fixed step | Splits long frames into steps below a maximum | Steps still differ in length |
| Fixed step and accumulator | The same step every time | Stutter |
| Fixed step and interpolation | The same step, smooth picture | One step of lag, two states to keep |

A smaller step is more stable and more expensive. 1/60 s is a common choice, the one Box2D suggests, and stiff systems add [substeps](./integration.md#substeps) inside each step.

## On the GPU

The loop itself stays in JavaScript: it decides how many steps to run, and each step becomes a batch of commands for the GPU. Sending commands does not wait for them to finish, so JavaScript can move on while the GPU computes. *Our reading, not tested yet:* if the GPU is slower than the frame, its work piles up and frames slow down anyway, so the spiral of death must be watched on GPU time too, which WebGPU can measure with timestamp queries. Blending needs both states on the GPU: two copies of each buffer, swapped at every step.

## In FORCE

Not yet: [hello-compute](../../examples/hello-compute/main.ts) runs one single step of 0.1 s. The fixed-step loop will be one of the first pieces of the engine.

## Check yourself

1. Rendering at 30 FPS with a 1/60 s step: how many steps run per frame, and what is left in the accumulator?
2. What starts the spiral of death, and what does clamping cost?
3. Why does `alpha` remove the stutter, and what does it cost?

To experiment, run `node docs/topics/fixed-timestep.mjs` and change the frame rate.

## Sources

- [Glenn Fiedler, Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/) (2004): variable and semi-fixed steps, the accumulator, the spiral of death, clamping and interpolation.
- [Box2D, Hello Box2D](https://github.com/erincatto/box2d/blob/main/docs/hello.md): 1/60 s as the suggested step.
- [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a): where we first met the loop with a limit on steps.
- [fixed-timestep.mjs](./fixed-timestep.mjs): our experiment, behind the frame table.
