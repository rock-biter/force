// Step 4, run 8 times: one round of position corrections with the half and half rule (chapter 026),
// compressed masses and levels (chapter 029). Each thread reads every position from the round
// before and writes only its own, in another buffer: nobody reads a position while it changes.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> before: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> after: array<vec4f>;
@group(0) @binding(3) var<storage, read> counts: array<u32>;
@group(0) @binding(4) var<storage, read> places: array<u32>;
@group(0) @binding(5) var<storage, read> planes: array<vec4f>;
@group(0) @binding(6) var<storage, read> levels: array<u32>;

// How heavy the solver thinks a particle is, as 1 / m^alpha; 0 never moves.
fn lightness(w: f32) -> f32 {
  return select(pow(w, params.alpha), 0.0, w == 0.0);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&before)) {
    return;
  }
  let me = before[i];
  if (me.w == 0.0) {
    after[i] = me;
    return;
  }
  let p = me.xyz;
  let mine = lightness(me.w);
  let level = levels[i];
  let diameter = 2.0 * params.radius;
  var sum = vec3f(0.0);
  var n = 0.0;

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
          let other = before[j];
          let away = p - other.xyz;
          let squared = dot(away, away);
          if (squared >= diameter * diameter || squared == 0.0) {
            continue;
          }
          let distance = sqrt(squared);
          // The lower of two particles in a pile looks heavier (levels, chapter 029).
          var tilt = 1.0;
          let theirs = levels[j];
          if (params.levelStrength > 0.0 && level != NO_LEVEL && theirs != NO_LEVEL) {
            tilt = exp(params.levelStrength * (f32(level) - f32(theirs)));
          }
          let wi = mine * tilt;
          let wj = lightness(other.w);
          sum += away / distance * ((diameter - distance) * wi / (wi + wj));
          n += 1.0;
        }
      }
    }
  }
  for (var k = 0u; k < params.planeCount; k++) {
    let plane = planes[k];
    let overlap = params.radius - (dot(p, plane.xyz) - plane.w);
    if (overlap > 0.0) {
      sum += plane.xyz * overlap;
      n += 1.0;
    }
  }
  // half and half: half the sum plus half the average
  var moved = p;
  if (n > 0.0) {
    moved = p + sum * (0.5 + 0.5 / n);
  }
  after[i] = vec4f(moved, me.w);
}
