// How should several springs on one particle be combined in our rounds? The numbers of chapter
// 060. Run it with: node docs/topics/spring-rounds.mjs
//
// The solver of the live pages, in 3D on the CPU: 60 steps a second, 2 substeps, 3 rounds, weights
// of 1 kg and spheres of 10 cm. A spring is a soft distance constraint (XPBD): it asks its two
// ends to move so that they are `rest` apart, softened by its compliance, 1 / k.
//
// What is compared:
//   how the asks of one round meet    'one by one': each spring moves its ends at once, and the
//                                      next spring sees them moved (Gauss-Seidel). On a GPU this
//                                      needs the springs split into groups that share no particle.
//                                     'all at once': every spring reads the same positions, and a
//                                      particle then adds up what its springs ask (Jacobi), as our
//                                      rounds do for contacts. Any thread can do its own particle.
//   how a particle adds them up       'average': the sum divided by how many asked
//                                     'half and half': half the sum plus half the average, our
//                                      rule for contacts (decision 015)
//                                     'sum': all of it
//   whether a spring remembers        with a running total λ of what it asked in this substep, as
//                                      XPBD says, or without, starting from zero at every round

const RADIUS = 0.1
const SPACING = 2 * RADIUS
const GRAVITY = 9.81
const STEP = 1 / 60
const SUBSTEPS = 2
const ROUNDS = 3

/** A world: positions x, speeds v, 1 / mass w (0 is held still), and springs between names. */
function world(points, links, compliance) {
  return {
    n: points.length,
    x: points.map((p) => [...p.at]),
    v: points.map(() => [0, 0, 0]),
    w: points.map((p) => (p.held ? 0 : 1)),
    springs: links.map(([a, b]) => ({
      a,
      b,
      rest: Math.hypot(...points[a].at.map((c, k) => c - points[b].at[k])),
      compliance,
      total: 0,
    })),
  }
}

const RULES = {
  average: (n) => 1 / n,
  // the average pushed a little further: 1.5 times it, but never more than the whole sum
  'average × 1.5': (n) => Math.min(1.5 / n, 1),
  'half and half': (n) => 0.5 + 0.5 / n,
  sum: () => 1,
}

/**
 * One substep. `how`: 'one by one' or 'all at once'; `rule`: how a particle adds up its asks, for
 * 'all at once'; `remembers`: whether a spring keeps its running total; `shape`: a solid the
 * particles must stay out of, or nothing; `apart`: contacts in a pass of their own after the
 * springs, not in the same sum.
 */
