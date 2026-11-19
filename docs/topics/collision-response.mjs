// The numbers of docs/logbook/027-the-stored-nudge.md and 028-the-ranking.md, recomputed.
// Run it with: node docs/topics/collision-response.mjs [velocities | patches | ranking]
// With no argument it runs all three parts, in a few minutes.
//
// Spheres of radius 0.1 m and 1 kg in 3D, pushed apart in the three ways of chapters 025 to 027:
//   positions   move them back (Macklin et al. 2014), as in constraint-averaging.mjs
//   velocities  stop them approaching, plus a nudge out (Catto 2005), as Box2D does it
//   spring      a spring and a damper on every overlap (Green's CUDA sample, Harada)
// One "thread" per particle, which reads its neighbours from the round before and writes only
// itself. No bounce, no friction, 60 steps per second.

const RADIUS = 0.1
const DIAMETER = 2 * RADIUS
const GRAVITY = 9.81
const STEP = 1 / 60
const NUDGE = 0.2 // share of an overlap the velocity way removes per step (Baumgarte)

// ---- vectors -------------------------------------------------------------------------------------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const length = (a) => Math.hypot(a[0], a[1], a[2])
const unit = (v) => (length(v) > 0 ? scale(v, 1 / length(v)) : ZERO)
const ZERO = [0, 0, 0]
const turn = (v, degrees) => {
  const a = (degrees * Math.PI) / 180
  return [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)]
}
const random = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ---- scenes --------------------------------------------------------------------------------------
const plane = (normal, offset) => ({ normal, offset })
const column = () => ({
  start: Array.from({ length: 10 }, (_, i) => [0, RADIUS + DIAMETER * i, 0]),
  fixed: new Array(10).fill(false),
  planes: [plane([0, 1, 0], 0)],
})
// 216 particles dropped from a loose grid into a box 1.2 m wide, set straight or turned.
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
  return { start, fixed: new Array(216).fill(false), planes: [plane([0, 1, 0], 0), ...walls] }
}
// 100 particles dropped on 64 fixed spheres touching in a square grid: every one of the first
// layer ends in a pocket of four.
const fixedFloor = () => {
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
  return {
    start: [...floor, ...drop],
    fixed: [...floor.map(() => true), ...drop.map(() => false)],
    planes: [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ].map((n) => plane(n, -0.8)),
  }
}
const falling = () => ({ start: [[0, 100, 0]], fixed: [false], planes: [] })
// The marble on three fixed spheres, 1 cm deep in each, and the marble squeezed between two.
const pocket = () => {
  const ring = DIAMETER / (2 * Math.sin(Math.PI / 3))
  const height = Math.sqrt((DIAMETER - 0.01) ** 2 - ring ** 2)
  const start = [0, 1, 2].map((k) => [
    ring * Math.cos((2 * Math.PI * k) / 3),
    0,
    ring * Math.sin((2 * Math.PI * k) / 3),
  ])
  start.push([0, height, 0])
  return {
    start,
    fixed: [true, true, true, false],
    planes: [],
    need: (NUDGE * 0.01) / STEP / (height / (DIAMETER - 0.01)),
  }
}
const squeeze = () => ({
  start: [
    [0, 0, 0],
    [0, DIAMETER - 0.01, 0],
    [0, 2 * DIAMETER - 0.018, 0],
  ],
  fixed: [true, false, true],
  planes: [],
})

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

