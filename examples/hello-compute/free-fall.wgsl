// Runs once per particle, in parallel: each invocation moves one height by one free-fall step.

// `override` constants are set from JavaScript when the pipeline is created.
override WORKGROUP_SIZE: u32;
override GRAVITY: f32;
override DT: f32;

// Slot 0 of bind group 0: the buffer that JavaScript attaches with createBindGroup().
@group(0) @binding(0) var<storage, read_write> heights: array<f32>;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) id: vec3u) {
  // Workgroups are launched whole, so the last one can run past the end of the array.
  if (id.x >= arrayLength(&heights)) {
    return;
  }

  heights[id.x] -= 0.5 * GRAVITY * DT * DT;
}