function substep(s, h, options) {
  const { how, rule = 'average', remembers = true, shape, apart = false } = options
  const rounds = options.rounds ?? ROUNDS
  const before = s.x.map((p) => [...p])
  for (let i = 0; i < s.n; i++) {
    if (!s.w[i]) continue
    s.v[i][1] -= GRAVITY * h
    for (let k = 0; k < 3; k++) s.x[i][k] += s.v[i][k] * h
  }
  for (const spring of s.springs) spring.total = 0
  /** What a spring asks of its two ends now: a move along the line between them, per unit of w. */
  const ask = (spring, p) => {
    const d = [0, 1, 2].map((k) => p[spring.a][k] - p[spring.b][k])
    const far = Math.hypot(...d)
    const soft = spring.compliance / (h * h)
    const wsum = s.w[spring.a] + s.w[spring.b]
    if (far === 0 || wsum === 0) return null
    const change = (-(far - spring.rest) - soft * (remembers ? spring.total : 0)) / (wsum + soft)
    return { change, along: d.map((c) => c / far) }
  }
  /** What the solid asks of particle i: the way out and how far, or nothing. */
  const contact = (i, p) => (shape ? shape(p[i]) : null)

  for (let round = 0; round < rounds; round++) {
    if (how === 'one by one') {
      for (const spring of s.springs) {
        const out = ask(spring, s.x)
        if (!out) continue
        spring.total += out.change
        for (let k = 0; k < 3; k++) {
          s.x[spring.a][k] += s.w[spring.a] * out.change * out.along[k]
          s.x[spring.b][k] -= s.w[spring.b] * out.change * out.along[k]
        }
      }
      for (let i = 0; i < s.n; i++) {
        const out = s.w[i] ? contact(i, s.x) : null
        if (out) for (let k = 0; k < 3; k++) s.x[i][k] += out[k]
      }
      continue
    }
    const sum = s.x.map(() => [0, 0, 0])
    const count = new Array(s.n).fill(0)
    const asked = []
    for (const spring of s.springs) {
      const out = ask(spring, s.x)
      asked.push(out)
      if (!out) continue
      for (const [end, sign] of [
        [spring.a, 1],
        [spring.b, -1],
      ]) {
        if (!s.w[end]) continue
        for (let k = 0; k < 3; k++) sum[end][k] += sign * s.w[end] * out.change * out.along[k]
        count[end]++
      }
    }
    if (!apart)
      for (let i = 0; i < s.n; i++) {
        const out = s.w[i] ? contact(i, s.x) : null
        if (!out) continue
        for (let k = 0; k < 3; k++) sum[i][k] += out[k]
        count[i]++
      }
    const share = (i) => (count[i] ? RULES[rule](count[i]) : 0)
    for (let i = 0; i < s.n; i++) for (let k = 0; k < 3; k++) s.x[i][k] += sum[i][k] * share(i)
    // a spring's total grows by what was really given: its ask, scaled as its two ends scaled it
    s.springs.forEach((spring, j) => {
      if (asked[j]) spring.total += asked[j].change * 0.5 * (share(spring.a) + share(spring.b) || 0)
    })
    if (apart)
      for (let i = 0; i < s.n; i++) {
        const out = s.w[i] ? contact(i, s.x) : null
        if (out) for (let k = 0; k < 3; k++) s.x[i][k] += out[k]
      }
  }
  for (let i = 0; i < s.n; i++)
    for (let k = 0; k < 3; k++) s.v[i][k] = s.w[i] ? (s.x[i][k] - before[i][k]) / h : 0
}

/**
 * Runs `seconds`, and returns the world, or null if it blew up. Over the last 3 s it keeps how much
 * longer than at rest the springs are, in % of their rest length: `s.mean`, over springs and time,
 * and `s.worst`, the worst spring at its worst moment.
 */
function run(s, seconds, options) {
  const substeps = options.substeps ?? SUBSTEPS
  let sum = 0
  let samples = 0
  s.worst = 0
  const steps = Math.round(seconds / STEP)
  for (let t = 0; t < steps; t++) {
    for (let k = 0; k < substeps; k++) substep(s, STEP / substeps, options)
    if (s.x.some((p) => !p.every(Number.isFinite) || Math.abs(p[1]) > 1000)) return null
    if (t < steps - 3 / STEP) continue
    for (const g of s.springs) {
      const now =
        (Math.hypot(...[0, 1, 2].map((k) => s.x[g.a][k] - s.x[g.b][k])) / g.rest - 1) * 100
      sum += now
      samples++
      s.worst = Math.max(s.worst, now)
    }
  }
  s.mean = sum / samples
  return s
}
const stretch = (s) => ({ mean: s.mean, worst: s.worst })
const moving = (s) => s.v.filter((v) => Math.hypot(...v) > 0.05).length

// ---- scenes -------------------------------------------------------------------------------------
/** A chain of `count` weights hanging from a held one. */
function chain(count) {
  const points = Array.from({ length: count + 1 }, (_, i) => ({
    at: [0, -i * SPACING, 0],
    held: i === 0,
  }))
  return { points, links: points.slice(1).map((_, i) => [i, i + 1]) }
}
/**
 * A square cloth of side × side weights, flat, each joined to its neighbours along the two sides,
 * and with `diagonals` along the two diagonals as well. `hold` says which weights are held.
 */
