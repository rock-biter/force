// Step 1: gravity on the velocity, then the predicted position (Macklin's loop, chapter 026).
// w of a position holds 1 / mass; 0 is a particle that never moves.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> predicted: array<vec4f>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&positions)) {
    return;
  }
  let x = positions[i];
  if (x.w == 0.0) {
    predicted[i] = x;
    return;
  }
  let v = velocities[i].xyz + params.gravity * params.step;
  velocities[i] = vec4f(v, 0.0);
  predicted[i] = vec4f(x.xyz + v * params.step, x.w);
}
