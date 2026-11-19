// Step 5: the velocity is how far each particle moved in this step, and its new position is where
// the rounds left it.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(0) @binding(3) var<storage, read> predicted: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions)) {
    return;
  }
  let x = positions[i];
  if (x.w == 0.0) {
    return;
  }
  let p = predicted[i];
  velocities[i] = vec4f((p.xyz - x.xyz) / params.step, 0.0);
  positions[i] = p;
}
