// The list of neighbours, step d: each particle writes down every other one closer than a diameter
// plus the margin, from the cells around it, and where it is now. Only when the list is made again.

const MAX_NEIGHBOURS = 32u;

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read> counts: array<u32>;
@group(0) @binding(3) var<storage, read> places: array<u32>;
@group(0) @binding(4) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(5) var<storage, read_write> neighbours: array<u32>;
@group(0) @binding(6) var<storage, read_write> neighbourCounts: array<u32>;
@group(0) @binding(7) var<storage, read_write> anchors: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions) || !rebuild()) {
    return;
  }
  if (i == 0u) {
    atomicAdd(&control[3], 1u);
  }
  let p = positions[i].xyz;
  let reach = 2.0 * params.radius + params.margin;
  var n = 0u;
  let home = cellCoords(p);
  // How many cells away a neighbour can be: 1 when the cell is as wide as the reach, 3 × 3 × 3
  // cells in all, and 2 when the margin makes the reach longer than a cell, 5 × 5 × 5.
  let span = i32(ceil(reach / params.cell - 0.001));
  for (var dz = -span; dz <= span; dz++) {
    for (var dy = -span; dy <= span; dy++) {
      for (var dx = -span; dx <= span; dx++) {
        let c = home + vec3i(dx, dy, dz);
        if (any(c < vec3i(0)) || any(c >= vec3i(params.size))) {
          continue;
        }
        let cell = cellIndex(c);
        let count = min(counts[cell], params.places);
        for (var s = 0u; s < count; s++) {
          let j = places[cell * params.places + s];
          let away = p - positions[j].xyz;
          if (j == i || dot(away, away) >= reach * reach) {
            continue;
          }
          if (n < MAX_NEIGHBOURS) {
            neighbours[i * MAX_NEIGHBOURS + n] = j;
            n++;
          } else {
            atomicAdd(&control[4], 1u);
          }
        }
      }
    }
  }
  neighbourCounts[i] = n;
  anchors[i] = positions[i];
}
