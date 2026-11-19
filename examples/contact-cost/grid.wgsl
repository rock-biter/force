// Step 2: each particle takes a place in its cell, with the pigeonholes of chapter 024.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
// One counter per cell, shared by every thread: only atomic functions may touch it.
@group(0) @binding(2) var<storage, read_write> counts: array<atomic<u32>>;
// The places: the numbers of the particles in each cell.
@group(0) @binding(3) var<storage, read_write> places: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions)) {
    return;
  }
  let cell = cellIndex(cellCoords(positions[i].xyz));
  // The ticket machine: the value before the addition is this particle's place.
  let place = atomicAdd(&counts[cell], 1u);
  if (place < params.places) {
    places[cell * params.places + place] = i;
  } // a fifth particle writes nothing: it stays out of the grid
}