function cloth(side, height, hold, diagonals = false) {
  const points = []
  const links = []
  const at = (a, b) => a + b * side
  for (let b = 0; b < side; b++)
    for (let a = 0; a < side; a++) {
      points.push({
        at: [(a - (side - 1) / 2) * SPACING, height, (b - (side - 1) / 2) * SPACING],
        held: hold(a, b),
      })
      if (a + 1 < side) links.push([at(a, b), at(a + 1, b)])
      if (b + 1 < side) links.push([at(a, b), at(a, b + 1)])
      if (diagonals && a + 1 < side && b + 1 < side) {
        links.push([at(a, b), at(a + 1, b + 1)])
        links.push([at(a + 1, b), at(a, b + 1)])
      }
    }
  return { points, links }
}
/** A fixed ball of this radius on the floor, and the floor: the move that takes p out of them. */
const ballOnFloor = (radius) => (p) => {
  const out = [0, 0, 0]
  let touched = false
  if (p[1] < RADIUS) {
    out[1] += RADIUS - p[1]
    touched = true
  }
  const d = [p[0], p[1] - radius, p[2]]
  const far = Math.hypot(...d)
  if (far < radius + RADIUS && far > 0) {
    for (let k = 0; k < 3; k++) out[k] += (d[k] / far) * (radius + RADIUS - far)
    touched = true
  }
  return touched ? out : null
}
/** How deep the particles are inside the ball or the floor, in cm: the worst. */
function sunk(s, radius) {
  let worst = 0
  for (const p of s.x) {
    worst = Math.max(worst, RADIUS - p[1])
    worst = Math.max(worst, radius + RADIUS - Math.hypot(p[0], p[1] - radius, p[2]))
  }
  return worst * 100
}

// ---- the tables -----------------------------------------------------------------------------------
const WAYS = [
  ['one by one', { how: 'one by one' }],
  ['all at once, average', { how: 'all at once', rule: 'average' }],
  ['all at once, average × 1.5', { how: 'all at once', rule: 'average × 1.5' }],
  ['all at once, half and half', { how: 'all at once', rule: 'half and half' }],
  ['all at once, sum', { how: 'all at once', rule: 'sum' }],
  ['all at once, average, no memory', { how: 'all at once', rule: 'average', remembers: false }],
  [
    'all at once, half and half, no memory',
    { how: 'all at once', rule: 'half and half', remembers: false },
  ],
]
const pad = (text, width) => String(text).padEnd(width)
const num = (value, digits = 2) => value.toFixed(digits).padStart(7)

console.log('Part 1. A chain of 30 weights of 1 kg, hanging for 10 s. Mean stretch of its links.')
console.log('A rod should not stretch. With compliance 1 / 10 000 the mean should be 0.76%:')
console.log('a link carries the weights below it, 15.5 on average, × 9.81 / 10 000 / 0.2 m.\n')
console.log(`${pad('', 40)}  rod: mean   worst | compliance 1/10 000: mean   worst`)
for (const [name, options] of WAYS) {
  const cells = [0, 1 / 10000].map((compliance) => {
    const { points, links } = chain(30)
    const s = run(world(points, links, compliance), 10, options)
    if (!s) return '        blows up'
    const { mean, worst } = stretch(s)
    return `${num(mean)}% ${num(worst)}%`
  })
  console.log(`${pad(name, 40)}  ${cells[0]} |               ${cells[1]}`)
}

