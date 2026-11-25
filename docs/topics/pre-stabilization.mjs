// The numbers of docs/logbook/032-two-kinds-of-bounce.md: do particles that land on a heap bounce in
// FORCE+, and does Macklin's pre-stabilization stop it? Run it with:
// node docs/topics/pre-stabilization.mjs (about 5 minutes)
//
// FORCE+ as the GPU runs it (examples/contact-cost, examples/heap-simulation): spheres of radius 0.1 m,
// 60 steps per second, each step cut into `substeps`, each substep with 8 rounds of half and half,
// masses seen as m^0.5, levels in the pile with c = 2 (decision 015). No bounce, no friction.
//   pre   passes of pre-stabilization before the rounds (Macklin 2014, section 4.4): the same rule
//         run on the positions at the start of the substep, and every move made there made on the
//         predicted positions too, so that it does not turn into speed.

const RADIUS = 0.1
const DIAMETER = 2 * RADIUS
const GRAVITY = 9.81
const STEP = 1 / 60
const ROUNDS = 8
// How a particle combines its corrections: half and half, or part 2's plain average.
let RULE = (n) => 0.5 + 0.5 / n
let ALPHA = 0.5 // part 1 changes these two for the heap without levels
let LEVELS = 2
const RESTS = 0.001 // touching, within 1 mm
const BELOW = 0.5 // the other one is below: within 60 degrees of straight down

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const length = (a) => Math.hypot(a[0], a[1], a[2])
const ZERO = [0, 0, 0]
const random = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// The floor and four walls around a box 1.2 m wide.
const PLANES = [
  { normal: [0, 1, 0], offset: 0 },
  ...[
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
  ].map((normal) => ({ normal, offset: -0.6 })),
]

/** Every pair closer than `reach`, through cells as wide as `reach`. */
function pairsWithin(x, reach) {
  const cells = new Map()
  const key = (c) => c.join()
  const cellOf = x.map((p) => p.map((v) => Math.floor(v / reach)))
  cellOf.forEach((c, i) => {
    const k = key(c)
    if (cells.has(k)) cells.get(k).push(i)
    else cells.set(k, [i])
  })
  const pairs = []
  cellOf.forEach(([cx, cy, cz], i) => {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of cells.get(key([cx + dx, cy + dy, cz + dz])) ?? [])
            if (j > i && length(sub(x[i], x[j])) < reach) pairs.push([i, j])
  })
  return pairs
}

/**
 * One pass of half and half on positions q, as round-list.wgsl: every particle reads q and gets
 * its own move. A pair shares its overlap by the masses the solver sees, the lower one in a pile
 * weighing e^(c × difference of levels) more; a plane gives the whole overlap.
 */
function correction(q, pairs, light, level) {
  const sum = q.map(() => [0, 0, 0])
  const count = q.map(() => 0)
  for (const [i, j] of pairs) {
    const away = sub(q[i], q[j])
    const distance = length(away)
    const overlap = DIAMETER - distance
    if (overlap <= 0 || distance === 0) continue
    const known = Number.isFinite(level[i]) && Number.isFinite(level[j])
    const wi = light[i] * (known ? Math.exp(LEVELS * (level[i] - level[j])) : 1)
    const wj = light[j]
    if (wi + wj === 0) continue
    const n = scale(away, overlap / distance / (wi + wj))
    if (wi) {
      sum[i] = add(sum[i], scale(n, wi))
      count[i]++
    }
    if (wj) {
      sum[j] = sub(sum[j], scale(n, wj))
      count[j]++
    }
  }
  return q.map((qi, i) => {
    if (!light[i]) return ZERO
    for (const { normal, offset } of PLANES) {
      const overlap = RADIUS - (dot(qi, normal) - offset)
      if (overlap > 0) {
        sum[i] = add(sum[i], scale(normal, overlap))
        count[i]++
      }
    }
    return count[i] ? scale(sum[i], RULE(count[i])) : ZERO
  })
}

