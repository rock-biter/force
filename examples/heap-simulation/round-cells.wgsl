// A study (chapter 050): the round of round-push.wgsl with no list of neighbours. Every round reads
// the address book itself, the 3 × 3 × 3 cells around the particle, as the shader that makes the
// lists does once. Nothing to keep between substeps, and two buffers fewer, the lists and the
// anchors; the price is the search, paid at every round. Only with ?lists=off in the address.
//
// The book was filed at the start of the substep and the particles have moved since, a little at
// each round: a particle is looked for in the cell where it was, not where it is. The cells must
// be a little wider than a particle for that, as the margin of the lists made them.

struct Pointer {
  center: vec3f, // meters
  radius: f32,   // meters; 0 when the pointer is away
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> before: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> after: array<vec4f>;
@group(0) @binding(3) var<storage, read> counts: array<u32>;
@group(0) @binding(4) var<storage, read> starts: array<u32>;
@group(0) @binding(5) var<storage, read> planes: array<vec4f>;
@group(0) @binding(6) var<storage, read> levels: array<u32>;
@group(0) @binding(7) var<uniform> pointer: Pointer;
@group(0) @binding(8) var<storage, read> start: array<vec4f>; // positions when the substep began
@group(0) @binding(9) var<uniform> friction: f32;             // µ, 0 for none
@group(0) @binding(10) var<storage, read> book: array<u32>;

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
  // Friction, in the same loop as the pushes: how far this particle has slid up to the last round.
  // With no friction nothing more is read than the pushes need.
  let rubbing = friction > 0.0;
  var slid = vec3f(0.0);
  if (rubbing) {
    slid = p - start[i].xyz;
  }
  var back = vec3f(0.0);

  let slots = arrayLength(&counts);
  let home = cellOf(p);
  for (var dz = -1; dz <= 1; dz++) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let c = home + vec3i(dx, dy, dz);
        if (!known(c)) {
          continue;
        }
        let cell = slot(c, slots);
        let first = starts[cell];
        for (var s = 0u; s < counts[cell]; s++) {
          let j = book[first + s];
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
          if (rubbing) {
            let theirSlide = other.xyz - start[j].xyz;
            back += rub(slid - theirSlide, away / distance, diameter - distance) * (wi / (wi + wj));
          }
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
      if (rubbing) {
        back += rub(slid, plane.xyz, overlap);
      }
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
  if (n > 0.0 && rubbing) {
    moved += back / n;
  }
  after[i] = vec4f(moved, me.w);
}
