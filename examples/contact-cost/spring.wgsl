// The spring way, one substep: every overlap pushes with a spring and a damper, measured in hertz
// as Box2D does (chapter 029). A contact's stiffness is m × ω², where m is the mass it has to move,
// both bodies seen as one, so a heavy body sinks no deeper than a light one. Each thread adds up the
// forces on its own particle and moves it, reading every position and velocity from the substep
// before and writing its own in other buffers.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positionsBefore: array<vec4f>;
@group(0) @binding(2) var<storage, read> velocitiesBefore: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> positionsAfter: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> velocitiesAfter: array<vec4f>;
@group(0) @binding(5) var<storage, read> counts: array<u32>;
@group(0) @binding(6) var<storage, read> places: array<u32>;
@group(0) @binding(7) var<storage, read> planes: array<vec4f>;

// The force of one contact along `normal`: m is the mass the contact moves, closing the speed at
// which the two meet. A damper ratio of 1 stops a bounce with no rebound.
fn contact(m: f32, overlap: f32, closing: f32) -> f32 {
  let omega = params.omega;
  return m * omega * omega * overlap - 2.0 * params.damper * m * omega * closing;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positionsBefore)) {
    return;
  }
  let me = positionsBefore[i];
  let w = me.w; // 1 / mass
  if (w == 0.0) {
    positionsAfter[i] = me;
    velocitiesAfter[i] = velocitiesBefore[i];
    return;
  }
  let p = me.xyz;
  var v = velocitiesBefore[i].xyz;
  let diameter = 2.0 * params.radius;
  var force = params.gravity / w;

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
          if (j == i) {
            continue;
          }
          let other = positionsBefore[j];
          let away = p - other.xyz;
          let squared = dot(away, away);
          if (squared >= diameter * diameter || squared == 0.0) {
            continue;
          }
          let distance = sqrt(squared);
          let normal = away / distance;
          let closing = dot(v - velocitiesBefore[j].xyz, normal);
          force += normal * contact(1.0 / (w + other.w), diameter - distance, closing);
        }
      }
    }
  }
  for (var k = 0u; k < params.planeCount; k++) {
    let plane = planes[k];
    let overlap = params.radius - (dot(p, plane.xyz) - plane.w);
    if (overlap > 0.0) {
      force += plane.xyz * contact(1.0 / w, overlap, dot(v, plane.xyz));
    }
  }
  v += force * w * params.substep;
  positionsAfter[i] = vec4f(p + v * params.substep, w);
  velocitiesAfter[i] = vec4f(v, 0.0);
}