/** One substep of length h: predict, levels, pre-stabilization, rounds, finish. */
function substep(state, h, pre) {
  const { w } = state
  const light = w.map((wi) => (wi ? wi ** ALPHA : 0))
  const v = state.v.map((vi, i) => (w[i] ? [vi[0], vi[1] - GRAVITY * h, vi[2]] : vi))
  let x = state.x
  let p = x.map((xi, i) => (w[i] ? add(xi, scale(v[i], h)) : xi))
  const near = pairsWithin(p, 1.5 * DIAMETER)
  // levels, as levels-list.wgsl: from the predicted positions and the last levels
  const level = p.map((pi) =>
    PLANES.some(
      ({ normal, offset }) => normal[1] > BELOW && dot(pi, normal) - offset - RADIUS < RESTS,
    )
      ? 0
      : Number.POSITIVE_INFINITY,
  )
  for (const [i, j] of near) {
    const away = sub(p[i], p[j])
    const distance = length(away)
    if (distance - DIAMETER > RESTS) continue
    if (away[1] > BELOW * distance) level[i] = Math.min(level[i], state.level[j] + 1)
    if (-away[1] > BELOW * distance) level[j] = Math.min(level[j], state.level[i] + 1)
  }
  if (pre) {
    const start = pairsWithin(x, 1.5 * DIAMETER)
    for (let k = 0; k < pre; k++) {
      const move = correction(x, start, light, level)
      x = x.map((xi, i) => add(xi, move[i]))
      p = p.map((pi, i) => add(pi, move[i]))
    }
  }
  for (let r = 0; r < ROUNDS; r++) {
    const move = correction(p, near, light, level)
    p = p.map((pi, i) => add(pi, move[i]))
  }
  return {
    w,
    level,
    x: p,
    v: p.map((pi, i) => (w[i] ? scale(sub(pi, x[i]), 1 / h) : v[i])),
  }
}

// ---- scenes -------------------------------------------------------------------------------------
/** 216 spheres of 1 to 100 kg, even on a log scale, falling into the box, as in chapter 029. */
function heap() {
  const next = random(1)
  const mass = random(3)
  const x = []
  const masses = []
  for (let layer = 0; layer < 6; layer++)
    for (let a = 0; a < 6; a++)
      for (let b = 0; b < 6; b++) {
        x.push([
          -0.5 + a * 0.2 + (next() - 0.5) * 0.04,
          0.3 + layer * 0.22,
          -0.5 + b * 0.2 + (next() - 0.5) * 0.04,
        ])
        masses.push(100 ** mass())
      }
  return { x, masses }
}

/** A layer of 36 spheres held still on the floor: nothing gives way under a hit. */
function fixedLayer() {
  const x = []
  for (let a = 0; a < 6; a++)
    for (let b = 0; b < 6; b++) x.push([-0.5 + a * 0.2, RADIUS, -0.5 + b * 0.2])
  return { x, masses: x.map(() => 1), fixed: x.map((_, i) => i) }
}

/**
 * What lies below settles for 3 s while a rain of 5 × 5 spheres of 1 kg waits 3 m up, held still.
 * Then the rain falls, thrown down at `speed`. Each drop is moved by up to 2 cm, never enough to
 * touch another one, and starts a little higher than the one before, so each one lands on a
 * different spot, at a different moment of a step: one drop alone can be lucky or unlucky.
 */
function rain(below, speed, seed) {
  const { x, masses, fixed = [] } = below()
  const first = x.length
  const next = random(seed)
  for (let k = 0; k < 25; k++) {
    x.push([
      -0.48 + (k % 5) * 0.24 + (next() - 0.5) * 0.04,
      3 + 0.013 * k,
      -0.48 + Math.floor(k / 5) * 0.24 + (next() - 0.5) * 0.04,
    ])
    masses.push(1)
  }
  return { x, masses, first, settle: 3, speed, fixed }
}

// Each scene runs three rains, 75 drops.
const SCENES = [
  ['from 3 m onto the heap, 7.7 m/s at the top', (seed) => rain(heap, 0, seed)],
  ['thrown down at 20 m/s onto the heap', (seed) => rain(heap, 20, seed)],
  ['at 20 m/s onto a layer held still', (seed) => rain(fixedLayer, 20, seed)],
  ['at 20 m/s onto the heap, no levels, α = 1', (seed) => rain(heap, 20, seed), [1, 0]],
]