// Every method steps a scene through `run`, which reports what the last second looked like.
// Still moving: a particle whose position changed faster than 0.1 m/s at some step of it.
const run = (scene, seconds, stepper, gravity = true) => {
  let state = {
    x: scene.start.map((p) => [...p]),
    v: scene.start.map(() => [0, 0, 0]),
    stored: new Map(),
  }
  const moves = []
  for (let s = 0; s < Math.round(seconds / STEP); s++) {
    const before = state.x
    state = stepper(scene, state, gravity)
    if (state.x.some((xi) => !xi.every(Number.isFinite)) || state.v.some((vi) => length(vi) > 1000))
      return null
    moves.push(state.x.map((xi, i) => length(sub(xi, before[i])) / STEP))
  }
  const last = moves.slice(-60)
  const moving = scene.start.filter(
    (_, i) => !scene.fixed[i] && last.some((m) => m[i] > 0.1),
  ).length
  return { x: state.x, v: state.v, moving, worst: worstOverlap(scene, state.x) }
}
const gravityOn = (scene, v, gravity, damping = 0) =>
  v.map((vi, i) =>
    scene.fixed[i] ? vi : scale(gravity ? add(vi, [0, -GRAVITY * STEP, 0]) : vi, 1 - damping),
  )

// ---- 1. positions --------------------------------------------------------------------------------
// The contacts of each particle, found once per step: planes first, then the particles closer than
// 1.5 diameters, in the order a GPU loop over the 27 cells would meet them.
const positionContacts = (scene, positions) =>
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
const positionCorrection = (scene, old, contact, p) => {
  if (contact.plane) {
    const overlap = RADIUS - (dot(p, contact.plane.normal) - contact.plane.offset)
    return overlap > 0 ? scale(contact.plane.normal, overlap) : null
  }
  const away = sub(p, old[contact.j])
  const distance = length(away)
  const overlap = DIAMETER - distance
  if (overlap <= 0 || distance === 0) return null
  return scale(away, ((scene.fixed[contact.j] ? 1 : 0.5) * overlap) / distance)
}
const sumOf = (list) => list.reduce(add, ZERO)
const longestOf = (list) => Math.max(0, ...list.map(length))
const averageOf = (list) => (list.length ? scale(sumOf(list), 1 / list.length) : ZERO)
// How a particle combines the corrections of its contacts (chapter 026).
const RULES = {
  sum: (l) => sumOf(l),
  average: (l) => averageOf(l),
  'average ×1.5': (l) => scale(averageOf(l), 1.5),
  'half and half': (l) => scale(add(sumOf(l), averageOf(l)), 0.5),
  'axis maximum': (l) =>
    [0, 1, 2].map((a) => Math.max(0, ...l.map((c) => c[a])) + Math.min(0, ...l.map((c) => c[a]))),
  'tight cap': (l) => {
    const s = sumOf(l)
    return length(s) <= longestOf(l) ? s : scale(unit(s), longestOf(l))
  },
  'maximum along the sum': (l) => {
    const d = unit(sumOf(l))
    const parts = l.map((c) => dot(c, d))
    return scale(d, Math.max(0, ...parts) + Math.min(0, ...parts))
  },
  'direction of the sum, longest length': (l) => scale(unit(sumOf(l)), longestOf(l)),
  'direction of the average, mean length': (l) =>
    scale(unit(averageOf(l)), (longestOf(l) + length(averageOf(l))) / 2),
  'direction of the average, 35% toward the longest': (l) => {
    const a = averageOf(l)
    return scale(unit(a), length(a) + 0.35 * (longestOf(l) - length(a)))
  },
  'one after the other': 'sequence',
}
const positionRound = (scene, old, contacts, rule) =>
  old.map((x, i) => {
    if (scene.fixed[i]) return x
    if (RULES[rule] === 'sequence') {
      let p = x
      for (const c of contacts[i]) p = add(p, positionCorrection(scene, old, c, p) ?? ZERO)
      return p
    }
    return add(
      x,
      RULES[rule](contacts[i].map((c) => positionCorrection(scene, old, c, x)).filter(Boolean)),
    )
  })
