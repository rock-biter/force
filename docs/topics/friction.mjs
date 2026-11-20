// Friction on positions in FORCE+: does it hold a sphere on a slope, a heap in a pile, and stop the
// skating of chapter 032? Run it with: node docs/topics/friction.mjs
//
// FORCE+ as in docs/topics/speed-limit.mjs: spheres of radius 0.1 m, 60 steps per second, each
// step cut into `substeps`, each substep with 8 rounds of half and half, masses seen as m^0.5,
// levels in the pile with c = 2 (decision 015), and the max speed of decision 019, 1.5 radii per
// substep. No bounce.
//
// The friction is Macklin's (Unified Particle Physics, 2014, section 6.1, equation 24). In a round,
// a contact that overlaps by d also looks at how far its two particles slid past each other since
// the start of the substep, across the line between them. If the slide is shorter than µs × d it
// asks to take all of it back (static friction); otherwise µk × d of it (kinetic friction). The
// two share that move by their masses, like the push. Here µs = µk = µ.
// Two ways to add it to a particle's other moves:
//   'same'   the friction moves join the pushes in the same sum: half and half on everything
//   'apart'  the pushes are combined by half and half, the friction moves are averaged
//   'own'    as 'same', with the friction move cut to how far the particle has moved in the
//            substep: the user's remark that friction can stop a slide but never turn it back
// In those three every contact measures the slide before this round's pushes. In a hollow between
// two spheres the pushes already take the fall back, and friction takes it back again. So:
//   'after'       the slide is measured after the particle's own pushes of this round, then 'same'
//   'afterApart'  the same slide, then 'apart'

const RADIUS = 0.1
const DIAMETER = 2 * RADIUS
const GRAVITY = 9.81
const STEP = 1 / 60
const ROUNDS = 8
const ALPHA = 0.5
const LEVELS = 2
const RESTS = 0.001 // touching, within 1 mm
const BELOW = 0.5 // the other one is below: within 60 degrees of straight down
const SPEED_SHARE = 1.5 // decision 019

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

const FLOOR = { normal: [0, 1, 0], offset: 0 }
const WALLS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
].map((normal) => ({ normal, offset: -0.6 }))

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

/** The part of `slide` across `n`, cut as equation 24 says for an overlap d. */
function frictionMove(slide, n, d, mu) {
  const across = sub(slide, scale(n, dot(slide, n)))
  const far = length(across)
  if (far === 0 || mu === 0) return ZERO
  return scale(across, -Math.min((mu * d) / far, 1))
}

/**
 * One round on positions q: every particle reads q and gets its own move. `start` holds the
 * positions at the start of the substep, which friction measures the slide from.
 */
function correction(q, start, pairs, light, level, planes, friction) {
  const { mu = 0, mix = 'same' } = friction
  // what each particle's contacts are: the way out n, its share of the pair, the overlap d, and
  // how far the other one has moved since the start of the substep (nothing, for a plane)
  const contacts = q.map(() => [])
  for (const [i, j] of pairs) {
    const away = sub(q[i], q[j])
    const distance = length(away)
    const d = DIAMETER - distance
    if (d <= 0 || distance === 0) continue
    const known = Number.isFinite(level[i]) && Number.isFinite(level[j])
    const wi = light[i] * (known ? Math.exp(LEVELS * (level[i] - level[j])) : 1)
    const wj = light[j]
    if (wi + wj === 0) continue
    const n = scale(away, 1 / distance)
    if (wi) contacts[i].push({ n, share: wi / (wi + wj), d, other: sub(q[j], start[j]) })
    if (wj)
      contacts[j].push({ n: scale(n, -1), share: wj / (wi + wj), d, other: sub(q[i], start[i]) })
  }
  return q.map((qi, i) => {
    if (!light[i]) return ZERO
    const list = contacts[i]
    for (const { normal, offset } of planes) {
      const d = RADIUS - (dot(qi, normal) - offset)
      if (d > 0) list.push({ n: normal, share: 1, d, other: ZERO })
    }
    if (!list.length) return ZERO
    const half = 0.5 + 0.5 / list.length
    const push = scale(
      list.reduce((sum, c) => add(sum, scale(c.n, c.d * c.share)), ZERO),
      half,
    )
    // the slide friction looks at: up to where the rounds had brought the particle, or, for the
    // 'after' ways, up to where this round's pushes bring it
    const late = mix === 'after' || mix === 'afterApart'
    const moved = sub(late ? add(qi, push) : qi, start[i])
    const rub = list.reduce(
      (sum, c) => add(sum, scale(frictionMove(sub(moved, c.other), c.n, c.d, mu), c.share)),
      ZERO,
    )
    if (mix === 'apart' || mix === 'afterApart') return add(push, scale(rub, 1 / list.length))
    let back = scale(rub, half)
    if (mix === 'own' && length(back) > length(moved))
      back = scale(back, length(moved) / length(back))
    return add(push, back)
  })
}