// ---- running and measuring ----------------------------------------------------------------------
const touching = (x, i) =>
  PLANES.some(({ normal, offset }) => dot(x[i], normal) - offset - RADIUS < RESTS) ||
  x.some((xj, j) => j !== i && length(sub(x[i], xj)) - DIAMETER < RESTS)

/**
 * Settles what lies below, lets the rain fall, and watches 3 s. Returns, after the fall:
 *   rebounds  for each drop, how far it rose above where it first touched, in cm
 *   kicked    for each sphere below, how far it rose above where it rested, in cm
 *   upward    the fastest upward speed of any sphere, in m/s
 *   leftover  the deepest overlap between two spheres at the end of a step, in mm
 * and, just before the fall, how many spheres below moved faster than 0.1 m/s.
 */
function run(make, substeps, pre) {
  const s = make()
  const count = s.x.length
  let state = {
    x: s.x.map((p) => [...p]),
    v: s.x.map(() => [0, 0, 0]),
    w: s.masses.map((m, i) => (i < s.first && !s.fixed.includes(i) ? 1 / m : 0)),
    level: s.x.map(() => Number.POSITIVE_INFINITY),
  }
  const step = () => {
    for (let k = 0; k < substeps; k++) state = substep(state, STEP / substeps, pre)
  }
  for (let t = 0; t < Math.round(s.settle / STEP); t++) step()
  const restless = state.v.filter((v, i) => i < s.first && length(v) > 0.1).length
  const rest = state.x.map((p) => p[1])
  state.w = state.w.map((w, i) => (i < s.first ? w : 1 / s.masses[i]))
  state.v = state.v.map((v, i) => (i < s.first ? v : [0, -s.speed, 0]))
  let leftover = 0
  const landed = new Array(count).fill(null) // the height where each falling sphere first touched
  const rose = new Array(count).fill(0)
  let upward = 0
  for (let t = 0; t < Math.round(3 / STEP); t++) {
    step()
    if (state.x.some((p) => !p.every(Number.isFinite))) return null
    for (const [i, j] of pairsWithin(state.x, DIAMETER))
      leftover = Math.max(leftover, DIAMETER - length(sub(state.x[i], state.x[j])))
    for (let i = 0; i < count; i++) {
      const y = state.x[i][1]
      upward = Math.max(upward, state.v[i][1])
      if (i < s.first) rose[i] = Math.max(rose[i], y - rest[i])
      else if (landed[i] === null) {
        if (touching(state.x, i)) landed[i] = y
      } else rose[i] = Math.max(rose[i], y - landed[i])
    }
  }
  return {
    rebounds: rose.slice(s.first).map((r) => r * 100),
    kicked: rose.slice(0, s.first).map((r) => r * 100),
    upward,
    restless,
    leftover: leftover * 1000,
  }
}

const median = (list) => [...list].sort((a, b) => a - b)[list.length >> 1]
const cm = (value) => `${value.toFixed(1)} cm`

