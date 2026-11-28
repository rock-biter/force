// A round where what lies on a cloth is pushed by the cloth's surface, not by its spheres: a copy
// of mixed-sizes/round-cells-sized.wgsl, where everything else is explained. A trial, for the
// page of this folder and for any page with cloths opened with ?surface= (chapter 077).
//
// A cloth is a net of spheres, and a push between two spheres goes along the line between their
// centers. To a grain lying on it the cloth is then a tray of dimples: with spheres as large as
// the grain, it leaves one only on a slope of more than 35 degrees. Two cloths on each other lock
// the same way, and stay a diameter apart however thin they are drawn. Here, between a particle
// of a cloth and a particle that is not of that cloth (a loose one, a grain, or one of another
// cloth), a contact is still made as before, when the two spheres overlap, but the push is one of
// these, as `surface.method` says:
//
// - AS_TODAY: the side kept, as between any two bodies.
// - DEEPEST: along the normal of the cloth at that particle (normals.wgsl), until the grain's
//   surface is `surface.half` from the plane that touches the cloth there: half the thickness of
//   the cloth. Every particle of the cloth in reach asks about the same, and our rule would add
//   them up and throw the grain back, so the grain takes one only, as one contact: the nearest
//   particle of the cloth (the name is from when it took the deepest).
// - BLENDED: the same, with all the particles in reach blended into one surface: their normals,
//   and how deep the grain is under each one's plane, weighed by the distance along the cloth,
//   as a normal is blended across a face when it is drawn. A plane the grain is above counts
//   too. A grain then feels less of the flat tiles the cloth is made of.
// - LARGE: the particle of the cloth pushes as a sphere `surface.large` times its radius, moved
//   back along the normal so that its top is `surface.half` above the cloth (Müller and
//   Chentanez 2011, made two-sided).
//
// Two cloths: each particle is a grain to the other cloth, with half a thickness for a radius,
// so the two rest a whole thickness apart, middle to middle. A particle can have a cloth above
// and one below, and their surfaces must not be blended into one: it keeps one surface for each
// body in reach, SLOTS at most, and each is one contact. A body past the last slot pushes as
// DEEPEST would, each of its particles on its own. With LARGE there are no slots: every large
// sphere of the other cloth is a contact of its own, as every sphere is today.
//
// With `surface.rounded`, in DEEPEST and BLENDED, the cloth ends with a rounded edge. Without it
// a grain up to a diameter past the last particle is still pushed along the normal, as if the
// cloth went on, flat, and a grain that comes from the side is thrown up or down. With it, for a
// grain that is past a particle where the net ends, the push goes along the line from the edge
// to the grain, until its surface is `surface.half` from the edge: half a cylinder along a
// border, a quarter of a sphere at a corner, and the side kept does not apply there.
//
// The side of the cloth a grain is on is the one it was on when the substep began. A particle of
// the cloth is pushed back by each loose grain on its own, with the same push the other way.
// Only with the particles kept in the order of the book.
//
// The normals are one buffer more than the round it copies reads, and that one reads 8 storage
// buffers already: all a device gives unless asked. So the floor and the walls, 6 planes at
// most, come in here as a uniform, a fixed array, from the same buffer the other shaders read
// as storage. A storage buffer is for what has no fixed length; a few planes do not need one.

