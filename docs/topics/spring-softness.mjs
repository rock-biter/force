// Is a spring as soft as asked? The numbers of chapter 064.
// Run it with: node docs/topics/spring-softness.mjs
//
// Springs solved one by one, as on the live pages (decision 037): 60 steps a second, cut into
// substeps, a few passes over the springs in each. A spring has a compliance, 1 / stiffness: under
// a pull of F newtons it should be F × compliance longer than at rest. Weights of 1 kg, links of
// 20 cm, hanging from a held point. Only up and down: y is how far below that point a weight is.
//
// Two ways to use the compliance (XPBD, Macklin and others 2016, equation 18):
//   'fresh'     at every pass a spring asks for (error) / (w + w + compliance / substep²)
//   'remembers' it also keeps λ, the total it has asked for in this substep, and asks for
//               (error − compliance / substep² × λ) / (w + w + compliance / substep²)

const REST = 0.2
const GRAVITY = 9.81
const STEP = 1 / 60

/**
 * A chain of `count` weights hangs for 10 s. How much longer than at rest its links are, in %, on
 * average over the last 3 s, and how far the last weight still swings then, in cm.
 */
function hang(count, compliance, { substeps, passes, remembers }) {
  const y = Array.from({ length: count + 1 }, (_, i) => i * REST)
  const v = new Array(count + 1).fill(0)
  const h = STEP / substeps
  const soft = compliance / (h * h)
  let sum = 0
  let samples = 0
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  const steps = Math.round(10 / STEP)
  for (let t = 0; t < steps; t++) {
    for (let s = 0; s < substeps; s++) {
      const before = [...y]
      for (let i = 1; i <= count; i++) {
        v[i] += GRAVITY * h
        y[i] += v[i] * h
      }
      const total = new Array(count + 1).fill(0)
      for (let pass = 0; pass < passes; pass++)
        for (let i = 1; i <= count; i++) {
          const wa = i === 1 ? 0 : 1 // the held point never moves
          const error = y[i] - y[i - 1] - REST
          const change = (-error - (remembers ? soft * total[i] : 0)) / (wa + 1 + soft)
          total[i] += change
          y[i - 1] -= wa * change
          y[i] += change
        }
      for (let i = 1; i <= count; i++) v[i] = (y[i] - before[i]) / h
    }
    if (t < steps - 3 / STEP) continue
    sum += (y[count] / (count * REST) - 1) * 100
    samples++
    low = Math.min(low, y[count])
    high = Math.max(high, y[count])
  }
  return { stretch: sum / samples, swing: (high - low) * 100 }
}

/** What the chain should stretch by, in %: each link carries the weights below it. */
const asked = (count, compliance) => (((count + 1) / 2) * GRAVITY * compliance * 100) / REST

const num = (value) => value.toFixed(2).padStart(7)
const SETTINGS = [
  ['2 substeps × 3 passes', { substeps: 2, passes: 3 }],
  ['2 substeps × 10 passes', { substeps: 2, passes: 10 }],
  ['2 substeps × 30 passes', { substeps: 2, passes: 30 }],
  ['4 substeps × 3 passes', { substeps: 4, passes: 3 }],
  ['8 substeps × 3 passes', { substeps: 8, passes: 3 }],
  ['20 substeps × 1 pass', { substeps: 20, passes: 1 }],
]

for (const [count, compliances] of [
  [1, [0.001, 0.01]],
  [10, [0.0001, 0.001]],
  [30, [0.0001, 0.001]],
])
  for (const compliance of compliances) {
    console.log(
      `\n${count} weight${count > 1 ? 's' : ''}, compliance ${compliance * 1000} mm/N: asked ${asked(count, compliance).toFixed(2)}%. A rod stretches`,
      `${hang(count, 0, { substeps: 2, passes: 3 }).stretch.toFixed(2)}% with 2 × 3.`,
    )
    console.log(`${''.padEnd(26)}  fresh: stretch   swing | remembers: stretch   swing`)
    for (const [name, options] of SETTINGS) {
      const a = hang(count, compliance, { ...options, remembers: false })
      const b = hang(count, compliance, { ...options, remembers: true })
      console.log(
        `${name.padEnd(26)}        ${num(a.stretch)}% ${num(a.swing)} cm |           ${num(b.stretch)}% ${num(b.swing)} cm`,
      )
    }
  }
