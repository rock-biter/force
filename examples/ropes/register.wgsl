// The register (decision 036). Particles are kept in the order of their cells, so the row of a
// particle changes at every substep. Its name does not: it is the second of its properties, and
// moves with it. This pass writes, for every name, the row it is in now. A spring says two names,
// and looks here for where they are.

@group(0) @binding(0) var<storage, read> properties: array<vec4f>; // y: the name, a whole number
@group(0) @binding(1) var<storage, read_write> rowOf: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&properties)) {
    return;
  }
  rowOf[u32(properties[row].y)] = row;
}
