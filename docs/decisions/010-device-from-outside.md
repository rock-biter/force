# 010 · The device comes from outside

*Accepted · November 11, 2026 · The user, after the guide on [adapters and devices](../guides/adapter-and-device.md#questions)*

**Decision:** we will let the app give FORCE its GPU device, so the engine can share the renderer's. Only when no device is given will FORCE create one of its own.

## Why

A device is the exclusive owner of what it creates: a buffer made on one device cannot be used on another. If three.js drew with one device and FORCE simulated on another, every position would have to travel through the CPU between them. Sharing one device keeps the data on the GPU, and keeps FORCE independent of any renderer, as the [README](../../README.md) promises.

## Not chosen

- **FORCE always creates its own device:** simple, but nothing could be shared with the renderer.
- **The app must always give a device:** one more step for a quick test, or for a page that only simulates.

## Consequences

- Creating a world is asynchronous, since a device may have to be requested: `await World.create({ device, positions })`.
- Who creates the device destroys it: `world.destroy()` destroys a device FORCE created, never one it was given.
- With a shared device, FORCE lives with the limits and features the renderer asked for.
- The docs must explain why giving the device matters, with examples for three.js and other libraries.

## Still open

- How each library exposes its device: to check, library by library, before writing the examples. three.js r187 checked in [decision 012](./012-renderers-read-the-gpu-buffer.md).
- What to do when the shared device is lost, since the simulation state lives on it.
