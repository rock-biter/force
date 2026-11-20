// The list of neighbours, step c: the grid of chapter 024, only when the list is made again.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> places: array<u32>;
@group(0) @binding(4) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions) || !rebuild()) {
    return;
  }
  let cell = cellIndex(cellCoords(positions[i].xyz));
  let place = atomicAdd(&counts[cell], 1u);
  if (place < params.places) {
    places[cell * params.places + place] = i;
  } else {
    atomicAdd(&control[5], 1u); // the cell is full: nobody will find this particle
  }
}
