// The numbers of docs/topics/spring-simulation.md: one chain, four ways to simulate its springs.
// Run it with: node docs/topics/spring-simulation.mjs
//
// A chain of 10 weights of 1 kg hangs from a fixed point, each on a spring 10 cm long at rest. It
// is let go with every spring at rest length, falls, stretches and swings up and down. With
// springs of stiffness k the chain should hang 9.81 × (10 + 9 + … + 1) / k longer than at rest:
// the top spring carries ten weights, the bottom one a single weight. Only up and down: y is how
// far below the fixed point a weight is, in meters.

const COUNT = 10
const MASS = 1
const REST = 0.1
const GRAVITY = 9.81
const hang = (k) => (GRAVITY * MASS * (COUNT * (COUNT + 1))) / 2 / k

/** The chain at rest length, not moving. y[0] is the fixed point. */
const chain = () => ({
  y: Array.from({ length: COUNT + 1 }, (_, i) => i * REST),
  v: new Array(COUNT + 1).fill(0),
})

/**
 * Runs `step` for 10 s and says how much longer than at rest the chain is, on average over the
 * last 5 s, and how far it still swings then, both in cm. null if it blew up.
 */
function watch(step, dt) {
  const s = chain()
  let sum = 0
  let n = 0
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  for (let t = 0; t < 10; t += dt) {
    step(s, dt)
    const stretch = s.y[COUNT] - COUNT * REST
    if (!Number.isFinite(stretch) || Math.abs(stretch) > 100) return null
    if (t < 5) continue
    sum += stretch
    n++
    low = Math.min(low, stretch)
    high = Math.max(high, stretch)
  }
  return { stretch: (sum / n) * 100, swing: (high - low) * 100 }
}
const show = (out) =>
  out
    ? `${out.stretch.toFixed(2).padStart(6)} cm longer, still swinging by ${out.swing.toFixed(2)} cm`
    : 'blows up'

// ---- way 0: forces, as they are now (semi-implicit Euler) ------------------------------------
const forces = (k) => (s, dt) => {
  const f = new Array(COUNT + 1).fill(0)
  for (let i = 1; i <= COUNT; i++) {
    const pull = k * (s.y[i] - s.y[i - 1] - REST)
    f[i] -= pull
    f[i - 1] += pull
  }
  for (let i = 1; i <= COUNT; i++) {
    s.v[i] += (GRAVITY + f[i] / MASS) * dt
    s.y[i] += s.v[i] * dt
  }
}

// ---- way 1: forces, as they will be (implicit Euler) -----------------------------------------
// The speeds at the end of the step are the unknowns of ten equations, one per weight, each tied
// to its two neighbours: (m + dt² k × springs) v' − dt² k × (neighbours' v') = m v + dt × force now.
const implicit = (k) => (s, dt) => {
  const a = dt * dt * k
  const lower = []
  const diagonal = []
  const upper = []
  const right = []
  for (let i = 1; i <= COUNT; i++) {
    const below = i < COUNT ? 1 : 0
    lower.push(-a)
    diagonal.push(MASS + a * (1 + below))
    upper.push(-a * below)
    let force = MASS * GRAVITY - k * (s.y[i] - s.y[i - 1] - REST)
    if (below) force += k * (s.y[i + 1] - s.y[i] - REST)
    right.push(MASS * s.v[i] + dt * force)
  }
  // a chain gives equations that can be solved in two sweeps, down and up
  for (let i = 1; i < COUNT; i++) {
    const m = lower[i] / diagonal[i - 1]
    diagonal[i] -= m * upper[i - 1]
    right[i] -= m * right[i - 1]
  }
  const next = new Array(COUNT)
  next[COUNT - 1] = right[COUNT - 1] / diagonal[COUNT - 1]
  for (let i = COUNT - 2; i >= 0; i--) next[i] = (right[i] - upper[i] * next[i + 1]) / diagonal[i]
  for (let i = 1; i <= COUNT; i++) {
    s.v[i] = next[i - 1]
    s.y[i] += s.v[i] * dt
  }
}

// ---- ways 2 and 3: move the ends (PBD), and move them part of the way (XPBD) ------------------
// `compliance` is 1 / k, 0 for a rod. Each spring keeps λ, the sum of what it has asked so far in
// this step (XPBD, Macklin and others 2016, equation 18).
const constraints = (rounds, compliance) => (s, dt) => {
  const before = [...s.y]
  for (let i = 1; i <= COUNT; i++) {
    s.v[i] += GRAVITY * dt
    s.y[i] += s.v[i] * dt
  }
  const soft = compliance / (dt * dt)
  const lambda = new Array(COUNT + 1).fill(0)
  for (let round = 0; round < rounds; round++)
    for (let i = 1; i <= COUNT; i++) {
      const wa = i === 1 ? 0 : 1 / MASS // the fixed point never moves
      const wb = 1 / MASS
      const error = s.y[i] - s.y[i - 1] - REST
      const change = (-error - soft * lambda[i]) / (wa + wb + soft)
      lambda[i] += change
      s.y[i - 1] -= wa * change
      s.y[i] += wb * change
    }
  for (let i = 1; i <= COUNT; i++) s.v[i] = (s.y[i] - before[i]) / dt
}

// ---- the tables -----------------------------------------------------------------------------
const DT = 1 / 120
console.log(`Steps of 1/120 s. A chain of ${COUNT} weights of ${MASS} kg.\n`)
console.log('Forces as they are now. The limit: step × ω < 2, here k below about 14 400 N/m.')
for (const k of [1000, 10000, 14000, 15000, 100000])
  console.log(
    `  k ${String(k).padStart(6)} N/m, should hang ${(hang(k) * 100).toFixed(2).padStart(5)} cm longer: ${show(watch(forces(k), DT))}`,
  )

console.log('\nForces as they will be (implicit).')
for (const k of [1000, 10000, 100000, 10000000])
  console.log(
    `  k ${String(k).padStart(8)} N/m, should hang ${(hang(k) * 100).toFixed(3).padStart(6)} cm longer: ${show(watch(implicit(k), DT))}`,
  )

console.log('\nMove the ends, all the way (PBD, a rod): it should not stretch at all.')
for (const rounds of [1, 3, 10, 30, 100])
  console.log(`  ${String(rounds).padStart(3)} rounds: ${show(watch(constraints(rounds, 0), DT))}`)

console.log(
  '\nMove the ends part of the way (XPBD), compliance 1 / 10 000: should hang 5.40 cm longer.',
)
for (const rounds of [1, 3, 10, 30, 100])
  console.log(
    `  ${String(rounds).padStart(3)} rounds: ${show(watch(constraints(rounds, 1 / 10000), DT))}`,
  )
console.log('The same with steps of 1/60 s and of 1/240 s, 10 rounds:')
for (const dt of [1 / 60, 1 / 240])
  console.log(`  1/${Math.round(1 / dt)} s: ${show(watch(constraints(10, 1 / 10000), dt))}`)
console.log('And the rod, 10 rounds, with the same two steps:')
for (const dt of [1 / 60, 1 / 240])
  console.log(`  1/${Math.round(1 / dt)} s: ${show(watch(constraints(10, 0), dt))}`)
