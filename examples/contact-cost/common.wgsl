// Shared by every shader of the contact step: the parameters, and how to find a particle's cell.

struct Params {
  gravity: vec3f,     // m/s²
  step: f32,          // seconds
  origin: vec3f,      // the corner of cell 0, in meters
  cell: f32,          // the width of a cell: one diameter
  size: vec3u,        // cells along x, y and z
  places: u32,        // places per cell
  radius: f32,        // meters, the same for every particle
  alpha: f32,         // the solver sees m^alpha: 1 is the real mass (chapter 029)
  levelStrength: f32, // c: a pair weighs the lower one e^(c × difference of levels) more
  planeCount: u32,    // how many planes: the floor and the walls
  omega: f32,         // the spring way: 2π × hertz
  damper: f32,        // the spring way: damper ratio, 1 stops a bounce with no rebound
  substep: f32,       // the spring way: seconds per substep
  margin: f32,        // the list of neighbours: how far beyond touching it looks, in meters
}

// A level that is not known: the particle rests on nothing.
const NO_LEVEL = 0xffffffffu;

fn cellCoords(p: vec3f) -> vec3i {
  // A particle outside the grid goes to the nearest cell on its border.
  return clamp(vec3i(floor((p - params.origin) / params.cell)), vec3i(0), vec3i(params.size) - 1);
}

fn cellIndex(c: vec3i) -> u32 {
  return u32(c.x) + params.size.x * (u32(c.y) + params.size.y * u32(c.z));
}
