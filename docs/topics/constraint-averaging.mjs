// The numbers of docs/logbook/026-the-marble-in-the-pocket.md, recomputed.
// Run it with: node docs/topics/constraint-averaging.mjs
//
// Spheres of radius 0.1 m in 3D, pushed apart by moving their positions, the way Macklin and others
// do it on the GPU (Unified Particle Physics, 2014, Algorithm 1): move every particle by its velocity
// to a predicted position, repair the contacts on those positions for a few rounds, then take the
// velocity back from how far each particle moved. One "thread" per particle: in a round it reads
// everybody's position from the round before and writes only its own. Equal masses, so a pair
// splits its overlap in half; a fixed sphere, the floor and the walls leave it all to the other one.
// No friction, 60 steps per second.
//
// What changes from rule to rule is how one particle combines the corrections of its contacts.

const RADIUS = 0.1
const DIAMETER = 2 * RADIUS
const GRAVITY = 9.81
const STEP = 1 / 60

// ---- vectors -------------------------------------------------------------------------------------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const length = (a) => Math.hypot(a[0], a[1], a[2])
const ZERO = [0, 0, 0]
// Turn a vector around the vertical axis, to set the same scene at another angle in the world.
const turn = (v, degrees) => {
  const a = (degrees * Math.PI) / 180
  return [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)]
}

// ---- contacts ------------------------------------------------------------------------------------
// The contacts of each particle, found once per step: planes first, then the particles closer than
// 1.5 diameters, in the order a GPU loop over the 27 cells would meet them (z, then y, then x).
const findContacts = (scene, positions) =>
  positions.map((p, i) => {
    const cell = p.map((c) => Math.floor(c / DIAMETER))
    const near = []
    positions.forEach((q, j) => {
      if (j !== i && length(sub(q, p)) < 1.5 * DIAMETER) {
        const o = q.map((c, axis) => Math.floor(c / DIAMETER) - cell[axis])
        near.push({ j, key: o[2] * 9 + o[1] * 3 + o[0] })
      }
    })
    near.sort((a, b) => a.key - b.key)
    return [...scene.planes.map((plane) => ({ plane })), ...near.map(({ j }) => ({ j }))]
  })

// The correction one contact asks of a particle standing at p, against the others' old positions.
const correction = (scene, old, contact, p) => {
  if (contact.plane) {
    const overlap = RADIUS - (dot(p, contact.plane.normal) - contact.plane.offset)
    return overlap > 0 ? scale(contact.plane.normal, overlap) : null
  }
  const away = sub(p, old[contact.j])
  const distance = length(away)
  const overlap = DIAMETER - distance
  if (overlap <= 0 || distance === 0) return null
  const share = scene.fixed[contact.j] ? 1 : 0.5
  return scale(away, (share * overlap) / distance)
}

// ---- the rules -----------------------------------------------------------------------------------
// Each rule gets the corrections of one particle, all measured at its old position, and returns the
// move. 'sequence' is different: it measures each contact again from the position already moved.
const cuts = { count: 0, of: 0 }
const sumOf = (list) => list.reduce(add, ZERO)
const longestOf = (list) => Math.max(0, ...list.map(length))
const along = (direction, list) => list.map((c) => dot(c, direction))
const unit = (v) => (length(v) > 0 ? scale(v, 1 / length(v)) : ZERO)

