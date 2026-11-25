// Step 5, with a speed limit: as contact-cost/finish.wgsl, the velocity is how far each particle
// moved in this substep and its new position is where the rounds left it. Then the speed is cut to
// `speedLimit`, in m/s, as NVIDIA FleX's maxSpeed does. The page sets it to one radius per substep,
// so that no particle is predicted to move more than its radius in the next one, the cause of the
// splashes of chapter 032 (chapter 033). 0 is no limit. Only the speed is cut, not the position.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(0) @binding(3) var<storage, read> predicted: array<vec4f>;
@group(0) @binding(4) var<uniform> speedLimit: f32;

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
  var v = (p.xyz - x.xyz) / params.step;
  let speed = length(v);
  if (speedLimit > 0.0 && speed > speedLimit) {
    v *= speedLimit / speed;
  }
  velocities[i] = vec4f(v, 0.0);
  positions[i] = p;
}
