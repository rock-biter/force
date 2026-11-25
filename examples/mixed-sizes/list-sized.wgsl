// The list of neighbours for particles of different sizes (decision 031): a copy of
// heap-simulation/book-list.wgsl, which the benchmark page times and must stay as it is.
//
// What changes. Two particles are neighbours when closer than their two radii plus the margin,
// each radius read from `properties`. And a particle's row of `neighbours` now begins with how
// many they are, then the neighbours: 33 numbers, not 32. That frees the buffer of the counts,
// so that with the properties this shader still reads 8 storage buffers, all a device gives
// unless asked for more (decision 032).

const MAX_NEIGHBOURS = 32u;
const ROW = 33u; // a particle's row: the count, then up to 32 neighbours

@group(0) @binding(0) var<uniform> params: Params; // params.radius is the largest radius
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read> counts: array<u32>;
@group(0) @binding(3) var<storage, read> starts: array<u32>;
@group(0) @binding(4) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(5) var<storage, read_write> neighbours: array<u32>;
@group(0) @binding(6) var<storage, read> properties: array<vec4f>; // x: the radius, in meters
@group(0) @binding(7) var<storage, read_write> anchors: array<vec4f>;
@group(0) @binding(8) var<storage, read> book: array<u32>;

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
  let mine = properties[i].x;
  // The furthest a neighbour can be: two of the largest, and the margin. The cells are that wide,
  // so 3 × 3 × 3 of them are enough.
  let furthest = 2.0 * params.radius + params.margin;
  var n = 0u;
  let slots = arrayLength(&counts);
  let home = cellOf(p);
  let span = i32(ceil(furthest / params.cell - 0.001));
  for (var dz = -span; dz <= span; dz++) {
    for (var dy = -span; dy <= span; dy++) {
      for (var dx = -span; dx <= span; dx++) {
        let c = home + vec3i(dx, dy, dz);
        if (!known(c)) {
          continue;
        }
        let cell = slot(c, slots);
        let first = starts[cell];
        for (var s = 0u; s < counts[cell]; s++) {
          let j = book[first + s];
          let other = positions[j].xyz;
          let away = p - other;
          let reach = mine + properties[j].x + params.margin;
          // In a table two cells can share a slot: a particle counts only for the cell it is in,
          // or it would be found once for each of them.
          if (j == i || dot(away, away) >= reach * reach || any(cellOf(other) != c)) {
            continue;
          }
          if (n < MAX_NEIGHBOURS) {
            neighbours[i * ROW + 1u + n] = j;
            n++;
          } else {
            atomicAdd(&control[4], 1u);
          }
        }
      }
    }
  }
  neighbours[i * ROW] = n;
  anchors[i] = positions[i];
}
