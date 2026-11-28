// The normal of a cloth at each of its particles: which way is out of the cloth there. What lies
// on the cloth is pushed along it (round-cells-surface.wgsl), not along the line between two
// centers, so the cloth is a smooth surface to it and not a tray of spheres.
//
// A particle of a cloth knows its place in it from its name: the cloth is `columns` by `rows`
// particles, named row after row from `first`. Which cloth is its body, the third of its
// properties, from 1 on: `nets` holds the three numbers of each, in that order, and a fourth: 1 if
// the cloth pushes with its surface, 0 if with its spheres as before. Then it gets no normal, and
// that is how the round knows. Its two neighbours along a row and its two along a
// column give two lines that lie on the cloth, and the normal is across both: their cross
// product, as for a triangle that is drawn. On the border a particle stands in for the neighbour
// it does not have. Which of the two ways out the normal points does not matter: the round looks
// at which side the grain was on.
//
// Two numbers go with every normal: the unit line along the row, and for each of the two lines on
// the cloth whether the net ends at this particle, and on which end. The round uses them to end
// the cloth with a rounded edge, and not as a flat slab that goes on past its last particle.
// So every particle has two places here: the normal, with the end along its column (-1 the first
// row, 1 the last, 0 inside), then the line along its row, with the end along it.
//
// The particles are kept in the order of their cells, so a neighbour is found by its name in the
// register (ropes/register.wgsl). Run once per substep, on the positions the substep began with.


@group(0) @binding(0) var<storage, read> properties: array<vec4f>; // y: the name, z: the body
@group(0) @binding(1) var<storage, read> rowOf: array<u32>;
@group(0) @binding(2) var<storage, read> positions: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> normals: array<vec4f>;
@group(0) @binding(4) var<storage, read> nets: array<vec4u>; // first, columns, rows, surface on

fn at(net: vec4u, a: u32, b: u32) -> vec3f {
  return positions[rowOf[net.x + a + b * net.y]].xyz;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&properties)) {
    return;
  }
  let kind = properties[row];
  // a loose particle: no normal
  if (kind.z == 0.0) {
    normals[2 * row] = vec4f(0.0);
    normals[2 * row + 1] = vec4f(0.0);
    return;
  }
  let net = nets[u32(kind.z) - 1];
  if (net.w == 0u) {
    normals[2 * row] = vec4f(0.0);
    normals[2 * row + 1] = vec4f(0.0);
    return;
  }
  let columns = net.y;
  let rows = net.z;
  let k = u32(kind.y) - net.x;
  let a = k % columns;
  let b = k / columns;
  let along = at(net, min(a + 1, columns - 1), b) - at(net, a - min(a, 1), b);
  let down = at(net, a, min(b + 1, rows - 1)) - at(net, a, b - min(b, 1));
  let across = cross(down, along);
  let size = length(across);
  let normal = select(vec3f(0.0), across / size, size > 0.0);
  let far = length(along);
  let endA = select(select(0.0, 1.0, a == columns - 1), -1.0, a == 0);
  let endB = select(select(0.0, 1.0, b == rows - 1), -1.0, b == 0);
  normals[2 * row] = vec4f(normal, endB);
  normals[2 * row + 1] = vec4f(select(vec3f(0.0), along / far, far > 0.0), endA);
}
