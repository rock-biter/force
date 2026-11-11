// One semi-implicit Euler step for every particle, one thread each (decision 006):
// first the velocity, then the position, moved with the new velocity.

struct Params {
  gravity: vec3f, // m/s², Y up (decision 009)
  step: f32,      // seconds: it fills the fourth slot that a vec3f leaves free
}

override WORKGROUP_SIZE: u32;

@group(0) @binding(0) var<uniform> params: Params;
// One vec4f per particle (decision 008): xyz is used, w is free for now.
@group(0) @binding(1) var<storage, read_write> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec4f>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  // Workgroups are launched whole, so the last one can run past the end of the arrays.
  if (i >= arrayLength(&positions)) {
    return;
  }

  let velocity = velocities[i].xyz + params.gravity * params.step;
  velocities[i] = vec4f(velocity, velocities[i].w);
  positions[i] = vec4f(positions[i].xyz + velocity * params.step, positions[i].w);
}
