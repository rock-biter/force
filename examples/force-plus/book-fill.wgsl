// The address book, step 5: every particle takes the last free row of its cell's part, with
// atomicSub, the ticket machine run backward (it returns the value from before, like atomicAdd),
// and writes its own number there. When all are in, `ends` holds where each part begins.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> ends: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> book: array<u32>;
@group(0) @binding(4) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions) || !rebuild()) {
    return;
  }
  let cell = slot(cellOf(positions[i].xyz), arrayLength(&ends));
  book[atomicSub(&ends[cell], 1u) - 1u] = i;
}