console.log('\nPart 2. A cloth of 20 × 20 weights, held by one side, hanging for 10 s. Rods.')
console.log('Mean and worst stretch, and how many weights still move faster than 5 cm/s.\n')
console.log(
  `${pad('', 40)}  4 links each: mean   worst  moving | with diagonals: mean   worst  moving`,
)
for (const [name, options] of WAYS) {
  const cells = [false, true].map((diagonals) => {
    const { points, links } = cloth(20, 0, (_a, b) => b === 0, diagonals)
    // hanging: turn the cloth so that it starts in the plane of its held side
    for (const p of points) p.at = [p.at[0], -(p.at[2] + (19 * SPACING) / 2), 0]
    const s = run(world(points, links, 0), 10, options)
    if (!s) return '              blows up'
    const { mean, worst } = stretch(s)
    return `${num(mean)}% ${num(worst)}% ${String(moving(s)).padStart(7)}`
  })
  console.log(`${pad(name, 40)}        ${cells[0]} |         ${cells[1]}`)
}

console.log(
  '\nPart 3. The same cloth, free, falls flat from 1.5 m onto a fixed ball of 60 cm on the',
)
console.log(
  'floor, for 5 s. Rods. Contacts in the same sum as the springs, or in a pass of their own',
)
console.log('after them. Stretch, and how deep a weight ends inside the ball or the floor.\n')
console.log(`${pad('', 40)}  same sum: mean   worst    sunk | a pass apart: mean   worst    sunk`)
for (const [name, options] of WAYS) {
  if (options.how === 'one by one' || options.remembers === false) continue
  const cells = [false, true].map((apart) => {
    const { points, links } = cloth(20, 1.5, () => false)
    const s = run(world(points, links, 0), 5, { ...options, shape: ballOnFloor(0.6), apart })
    if (!s) return '              blows up'
    const { mean, worst } = stretch(s)
    return `${num(mean)}% ${num(worst)}% ${num(sunk(s, 0.6))} cm`
  })
  console.log(`${pad(name, 40)}    ${cells[0]} |     ${cells[1]}`)
}
{
  const { points, links } = cloth(20, 1.5, () => false)
  const s = run(world(points, links, 0), 5, { how: 'one by one', shape: ballOnFloor(0.6) })
  const { mean, worst } = s ? stretch(s) : {}
  console.log(
    `${pad('one by one, contacts after each round', 40)}    ${s ? `${num(mean)}% ${num(worst)}% ${num(sunk(s, 0.6))} cm` : 'blows up'}`,
  )
}

console.log('\nPart 4. The same 6 rounds in a step, cut differently, and more of them. Rods.')
console.log(
  'The chain of 30, and the cloth held by one side, with diagonals: mean and worst stretch.\n',
)
console.log(`${pad('', 44)}  chain: mean   worst | cloth: mean   worst  moving`)
for (const [name, options] of [
  ['one by one, 2 substeps × 3 rounds', { how: 'one by one' }],
  ['one by one, 6 substeps × 1 round', { how: 'one by one', substeps: 6, rounds: 1 }],
  ['one by one, 2 substeps × 10 rounds', { how: 'one by one', rounds: 10 }],
  ['average, 2 substeps × 3 rounds', { how: 'all at once' }],
  ['average, 6 substeps × 1 round', { how: 'all at once', substeps: 6, rounds: 1 }],
  ['average, 2 substeps × 10 rounds', { how: 'all at once', rounds: 10 }],
  ['average, 2 substeps × 30 rounds', { how: 'all at once', rounds: 30 }],
  [
    'average × 1.5, 2 substeps × 10 rounds',
    { how: 'all at once', rule: 'average × 1.5', rounds: 10 },
  ],
]) {
  const a = (() => {
    const { points, links } = chain(30)
    const s = run(world(points, links, 0), 10, options)
    return s ? `${num(s.mean)}% ${num(s.worst)}%` : '        blows up'
  })()
  const b = (() => {
    const { points, links } = cloth(20, 0, (_a, b) => b === 0, true)
    for (const p of points) p.at = [p.at[0], -(p.at[2] + (19 * SPACING) / 2), 0]
    const s = run(world(points, links, 0), 10, options)
    return s ? `${num(s.mean)}% ${num(s.worst)}% ${String(moving(s)).padStart(7)}` : 'blows up'
  })()
  console.log(`${pad(name, 44)}  ${a} | ${b}`)
}
