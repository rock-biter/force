# How do threads share a counter?

*WebGPU mini guide · 4 min read · Code: [examples/contact-cost](../../examples/contact-cost/main.ts) · Read first: [compute shaders](./compute-shader.md), [dispatch and workgroups](./dispatch-and-workgroups.md)*

**In short:** when many threads add to the same number, reading it and writing it back loses counts. WGSL, the shader language of WebGPU, gives you *atomic* types: a counter declared `atomic<u32>`, which only special functions may touch, each call a single move that no other thread can split. `atomicAdd` returns the value from before, so it hands out numbers like a ticket machine.

## The idea

At a deli counter, two customers arrive at once. If each one read the number on a board, added one, and wrote it back, both would read 12 and both would write 13: one customer is lost. A ticket machine does "give me the number and raise it" as one move, so they get 12 and 13.

On a GPU thousands of threads run the same code at once, so this happens all the time. In FORCE every particle finds the cell of a grid it falls in and takes a place there. With a plain counter, `counts: array<u32>`, two particles of the same cell starting together go wrong:

```wgsl
let place = counts[cell];   // both threads read 0
counts[cell] = place + 1u;  // both write 1: the cell counts one particle, not two
```

Both write their number in place 0, and one of them vanishes from the grid.

`atomic<T>`, where `T` is `u32` or `i32`, is the ticket machine. A variable of that type can only be touched by the *atomic built-in functions*. `atomicLoad` reads it and `atomicStore` writes it. `atomicAdd`, `atomicSub`, `atomicMin`, `atomicMax`, `atomicAnd`, `atomicOr`, `atomicXor` and `atomicExchange` read, change and write in one indivisible move, and return the value from before.

Desktop GLSL has the same `atomicAdd` in its compute shaders, but WebGL has neither compute shaders nor atomics. three.js offers `atomicAdd()` in TSL, its way to write shaders in JavaScript, for the WebGPU renderer.

## The code

The grid of [`examples/contact-cost`](../../examples/contact-cost/main.ts), shortened. One counter per cell, 4 places per cell, one thread per particle:

```wgsl
@group(0) @binding(2) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> places: array<u32>;

// inside main(): i is this thread's particle, cellOf() turns a position into a cell number
let cell = cellOf(positions[i].xyz);
let place = atomicAdd(&counts[cell], 1u); // the value before the addition: my place
if (place < 4u) {
  places[cell * 4u + place] = i;          // write my number in my place
}
```

- An atomic is allowed only in a `storage` buffer with `read_write` access, or in `workgroup` memory, the memory the threads of one workgroup share.
- `&counts[cell]` is a pointer: atomic functions take the address of the counter, not its value.
- `places` is a plain array. No two threads ever get the same place, so plain writes are safe.
- A fifth particle in a cell gets place 4 and writes nothing. That is by design: the grid has room for 4 per cell, and for spheres that do not overlap a cell as wide as one holds 4 at most.

`atomicMax` keeps the largest value any thread offers. FORCE uses it for the largest distance any particle moved in a step, which is a float, while atomics take only integers. The trick: for floats that are not negative, the bits read as a `u32` are in the same order as the numbers, so the largest bits are the largest distance ([watch.wgsl](../../examples/contact-cost/watch.wgsl)):

```wgsl
atomicMax(&control[2], bitcast<u32>(moved)); // moved >= 0
// later, in another shader: bitcast<f32>(atomicLoad(&control[2]))
```

A counter must start at zero. The grid is built again at every step of the simulation, so before the dispatch JavaScript clears the counters:

```ts
const encoder = device.createCommandEncoder()
encoder.clearBuffer(counts) // fills the buffer with zeros
const pass = encoder.beginComputePass()
// … dispatch the shader above
```

`clearBuffer(buffer, offset?, size?)` writes zeros on the GPU, in order with the other commands. The buffer must be created with the `COPY_DST` usage flag, "can be copied into" (see [buffers](./buffers.md)), and `offset` and `size` must be multiples of 4.

## Common mistakes

- **Treating the counter as a number.** `counts[i] = 0u` fails to compile with *cannot assign 'u32' to 'atomic<u32>'*, and `counts[i] + 1u` with *no matching overload for 'operator + (atomic<u32>, u32)'*. Use `atomicStore(&counts[i], 0u)` and `atomicLoad(&counts[i])`.
- **A read-only buffer.** `var<storage, read>` with an atomic inside fails with *atomic variables in 'storage' address space must have 'read_write' access mode*.
- **Forgetting to clear.** Nothing fails, the results are just wrong. Three particles in one cell of 4 places, built three times without clearing: the first build gives them places 0, 1, 2; the second 3, 4, 5, and only one fits; the third 6, 7, 8, and all three are out of the grid. And `clearBuffer` on a buffer without `COPY_DST` is rejected: *usage (BufferUsage::Storage) doesn't include BufferUsage::CopyDst*.

## Where FORCE uses it

The grid that finds which particles touch, in [`examples/contact-cost`](../../examples/contact-cost/grid.wgsl). On an Apple M1 it places 108 000 particles in 67 microseconds, measured by the page with [timestamp queries](./timestamp-queries.md). And the largest move since the list of neighbours was made, with `atomicMax`, so that the GPU decides by itself when to make the list again ([decision 016](../decisions/016-a-list-made-when-needed.md)).

## Try it

The page builds each grid 21 times, to time it, and then checks the last one against the same grid worked out in JavaScript. Delete the `encoder.clearBuffer(counts)` line in its `build()` function and reload: the "same as JS" column turns to NO, because each build adds to the counts of the one before.

## Sources

- [WGSL, atomic types](https://www.w3.org/TR/WGSL/#atomic-types): `u32` or `i32`, only in `workgroup` or in `read_write` storage, and only touched by atomic functions.
- [WGSL, atomicAdd](https://www.w3.org/TR/WGSL/#atomic-add): returns the original value stored before the operation.
- [WGSL, atomicMax](https://www.w3.org/TR/WGSL/#atomic-rmw): keeps the larger value, and returns the one from before.
- [Wikipedia, IEEE 754](https://en.wikipedia.org/wiki/IEEE_754): the bits of single and double precision floats sort like sign-magnitude integers, so non-negative ones sort like unsigned integers.
- [MDN, GPUCommandEncoder.clearBuffer()](https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder/clearBuffer): fills with zeros; needs `COPY_DST`; offset and size multiples of 4.
- The error messages are Chrome 158's, collected by running each mistake on an Apple M1.

## For an article or video

- **Hook:** two threads add 1 to the same number, and the number goes up by 1.
- **Show:** the deli ticket machine, then the grid: particles vanish with a plain read and write, and all stay with `atomicAdd`.
- **Takeaway:** when threads share a counter, let `atomicAdd` hand out the numbers: the value it returns is yours alone.

## Questions

*Asked while reading this guide, and answered after checking the sources.*
