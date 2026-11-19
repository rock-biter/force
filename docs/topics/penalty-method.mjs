// The numbers of docs/logbook/025-the-pillow.md, recomputed.
// Run it with: node docs/topics/penalty-method.mjs
// Particles of 1 kg and radius 0.1 m stacked in a column on a fixed particle, held apart by a spring
// that pushes only while they overlap: the line of Green's CUDA sample, force = k × overlap.
// Semi-implicit Euler (decision 006), gravity 9.81 m/s², no damping.

const GRAVITY = 9.81
const DIAMETER = 0.2
const MASS = 1

// Start at the exact rest position: the contact under particle i is squeezed by the weight of
// every particle from i up, divided by k. Then tap the top particle at 1 cm/s and watch.
// Returns the largest distance any particle drifts from rest, in meters, or Infinity if they fly apart.
const tap = ({ k, count, step, seconds = 20 }) => {
  const y = []
  let base = 0
  for (let i = 0; i < count; i++) {
    base += DIAMETER - ((count - i) * MASS * GRAVITY) / k
    y.push(base)
  }
  const rest = [...y]
  const speed = y.map(() => 0)
  speed[count - 1] = 0.01
  let worst = 0
  for (let s = 0; s < Math.round(seconds / step); s++) {
    const force = y.map(() => -MASS * GRAVITY)
    for (let i = 0; i < count; i++) {
      const below = i === 0 ? 0 : y[i - 1]
      const overlap = DIAMETER - (y[i] - below)
      if (overlap > 0) {
        force[i] += k * overlap
        if (i > 0) force[i - 1] -= k * overlap
      }
    }
    for (let i = 0; i < count; i++) {
      speed[i] += (force[i] / MASS) * step
      y[i] += speed[i] * step
      worst = Math.max(worst, Math.abs(y[i] - rest[i]))
    }
    if (worst > 100) return { worst: Infinity, after: (s + 1) * step }
  }
  return { worst }
}

// Calm: the tap of 1 cm/s never moves anything by more than 1 cm.
const calm = (k, count, step) => tap({ k, count, step }).worst < 0.01

// The stiffest spring that stays calm, to the nearest 100 N/m.
const limit = (count, step) => {
  let k = 100
  while (calm(k + 100, count, step)) k += 100
  return k
}

const mm = (meters) => `${(meters * 1000).toFixed(1)} mm`

console.log('Soft: how far the bottom contact sinks at rest, weight / k')
console.log(`  one particle of 1 kg, k = 1000 N/m: ${mm((MASS * GRAVITY) / 1000)}`)
console.log(`  a column of 10, k = 1000 N/m:       ${mm((10 * MASS * GRAVITY) / 1000)}`)

console.log(
  '\nStiff: the largest k that stays calm after a tap, and how far the bottom sinks with it',
)
for (const [label, step] of [
  ['60 steps per second', 1 / 60],
  ['2 substeps', 1 / 120],
  ['4 substeps', 1 / 240],
]) {
  for (const count of [1, 10]) {
    const k = limit(count, step)
    console.log(
      `  ${label}, ${count === 1 ? 'one particle ' : 'column of 10 '}: k = ${k} N/m, sinks ${mm((count * MASS * GRAVITY) / k)}`,
    )
  }
}

console.log(
  '\nThe question: a column of 10 that sinks only 10 mm needs k = 10 × 9.81 / 0.010 = 9810 N/m',
)
for (const [label, step] of [
  ['60 steps per second', 1 / 60],
  ['2 substeps', 1 / 120],
]) {
  const { worst, after } = tap({ k: 9810, count: 10, step })
  console.log(
    `  ${label}: ${worst === Infinity ? `flies apart after ${after.toFixed(2)} s` : `calm, drifts at most ${mm(worst)}`}`,
  )
}