const positions =
  (rule, rounds, { damping = 0, sleep = 0 } = {}) =>
  (scene, { x, v }, gravity) => {
    v = gravityOn(scene, v, gravity, damping)
    let p = x.map((xi, i) => (scene.fixed[i] ? xi : add(xi, scale(v[i], STEP))))
    const contacts = positionContacts(scene, p)
    for (let r = 0; r < rounds; r++) p = positionRound(scene, p, contacts, rule)
    v = p.map((pi, i) => scale(sub(pi, x[i]), 1 / STEP))
    // Macklin's particle sleeping (section 4.5): a move shorter than `sleep` is not made.
    return { x: p.map((pi, i) => (length(sub(pi, x[i])) > sleep ? pi : x[i])), v }
  }

// ---- 2. velocities -------------------------------------------------------------------------------
// Pairs closer than 1.5 diameters and particles near a plane, each with a key to find its push
// again at the next step. gap < 0 is an overlap; the normal points from the other one to i.
const velocityContacts = (scene, x) => {
  const list = []
  for (let i = 0; i < x.length; i++) {
    if (!scene.fixed[i])
      scene.planes.forEach((pl, p) => {
        const gap = dot(x[i], pl.normal) - pl.offset - RADIUS
        if (gap < 0.5 * DIAMETER) list.push({ i, normal: pl.normal, gap, key: `${i}:p${p}` })
      })
    for (let j = i + 1; j < x.length; j++) {
      if (scene.fixed[i] && scene.fixed[j]) continue
      const away = sub(x[i], x[j])
      const distance = length(away)
      if (distance < 1.5 * DIAMETER)
        list.push({
          i,
          j,
          normal: scale(away, 1 / distance),
          gap: distance - DIAMETER,
          key: `${i}:${j}`,
        })
    }
  }
  return list
}
const remeasure = (contacts, x, scene) =>
  contacts.map((c) => {
    if (c.j === undefined) {
      const pl = scene.planes[Number(c.key.split(':p')[1])]
      return { ...c, gap: dot(x[c.i], pl.normal) - pl.offset - RADIUS }
    }
    const away = sub(x[c.i], x[c.j])
    const distance = length(away)
    return { ...c, normal: scale(away, 1 / distance), gap: distance - DIAMETER }
  })
// Mass splitting (Tonge 2012): each particle meets its contacts as copies. How many:
const COPIES = { sum: () => 1, average: (n) => n, 'half and half': (n) => (2 * n) / (n + 1) }
// One step of contacts on the velocities.
//   warm:       start from the pushes the same contacts had at the end of the step before
//   accumulate: each contact keeps its total push, which a later round may take back down to 0
//   nudge:      share of the overlap to remove in this step; 0 in the relax rounds
const solve = (scene, v, contacts, rule, rounds, nudge, { warm, accumulate }, stored, start) => {
  const inverse = (k) => (k === undefined || scene.fixed[k] ? 0 : 1)
  const push = new Map(start ?? [])
  v = v.map((vi) => [...vi])
  if (warm)
    for (const c of contacts) {
      const old = stored.get(c.key) ?? 0
      push.set(c.key, old)
      v[c.i] = add(v[c.i], scale(c.normal, inverse(c.i) * old))
      if (c.j !== undefined) v[c.j] = sub(v[c.j], scale(c.normal, inverse(c.j) * old))
    }
  const target = (c) => (c.gap > 0 ? -c.gap / STEP : (nudge * -c.gap) / STEP)
  const approach = (c) => dot(sub(v[c.i], c.j === undefined ? ZERO : v[c.j]), c.normal)
  // The contacts that push on each particle in this step: overlapping, holding a push already,
  // or about to close their gap too fast (speculative). They set the number of copies.
  const pushing = v.map(() => 0)
  for (const c of contacts)
    if (c.gap <= 0 || (push.get(c.key) ?? 0) > 0 || approach(c) < target(c)) {
      pushing[c.i]++
      if (c.j !== undefined) pushing[c.j]++
    }
  const copies = pushing.map((n) => COPIES[rule](Math.max(n, 1)))
  for (let r = 0; r < rounds; r++) {
    const change = v.map(() => [0, 0, 0])
    for (const c of contacts) {
      const split =
        inverse(c.i) * copies[c.i] + (c.j === undefined ? 0 : inverse(c.j) * copies[c.j])
      if (split === 0) continue
      let delta = (target(c) - approach(c)) / split
      if (accumulate) {
        const old = push.get(c.key) ?? 0
        const total = Math.max(old + delta, 0)
        delta = total - old
        push.set(c.key, total)
      } else delta = Math.max(delta, 0)
      change[c.i] = add(change[c.i], scale(c.normal, inverse(c.i) * delta))
      if (c.j !== undefined) change[c.j] = sub(change[c.j], scale(c.normal, inverse(c.j) * delta))
    }
    v = v.map((vi, i) => add(vi, change[i]))
  }
  return { v, push }
}
const velocities =
  (
    rule,
    rounds,
    { warm = false, accumulate = false, nudge = NUDGE, relax = 0, damping = 0, sleep = 0 } = {},
  ) =>
  (scene, { x, v, stored }, gravity) => {
    v = gravityOn(scene, v, gravity, damping)
    const contacts = velocityContacts(scene, x)
    let out = solve(scene, v, contacts, rule, rounds, nudge, { warm, accumulate }, stored)
    const moved = x.map((xi, i) => {
      const move = scale(out.v[i], STEP)
      return scene.fixed[i] || length(move) <= sleep ? xi : add(xi, move)
    })
    // Box2D's relax rounds: the same contacts, no nudge, from the pushes just found.
    if (relax)
      out = solve(
        scene,
        out.v,
        remeasure(contacts, moved, scene),
        rule,
        relax,
        0,
        { warm: false, accumulate: true },
        null,
        out.push,
      )
    return { x: moved, v: out.v, stored: out.push }
  }

