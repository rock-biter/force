// One semi-implicit Euler step for every particle, one thread each (decision 006):
// first the velocity, then the position, moved with the new velocity.
// Then, if the world has one, the ground (decision 013).

struct Params {
  gravity: vec3f,     // m/s², Y up (decision 009)
  step: f32,          // seconds: it fills the fourth slot that a vec3f leaves free
  groundY: f32,       // meters
  radius: f32,        // meters, the same for every particle
  restitution: f32,   // 0 stops dead, 1 bounces back as high
  friction: f32,      // 0 is ice
}

override WORKGROUP_SIZE: u32;
// Fixed when the pipeline is made: with no ground, the compiler can drop that code entirely.
override GROUND: bool;

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

  var velocity = velocities[i].xyz + params.gravity * params.step;
  var position = positions[i].xyz + velocity * params.step;

  if (GROUND) {
    // The lowest the center can go: the ground, plus the radius.
    let surface = params.groundY + params.radius;
    if (position.y < surface) {
      position.y = surface; // back on top
      if (velocity.y < 0.0) {
        // Bounce: the speed into the ground comes back up, weakened by the restitution.
        let impact = -velocity.y;
        velocity.y = impact * params.restitution;
        // Friction: the harder the hit, the more the sliding slows, up to a full stop
        // (Coulomb friction, applied as one kick). The hit is the whole change in vertical speed.
        let hit = impact * (1.0 + params.restitution);
        let slide = length(velocity.xz);
        if (slide > 0.0) {
          let kept = max(slide - params.friction * hit, 0.0) / slide;
          velocity.x *= kept;
          velocity.z *= kept;
        }
      }
    }
  }

  velocities[i] = vec4f(velocity, velocities[i].w);
  positions[i] = vec4f(position, positions[i].w);
}
