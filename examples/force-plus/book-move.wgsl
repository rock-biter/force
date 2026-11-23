// The address book, step 6, only when the particles are kept in the order of the book: each row of
// the book takes the particle written there and copies what belongs to it, where it was when the
// substep began, where it is predicted to be and its level in the pile, into the same row of three
// spare buffers. book-settle.wgsl then copies them back. From then on particle number 7 is the one
// in row 7 of the book: the particles of a cell sit next to each other in memory, as Green and
// NVIDIA FleX keep them (chapter 041). Velocities are not moved: the end of the step writes them
// again from the positions.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(2) var<storage, read> book: array<u32>;
@group(0) @binding(3) var<storage, read> positions: array<vec4f>;
@group(0) @binding(4) var<storage, read> predicted: array<vec4f>;
@group(0) @binding(5) var<storage, read> levels: array<u32>;
@group(0) @binding(6) var<storage, read_write> movedPositions: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> movedPredicted: array<vec4f>;
@group(0) @binding(8) var<storage, read_write> movedLevels: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&book) || !rebuild()) {
    return;
  }
  let i = book[row];
  movedPositions[row] = positions[i];
  movedPredicted[row] = predicted[i];
  movedLevels[row] = levels[i];
}
