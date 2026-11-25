// The levels of the pile with no lists of neighbours, for particles of different sizes: a copy of
// heap-simulation/levels-cells.wgsl. A particle rests on the floor, or on another, by its own
// radius, read from `properties`.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read> counts: array<u32>;
@group(0) @binding(3) var<storage, read> starts: array<u32>;
@group(0) @binding(4) var<storage, read> planes: array<vec4f>; // normal in xyz, offset in w
@group(0) @binding(5) var<storage, read> before: array<u32>;   // last step's levels
@group(0) @binding(6) var<storage, read_write> levels: array<u32>;
@group(0) @binding(7) var<storage, read> properties: array<vec4f>; // x: the radius, in meters
@group(0) @binding(8) var<storage, read> book: array<u32>;

const RESTS = 0.001; // touching, within 1 mm
const BELOW = 0.5;   // the other one is below: within 60 degrees of straight down

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions)) {
    return;
  }
  let p = positions[i].xyz;
  let mine = properties[i].x;
  var level = NO_LEVEL;
  for (var k = 0u; k < params.planeCount; k++) {
    let plane = planes[k];
    if (plane.y > BELOW && dot(p, plane.xyz) - plane.w - mine < RESTS) {
      level = 0u;
    }
  }
  let slots = arrayLength(&counts);
  let home = cellOf(p);
  let clash = clashing(home, slots); // in a table: do two of the 27 cells share a slot?
  for (var dz = -1; dz <= 1; dz++) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let c = home + vec3i(dx, dy, dz);
        // In a table two of these 27 cells can share a slot: it is read once, for the first.
        if (!known(c) || (clash && repeated(home, vec3i(dx, dy, dz), slots))) {
          continue;
        }
        let cell = slot(c, slots);
        let first = starts[cell];
        for (var s = 0u; s < counts[cell]; s++) {
          let j = book[first + s];
          let under = before[j];
          if (j == i || under == NO_LEVEL) {
            continue;
          }
          let away = p - positions[j].xyz;
          let distance = length(away);
          if (distance - mine - properties[j].x < RESTS && away.y > BELOW * distance) {
            level = min(level, under + 1u);
          }
        }
      }
    }
  }
  levels[i] = level;
}
