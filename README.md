![FORCE, GPU physics engine: illustration of a cube of blue particles collapsing onto a grid](./force-cover.png)

# FORCE

A GPU-first physics engine for the web, built on [WebGPU](https://www.w3.org/TR/webgpu/).

**[Documentation →](https://rock-biter.github.io/force/)** The website of the project. For now it
has the examples running in the browser, the logbook and the topic map in 3D. The full
documentation of the library will live there too.

> **Status: early development.** FORCE is being built in the open, one step at a time, and
> studying how physics engines work is part of the job. The package is not published on npm, and
> the API will change without notice.

## Where we are

*Updated November 18, 2026*

**Latest step:** [the price of copies](./docs/logbook/019-the-price-of-copies.md). On a GPU, two
rules such as "this link must stay 10 cm long" cannot write the same body at the same instant.
Either they take turns, or each works on its own copy of the body and the copies are averaged
([half a box](./docs/logbook/018-half-a-box.md)). We tried both on a hanging chain. Turns do as
well as a CPU. Copies need four times the passes over the rules, and with the springs Box2D uses
as rules the chain hangs twice as far below its length.

**Next:** measure in WebGPU what the two ways cost: one launch of a compute shader, and one trip
of data from the GPU back to JavaScript.

Every step, with what we learned and what went wrong, is in the [logbook](./docs/README.md).

## Goals

- Run the simulation on the GPU with WebGPU compute shaders.
- Stay independent of any rendering library.
- Add a WebGL fallback later on.

## Requirements

A [browser with WebGPU support](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status),
on a page served from HTTPS or localhost.

The WebGPU types are built into TypeScript 6 and later. On TypeScript 5, also install
[`@webgpu/types`](https://www.npmjs.com/package/@webgpu/types).

## Usage

```js
import { World } from 'force-gpu'

// x, y, z for each particle, in meters
const positions = new Float32Array([0, 10, 0, 1, 12, 0])
const world = await World.create({ device, positions })

function frame(frameTime) {
  // seconds since the last frame: the engine runs as many fixed steps as they hold
  world.update(frameTime)
}
```

**Give FORCE your renderer's GPU device.** A buffer created on one device cannot be used on
another, so if FORCE and your renderer each had their own, every position would have to travel
through the CPU between them. When no `device` is given, FORCE requests one of its own: fine for a
page that only simulates. Examples with three.js and other libraries will follow.

## Documentation

The development logbook and study notes are in [docs/](./docs/README.md).

## Development

```sh
npm install
npm run dev        # serve the examples
npm test           # run the unit tests
npm run typecheck  # check types
npm run lint       # check lint and formatting
npm run build      # build the package into dist/
npm run build:site # build the website into _site/
```

| Path        | Contents                                   |
| ----------- | ------------------------------------------ |
| `src/`      | The library                                |
| `test/`     | Unit tests                                 |
| `examples/` | The website: home page and runnable demos  |

## Contributing

FORCE is studied in the open. If you know a paper, a talk or an engine worth studying, or you spot a
mistake in the docs, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