console.log('Part 1. Rains of spheres of 1 kg with FORCE+, three rains of 25 for each line.')
console.log('Drops: how far they rose after landing, the middle one and the highest, and how many')
console.log('rose more than 10 cm. Below: spheres underneath that rose more than 10 cm, and the')
console.log('highest. Leftover: the deepest overlap at the end of a step. Restless: spheres')
console.log('underneath faster than 0.1 m/s just before the rain, out of three runs.\n')
for (const [label, make, [alpha, levels] = [0.5, 2]] of SCENES) {
  ALPHA = alpha
  LEVELS = levels
  console.log(label)
  for (const [substeps, pre] of [
    [1, 0],
    [1, 2],
    [8, 0],
    [8, 2],
  ]) {
    const runs = [7, 8, 9].map((seed) => run(() => make(seed), substeps, pre))
    const name = `  ${substeps} substep${substeps > 1 ? 's' : ' '}, pre ${pre}`
    if (runs.some((out) => !out)) {
      console.log(`${name}: blows up`)
      continue
    }
    const drops = runs.flatMap((out) => out.rebounds)
    const kicked = runs.flatMap((out) => out.kicked)
    console.log(
      `${name}: drops ${cm(median(drops)).padStart(8)}, highest ${cm(Math.max(...drops)).padStart(9)}, ` +
        `${String(drops.filter((r) => r > 10).length).padStart(2)}/75 over 10 cm | below ${String(kicked.filter((r) => r > 10).length).padStart(3)} over 10 cm, highest ${cm(Math.max(0, ...kicked)).padStart(9)} | ` +
        `upward ${Math.max(...runs.map((out) => out.upward))
          .toFixed(1)
          .padStart(4)} m/s, leftover ${Math.max(...runs.map((out) => out.leftover))
          .toFixed(0)
          .padStart(3)} mm, restless ${runs.reduce((n, out) => n + out.restless, 0)}`,
    )
  }
}

// ---- part 2: one drop at a time ---------------------------------------------------------------
// One sphere thrown down at 20 m/s onto the layer held still, from 66 spots of one pocket and 4
// starting heights, 8 substeps. Nothing gives way, nothing stays overlapped, no other drop is near.
ALPHA = 0.5
LEVELS = 2
const single = (dx, dz, height) => () => {
  const { x, masses, fixed } = fixedLayer()
  const first = x.length
  x.push([0.1 + dx, height, 0.1 + dz])
  masses.push(1)
  return { x, masses, first, settle: 0, speed: 20, fixed }
}
const spots = []
for (let a = 0; a <= 10; a++)
  for (let b = 0; b <= a; b++)
    for (const height of [1, 1.013, 1.026, 1.039]) spots.push([a / 100, b / 100, height])
console.log('\nPart 2. One sphere at a time, at 20 m/s onto the layer held still, 8 substeps,')
console.log(`from ${spots.length} spots of one pocket: how far it rose after landing.`)
let worst = null
for (const [name, rule] of [
  ['half and half', (n) => 0.5 + 0.5 / n],
  ['plain average', (n) => 1 / n],
]) {
  RULE = rule
  const rose = spots.map(([dx, dz, height]) => {
    const r = run(single(dx, dz, height), 8, 0).rebounds[0]
    if (name === 'half and half' && (!worst || r > worst.r)) worst = { r, dx, dz, height }
    return r
  })
  console.log(
    `  ${name.padEnd(13)}: middle ${cm(median(rose))}, ${rose.filter((r) => r > 10).length}/${rose.length} over 10 cm, highest ${cm(Math.max(...rose))}`,
  )
}

// ---- part 3: the highest one, substep by substep -----------------------------------------------
RULE = (n) => 0.5 + 0.5 / n
console.log('\nPart 3. The highest one with half and half, substep by substep, while it touches:')
{
  const s = single(worst.dx, worst.dz, worst.height)()
  const d = s.first
  let state = {
    x: s.x.map((p) => [...p]),
    v: s.x.map((_, i) => (i === d ? [0, -20, 0] : [0, 0, 0])),
    w: s.masses.map((m, i) => (s.fixed.includes(i) ? 0 : 1 / m)),
    level: s.x.map(() => Number.POSITIVE_INFINITY),
  }
  for (let k = 0; k < 120; k++) {
    state = substep(state, STEP / 8, 0)
    const y = state.x[d][1]
    const [vx, vy, vz] = state.v[d]
    const sphere = state.x.findIndex(
      (q, j) => j !== d && length(sub(state.x[d], q)) < DIAMETER + 1e-4,
    )
    if (sphere >= 0)
      console.log(
        `  substep ${String(k).padStart(2)}: height ${y.toFixed(3)} m, sideways ${Math.hypot(vx, vz).toFixed(1)} m/s, up ${vy.toFixed(1)} m/s, on sphere ${sphere}`,
      )
    else if (vy > 0) break // it left the layer going up
  }
}