/** One substep of length h: predict, levels, rounds, finish, then the max speed. */
function substep(state, h, planes, friction) {
  const { w } = state
  const light = w.map((wi) => (wi ? wi ** ALPHA : 0))
  const v = state.v.map((vi, i) => (w[i] ? [vi[0], vi[1] - GRAVITY * h, vi[2]] : vi))
  const x = state.x
  let p = x.map((xi, i) => (w[i] ? add(xi, scale(v[i], h)) : xi))
  const near = pairsWithin(p, 1.5 * DIAMETER)
  const level = p.map((pi) =>
    planes.some(
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
    const move = correction(p, x, near, light, level, planes, friction)
    p = p.map((pi, i) => add(pi, move[i]))
  }
  const most = (SPEED_SHARE * RADIUS) / h
  const after = p.map((pi, i) => {
    if (!w[i]) return v[i]
    const vi = scale(sub(pi, x[i]), 1 / h)
    return length(vi) > most ? scale(vi, most / length(vi)) : vi
  })
  return { w, level, x: p, v: after }
}

const newState = (x, masses, fixed = []) => ({
  x: x.map((p) => [...p]),
  v: x.map(() => [0, 0, 0]),
  w: masses.map((m, i) => (fixed.includes(i) ? 0 : 1 / m)),
  level: x.map(() => Number.POSITIVE_INFINITY),
})
const advance = (state, seconds, substeps, planes, friction) => {
  for (let t = 0; t < Math.round(seconds / STEP); t++)
    for (let k = 0; k < substeps; k++) state = substep(state, STEP / substeps, planes, friction)
  return state
}

const MIXES = ['same', 'apart', 'own', 'after', 'afterApart']
const MUS = [0, 0.3, 0.5, 1]

// ---- part 1: a sphere on a slope ----------------------------------------------------------------
// The one case with an exact answer. On a slope of angle θ a body with friction µ stays still if
// tan θ < µ, and otherwise speeds up by g × (sin θ − µ cos θ). With µ = 0.5 the limit is 26.6°.
console.log('Part 1. One sphere on a slope, µ = 0.5: its speed along the slope after 1 s, in m/s.')
for (const substeps of [1, 4])
  for (const degrees of [10, 20, 25, 30, 40]) {
    const a = (degrees * Math.PI) / 180
    const slope = [{ normal: [Math.sin(a), Math.cos(a), 0], offset: 0 }]
    const exact = Math.max(0, GRAVITY * (Math.sin(a) - 0.5 * Math.cos(a)))
    const free = GRAVITY * Math.sin(a)
    const start = [[RADIUS * Math.sin(a), RADIUS * Math.cos(a), 0]]
    const speeds = MIXES.map((mix) => {
      const end = advance(newState(start, [1]), 1, substeps, slope, { mu: 0.5, mix })
      return length(end.v[0]).toFixed(2)
    })
    console.log(
      `  ${substeps} substep${substeps > 1 ? 's' : ' '}, ${degrees}°: ${speeds.join(' / ')} (${MIXES.join(' / ')}), ` +
        `exact ${exact.toFixed(2)}, without friction ${free.toFixed(2)}`,
    )
  }

// ---- part 2: a pile -----------------------------------------------------------------------------
// A block of 6 × 6 × 6 spheres of 1 kg, or of 1 to 100 kg, let go on a floor with no walls. After
// 8 s: how tall the pile is, how wide (the distance from the middle that holds 90% of the
// spheres), the slope those two give, how many still move faster than 0.1 m/s, and the deepest
// overlap.
function block(massOf) {
  const next = random(1)
  const mass = random(3)
  const x = []
  const masses = []
  for (let layer = 0; layer < 6; layer++)
    for (let a = 0; a < 6; a++)
      for (let b = 0; b < 6; b++) {
        x.push([
          -0.5 + a * 0.2 + (next() - 0.5) * 0.04,
          0.12 + layer * 0.21,
          -0.5 + b * 0.2 + (next() - 0.5) * 0.04,
        ])
        masses.push(massOf(mass))
      }
  return { x, masses }
}
function pile(massOf, substeps, friction) {
  const { x, masses } = block(massOf)
  const end = advance(newState(x, masses), 8, substeps, [FLOOR], friction)
  if (end.x.some((p) => !p.every(Number.isFinite))) return 'blows up'
  const cx = end.x.reduce((s, p) => s + p[0], 0) / end.x.length
  const cz = end.x.reduce((s, p) => s + p[2], 0) / end.x.length
  const far = end.x.map((p) => Math.hypot(p[0] - cx, p[2] - cz)).sort((a, b) => a - b)
  const wide = far[Math.floor(0.9 * far.length)]
  const tall = Math.max(...end.x.map((p) => p[1])) + RADIUS
  const moving = end.v.filter((v) => length(v) > 0.1).length
  let deepest = 0
  for (const [i, j] of pairsWithin(end.x, DIAMETER))
    deepest = Math.max(deepest, DIAMETER - length(sub(end.x[i], end.x[j])))
  const slope = (Math.atan2(tall - DIAMETER, wide) * 180) / Math.PI
  return (
    `tall ${tall.toFixed(2)} m, wide ${wide.toFixed(2)} m, slope ${slope.toFixed(0).padStart(2)}°, ` +
    `${String(moving).padStart(3)} moving, deepest ${(deepest * 1000).toFixed(1)} mm`
  )
}
console.log('\nPart 2. A block of 216 spheres let go on a floor with no walls, after 8 s.')
for (const [name, massOf] of [
  ['1 kg', () => 1],
  ['1 to 100 kg', (next) => 100 ** next()],
])
  for (const substeps of [1, 4]) {
    console.log(`${name}, ${substeps} substep${substeps > 1 ? 's' : ''}`)
    for (const mu of MUS)
      for (const mix of mu ? MIXES : ['same'])
        console.log(
          `  µ ${String(mu).padEnd(3)} ${(mu ? mix : '').padEnd(10)}: ${pile(massOf, substeps, { mu, mix })}`,
        )
  }

// ---- part 3: the skating --------------------------------------------------------------------------
// The rain of chapters 032 and 033 onto a layer of 36 spheres held still: 25 spheres of 1 kg thrown
// down at 20 m/s, three rains, 75 drops. How many rise more than 10 cm after they first touch.
function rain(seed, substeps, friction) {
  const x = []
  for (let a = 0; a < 6; a++)
    for (let b = 0; b < 6; b++) x.push([-0.5 + a * 0.2, RADIUS, -0.5 + b * 0.2])
  const first = x.length
  const next = random(seed)
  for (let k = 0; k < 25; k++)
    x.push([
      -0.48 + (k % 5) * 0.24 + (next() - 0.5) * 0.04,
      3 + 0.013 * k,
      -0.48 + Math.floor(k / 5) * 0.24 + (next() - 0.5) * 0.04,
    ])
  const planes = [FLOOR, ...WALLS]
  let state = newState(
    x,
    x.map(() => 1),
    x.map((_, i) => i).filter((i) => i < first),
  )
  state.v = state.v.map((v, i) => (i < first ? v : [0, -20, 0]))
  const landed = new Array(x.length).fill(null)
  const rose = new Array(x.length).fill(0)
  const touching = (i) =>
    planes.some(({ normal, offset }) => dot(state.x[i], normal) - offset - RADIUS < RESTS) ||
    state.x.some((xj, j) => j !== i && length(sub(state.x[i], xj)) - DIAMETER < RESTS)
  for (let t = 0; t < Math.round(3 / STEP); t++) {
    state = advance(state, STEP, substeps, planes, friction)
    for (let i = first; i < x.length; i++) {
      const y = state.x[i][1]
      if (landed[i] === null) {
        if (touching(i)) landed[i] = y
      } else rose[i] = Math.max(rose[i], y - landed[i])
    }
  }
  return rose.slice(first).map((r) => r * 100)
}
console.log('\nPart 3. 75 drops at 20 m/s onto spheres held still: how many rise above 10 cm.')
for (const substeps of [1, 2, 4])
  for (const mu of MUS)
    for (const mix of mu ? MIXES : ['same']) {
      const drops = [7, 8, 9].flatMap((seed) => rain(seed, substeps, { mu, mix }))
      console.log(
        `  ${substeps} substep${substeps > 1 ? 's' : ' '}, µ ${String(mu).padEnd(3)} ${(mu ? mix : '').padEnd(10)}: ` +
          `${String(drops.filter((r) => r > 10).length).padStart(2)}/75, highest ${Math.max(...drops).toFixed(1)} cm`,
      )
    }
