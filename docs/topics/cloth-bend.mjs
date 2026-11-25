// Does a spring that skips a particle resist folding? The numbers of chapter 066.
// Run it with: node docs/topics/cloth-bend.mjs
//
// A strip of cloth, 20 particles long and 6 wide, 20 cm apart, weights of 1 kg, clamped by one short
// side, its first two rows, and let go flat, sticking out like a diving board. Springs solved one by one with a running
// total, as on the live pages: 2 substeps of 3 passes, and a drag of 0.5 per second so that it
// comes to rest. Links along the sides and the diagonals are rods. With nothing against folding
// the strip falls and hangs straight down from its held side. *Bend* links join each particle to
// the one two places further, along both sides: when the strip folds between them they come
// closer, and the link pushes them back. How soft they are is their compliance.

const SPACING = 0.2
const GRAVITY = 9.81
const STEP = 1 / 60
const LONG = 20
const WIDE = 6

function strip(bend) {
  const at = (a, b) => a + b * LONG
  const x = []
  const held = []
  const links = []
  for (let b = 0; b < WIDE; b++)
    for (let a = 0; a < LONG; a++) {
      x.push([a * SPACING, 0, b * SPACING])
      held.push(a < 2) // two rows held: one alone would be a hinge, and the strip would just swing down
      if (a + 1 < LONG) links.push([at(a, b), at(a + 1, b), 0])
      if (b + 1 < WIDE) links.push([at(a, b), at(a, b + 1), 0])
      if (a + 1 < LONG && b + 1 < WIDE) {
        links.push([at(a, b), at(a + 1, b + 1), 0])
        links.push([at(a + 1, b), at(a, b + 1), 0])
      }
      if (bend !== null && a + 2 < LONG) links.push([at(a, b), at(a + 2, b), bend])
      if (bend !== null && b + 2 < WIDE) links.push([at(a, b), at(a, b + 2), bend])
    }
  return {
    x,
    v: x.map(() => [0, 0, 0]),
    w: held.map((h) => (h ? 0 : 1)),
    springs: links.map(([i, j, compliance]) => ({
      i,
      j,
      compliance,
      rest: Math.hypot(...x[i].map((c, k) => c - x[j][k])),
      total: 0,
    })),
  }
}

/** Runs the strip for 20 s. How far below its held side its free end hangs, in cm, and how far out. */
function droop(bend, { substeps = 2, passes = 3 } = {}) {
  const s = strip(bend)
  const h = STEP / substeps
  for (let t = 0; t < 20 / STEP; t++)
    for (let sub = 0; sub < substeps; sub++) {
      const before = s.x.map((p) => [...p])
      for (let i = 0; i < s.x.length; i++) {
        if (!s.w[i]) continue
        s.v[i][1] -= GRAVITY * h
        for (let k = 0; k < 3; k++) s.x[i][k] += s.v[i][k] * h
      }
      for (const g of s.springs) g.total = 0
      for (let pass = 0; pass < passes; pass++)
        for (const g of s.springs) {
          const d = [0, 1, 2].map((k) => s.x[g.i][k] - s.x[g.j][k])
          const far = Math.hypot(...d)
          const soft = g.compliance / (h * h)
          const light = s.w[g.i] + s.w[g.j]
          if (far === 0 || light + soft === 0) continue
          const ask = (-(far - g.rest) - soft * g.total) / (light + soft)
          g.total += ask
          for (let k = 0; k < 3; k++) {
            s.x[g.i][k] += (s.w[g.i] * ask * d[k]) / far
            s.x[g.j][k] -= (s.w[g.j] * ask * d[k]) / far
          }
        }
      for (let i = 0; i < s.x.length; i++)
        for (let k = 0; k < 3; k++)
          s.v[i][k] = s.w[i] ? (s.x[i][k] - before[i][k]) / h / (1 + 0.5 * h) : 0
    }
  // the free end: the last particle of each row along the strip
  let down = 0
  let out = 0
  for (let b = 0; b < WIDE; b++) {
    down -= s.x[LONG - 1 + b * LONG][1] / WIDE
    out += (s.x[LONG - 1 + b * LONG][0] - SPACING) / WIDE
  }
  // the sharpest fold: the largest angle between two links in a row along the strip, in degrees
  let sharpest = 0
  for (let b = 0; b < WIDE; b++)
    for (let a = 1; a + 1 < LONG; a++) {
      const p = s.x[a - 1 + b * LONG]
      const q = s.x[a + b * LONG]
      const r = s.x[a + 1 + b * LONG]
      const u = [0, 1, 2].map((k) => q[k] - p[k])
      const w = [0, 1, 2].map((k) => r[k] - q[k])
      const cos = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (Math.hypot(...u) * Math.hypot(...w))
      sharpest = Math.max(sharpest, (Math.acos(Math.min(Math.max(cos, -1), 1)) * 180) / Math.PI)
    }
  return { down: down * 100, out: out * 100, sharpest }
}

const length = (LONG - 2) * SPACING * 100 // beyond the clamp
console.log(
  `A strip sticking ${length.toFixed(0)} cm out of a clamp, let go flat. After 20 s, how far below`,
)
console.log('the clamp its free end is, and how far out from it. Hanging straight down:')
console.log(
  `${length.toFixed(0)} cm below, 0 out. Sticking straight out: 0 below, ${length.toFixed(0)} out.\n`,
)
const show = (name, out) =>
  console.log(
    `${name.padEnd(44)} ${out.down.toFixed(0).padStart(5)} cm below ${out.out.toFixed(0).padStart(5)} cm out, sharpest fold ${out.sharpest.toFixed(0).padStart(3)}°`,
  )
show('no bend links', droop(null))
for (const compliance of [0, 0.0001, 0.001, 0.01, 0.1])
  show(`bend links that give ${compliance * 1000} mm/N`, droop(compliance))
console.log('\nBend links as rods, with other settings:')
for (const [name, options] of [
  ['2 substeps × 3 passes', {}],
  ['2 substeps × 10 passes', { passes: 10 }],
  ['2 substeps × 30 passes', { passes: 30 }],
  ['8 substeps × 3 passes', { substeps: 8 }],
])
  show(`  ${name}`, droop(0, options))
console.log('\nBend links that give 10 mm/N, with other settings:')
for (const [name, options] of [
  ['2 substeps × 3 passes', {}],
  ['2 substeps × 10 passes', { passes: 10 }],
  ['8 substeps × 3 passes', { substeps: 8 }],
])
  show(`  ${name}`, droop(0.01, options))
