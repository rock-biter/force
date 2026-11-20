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

*Updated November 20, 2026*

**Latest step:** [a box that tilts](./docs/logbook/035-the-grid-stays-still.md). Our particles now
have friction, so a heap stands in a pile instead of flowing like a liquid
([how](./docs/logbook/034-the-box-on-the-ramp.md)). On a new live page
([try it](https://rock-biter.github.io/force/force-tilt/)) you can tilt their box by up to 30
degrees and watch the pile hold, then slide. Getting there taught us to keep the grid that finds
neighbouring particles fixed in the world, and to let the box turn inside it.

**Next:** a better way to find which particles are near each other, without the limit of four per
cell of today's grid.

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
| `examples/` | The website: home page, demos and the lab  |

## Contributing

FORCE is studied in the open. If you know a paper, a talk or an engine worth studying, or you spot a
mistake in the docs, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
