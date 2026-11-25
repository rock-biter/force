// What properties-move.wgsl copied into the spare buffer goes back into the real one, row by row.
// Two passes, because a pass cannot read a buffer while other threads write it.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl
@group(0) @binding(2) var<storage, read> movedProperties: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> properties: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&properties) || !rebuild()) {
    return;
  }
  properties[row] = movedProperties[row];
}
