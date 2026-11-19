// The list of neighbours, step a: how far has any particle moved since the list was made? The
// largest move is kept with atomicMax. A float that is not negative keeps its order when its bits
// are read as a u32, so the largest bits are the largest distance.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> predicted: array<vec4f>;
@group(0) @binding(2) var<storage, read> anchors: array<vec4f>; // where each one was when the list was made
@group(0) @binding(3) var<storage, read_write> control: array<atomic<u32>>; // see rebuild.wgsl

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  // With no margin there is no list to watch. (This also makes the shader use params: a binding
  // the shader never reads is left out of a layout: 'auto', and the bind group would not match.)
  if (i >= arrayLength(&predicted) || params.margin == 0.0) {
    return;
  }
  let moved = length(predicted[i].xyz - anchors[i].xyz);
  atomicMax(&control[2], bitcast<u32>(moved));
}
