// A hand on a cloth: the pointer holds a few particles and drags them (examples/heap-simulation).
//
// When the pointer goes down on a cloth, JavaScript writes for every particle, under its name,
// where it was from the point that was touched, and a weight: 1 at that point, falling to 0 a
// radius away, measured along the cloth. While the pointer drags, that point, the handle, moves
// on a plane parallel to the camera's, and this pass moves each particle toward its place around
// the handle by a share of the way: its weight, times the pull. So the middle of the hand follows
// the pointer closely and its rim hardly at all, and the cloth is not pulled into a spike.
//
// It runs on the predicted positions, before the springs: they and the contacts then answer, and
// the velocity is worked out from where the particle ends, as for everything else here. Nothing
// is a force. A held particle, 1 / mass of 0, is left alone.
//
// The share is taken at every substep, so more substeps make the same pull firmer: to do, if this
// goes into the engine.

struct Handle {
  at: vec3f,  // where the handle is in this substep, in meters
  pull: f32,  // the share of the way a particle of weight 1 covers in a substep, from 0 to 1
}

@group(0) @binding(0) var<storage, read> properties: array<vec4f>; // y: the name, a whole number
@group(0) @binding(1) var<storage, read_write> predicted: array<vec4f>;
@group(0) @binding(2) var<storage, read> grabbed: array<vec4f>; // by name: xyz from the handle, w the weight
@group(0) @binding(3) var<uniform> handle: Handle;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let row = id.x;
  if (row >= arrayLength(&predicted)) {
    return;
  }
  let p = predicted[row];
  let hold = grabbed[u32(properties[row].y)];
  let share = hold.w * handle.pull;
  if (p.w == 0.0 || share <= 0.0) {
    return;
  }
  predicted[row] = vec4f(mix(p.xyz, handle.at + hold.xyz, share), p.w);
}
