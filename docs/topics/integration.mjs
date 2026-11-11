// The numbers of docs/topics/integration.md, recomputed. Run it with: node docs/topics/integration.mjs
// Change the constants and see how each integrator reacts.

const GRAVITY = 9.81
const MASS = 1
const STIFFNESS = 100
const STEP = 1 / 60

// Each integrator takes a state { x, v }, an acceleration function and a step h.
const integrators = {
  'Explicit Euler': ({ x, v }, a, h) => ({ x: x + v * h, v: v + a(x) * h }),
  'Semi-implicit Euler': ({ x, v }, a, h) => {
    const v1 = v + a(x) * h
    return { x: x + v1 * h, v: v1 }
  },
  // a(x) here is the a(x1) of the previous step: a real engine keeps it, and computes one force per step.
  'Velocity Verlet': ({ x, v }, a, h) => {
    const x1 = x + v * h + 0.5 * a(x) * h * h
    return { x: x1, v: v + 0.5 * (a(x) + a(x1)) * h }
  },
  RK4: ({ x, v }, a, h) => {
    const k1 = { dx: v, dv: a(x) }
    const k2 = { dx: v + (k1.dv * h) / 2, dv: a(x + (k1.dx * h) / 2) }
    const k3 = { dx: v + (k2.dv * h) / 2, dv: a(x + (k2.dx * h) / 2) }
    const k4 = { dx: v + k3.dv * h, dv: a(x + k3.dx * h) }
    return {
      x: x + (h / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
      v: v + (h / 6) * (k1.dv + 2 * k2.dv + 2 * k3.dv + k4.dv),
    }
  },
  // Only for a single linear spring: there the end-of-step force can be solved by hand.
  'Implicit Euler': ({ x, v }, _a, h) => {
    const v1 = (v - h * (STIFFNESS / MASS) * x) / (1 + h * h * (STIFFNESS / MASS))
    return { x: x + v1 * h, v: v1 }
  },
}

function run(integrate, state, a, h, steps, watch = () => {}) {
  let s = state
  for (let i = 0; i < steps; i++) {
    s = integrate(s, a, h)
    watch(s)
  }
  return s
}

console.log('Free fall from 10 m, 10 steps per second, after 1 s:')
console.log(`  Exact                ${(10 - 0.5 * GRAVITY).toFixed(3)} m`)
for (const name of ['Explicit Euler', 'Semi-implicit Euler']) {
  const end = run(integrators[name], { x: 10, v: 0 }, () => -GRAVITY, 0.1, 10)
  console.log(`  ${name.padEnd(20)} ${end.x.toFixed(3)} m`)
}

const spring = (x) => -(STIFFNESS / MASS) * x
const energy = ({ x, v }) => 0.5 * MASS * v * v + 0.5 * STIFFNESS * x * x
const start = { x: 1, v: 0 }
// Small changes need more digits, or RK4 would look perfect.
const show = (ratio) => ratio.toPrecision(Math.abs(ratio - 1) < 0.01 ? 6 : 3)

console.log(`\nSpring: energy compared with the start (k = ${STIFFNESS}, m = ${MASS}, 60 steps/s):`)
for (const [name, integrate] of Object.entries(integrators)) {
  let low = 1
  let high = 1
  const watch = (s) => {
    low = Math.min(low, energy(s) / energy(start))
    high = Math.max(high, energy(s) / energy(start))
  }
  const after1 = show(energy(run(integrate, start, spring, STEP, 60)) / energy(start))
  const after10 = show(energy(run(integrate, start, spring, STEP, 600, watch)) / energy(start))
  console.log(
    `  ${name.padEnd(20)} 1 s: ×${after1}  10 s: ×${after10}  range ${show(low)} to ${show(high)}`,
  )
}

const omega = Math.sqrt(STIFFNESS / MASS)
const factor = 1 + (STEP * omega) ** 2
console.log(`\nEnergy factor per step, 1 + (dt × ω)² = ${factor.toFixed(5)}: after 60 steps`)
console.log(
  `  explicit Euler ×${(factor ** 60).toFixed(3)}, implicit Euler ×${(1 / factor ** 60).toFixed(3)}`,
)

console.log('\nSemi-implicit Euler at the edge of stability (dt × ω):')
for (const edge of [1.9, 2.1]) {
  let high = 1
  run(integrators['Semi-implicit Euler'], start, spring, edge / omega, 1000, (s) => {
    high = Math.max(high, energy(s) / energy(start))
  })
  console.log(`  ${edge}: highest energy ×${high.toPrecision(3)}`)
}
