![FORCE, GPU physics engine: illustration of a cube of blue particles collapsing onto a grid](./force-cover.png)

# FORCE

A GPU-first physics engine for the web, built on [WebGPU](https://www.w3.org/TR/webgpu/).

> **Status: early development.** There is no physics engine here yet and the package is not
> published on npm. The API will change without notice.

## Goals

- Run the simulation on the GPU with WebGPU compute shaders.
- Stay independent of any rendering library.
- Add a WebGL fallback later on.

## Requirements

A [browser with WebGPU support](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status),
on a page served from HTTPS or localhost.

The WebGPU types are built into TypeScript 6 and later. On TypeScript 5, also install
[`@webgpu/types`](https://www.npmjs.com/package/@webgpu/types).

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
```

| Path        | Contents                                   |
| ----------- | ------------------------------------------ |
| `src/`      | The library                                |
| `test/`     | Unit tests                                 |
| `examples/` | Runnable demos, importing from `force-gpu` |

## Contributing

FORCE is studied in the open. If you know a paper, a talk or an engine worth studying, or you spot a
mistake in the docs, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
