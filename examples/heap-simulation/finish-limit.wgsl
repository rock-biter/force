// Step 5, with a speed limit: as contact-cost/finish.wgsl, the velocity is how far each particle
// moved in this substep and its new position is where the rounds left it. Then the speed is cut to
// `speedLimit`, in m/s, as NVIDIA FleX's maxSpeed does. The page sets it to one radius per substep,
// so that no particle is predicted to move more than its radius in the next one, the cause of the
// splashes of chapter 032 (chapter 033). 0 is no limit. Only the speed is cut, not the position.
//
// Before the limit, the drag (chapter 065): a brake on every particle, against its speed, like air.
// `drag` is in 1 / seconds: with 1, a particle left alone loses about two thirds of its speed in a
// second. It is what makes a rope stop swinging: a spring's own damping only brakes changes of
// its length. 0 is none.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(0) @binding(3) var<storage, read> predicted: array<vec4f>;
struct Finish {
  speedLimit: f32, // m/s, 0 for none
  drag: f32,       // 1 / s, 0 for none
}
@group(0) @binding(4) var<uniform> finish: Finish;

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
  // the brake for the length of a substep, in the form that cannot turn a speed around
  v /= 1.0 + finish.drag * params.step;
  let speed = length(v);
  if (finish.speedLimit > 0.0 && speed > finish.speedLimit) {
    v *= finish.speedLimit / speed;
  }
  velocities[i] = vec4f(v, 0.0);
  positions[i] = p;
}
