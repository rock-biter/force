// The levels of the pile for particles of different sizes (decision 031): a copy of
// contact-cost/levels-list.wgsl. A particle rests on the floor, or on another, by its own radius,
// read from `properties`. The rows of `neighbours` begin with their count: see list-sized.wgsl.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read> neighbours: array<u32>;
@group(0) @binding(3) var<storage, read> properties: array<vec4f>; // x: the radius, in meters
@group(0) @binding(4) var<storage, read> planes: array<vec4f>;     // normal in xyz, offset in w
@group(0) @binding(5) var<storage, read> before: array<u32>;       // last step's levels
@group(0) @binding(6) var<storage, read_write> levels: array<u32>;

const ROW = 33u;

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
  for (var s = 0u; s < neighbours[i * ROW]; s++) {
    let j = neighbours[i * ROW + 1u + s];
    let under = before[j];
    if (under == NO_LEVEL) {
      continue;
    }
    let away = p - positions[j].xyz;
    let distance = length(away);
    if (distance - mine - properties[j].x < RESTS && away.y > BELOW * distance) {
      level = min(level, under + 1u);
    }
  }
  levels[i] = level;
}
