# Create a pipeline now, or wait for it?

*WebGPU mini guide · 4 min read · Code: [examples/pipeline-creation](../../examples/pipeline-creation/main.ts) · Read first: [pipelines](./pipelines.md)*

**In short:** both ways compile the same shader in the same time, and neither blocks your JavaScript. The difference is what waits meanwhile: with `createComputePipeline()`, everything else you send to the GPU can be held up, and in Chrome it is; with `createComputePipelineAsync()`, only the code that needs that pipeline.

## The idea

In JavaScript, "sync or async" usually means "does my script freeze?", as with `fs.readFileSync()` and `fs.readFile()`. Here it does not. Your script never compiles anything: it sends orders to another part of the browser, often a separate process, which talks to the GPU. That part takes the orders one at a time, in the order they arrive.

Think of a kitchen with one cook, and you as the waiter.

- **Immediate.** You hand over the order "learn this new recipe" and walk away at once, with a ticket for the dish. The cook stops and studies the recipe. Every order you bring after that waits on the counter, even a glass of water.
- **Async.** An assistant studies the recipe in the back room, and rings a bell when it is ready. Meanwhile the cook keeps serving.

The recipe takes the same time to learn in both cases. Who the assistant is, the spec does not say: a browser is free to use another thread, for example. three.js has a similar pair for WebGL, `renderer.compile()` and `renderer.compileAsync()`.

The spec has names for the three places. You, the waiter, are the *content timeline*: your script. The cook is the *device timeline*: the browser's part that creates buffers and pipelines and passes work on. The stove is the *queue timeline*: the GPU doing the actual work.

## The code

The example times both ways. Right after asking for the pipeline, it sends the GPU a tiny job that has nothing to do with it, and measures how long that job takes:

```ts
const start = performance.now()
if (mode === 'immediate') {
  pipeline = device.createComputePipeline(descriptor)
} else {
  pending = device.createComputePipelineAsync(descriptor)
}
const call = performance.now() - start

// The unrelated job: sixteen bytes into a buffer the pipeline never touches.
device.queue.writeBuffer(scratch, 0, new Float32Array(4))
const otherWork = device.queue.onSubmittedWorkDone().then(() => performance.now() - start)

pipeline ??= await (pending as Promise<GPUComputePipeline>)
```

- `descriptor` is the same object of options for both calls; `mode` says which of the two this run is timing, and `scratch` is a 16-byte buffer made only for this.
- `onSubmittedWorkDone()` returns a promise that resolves when the GPU has finished everything sent so far. It is our stopwatch for the glass of water.
- The last line is the whole price of the async way: an `await` before the pipeline can be used.

What it printed, in milliseconds, the median of 5 runs. A frame at 60 per second lasts 16.7. "First run done" is when the new pipeline has run once and the GPU has finished:

| Shader | Way | The call returns | The other job waits | First run done |
| --- | --- | --- | --- | --- |
| [`integrate.wgsl`](../../src/shaders/integrate.wgsl), FORCE's own | immediate | 0.0 | 12.8 | 13.2 |
| | async | 0.0 | 0.1 | 13.2 |
| A hundred lines of trigonometry | immediate | 0.0 | 141.0 | 141.4 |
| | async | 0.0 | 0.1 | 145.9 |

Three things to read in it. The call returns at once in both ways. The first run is done after about the same time in both ways. Only "The other job waits" changes: 141 ms is eight frames in which our tiny write did not get through. We did not time a draw, but its commands would stand in the same line.

These numbers come from one machine, an Apple M1 with Chrome 157 run headless, that is with no window, on November 13, 2026. They show the shape of the difference, not what a phone will do.

## What else changes

| | Immediate | Async |
| --- | --- | --- |
| You get | a pipeline, at once | a promise |
| In code that cannot `await`, such as a constructor | usable at once | you can only keep the promise for later |
| A mistake in the pipeline | an invalid pipeline and an error in the console | the promise rejects with a `GPUPipelineError`, which `try`/`catch` can handle |
| Who waits for the compiler | all the GPU work sent after it | only what awaits the promise |

Where exactly the immediate way stalls is left open by the spec: at creation, at the first use, or when the commands are sent. In our measure with Chrome it was at creation. A browser that stalled at the first use would show about 0 in "The other job waits", and the wait would move to the first frame that uses the pipeline.

## Common mistakes

- **Expecting the async way to be faster.** It is not: 13.2 ms against 13.2 for the first run, and 141.4 against 145.9 with the long shader. It moves the wait, it does not shorten it.
- **Timing the call.** `createComputePipeline()` returns in 0.0 ms, so a stopwatch around it says pipelines are free. Time the work that comes after, as the example does.
- **Measuring the same shader twice.** Browsers keep what they have compiled. In Chrome, with the immediate way the other job waited 141 ms the first time the long shader was used and 0.3 ms the second, in the same page. The example changes one number in the shader at every run for this reason.
- **Not catching the rejection.** With the async way a wrong pipeline is an exception at the `await`. With no `catch`, it ends up as an unhandled rejection.

## Where FORCE uses it

[`World`](../../src/world.ts) creates its one pipeline the immediate way, inside its constructor, and a constructor cannot `await`. Today that costs about 13 ms on the machine above, once, before the first frame, when nothing else is being drawn yet. It would start to matter with a world created in the middle of a game, with longer shaders, or on slower devices. `World.create()`, the function that calls the constructor, is already async and could await the pipeline first, so moving is possible; the choice is still open.

## Try it

Run `npm run dev`, open `pipeline-creation`, and read your own numbers; a phone on the same network is the interesting one. Then, in [`main.ts`](../../examples/pipeline-creation/main.ts), make `forceShader()` return `integrateCode` unchanged: from the second run on the browser recognizes the text, and the wait all but disappears.

## Sources

- [WebGPU specification](https://www.w3.org/TR/webgpu/): the three timelines, and that they may live in separate processes ([timelines](https://www.w3.org/TR/webgpu/#programming-model-timelines)); the immediate way returns at once though creation is not finished, can stall at a point left unspecified, and the async way is preferred ([pipelines](https://www.w3.org/TR/webgpu/#pipelines), [compute pipeline creation](https://www.w3.org/TR/webgpu/#compute-pipeline-creation)).
- [MDN, GPUDevice.createComputePipelineAsync()](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createComputePipelineAsync): the promise resolves when the pipeline can be used "without additional delay", and rejects with a `GPUPipelineError`.
- [Firefox bug 1878449, comment 5](https://bugzilla.mozilla.org/show_bug.cgi?id=1878449#c5): a Firefox engineer gives the async methods as best practice, since the immediate ones are hard to keep from blocking the work that follows.
- [three.js r187, WebGLRenderer.js](https://github.com/mrdoob/three.js/blob/r187/src/renderers/WebGLRenderer.js): `compileAsync()` is the "asynchronous version" of `compile()`, recommended "whenever possible".
- The numbers are our own measure, with [examples/pipeline-creation](../../examples/pipeline-creation/main.ts). That Chrome answers a known shader from a cache is what we saw (141 ms, then 0.3 ms), not something we read in its documentation.

## For an article or video

- **Hook:** `createComputePipeline()` returns in zero milliseconds. So where did the 141 go?
- **Show:** the table, then the kitchen with one cook.
- **Takeaway:** async does not make the compiler faster. It decides who waits for it.