const RULES = {
  // Every correction added: what each contact asks, all of it.
  sum: (list) => sumOf(list),
  // Macklin: divided by the number of contacts that push.
  average: (list) => (list.length ? scale(sumOf(list), 1 / list.length) : ZERO),
  'average ×1.5': (list) => (list.length ? scale(sumOf(list), 1.5 / list.length) : ZERO),
  'average ×2': (list) => (list.length ? scale(sumOf(list), 2 / list.length) : ZERO),
  // The user's first idea: on each axis, the largest push forward plus the largest push backward.
  'axis maximum': (list) =>
    [0, 1, 2].map(
      (axis) => Math.max(0, ...list.map((c) => c[axis])) + Math.min(0, ...list.map((c) => c[axis])),
    ),
  // The sum, cut down to the diameter if it is longer.
  'sum, capped at the diameter': (list) => {
    const s = sumOf(list)
    cuts.of++
    if (length(s) <= DIAMETER) return s
    cuts.count++
    return scale(unit(s), DIAMETER)
  },
  // The sum, cut down to the longest single correction if it is longer.
  'sum, capped at the longest': (list) => {
    const s = sumOf(list)
    const longest = longestOf(list)
    cuts.of++
    if (length(s) <= longest) return s
    cuts.count++
    return scale(unit(s), longest)
  },
  // Along the direction of the sum: the largest correction forward plus the largest backward.
  'maximum along the sum': (list) => {
    const d = unit(sumOf(list))
    const parts = along(d, list)
    return scale(d, Math.max(0, ...parts) + Math.min(0, ...parts))
  },
  // The direction of the sum, the length of the longest correction.
  'direction of the sum, longest length': (list) => scale(unit(sumOf(list)), longestOf(list)),
  // The direction of the average, half way between the longest length and the average's length.
  'direction of the average, mean length': (list) => {
    const a = list.length ? scale(sumOf(list), 1 / list.length) : ZERO
    return scale(unit(a), (longestOf(list) + length(a)) / 2)
  },
  // The same direction, with a length closer to the average's: 35% of the way toward the longest.
  'direction of the average, 0.35 toward the longest': (list) => {
    const a = list.length ? scale(sumOf(list), 1 / list.length) : ZERO
    return scale(unit(a), length(a) + 0.35 * (longestOf(list) - length(a)))
  },
  // Half way between the average and the sum.
  'average and sum, halved': (list) =>
    list.length ? scale(add(sumOf(list), scale(sumOf(list), 1 / list.length)), 0.5) : ZERO,
}
const SEQUENCES = ['sequence', 'sequence, reversed', 'sequence and average, halved']

const oneRound = (scene, old, contacts, rule) =>
  old.map((x, i) => {
    if (scene.fixed[i]) return x
    const list = contacts[i].map((c) => correction(scene, old, c, x)).filter(Boolean)
    if (!SEQUENCES.includes(rule)) return add(x, RULES[rule](list))
    const order = rule === 'sequence, reversed' ? [...contacts[i]].reverse() : contacts[i]
    let p = x
    for (const c of order) p = add(p, correction(scene, old, c, p) ?? ZERO)
    if (rule === 'sequence') return p
    if (rule === 'sequence, reversed') return p
    return scale(add(p, add(x, RULES.average(list))), 0.5)
  })

// ---- running a scene -----------------------------------------------------------------------------
const plane = (normal, offset) => ({ normal, offset })

const simulate = (scene, rule, rounds, seconds) => {
  let x = scene.start.map((p) => [...p])
  let v = x.map(() => [0, 0, 0])
  const speeds = []
  for (let s = 0; s < Math.round(seconds / STEP); s++) {
    let p = x.map((xi, i) => {
      if (scene.fixed[i]) return xi
      if (scene.gravity) v[i] = add(v[i], [0, -GRAVITY * STEP, 0])
      return add(xi, scale(v[i], STEP))
    })
    const contacts = findContacts(scene, p)
    for (let r = 0; r < rounds; r++) p = oneRound(scene, p, contacts, rule)
    v = p.map((pi, i) => scale(sub(pi, x[i]), 1 / STEP))
    x = p
    if (x.some((xi) => !xi.every(Number.isFinite))) return null
    speeds.push(v.map(length))
  }
  // Still moving: faster than 0.1 m/s at some moment of the last second.
  const last = speeds.slice(-60)
  const moving = scene.start.filter(
    (_, i) => !scene.fixed[i] && last.some((s) => s[i] > 0.1),
  ).length
  return { x, moving, fastest: Math.max(...last.flat()), worst: worstOverlap(scene, x) }
}

const worstOverlap = (scene, x) => {
  let worst = 0
  x.forEach((p, i) => {
    for (let j = i + 1; j < x.length; j++) worst = Math.max(worst, DIAMETER - length(sub(p, x[j])))
    if (!scene.fixed[i])
      for (const pl of scene.planes)
        worst = Math.max(worst, RADIUS - (dot(p, pl.normal) - pl.offset))
  })
  return worst
}

// Repeat the same jitter at every run.
const random = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const mm = (m) => `${(m * 1000).toFixed(1)} mm`
const pad = (s, n) => String(s).padEnd(n)
const ALL = [...Object.keys(RULES).filter((r) => !r.startsWith('average ×')), ...SEQUENCES]

