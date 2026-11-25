// The address book, step 7, only when the particles are kept in the order of the book: what
// book-move.wgsl copied into the spare buffers goes back into the real ones, row by row. Two
// passes, because a pass cannot read a buffer while other threads write it.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(2) var<storage, read> movedPositions: array<vec4f>;
@group(0) @binding(3) var<storage, read> movedPredicted: array<vec4f>;
@group(0) @binding(4) var<storage, read> movedLevels: array<u32>;
@group(0) @binding(5) var<storage, read_write> positions: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> predicted: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> levels: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&positions) || !rebuild()) {
    return;
  }
  positions[row] = movedPositions[row];
  predicted[row] = movedPredicted[row];
  levels[row] = movedLevels[row];
}
