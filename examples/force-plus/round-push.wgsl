// Step 4, run 8 times: one round of half and half through the list of neighbours, as in
// contact-cost/round-list.wgsl, plus the ball under the pointer.
//
// The ball is a solid sphere: a particle that overlaps it is pushed out, straight away from its
// center, like by the planes of the floor and the walls. The page moves it a tenth of the way to
// the pointer in each step, at 20 m/s at most, and grows it in a few steps, so it pushes particles
// away instead of throwing them. It moves at every substep, a piece of the way each time.
//
// Then friction, as decision 020 sets it (chapter 034). Once the particle knows where this round's
// pushes bring it, every contact looks at how far the two have slid past each other since the start
// of the substep, across the line between them, and asks to take back up to µ × the overlap of
// that slide. The particle moves by the average of what its contacts ask. The ball has no
// friction: it only pushes.

struct Pointer {
  center: vec3f, // meters
  radius: f32,   // meters; 0 when the pointer is away
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> before: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> after: array<vec4f>;
@group(0) @binding(3) var<storage, read> neighbours: array<u32>;
@group(0) @binding(4) var<storage, read> neighbourCounts: array<u32>;
@group(0) @binding(5) var<storage, read> planes: array<vec4f>;
@group(0) @binding(6) var<storage, read> levels: array<u32>;
@group(0) @binding(7) var<uniform> pointer: Pointer;
@group(0) @binding(8) var<storage, read> start: array<vec4f>; // positions when the substep began
@group(0) @binding(9) var<uniform> friction: f32;             // µ, 0 for none

const MAX_NEIGHBOURS = 32u;

// How heavy the solver thinks a particle is, as 1 / m^alpha; 0 never moves.
fn lightness(w: f32) -> f32 {
  return select(pow(w, params.alpha), 0.0, w == 0.0);
}

// What one contact asks friction to take back: the part of `slide` across the way out `n`, all of
// it if it is shorter than µ × overlap (static friction), µ × overlap of it otherwise (kinetic).
fn rub(slide: vec3f, n: vec3f, overlap: f32) -> vec3f {
  let across = slide - n * dot(slide, n);
  let far = length(across);
  if (far == 0.0) {
    return vec3f(0.0);
  }
  return -across * min(friction * overlap / far, 1.0);
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

  for (var s = 0u; s < neighbourCounts[i]; s++) {
    let j = neighbours[i * MAX_NEIGHBOURS + s];
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
  for (var k = 0u; k < params.planeCount; k++) {
    let plane = planes[k];
    let overlap = params.radius - (dot(p, plane.xyz) - plane.w);
    if (overlap > 0.0) {
      sum += plane.xyz * overlap;
      n += 1.0;
    }
  }
  // The ball: like a plane, nothing pushes it back, so the particle takes the whole overlap.
  if (pointer.radius > 0.0) {
    let away = p - pointer.center;
    let distance = length(away);
    let overlap = pointer.radius + params.radius - distance;
    if (overlap > 0.0 && distance > 0.0) {
      sum += away / distance * overlap;
      n += 1.0;
    }
  }
  // half and half: half the sum plus half the average
  var moved = p;
  if (n > 0.0) {
    moved = p + sum * (0.5 + 0.5 / n);
  }
  if (n > 0.0 && friction > 0.0) {
    // The same contacts again, now that the pushes are known. A neighbour's slide is taken up to
    // where the last round left it: its pushes of this round are its own thread's business.
    let slid = moved - start[i].xyz;
    var back = vec3f(0.0);
    for (var s = 0u; s < neighbourCounts[i]; s++) {
      let j = neighbours[i * MAX_NEIGHBOURS + s];
      let other = before[j];
      let away = p - other.xyz;
      let squared = dot(away, away);
      if (squared >= diameter * diameter || squared == 0.0) {
        continue;
      }
      let distance = sqrt(squared);
      var tilt = 1.0;
      let theirs = levels[j];
      if (params.levelStrength > 0.0 && level != NO_LEVEL && theirs != NO_LEVEL) {
        tilt = exp(params.levelStrength * (f32(level) - f32(theirs)));
      }
      let wi = mine * tilt;
      let wj = lightness(other.w);
      let theirSlide = other.xyz - start[j].xyz;
      back += rub(slid - theirSlide, away / distance, diameter - distance) * (wi / (wi + wj));
    }
    for (var k = 0u; k < params.planeCount; k++) {
      let plane = planes[k];
      let overlap = params.radius - (dot(p, plane.xyz) - plane.w);
      if (overlap > 0.0) {
        back += rub(slid, plane.xyz, overlap);
      }
    }
    moved += back / n;
  }
  after[i] = vec4f(moved, me.w);
}