// ---- 1. the marble in the pocket ------------------------------------------------------------------
// Three fixed spheres touching each other in a ring; B rests on them, 1 cm deep in each. No gravity.
const pocket = (degrees) => {
  const ring = DIAMETER / (2 * Math.sin(Math.PI / 3))
  const height = Math.sqrt((DIAMETER - 0.01) ** 2 - ring ** 2)
  const start = [0, 1, 2].map((k) =>
    turn(
      [ring * Math.cos((2 * Math.PI * k) / 3), 0, ring * Math.sin((2 * Math.PI * k) / 3)],
      degrees,
    ),
  )
  start.push([0, height, 0])
  return { start, fixed: [true, true, true, false], planes: [], gravity: false, height }
}
{
  const ring = DIAMETER / (2 * Math.sin(Math.PI / 3))
  const rise = Math.sqrt(DIAMETER ** 2 - ring ** 2) - Math.sqrt((DIAMETER - 0.01) ** 2 - ring ** 2)
  console.log(`1. A marble on three fixed ones, 1 cm deep in each: it must rise ${mm(rise)}`)
}
for (const rule of ['sum', 'average', ...ALL.filter((r) => r !== 'sum' && r !== 'average')]) {
  for (const degrees of rule === 'axis maximum' ? [0, 20, 45] : [0]) {
    const scene = pocket(degrees)
    let x = scene.start
    const contacts = findContacts(scene, x)
    const rows = []
    for (let r = 1; r <= 20; r++) {
      x = oneRound(scene, x, contacts, rule)
      if ([1, 2, 3, 20].includes(r)) rows.push(`${r}: ${mm(x[3][1] - scene.height)}`)
    }
    const side = Math.hypot(x[3][0], x[3][2])
    const label = rule === 'axis maximum' ? `${rule}, turned ${degrees}°` : rule
    console.log(
      `  ${pad(label, 40)} rounds ${rows.join(', ')}${side > 1e-6 ? `, and ${mm(side)} sideways` : ''}`,
    )
  }
}

// ---- 2. the squeeze ------------------------------------------------------------------------------
// B between two fixed spheres, 1 cm deep in the one below and 0.8 cm in the one above.
// No room to get out: the best place is the middle, 1 mm up.
console.log('\n2. B squeezed between two fixed spheres: the middle is 1 mm up')
{
  const start = [
    [0, 0, 0],
    [0, DIAMETER - 0.01, 0],
    [0, 2 * DIAMETER - 0.018, 0],
  ]
  const scene = { start, fixed: [true, false, true], planes: [], gravity: false }
  for (const rule of ALL) {
    let x = start
    const contacts = findContacts(scene, x)
    const moves = []
    for (let r = 1; r <= 6; r++) {
      x = oneRound(scene, x, contacts, rule)
      moves.push(((x[1][1] - start[1][1]) * 1000).toFixed(1))
    }
    console.log(`  ${pad(rule, 40)} B at (mm), rounds 1 to 6: ${moves.join(', ')}`)
  }
}

// ---- 2b. pushes that cancel ----------------------------------------------------------------------
// A column of three on the floor, every contact 1 cm deep, no gravity: one round, contacts one
// after the other. The bottom particle meets the floor first, or the particle above first.
console.log(
  '\n2b. A column of 3 on the floor, each contact 1 cm deep: how far the bottom one moves in one round',
)
{
  const start = [0, 1, 2].map((i) => [0, RADIUS - 0.01 + i * (DIAMETER - 0.01), 0])
  const scene = {
    start,
    fixed: [false, false, false],
    planes: [plane([0, 1, 0], 0)],
    gravity: false,
  }
  const contacts = findContacts(scene, start)
  for (const rule of ['sequence', 'sequence, reversed']) {
    const x = oneRound(scene, start, contacts, rule)
    console.log(`  ${pad(rule, 40)} ${mm(x[0][1] - start[0][1])}`)
  }
}

// ---- 3. a column of ten ----------------------------------------------------------------------------
console.log(
  '\n3. A column of 10 on the floor, 4 rounds per step, after 3 s. The top belongs at 1.900 m',
)
{
  const scene = {
    start: Array.from({ length: 10 }, (_, i) => [0, RADIUS + DIAMETER * i, 0]),
    fixed: new Array(10).fill(false),
    planes: [plane([0, 1, 0], 0)],
    gravity: true,
  }
  for (const rule of [
    'sum',
    'average',
    'average ×1.5',
    'average ×2',
    ...ALL.filter((r) => r !== 'sum' && r !== 'average'),
  ]) {
    const out = simulate(scene, rule, 4, 3)
    if (!out) {
      console.log(`  ${pad(rule, 40)} blows up`)
      continue
    }
    const top = out.x[9][1]
    const highest = Math.max(...out.x.map((p) => p[1]))
    console.log(
      `  ${pad(rule, 40)} top at ${top.toFixed(3)} m${highest > top + 1e-9 ? `, but one particle is at ${highest.toFixed(1)} m` : ''}, fastest ${out.fastest.toFixed(2)} m/s`,
    )
  }
}