// ---- 3. spring -----------------------------------------------------------------------------------
// Force = stiffness × overlap, minus a damper on the speed at which the two meet, while they overlap.
// The step is cut into substeps; the neighbours are found once per step.
const spring =
  (substeps, stiffness, damperRatio) =>
  (scene, { x, v }, gravity) => {
    const h = STEP / substeps
    const pairs = []
    for (let i = 0; i < x.length; i++)
      for (let j = i + 1; j < x.length; j++)
        if (!(scene.fixed[i] && scene.fixed[j]) && length(sub(x[i], x[j])) < 1.5 * DIAMETER)
          pairs.push([i, j])
    // A damper ratio of 1 stops a pair of 1 kg particles without a bounce (critical damping).
    const damper = (fixedOther) => 2 * damperRatio * Math.sqrt(stiffness * (fixedOther ? 1 : 0.5))
    x = x.map((p) => [...p])
    v = v.map((p) => [...p])
    for (let s = 0; s < substeps; s++) {
      const force = x.map((_, i) => (scene.fixed[i] || !gravity ? [0, 0, 0] : [0, -GRAVITY, 0]))
      for (const [i, j] of pairs) {
        const away = sub(x[i], x[j])
        const distance = length(away)
        const overlap = DIAMETER - distance
        if (overlap <= 0) continue
        const n = scale(away, 1 / distance)
        const f =
          stiffness * overlap - damper(scene.fixed[i] || scene.fixed[j]) * dot(sub(v[i], v[j]), n)
        force[i] = add(force[i], scale(n, f))
        force[j] = sub(force[j], scale(n, f))
      }
      x.forEach((p, i) => {
        if (scene.fixed[i]) return
        for (const pl of scene.planes) {
          const overlap = RADIUS - (dot(p, pl.normal) - pl.offset)
          if (overlap > 0)
            force[i] = add(
              force[i],
              scale(pl.normal, stiffness * overlap - damper(true) * dot(v[i], pl.normal)),
            )
        }
      })
      for (let i = 0; i < x.length; i++) {
        if (scene.fixed[i]) continue
        v[i] = add(v[i], scale(force[i], h))
        x[i] = add(x[i], scale(v[i], h))
      }
    }
    return { x, v }
  }

