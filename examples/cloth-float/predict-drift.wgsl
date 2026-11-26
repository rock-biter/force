// Step 1, as contact-cost/predict.wgsl, with a drift: a push that changes from place to place and
// from moment to moment, like slow currents of air. With no gravity it is all that moves a cloth
// left alone.
//
// The push is a few sine waves added up. Each of its three parts depends on the other two
// coordinates, never on its own: so particles side by side are pushed almost alike, and a cloth
// waves instead of shaking. It is an acceleration, the same for every mass, as gravity is.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> predicted: array<vec4f>;
struct Drift {
  time: f32,     // seconds since the start
  strength: f32, // m/s², the most each part of the push reaches; 0 is none
  scale: f32,    // radians per meter: the smaller, the wider the currents
}
@group(0) @binding(4) var<uniform> drift: Drift;

fn push(p: vec3f) -> vec3f {
  let q = p * drift.scale;
  let t = drift.time;
  return 0.5 * vec3f(
    sin(q.y * 1.3 + t * 0.7) + sin(q.z * 0.8 - t * 0.5 + 1.7),
    sin(q.z * 1.1 + t * 0.6 + 4.1) + sin(q.x * 0.9 - t * 0.8),
    sin(q.x * 1.2 + t * 0.9 + 2.3) + sin(q.y * 0.7 - t * 0.4 + 5.2),
  );
}

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
  let v = velocities[i].xyz + (params.gravity + drift.strength * push(x.xyz)) * params.step;
  velocities[i] = vec4f(v, 0.0);
  predicted[i] = vec4f(x.xyz + v * params.step, x.w);
}
