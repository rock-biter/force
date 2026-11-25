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
// And each spring keeps a running total of what it has asked for in this substep: without it,
// every pass would take back a share of what is left, and enough passes would make any spring a
// rod (chapter 064). The first pass of a substep starts the total from zero.
//
// The damping makes a spring's swing die: it is a damping ratio, 0 for none, 1 to come to rest
// without going past it (docs/topics/spring.md). The spring resists how much its length has
// changed since the substep began, as XPBD's own damping does (equation 26 of the paper). It
// brakes only the spring's length: a rope swinging like a pendulum is not slowed by it. A rod has
// no swing of its own, and no damping.

struct Spring {
  a: u32,          // the name of one end
  b: u32,          // the name of the other
  rest: f32,       // meters
  compliance: f32, // meters per newton; 0 for a rod
  damping: f32,    // a damping ratio: 0 for none, 1 stops a swing without a bounce
}
struct Part {
  first: u32, // where this group begins in the list
  count: u32, // how many springs it has
  fresh: u32, // 1 in the first pass of a substep: the running totals start from zero
}

@group(0) @binding(0) var<uniform> params: Params; // params.step is the length of a substep
@group(0) @binding(1) var<uniform> part: Part;
@group(0) @binding(2) var<storage, read> springs: array<Spring>;
@group(0) @binding(3) var<storage, read> rowOf: array<u32>; // the register: see register.wgsl
@group(0) @binding(4) var<storage, read_write> positions: array<vec4f>; // w: 1 / mass, 0 if held
@group(0) @binding(5) var<storage, read_write> totals: array<f32>;      // one per spring: λ in XPBD
@group(0) @binding(6) var<storage, read> start: array<vec4f>; // where each particle began the substep

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= part.count) {
    return;
  }
  let k = part.first + id.x;
  let spring = springs[k];
  let i = rowOf[spring.a];
  let j = rowOf[spring.b];
  let pi = positions[i];
  let pj = positions[j];
  let away = pi.xyz - pj.xyz;
  let far = length(away);
  let soft = spring.compliance / (params.step * params.step);
  let light = pi.w + pj.w;
  if (far == 0.0 || light + soft == 0.0) {
    return;
  }
  let along = away / far;
  // The damper of a spring of this stiffness between these masses, for the damping ratio asked:
  // 2 ζ √(k m). As XPBD wants it: times the compliance, over the substep.
  var brake = 0.0;
  if (spring.compliance > 0.0 && light > 0.0) {
    brake = 2.0 * spring.damping * sqrt(spring.compliance / light) / params.step;
  }
  // how much longer the spring has become since the substep began
  let grown = dot(along, (pi.xyz - start[i].xyz) - (pj.xyz - start[j].xyz));
  var total = totals[k];
  if (part.fresh == 1u) {
    total = 0.0;
  }
  // What the spring asks for now: its error, less what the compliance lets it keep of what it has
  // already asked. Negative brings the two ends together. Each end moves by its 1 / mass.
  let ask = (-(far - spring.rest) - soft * total - brake * grown) / ((1.0 + brake) * light + soft);
  totals[k] = total + ask;
  positions[i] = vec4f(pi.xyz + along * (ask * pi.w), pi.w);
  positions[j] = vec4f(pj.xyz - along * (ask * pj.w), pj.w);
}
