// The address book, step 6: the list of neighbours of contact-cost/list.wgsl, read from the address
// book instead of the 4 places per cell. A cell's particles are the rows of `book` from
// starts[slot] on, counts[slot] of them, however many they are, where slot is the cell's slot.

const MAX_NEIGHBOURS = 32u;

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read> counts: array<u32>;
@group(0) @binding(3) var<storage, read> starts: array<u32>;
@group(0) @binding(4) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(5) var<storage, read_write> neighbours: array<u32>;
@group(0) @binding(6) var<storage, read_write> neighbourCounts: array<u32>;
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
  let reach = 2.0 * params.radius + params.margin;
  var n = 0u;
  let slots = arrayLength(&counts);
  let home = cellOf(p);
  // How many cells away a neighbour can be: 1 when the cell is as wide as the reach, 3 × 3 × 3
  // cells in all, and 2 when the margin makes the reach longer than a cell, 5 × 5 × 5.
  let span = i32(ceil(reach / params.cell - 0.001));
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
          // In a table two cells can share a slot: a particle counts only for the cell it is in,
          // or it would be found once for each of them.
          if (j == i || dot(away, away) >= reach * reach || any(cellOf(other) != c)) {
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
