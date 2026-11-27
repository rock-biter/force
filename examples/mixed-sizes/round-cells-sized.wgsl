// A round with no lists of neighbours, for particles of different sizes: a copy of
// heap-simulation/round-cells.wgsl, where the search through the cells is explained. Two particles
// overlap by their two radii less their distance, and a plane or the ball pushes a particle by its
// own radius, read from `properties`. Only with the particles kept in the order of the book: with
// the book as well, this shader would read 9 storage buffers.

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
@group(0) @binding(10) var<storage, read> properties: array<vec4f>; // x: the radius, in meters, z: the body
@group(0) @binding(11) var<storage, read> book: array<u32>;

// The side kept (decision 046): a push goes along the line the two centers were on when the
// substep began, not the one they are on now, and asks that they stay a diameter apart along it.
// A particle that got past another in this substep is then pushed back to the side it came from.
// Not between two particles of one body, a cloth or a rope: a fold that has crossed another must
// be free to cross back, and the springs pull it. The body is the third of the properties, a
// whole number from 1 on, or 0 for a particle that belongs to none.
// ?kept=0 in the address writes `false` here, to compare with the push as it was.
const SIDE_KEPT = true;

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
  let radius = properties[i].x;
  let body = properties[i].z;
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
          if (j == i) {
            continue;
          }
          let other = before[j];
          let theirKind = properties[j];
          let diameter = radius + theirKind.x; // where these two just touch
          let away = p - other.xyz;
          let squared = dot(away, away);
          if (squared >= diameter * diameter || squared == 0.0) {
            continue;
          }
          let distance = sqrt(squared);
          // the side kept: the way out is the one the two had when the substep began
          var out = away / distance;
          var overlap = diameter - distance;
          let was = start[i].xyz - start[j].xyz;
          let wasFar = length(was);
          let apart = body == 0.0 || body != theirKind.z; // not two of one body
          if (SIDE_KEPT && apart && wasFar > 0.0) {
            out = was / wasFar;
            overlap = diameter - dot(away, out);
          }
          // The lower of two particles in a pile looks heavier (levels, chapter 029).
          var tilt = 1.0;
          let theirs = levels[j];
          if (params.levelStrength > 0.0 && level != NO_LEVEL && theirs != NO_LEVEL) {
            tilt = exp(params.levelStrength * (f32(level) - f32(theirs)));
          }
          let wi = mine * tilt;
          let wj = lightness(other.w);
          sum += out * (overlap * wi / (wi + wj));
          n += 1.0;
          if (rubbing) {
            let theirSlide = other.xyz - start[j].xyz;
            back += rub(slid - theirSlide, out, overlap) * (wi / (wi + wj));
          }
        }
      }
    }
  }
  for (var k = 0u; k < params.planeCount; k++) {
    let plane = planes[k];
    let overlap = radius - (dot(p, plane.xyz) - plane.w);
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
    let overlap = pointer.radius + radius - distance;
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