struct Pointer {
  center: vec3f, // meters
  radius: f32,   // meters; 0 when the pointer is away
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> before: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> after: array<vec4f>;
@group(0) @binding(3) var<storage, read> counts: array<u32>;
@group(0) @binding(4) var<storage, read> starts: array<u32>;
@group(0) @binding(5) var<uniform> planes: array<vec4f, 6>; // see above
@group(0) @binding(6) var<storage, read> levels: array<u32>;
@group(0) @binding(7) var<uniform> pointer: Pointer;
@group(0) @binding(8) var<storage, read> start: array<vec4f>; // positions when the substep began
@group(0) @binding(9) var<uniform> friction: f32;             // µ, 0 for none
@group(0) @binding(10) var<storage, read> properties: array<vec4f>; // x: the radius, in meters, z: the body
@group(0) @binding(11) var<storage, read> normals: array<vec4f>; // two for each particle: normals.wgsl
@group(0) @binding(12) var<uniform> surface: Surface;

struct Surface {
  method: u32,
  half: f32,  // meters: half the thickness of a cloth
  large: f32, // LARGE: the radius of the sphere, in radii of the cloth's particle
  rounded: u32, // 1: a cloth ends with a rounded edge
}
const AS_TODAY = 0u;
const DEEPEST = 1u;
const BLENDED = 2u;
const LARGE = 3u;
const SLOTS = 4u;

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
  // the surfaces this particle lies on: one for each body in reach, the blend or the deepest
  let surfaced = surface.method != AS_TODAY;
  var slotBody: array<f32, SLOTS>;
  var slotOut: array<vec3f, SLOTS>;
  var slotOverlap: array<f32, SLOTS>;
  var slotShare: array<f32, SLOTS>;
  var slotSlide: array<vec3f, SLOTS>;
  var slotWeight: array<f32, SLOTS>;
  var slotWas: array<f32, SLOTS>;  // which side of the surface the particle began the substep on
  var slotRest: array<f32, SLOTS>; // how far from the surface its center rests
  var slotNear: array<f32, SLOTS>; // DEEPEST: the nearest particle of the cloth so far, squared
  var slotRim: array<vec3f, SLOTS>;  // past an edge of the cloth: the ways out from the edge...
  var slotRimFar: array<f32, SLOTS>; // ...and how far from it
  var taken = 0u;

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
          let j = first + s;
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
          let share = wi / (wi + wj);
          var slide = vec3f(0.0);
          if (rubbing) {
            slide = slid - (other.xyz - start[j].xyz);
          }
          // a particle of a cloth and one that is not of that cloth: the push of the surface
          let theirBody = theirKind.z;
          let both = body != 0.0 && theirBody != 0.0; // two cloths
          let onCloth = apart && (body != 0.0 || theirBody != 0.0);
          if (surfaced && onCloth) {
            let grain = theirBody != 0.0; // this particle lies on their cloth
            let turn = select(-1.0, 1.0, grain); // `away` goes to the grain, or from it
            let cloth = 2 * select(i, j, grain);
            let normal = normals[cloth].xyz;
            // toward the side the grain was on when the substep began
            var up = normal * select(-1.0, 1.0, dot(was, normal) * turn >= 0.0);
            let height = dot(away, up) * turn; // the grain above the plane of the cloth here
            // how far from the surface the grain's center rests: its radius, or half a cloth
            let grainRadius = select(select(theirKind.x, radius, grain), surface.half, both);
            if (surface.method == LARGE) {
              let large = surface.large * select(radius, theirKind.x, grain);
              let reach = away * turn + up * (large - surface.half); // from the large sphere's center
              let far = length(reach);
              overlap = large + grainRadius - far;
              out = reach / max(far, 1e-9) * turn;
            } else {
              overlap = surface.half + grainRadius - height;
              // past the end of the net: from the edge, not from the plane
              let line = normals[cloth + 1];
              let endB = normals[cloth].w;
              var past = false; // past the edge of the cloth
              if (surface.rounded == 1 && (line.w != 0.0 || endB != 0.0)) {
                let toGrain = away * turn;
                let column = cross(line.xyz, normal);
                let pastA = max(dot(toGrain, line.xyz) * line.w, 0.0);
                let pastB = max(dot(toGrain, column) * endB, 0.0);
                if (pastA > 0.0 || pastB > 0.0) {
                  let reach = normal * dot(toGrain, normal)
                    + line.xyz * (line.w * pastA) + column * (endB * pastB);
                  let far = length(reach);
                  up = reach / far;
                  overlap = surface.half + grainRadius - far;
                  past = true;
                }
              }
              out = up * turn;
              // Too far over this cloth to lie on it: two spheres overlap a diameter apart, and
              // thin cloths in a pile are much closer than that, so many layers are in reach.
              // Only those within half a resting distance more keep a slot, or count in a blend.
              if (overlap <= -0.5 * (surface.half + grainRadius)) {
                continue;
              }
              if (grain) {
                // the slot of their body: the one it has, or the next free one
                var k = 0u;
                while (k < taken && slotBody[k] != theirBody) {
                  k++;
                }
                if (k == taken && taken < SLOTS) {
                  slotBody[k] = theirBody;
                  slotNear[k] = squared + 1.0;
                  taken++;
                }
                // The surface of a cloth is put together before its side is chosen: every
                // particle gives its normal as it is, and how far along it the grain is and was,
                // with their signs. A particle to the side of the grain, on a cloth that bends,
                // can have the grain under its own plane, and by itself would push it through.
                if (k < SLOTS) {
                  // Past the edge there is no side: the way out is the line from the edge, kept
                  // apart, so that the side chosen for the rest never turns it around.
                  let far = surface.half + grainRadius - overlap; // from the plane, or the edge
                  let sign = select(-1.0, 1.0, dot(up, normal) >= 0.0);
                  var weight = 1.0;
                  if (surface.method == BLENDED) {
                    let across = sqrt(max(squared - height * height, 0.0));
                    weight = max(1.0 - across / diameter, 0.0);
                  } else if (squared < slotNear[k]) {
                    // the nearest particle of the cloth alone: start again from it
                    slotNear[k] = squared;
                    slotOut[k] = vec3f(0.0);
                    slotOverlap[k] = 0.0;
                    slotShare[k] = 0.0;
                    slotSlide[k] = vec3f(0.0);
                    slotWeight[k] = 0.0;
                    slotWas[k] = 0.0;
                    slotRim[k] = vec3f(0.0);
                    slotRimFar[k] = 0.0;
                  } else {
                    continue;
                  }
                  if (past) {
                    slotRim[k] += up * weight;
                    slotRimFar[k] += far * weight;
                  } else {
                    slotOut[k] += up * (sign * weight);
                    slotOverlap[k] += far * (sign * weight);
                    slotWas[k] += dot(was, normal) * weight;
                  }
                  slotShare[k] += share * weight;
                  slotSlide[k] += slide * weight;
                  slotWeight[k] += weight;
                  slotRest[k] = surface.half + grainRadius;
                  continue;
                }
              }
            }
            if (overlap <= 0.0) {
              continue;
            }
          }
          sum += out * (overlap * share);
          n += 1.0;
          if (rubbing) {
            back += rub(slide, out, overlap) * share;
          }
        }
      }
    }
  }
  // each surface is one contact, on the side the particle was of it
  for (var k = 0u; k < taken; k++) {
    let weight = slotWeight[k];
    if (weight <= 0.0) {
      continue;
    }
    let side = select(-1.0, 1.0, slotWas[k] >= 0.0);
    let way = slotOut[k] * side + slotRim[k];
    let out = way / max(length(way), 1e-9);
    let overlap = slotRest[k] - (side * slotOverlap[k] + slotRimFar[k]) / weight;
    if (overlap <= 0.0) {
      continue;
    }
    let share = slotShare[k] / weight;
    sum += out * (overlap * share);
    n += 1.0;
    if (rubbing) {
      back += rub(slotSlide[k] / weight, out, overlap) * share;
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
