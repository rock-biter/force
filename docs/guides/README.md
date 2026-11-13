# WebGPU mini guides

Short guides, one concept each, built from the code of FORCE. They are written for developers who know JavaScript, and maybe three.js or GLSL, but are new to WebGPU.

## Guides

| Guide | The concept |
| --- | --- |
| [How do you get access to the GPU?](./adapter-and-device.md) | Adapter and device |
| [How do you send data to the GPU?](./buffers.md) | Buffers |
| [What does a compute shader look like?](./compute-shader.md) | Compute shaders and WGSL |
| [How do you prepare a shader to run?](./pipelines.md) | Pipelines |
| [Create a pipeline now, or wait for it?](./pipeline-creation.md) | Immediate and async pipeline creation |

## Planned

The first series comes from [`examples/hello-compute`](../../examples/hello-compute/main.ts) and from the engine's first loop, [`src/world.ts`](../../src/world.ts) with its shader [`integrate.wgsl`](../../src/shaders/integrate.wgsl), which already use these concepts:

- [x] How do you get access to the GPU? (adapter and device)
- [x] How do you send data to the GPU? (buffers)
- [x] What does a compute shader look like? (WGSL)
- [x] How do you prepare a shader to run? (pipelines)
- [x] Create a pipeline now, or wait for it? (immediate and async pipeline creation, from [`examples/pipeline-creation`](../../examples/pipeline-creation/main.ts))
- [ ] How does a shader find its data? (bind groups)
- [ ] How do you make thousands of threads work? (dispatch and workgroups)
- [ ] When does the GPU actually run? (commands and queue)
- [ ] How do you get the results back? (readback)
- [ ] How do you give every thread the same values? (uniform buffers)
- [ ] Why does a vec3f take 16 bytes? (memory alignment)
- [ ] How do two libraries share GPU data? (one device, one buffer, from [`examples/debug`](../../examples/debug/viewer.ts))
