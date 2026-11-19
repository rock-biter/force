// Step 3: one pass of levels in the pile (chapter 029). 0 on the floor, one more than the lowest
// particle this one rests on, none if it rests on nothing. Last step's levels are the start, so a
// pile of 10 needs 10 steps to be right.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read> counts: array<u32>;
@group(0) @binding(3) var<storage, read> places: array<u32>;
@group(0) @binding(4) var<storage, read> planes: array<vec4f>; // normal in xyz, offset in w
@group(0) @binding(5) var<storage, read> before: array<u32>;   // last step's levels
@group(0) @binding(6) var<storage, read_write> levels: array<u32>;

const RESTS = 0.001; // touching, within 1 mm
const BELOW = 0.5;   // the other one is below: within 60 degrees of straight down

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions)) {
    return;
  }
  let p = positions[i].xyz;
  var level = NO_LEVEL;
  for (var k = 0u; k < params.planeCount; k++) {
    let plane = planes[k];
    if (plane.y > BELOW && dot(p, plane.xyz) - plane.w - params.radius < RESTS) {
      level = 0u;
    }
  }
  let home = cellCoords(p);
  for (var dz = -1; dz <= 1; dz++) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let c = home + vec3i(dx, dy, dz);
        if (any(c < vec3i(0)) || any(c >= vec3i(params.size))) {
          continue;
        }
        let cell = cellIndex(c);
        let count = min(counts[cell], params.places);
        for (var s = 0u; s < count; s++) {
          let j = places[cell * params.places + s];
          let under = before[j];
          if (j == i || under == NO_LEVEL) {
            continue;
          }
          let away = p - positions[j].xyz;
          let distance = length(away);
          if (distance - 2.0 * params.radius < RESTS && away.y > BELOW * distance) {
            level = min(level, under + 1u);
          }
        }
      }
    }
  }
  levels[i] = level;
}