// ---- printing ------------------------------------------------------------------------------------
const mm = (m) => `${(m * 1000).toFixed(1)} mm`
const pad = (s, n) => String(s).padEnd(n)
const cell = (o) => (o ? `${mm(o.worst)}, ${o.moving} moving` : 'blows up')
const fourScenes = (stepper) => {
  const c = run(column(), 8, stepper)
  return {
    column: c,
    straight: run(box(0), 8, stepper),
    turned: run(box(45), 8, stepper),
    floor: run(fixedFloor(), 8, stepper),
  }
}
const line = (label, r) =>
  console.log(
    `  ${pad(label, 46)} column ${r.column ? `top ${r.column.x[9][1].toFixed(3)} m, deepest ${mm(r.column.worst)}, ${r.column.moving} moving` : 'blows up'} | box ${cell(r.straight)} / ${cell(r.turned)} | floor ${cell(r.floor)}`,
  )
const fall = (stepper) => {
  const o = run(falling(), 1, stepper)
  return `after 1 s of fall: ${length(o.v[0]).toFixed(2)} m/s`
}
const part = process.argv[2]

// ---- A. velocities (chapter 027) -----------------------------------------------------------------
if (!part || part === 'velocities') {
  console.log('A1. The pocket and the squeeze, one step, no gravity, half and half and the others')
  for (const [label, flags] of [
    ['without the two pieces', {}],
    ['with the two pieces', { warm: true, accumulate: true }],
  ]) {
    for (const rule of Object.keys(COPIES)) {
      const p = pocket()
      const s = squeeze()
      const rise = [1, 2, 3, 20].map((r) =>
        solve(
          p,
          p.start.map(() => [0, 0, 0]),
          velocityContacts(p, p.start),
          rule,
          r,
          NUDGE,
          flags,
          new Map(),
        ).v[3][1].toFixed(3),
      )
      const mid = [1, 2, 3, 4, 5, 6].map((r) =>
        solve(
          s,
          s.start.map(() => [0, 0, 0]),
          velocityContacts(s, s.start),
          rule,
          r,
          NUDGE,
          flags,
          new Map(),
        ).v[1][1].toFixed(3),
      )
      console.log(
        `  ${pad(label, 24)} ${pad(rule, 14)} pocket (must rise at ${p.need.toFixed(3)} m/s), rounds 1, 2, 3, 20: ${rise.join(', ')} | squeeze, rounds 1-6: ${mid.join(', ')}`,
      )
    }
  }
  console.log(
    '\nA2. The velocity way, 10 rounds, after 8 s: column, box straight / turned, floor of fixed spheres',
  )
  for (const [label, rule, flags] of [
    ['half and half, without the pieces', 'half and half', {}],
    ['half and half, with the pieces', 'half and half', { warm: true, accumulate: true }],
    [
      'half and half, with the pieces, nudge 5%',
      'half and half',
      { warm: true, accumulate: true, nudge: 0.05 },
    ],
    [
      'half and half, pieces + 1 relax round',
      'half and half',
      { warm: true, accumulate: true, relax: 1 },
    ],
    [
      'half and half, pieces + 10 relax rounds',
      'half and half',
      { warm: true, accumulate: true, relax: 10 },
    ],
    ['sum, pieces + 10 relax rounds', 'sum', { warm: true, accumulate: true, relax: 10 }],
    ['average, pieces + 10 relax rounds', 'average', { warm: true, accumulate: true, relax: 10 }],
  ])
    line(label, fourScenes(velocities(rule, 10, flags)))
  console.log('\nA3. The position way with half and half, more rounds')
  for (const rounds of [10, 20, 40, 80])
    line(`positions, ${rounds} rounds`, fourScenes(positions('half and half', rounds)))
}

