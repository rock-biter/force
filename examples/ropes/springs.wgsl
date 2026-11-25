// One group of springs, solved one by one (decision 037). A spring keeps its two ends at its rest
// length: if they are too far it brings them closer, if too close it pushes them apart, each end
// moving by its share, the lighter one more. Nothing here is a force: it moves positions, as our
// contacts do (a distance constraint, chapter 057).
//
// A thread per spring reads and writes the two particles of its spring in place, with no second
// buffer. That is safe only because the springs of a group share no particle: JavaScript sorts
// them into such groups, and each group is a dispatch of its own. Two threads writing one particle
// would not be reported by anything.
//
// The compliance, 1 / stiffness, makes the spring give: 0 is a rod. It is divided by the square of
// the substep, as XPBD does, so that the same number means the same spring whatever the substep.

struct Spring {
  a: u32,          // the name of one end
  b: u32,          // the name of the other
  rest: f32,       // meters
  compliance: f32, // meters per newton; 0 for a rod
}
struct Part {
  first: u32, // where this group begins in the list
  count: u32, // how many springs it has
}

@group(0) @binding(0) var<uniform> params: Params; // params.step is the length of a substep
@group(0) @binding(1) var<uniform> part: Part;
@group(0) @binding(2) var<storage, read> springs: array<Spring>;
@group(0) @binding(3) var<storage, read> rowOf: array<u32>; // the register: see register.wgsl
@group(0) @binding(4) var<storage, read_write> positions: array<vec4f>; // w: 1 / mass, 0 if held

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= part.count) {
    return;
  }
  let spring = springs[part.first + id.x];
  let i = rowOf[spring.a];
  let j = rowOf[spring.b];
  let pi = positions[i];
  let pj = positions[j];
  let away = pi.xyz - pj.xyz;
  let far = length(away);
  let soft = spring.compliance / (params.step * params.step);
  let both = pi.w + pj.w + soft;
  if (far == 0.0 || both == 0.0) {
    return;
  }
  // how far the two ends must come together, shared by 1 / mass
  let change = (far - spring.rest) / both;
  let along = away / far;
  positions[i] = vec4f(pi.xyz - along * (change * pi.w), pi.w);
  positions[j] = vec4f(pj.xyz + along * (change * pj.w), pj.w);
}