// ---- 4. a box ------------------------------------------------------------------------------------
// 216 particles dropped from a loose grid into a box 1.2 m wide, after 8 s.
// The same box set straight in the world, and turned by 45° around the vertical.
const box = (degrees) => {
  const next = random(1)
  const start = []
  for (let layer = 0; layer < 6; layer++)
    for (let a = 0; a < 6; a++)
      for (let b = 0; b < 6; b++)
        start.push(
          turn(
            [
              -0.5 + a * 0.2 + (next() - 0.5) * 0.04,
              0.3 + layer * 0.22,
              -0.5 + b * 0.2 + (next() - 0.5) * 0.04,
            ],
            degrees,
          ),
        )
  const walls = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
  ].map((n) => plane(turn(n, degrees), -0.6))
  return {
    start,
    fixed: new Array(216).fill(false),
    planes: [plane([0, 1, 0], 0), ...walls],
    gravity: true,
  }
}
console.log(
  '\n4. A box of 216 particles, after 8 s: worst overlap, particles still moving (faster than 0.1 m/s)',
)
for (const rule of [
  'sum',
  'average',
  'average ×1.5',
  ...ALL.filter((r) => r !== 'sum' && r !== 'average'),
]) {
  const cells = []
  for (const rounds of [4, 10])
    for (const degrees of [0, 45]) {
      cuts.count = cuts.of = 0
      const out = simulate(box(degrees), rule, rounds, 8)
      cells.push(
        out
          ? `${rounds} rounds ${degrees}°: ${mm(out.worst)}, ${out.moving} moving`
          : `${rounds} rounds ${degrees}°: blows up`,
      )
      if (rule.includes('capped') && rounds === 4 && degrees === 0)
        cells.push(`(the cap cut ${cuts.count} of ${cuts.of} moves)`)
    }
  console.log(`  ${pad(rule, 40)} ${cells.join(' | ')}`)
}

// ---- 5. a floor made of fixed spheres --------------------------------------------------------------
// 64 fixed spheres in a square grid, touching, inside walls: 100 particles dropped on them,
// so every one of the first layer sits in a pocket of four. After 8 s.
console.log(
  '\n5. 100 particles on a floor of 64 fixed spheres, after 8 s: worst overlap, still moving, fastest',
)
{
  const next = random(2)
  const floor = []
  for (let a = 0; a < 8; a++)
    for (let b = 0; b < 8; b++) floor.push([-0.7 + a * DIAMETER, 0, -0.7 + b * DIAMETER])
  const drop = []
  for (let layer = 0; layer < 4; layer++)
    for (let a = 0; a < 5; a++)
      for (let b = 0; b < 5; b++)
        drop.push([
          -0.4 + a * 0.2 + (next() - 0.5) * 0.04,
          0.4 + layer * 0.22,
          -0.4 + b * 0.2 + (next() - 0.5) * 0.04,
        ])
  const scene = {
    start: [...floor, ...drop],
    fixed: [...floor.map(() => true), ...drop.map(() => false)],
    planes: [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ].map((n) => plane(n, -0.8)),
    gravity: true,
  }
  for (const rule of [
    'sum',
    'average',
    'axis maximum',
    'sum, capped at the longest',
    'maximum along the sum',
    'direction of the sum, longest length',
    'direction of the average, mean length',
    'direction of the average, 0.35 toward the longest',
    'average and sum, halved',
  ]) {
    const cells = [4, 10].map((rounds) => {
      const out = simulate(scene, rule, rounds, 8)
      return out
        ? `${rounds} rounds: ${mm(out.worst)}, ${out.moving} moving, fastest ${out.fastest.toFixed(3)} m/s`
        : `${rounds} rounds: blows up`
    })
    console.log(`  ${pad(rule, 40)} ${cells.join(' | ')}`)
  }
}