// ---- B. patches against trembling (chapter 027) ----------------------------------------------------
if (!part || part === 'patches') {
  console.log(
    "\nB. A share of the velocity taken away at every step, or Macklin's sleeping threshold",
  )
  for (const [label, extra] of [
    ['nothing', {}],
    ['damping 1% per step', { damping: 0.01 }],
    ['damping 2% per step', { damping: 0.02 }],
    ['sleep under 1 mm per step', { sleep: 0.001 }],
    ['sleep under 2 mm per step', { sleep: 0.002 }],
  ]) {
    line(
      `velocities, pieces + 10 relax, ${label}`,
      fourScenes(
        velocities('half and half', 10, { warm: true, accumulate: true, relax: 10, ...extra }),
      ),
    )
    line(`positions, sum, 4 rounds, ${label}`, fourScenes(positions('sum', 4, extra)))
    line(`positions, average, 4 rounds, ${label}`, fourScenes(positions('average', 4, extra)))
    line(
      `positions, half and half, 10 rounds, ${label}`,
      fourScenes(positions('half and half', 10, extra)),
    )
    console.log(`  ${pad(label, 46)} ${fall(positions('half and half', 10, extra))}`)
  }
}

// ---- C. the ranking (chapter 028) ----------------------------------------------------------------
// The same price for everybody: 8 passes over the contacts per step.
if (!part || part === 'ranking') {
  console.log('\nC0. The spring, 8 substeps: the best stiffness and damper first')
  let best = null
  for (const stiffness of [5000, 20000, 50000])
    for (const ratio of [0.3, 1]) {
      const r = fourScenes(spring(8, stiffness, ratio))
      line(`spring, k = ${stiffness} N/m, damper ratio ${ratio}`, r)
      const score = scoreOf(r)
      if (!best || score < best.score)
        best = { score, label: `spring, 8 substeps, k = ${stiffness}, damper ${ratio}`, r }
    }
  const entries = [best]
  const add8 = (label, stepper) => entries.push({ label, r: fourScenes(stepper) })
  for (const rule of Object.keys(RULES)) add8(`positions, ${rule}, 8 rounds`, positions(rule, 8))
  add8(
    'positions, half and half, 8 rounds, damping 0.5%',
    positions('half and half', 8, { damping: 0.005 }),
  )
  for (const rule of Object.keys(COPIES)) {
    add8(`velocities, ${rule}, 8 rounds, without the pieces`, velocities(rule, 8))
    add8(
      `velocities, ${rule}, 4 + 4 relax rounds`,
      velocities(rule, 4, { warm: true, accumulate: true, relax: 4 }),
    )
  }
  add8(
    'velocities, half and half, 8 rounds, with the pieces',
    velocities('half and half', 8, { warm: true, accumulate: true }),
  )
  for (const e of entries) e.score = scoreOf(e.r)
  entries.sort((a, b) => a.score - b.score)
  console.log(
    '\nC1. The ranking: fewest failed scenes first, then the mean of the deepest overlaps',
  )
  for (const [k, e] of entries.entries()) line(`${k + 1}. ${e.label}, failed ${failedOf(e.r)}`, e.r)
  console.log(
    `\n  damping 0.5% per step: ${fall(positions('half and half', 8, { damping: 0.005 }))}`,
  )
}

// Fewer is better: 10 for each failed scene, plus the mean deepest overlap in cm. A scene fails if it
// blows up, if anything is still moving after 8 s, or if a pair is more than 20 mm deep, a tenth of
// the diameter: about where sinking starts to show.
function failedOf(r) {
  return [r.column, r.straight, r.turned, r.floor].filter(
    (o) => !o || o.moving > 0 || o.worst > 0.02,
  ).length
}
function scoreOf(r) {
  const scenes = [r.column, r.straight, r.turned, r.floor]
  const failed = failedOf(r)
  const depth = scenes.reduce((sum, o) => sum + (o ? o.worst : 1), 0) / scenes.length
  return failed * 10 + depth * 100
}
