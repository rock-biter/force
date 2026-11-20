// The address book, step 1: every particle adds 1 to the counter of its cell's slot, and nothing
// else.
// The address book is the other way to keep the grid (chapter 024): not 4 places per cell, but one
// long list of all the particles, sorted by cell, so a cell is never full. Only when the list of
// neighbours is made again.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions) || !rebuild()) {
    return;
  }
  // which slot a cell has is said by cells-grid.wgsl or cells-table.wgsl
  atomicAdd(&counts[slot(cellOf(positions[i].xyz), arrayLength(&counts))], 1u);
}
