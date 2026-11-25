// Where the address book files a cell, way 2: a table with a fixed number of slots, about two per
// particle, however big the world is. A cell's three numbers are scrambled into one (a hash) and
// the remainder of its division by the number of slots says which slot. Two cells far apart can
// land in the same slot, so whoever reads a slot must check which cell each particle is really in.
// The cells have no border: space is as large as an i32 can count.
// Only y and z are scrambled, with two of the primes of Teschner and others, 2003, and x is added
// after: the cells of a row along x get slots next to each other in memory, and a particle that
// reads the cells around it jumps less (chapter 039, decision 024). With a number of slots that
// is a power of two, as ours, this holds across x = 0 too.

fn cellOf(p: vec3f) -> vec3i {
  return vec3i(floor((p - params.origin) / params.cell));
}

fn known(c: vec3i) -> bool {
  return true;
}

fn slot(c: vec3i, slots: u32) -> u32 {
  let u = vec3u(c); // the same bits, read as numbers without a sign: the products wrap around
  return (((u.y * 19349663u) ^ (u.z * 83492791u)) + u.x) % slots;
}
