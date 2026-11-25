// The numbers of docs/logbook/033-the-speed-limit.md: can a limit on speed stop the splashes of
// fast particles, and what does it cost? Run it with: node docs/topics/speed-limit.mjs
//
// FORCE+ as in docs/topics/pre-stabilization.mjs: spheres of radius 0.1 m, 60 steps per second,
// each step cut into `substeps`, each substep with 8 rounds of half and half, masses seen as m^0.5,
// levels in the pile with c = 2 (decision 015). No bounce, no friction. At the end of each substep
// one of the limits of NVIDIA FleX (include/NvFlex.h), or none:
//   max speed         the speed is cut to one radius per substep, so that no sphere is predicted
//                     to move more than its radius: 6 m/s with 1 substep, 12 with 2, 24 with 4
//   max acceleration  the change of speed in a substep is cut to `acceleration` × its length,
//                     "useful to avoid popping due to large interpenetrations", says FleX
// Part 3 sets the max speed in m/s instead, above the safe value: the risk a world takes when it
// asks for more (decision 018).

const RADIUS = 0.1
const DIAMETER = 2 * RADIUS
const GRAVITY = 9.81
const STEP = 1 / 60
const ROUNDS = 8
const ALPHA = 0.5
const LEVELS = 2
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
    return count[i] ? scale(sum[i], 0.5 + 0.5 / count[i]) : ZERO
  })
}

/**
 * One substep of length h: predict, levels, rounds, finish, then the limit, as FleX applies it at
 * the end of each step: `speed` caps the speed, `acceleration` caps how much the speed changed.
 */
function substep(state, h, limit) {
  const { w } = state
  const light = w.map((wi) => (wi ? wi ** ALPHA : 0))
  const v = state.v.map((vi, i) => (w[i] ? [vi[0], vi[1] - GRAVITY * h, vi[2]] : vi))
  const x = state.x
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
  for (let r = 0; r < ROUNDS; r++) {
    const move = correction(p, near, light, level)
    p = p.map((pi, i) => add(pi, move[i]))
  }
  const after = p.map((pi, i) => {
    if (!w[i]) return v[i]
    let vi = scale(sub(pi, x[i]), 1 / h)
    if (limit.acceleration) {
      const change = sub(vi, state.v[i])
      const most = limit.acceleration * h
      if (length(change) > most) vi = add(state.v[i], scale(change, most / length(change)))
    }
    if (limit.speed) {
      const most = limit.speed(h)
      if (length(vi) > most) vi = scale(vi, most / length(vi))
    }
    return vi
  })
  return { w, level, x: p, v: after }
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
  ['thrown down at 20 m/s onto the heap', (seed) => rain(heap, 20, seed)],
  ['at 20 m/s onto a layer held still', (seed) => rain(fixedLayer, 20, seed)],
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
function run(make, substeps, limit) {
  const s = make()
  const count = s.x.length
  let state = {
    x: s.x.map((p) => [...p]),
    v: s.x.map(() => [0, 0, 0]),
    w: s.masses.map((m, i) => (i < s.first && !s.fixed.includes(i) ? 1 / m : 0)),
    level: s.x.map(() => Number.POSITIVE_INFINITY),
  }
  const step = () => {
    for (let k = 0; k < substeps; k++) state = substep(state, STEP / substeps, limit)
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

const cm = (value) => `${value.toFixed(1)} cm`
/** One radius per substep, in m/s. */
const speedOf = (substeps) => (RADIUS * substeps) / STEP

const LIMITS = [
  ['no limit', {}],
  ['max speed, 1 radius per substep', { speed: (h) => RADIUS / h }],
  ['max acceleration 100 m/s²', { acceleration: 100 }],
  ['max acceleration 300 m/s²', { acceleration: 300 }],
]

// ---- part 1: the price, a free fall -------------------------------------------------------------
// A sphere alone falls from 9 m, the height of the heap-simulation box, onto the floor. Without a limit
// it lands after 1.35 s at 13.3 m/s, as √(2 × 9.81 × 8.9) says.
/** When a sphere alone, falling from 9 m, touches the floor, and how fast it goes then. */
function fall(substeps, limit) {
  let state = { x: [[0, 9, 0]], v: [[0, 0, 0]], w: [1], level: [Number.POSITIVE_INFINITY] }
  let t = 0
  let speed = 0
  while (state.x[0][1] > RADIUS + RESTS && t < 600) {
    speed = -state.v[0][1]
    for (let k = 0; k < substeps; k++) state = substep(state, STEP / substeps, limit)
    t++
  }
  return `lands after ${(t * STEP).toFixed(2)} s, at ${speed.toFixed(1)} m/s`
}
console.log('Part 1. One sphere falls from 9 m onto the floor: when it lands, and how fast.')
for (const substeps of [1, 2, 4])
  for (const [name, limit] of LIMITS)
    console.log(
      `  ${substeps} substep${substeps > 1 ? 's' : ' '}, ${name.padEnd(32)}: ${fall(substeps, limit)}`,
    )

// ---- part 2: the splashes ---------------------------------------------------------------------
console.log('\nPart 2. Rains of 25 spheres of 1 kg, three for each line, 75 drops.')
console.log('Drops: how many rose more than 10 cm after landing, and the highest. Below: spheres')
console.log('underneath that rose more than 10 cm, and the highest. Leftover: the deepest overlap.')
/** One line of the table: the drops that rose, and the spheres underneath that were thrown. */
function report(tag, runs) {
  if (runs.some((out) => !out)) {
    console.log(`${tag}: blows up`)
    return
  }
  const drops = runs.flatMap((out) => out.rebounds)
  const kicked = runs.flatMap((out) => out.kicked)
  const leftover = Math.max(...runs.map((out) => out.leftover))
  console.log(
    `${tag}: drops ${String(drops.filter((r) => r > 10).length).padStart(2)}/75, highest ${cm(Math.max(...drops)).padStart(9)} | ` +
      `below ${String(kicked.filter((r) => r > 10).length).padStart(3)}/${kicked.length}, highest ${cm(Math.max(0, ...kicked)).padStart(9)} | ` +
      `leftover ${leftover.toFixed(0).padStart(3)} mm`,
  )
}

for (const [label, make] of SCENES) {
  console.log(label)
  for (const substeps of [1, 2, 4])
    for (const [name, limit] of LIMITS) {
      const runs = [7, 8, 9].map((seed) => run(() => make(seed), substeps, limit))
      report(`  ${substeps} substep${substeps > 1 ? 's' : ' '}, ${name.padEnd(32)}`, runs)
    }
}

// ---- part 3: asking for more ----------------------------------------------------------------------
// A world may ask for more than the safe limit, one radius per substep, in m/s (decision 018). Here
// as a share of the safe limit: 1.5 is the default of decision 019.
console.log('\nPart 3. The max speed above the safe one, one radius per substep.')
for (const substeps of [1, 2]) {
  console.log(`${substeps} substep${substeps > 1 ? 's' : ''}, safe ${speedOf(substeps)} m/s`)
  for (const share of [1, 1.25, 1.5, Number.POSITIVE_INFINITY]) {
    const most = share * speedOf(substeps)
    const limit = Number.isFinite(most) ? { speed: () => most } : {}
    const name = Number.isFinite(most) ? `${most} m/s, ${share} × safe` : 'no limit'
    console.log(`  ${name}, a fall from 9 m ${fall(substeps, limit)}`)
    for (const [label, make] of SCENES) {
      const runs = [7, 8, 9].map((seed) => run(() => make(seed), substeps, limit))
      report(`    ${label.padEnd(36)}`, runs)
    }
  }
}
