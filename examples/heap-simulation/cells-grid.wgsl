// Where the address book files a cell, way 1: every cell of the grid has a slot of its own. Simple,
// but the book then needs a slot for every cell of the grid, also the empty ones.

fn cellOf(p: vec3f) -> vec3i {
  return cellCoords(p); // a particle outside the grid goes to the nearest cell on its border
}

fn known(c: vec3i) -> bool {
  return all(c >= vec3i(0)) && all(c < vec3i(params.size));
}

fn slot(c: vec3i, slots: u32) -> u32 {
  return cellIndex(c);
}
