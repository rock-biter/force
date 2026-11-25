// Does a spring's swing die as fast as asked? The numbers of chapter 065.
// Run it with: node docs/topics/spring-damping.mjs
//
// One weight of 1 kg on one spring, no gravity, pulled 2 cm beyond rest and let go, solved as on
// the live pages: a soft distance constraint with a running total (XPBD, decision 039). The
// damping asked for is a damping ratio ζ (docs/topics/spring.md): 0 swings for ever, 1 comes to
// rest without going past it. An exact spring's next swing is exp(−2π ζ / √(1 − ζ²)) of the one
// before: 0.53 for ζ = 0.1, 0.14 for ζ = 0.3.
//
// Three ways to damp:
//   'in the spring'  XPBD's own term (Macklin and others 2016, equation 26): the spring also
//                    resists how far its length has changed in this substep
//   'after'          once the positions are settled and the speed is known, take away a share of
//                    the speed at which the spring's length changes
//   (none)           what the solver dissipates by itself

const REST = 0.2
const STEP = 1 / 60
const START = 0.02

/**
 * Lets the weight go and follows it for 4 s. Returns the size of its second swing on the far side
 * against... simply: every peak on the side it started from, as a share of the one before.
 */
function swing(compliance, zeta, { substeps, passes, how }) {
  const k = 1 / compliance
  const c = 2 * zeta * Math.sqrt(k) // the damper, for a weight of 1 kg
  const h = STEP / substeps
  const soft = compliance / (h * h)
  const gamma = how === 'in the spring' ? (compliance * c) / h : 0
  let y = REST + START
  let v = 0
  const path = []
  for (let t = 0; t < 4 / STEP; t++)
    for (let s = 0; s < substeps; s++) {
      const before = y
      y += v * h
      let total = 0
      for (let pass = 0; pass < passes; pass++) {
        const error = y - REST
        const ask = (-error - soft * total - gamma * (y - before)) / ((1 + gamma) * 1 + soft)
        total += ask
        y += ask
      }
      v = (y - before) / h
      // 'after': the damper's force over a substep, as an implicit step so that it cannot overshoot
      if (how === 'after') v /= 1 + c * h
      path.push(y - REST)
    }
  const peaks = [START]
  for (let i = 1; i < path.length - 1; i++)
    if (path[i] > path[i - 1] && path[i] >= path[i + 1] && path[i] > START * 1e-4)
      peaks.push(path[i])
  let past = 0
  for (const x of path) past = Math.max(past, -x)
  return { next: peaks.length > 1 ? peaks[1] / peaks[0] : 0, past: past / START }
}

const exact = (zeta) =>
  zeta >= 1 ? 0 : Math.exp((-2 * Math.PI * zeta) / Math.sqrt(1 - zeta * zeta))
const SETTINGS = [
  ['2 substeps × 3 passes', { substeps: 2, passes: 3 }],
  ['2 substeps × 10 passes', { substeps: 2, passes: 10 }],
  ['4 substeps × 3 passes', { substeps: 4, passes: 3 }],
  ['8 substeps × 3 passes', { substeps: 8, passes: 3 }],
]
const num = (value) => value.toFixed(2).padStart(6)

for (const compliance of [0.01, 0.001]) {
  const hertz = Math.sqrt(1 / compliance) / (2 * Math.PI)
  console.log(
    `\nCompliance ${compliance * 1000} mm/N: the spring swings ${hertz.toFixed(1)} times a second. The next swing, as a share of the one`,
  )
  console.log('before, and in brackets how far it goes past rest, as a share of where it started.')
  console.log(`${''.padEnd(24)}        ζ = 0          ζ = 0.1          ζ = 0.3          ζ = 1`)
  console.log(
    `${'an exact spring'.padEnd(24)} ${[0, 0.1, 0.3, 1].map((z) => `${num(z ? exact(z) : 1)}         `).join(' ')}`,
  )
  for (const how of ['in the spring', 'after'])
    for (const [name, options] of SETTINGS) {
      const cells = [0, 0.1, 0.3, 1].map((zeta) => {
        const out = swing(compliance, zeta, { ...options, how })
        return `${num(out.next)} (${num(out.past)})`
      })
      console.log(
        `${`${how}, ${name.replace(' substeps', '').replace(' passes', '')}`.padEnd(24)} ${cells.join(' ')}`,
      )
    }
}
