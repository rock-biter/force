// When the particles are kept in the order of the address book (heap-simulation/book-move.wgsl),
// what a particle is must follow it: row 7 of the properties must be the radius of the particle
// now in row 7. book-move.wgsl already fills the 8 storage buffers a shader gets, so the
// properties move in a pass of their own: each row of the book copies the properties of the
// particle written there into the same row of a spare buffer. properties-settle.wgsl then copies
// them back.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(2) var<storage, read> book: array<u32>;
@group(0) @binding(3) var<storage, read> properties: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> movedProperties: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&book) || !rebuild()) {
    return;
  }
  movedProperties[row] = properties[book[row]];
}
