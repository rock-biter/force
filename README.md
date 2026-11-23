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

*Updated November 23, 2026*

**Latest steps:** chapters [038](./docs/logbook/038-one-hundred-twenty-five-cells.md),
[039](./docs/logbook/039-far-apart-in-memory.md) and [040](./docs/logbook/040-the-table.md). To find
which particles touch, each one looks into the small cells of space around it
([try it](https://rock-biter.github.io/force/force-tilt/)). We timed every part of a step and found
that this search took most of it: each particle read 125 cells where we believed 27, and the way of
storing the cells we liked best scattered them in memory. With both fixed, a pile of 50 000 particles
in a corner takes 8 ms a step instead of 13, loses no particle, and the cells cost 1 MB whatever the
size of the world.

Then we moved the particles themselves into the order of their cells
([chapter 041](./docs/logbook/041-next-to-each-other.md)): faster again, and much more so with one
way of storing the cells than with the one we had just chosen.

Last, a study with [charts](https://rock-biter.github.io/force/cells-study/) of what makes one way
better than another: the size of the world, above all
([chapter 042](./docs/logbook/042-no-best-way.md)).

**You can help:** [run the benchmark](https://rock-biter.github.io/force/bench/) on your own device,
a computer or a phone, and send us the numbers ([chapter 043](./docs/logbook/043-other-peoples-devices.md)).

**Next:** the same measures on a phone.

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
