// The numbers of docs/logbook/029-heavy-on-light.md, recomputed.
// Run it with: node docs/topics/mass-ratio.mjs
//
// The two finalists of chapter 028, now with spheres of different masses. Radius 0.1 m, no bounce,
// no friction, 60 steps per second, 8 passes over the contacts per step:
//   positions      8 rounds of the user's "half and half" rule (chapter 026); a pair splits each
//                  correction against the masses: the lighter one takes the larger share
//   spring         8 substeps, one stiffness k for every contact, and a damper (chapter 028)
//   spring in Hz   8 substeps, each contact gets k = m × ω², where m is the mass it has to move
//                  (both bodies seen as one, m1 m2 / (m1 + m2)) and ω = 2π × hertz: Box2D's knob,
//                  on our explicit spring. Box2D's own soft contact is a different solver.

const RADIUS = 0.1
const DIAMETER = 2 * RADIUS
const GRAVITY = 9.81
const STEP = 1 / 60

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
const plane = (normal, offset) => ({ normal, offset })
const inverseOf = (scene, i) => (scene.fixed?.[i] ? 0 : 1 / scene.mass[i])

// ---- the methods: each one advances a scene by one step ---------------------------------------------
const neighbours = (x) => {
  const pairs = []
  for (let i = 0; i < x.length; i++)
    for (let j = i + 1; j < x.length; j++)
      if (length(sub(x[i], x[j])) < 1.5 * DIAMETER) pairs.push([i, j])
  return pairs
}

// split: share each correction between the bodies as lighter copies, the mass splitting of
// chapter 018 (Tonge 2012), with the half and half count of 2n / (n + 1) copies for n contacts.
// The copies do the sharing, so the corrections are then simply added. Without split, a pair shares
// against the real masses and the particle combines its corrections with half and half.
// alpha: the solver sees a compressed mass m^alpha instead of m, the user's idea of chapter 029.
// 1 is the real mass, 0.5 turns a ratio of 100 into 10, 0 makes every particle weigh the same.
// Gravity still pulls on every particle the same way, as it does.
// height: Macklin's stiff stacks (section 5.2): during the contacts only, each particle weighs
// e^(-height x h) times its mass, h being its height above the floor, so lower ones look heavier.
// liquid: a contact that touches a particle marked as liquid uses the real masses (alpha 1).
// levels: the user's idea (chapter 029). Each particle keeps its level in the pile: 0 if it rests
// on the floor, one more than the lowest particle it rests on, none if it rests on nothing. A pair
// with both levels known weighs the lower one e^(levels x difference) times more; otherwise nothing
// changes. Levels are kept from one step to the next and updated with one pass per step.
const RESTS = 0.001 // touching, within 1 mm
const BELOW = 0.5 // the other one is below: the line between the centres within 60 degrees of vertical
const positions =
  (rounds, split = false, alpha = 1, { height = 0, liquid = () => false, levels = 0 } = {}) =>
  (scene, { x, v, level }) => {
    let lift = x.map(() => 1)
    const inverse = (i, a = alpha) => (inverseOf(scene, i) ? inverseOf(scene, i) ** a / lift[i] : 0)
    v = v.map((vi, i) => (inverseOf(scene, i) ? add(vi, [0, -GRAVITY * STEP, 0]) : vi))
    let p = x.map((xi, i) => (inverseOf(scene, i) ? add(xi, scale(v[i], STEP)) : xi))
    const pairs = neighbours(p)
    lift = p.map((pi) => Math.exp(-height * Math.max(pi[1] - RADIUS, 0)))
    // one pass of levels, from the positions at the start of the step and last step's levels
    level = level ?? x.map(() => Infinity)
    if (levels) {
      const next = x.map((xi) =>
        scene.planes.some(
          (pl) => pl.normal[1] > BELOW && dot(xi, pl.normal) - pl.offset - RADIUS < RESTS,
        )
          ? 0
          : Infinity,
      )
      for (const [i, j] of neighbours(x)) {
        const away = sub(x[i], x[j])
        const distance = length(away)
        if (distance - DIAMETER > RESTS) continue
        if (away[1] > BELOW * distance) next[i] = Math.min(next[i], level[j] + 1) // j is under i
        if (-away[1] > BELOW * distance) next[j] = Math.min(next[j], level[i] + 1) // i is under j
      }
      level = next
    }
    const tilt = (i, j) =>
      levels && Number.isFinite(level[i]) && Number.isFinite(level[j])
        ? Math.exp(levels * (level[i] - level[j]))
        : 1
    for (let r = 0; r < rounds; r++) {
      const touching = (pi) =>
        scene.planes.filter((pl) => RADIUS - (dot(pi, pl.normal) - pl.offset) > 0)
      const count = p.map((pi) => touching(pi).length)
      for (const [i, j] of pairs)
        if (DIAMETER - length(sub(p[i], p[j])) > 0) {
          count[i]++
          count[j]++
        }
      const copies = count.map((n) => (split && n ? (2 * n) / (n + 1) : 1))
      const lists = p.map(() => [])
      for (const [i, j] of pairs) {
        const away = sub(p[i], p[j])
        const distance = length(away)
        const overlap = DIAMETER - distance
        if (overlap <= 0) continue
        const a = liquid(i) || liquid(j) ? 1 : alpha
        const wi = inverse(i, a) * tilt(i, j)
        const wj = inverse(j, a)
        const both = wi * copies[i] + wj * copies[j]
        if (both === 0) continue
        const n = scale(away, 1 / distance)
        if (wi) lists[i].push(scale(n, (overlap * wi) / both))
        if (wj) lists[j].push(scale(n, (-overlap * wj) / both))
      }
      p.forEach((pi, i) => {
        if (!inverseOf(scene, i)) return
        for (const pl of touching(pi))
          lists[i].push(scale(pl.normal, (RADIUS - (dot(pi, pl.normal) - pl.offset)) / copies[i]))
      })
      p = p.map((pi, i) => {
        const l = lists[i]
        if (!l.length) return pi
        const sum = l.reduce(add, ZERO)
        return add(pi, split ? sum : scale(sum, (1 + 1 / l.length) / 2))
      })
    }
    return { x: p, v: p.map((pi, i) => scale(sub(pi, x[i]), 1 / STEP)), level }
  }

// stiffnessOf(m) gives a contact's stiffness from the mass it has to move; damperRatio 1 stops a
// bounce with no rebound.
const spring =
  (substeps, stiffnessOf, damperRatio) =>
  (scene, { x, v }) => {
    const h = STEP / substeps
    const pairs = neighbours(x)
    x = x.map((p) => [...p])
    v = v.map((p) => [...p])
    const contact = (m, overlap, closing) => {
      const k = stiffnessOf(m)
      return k * overlap - 2 * damperRatio * Math.sqrt(k * m) * closing
    }
    for (let s = 0; s < substeps; s++) {
      const force = x.map((_, i) =>
        inverseOf(scene, i) ? [0, -GRAVITY * scene.mass[i], 0] : [0, 0, 0],
      )
      for (const [i, j] of pairs) {
        const wi = inverseOf(scene, i)
        const wj = inverseOf(scene, j)
        if (wi + wj === 0) continue
        const away = sub(x[i], x[j])
        const distance = length(away)
        const overlap = DIAMETER - distance
        if (overlap <= 0) continue
        const n = scale(away, 1 / distance)
        const f = contact(1 / (wi + wj), overlap, dot(sub(v[i], v[j]), n))
        force[i] = add(force[i], scale(n, f))
        force[j] = sub(force[j], scale(n, f))
      }
      x.forEach((p, i) => {
        if (!inverseOf(scene, i)) return
        for (const pl of scene.planes) {
          const overlap = RADIUS - (dot(p, pl.normal) - pl.offset)
          if (overlap > 0)
            force[i] = add(
              force[i],
              scale(pl.normal, contact(scene.mass[i], overlap, dot(v[i], pl.normal))),
            )
        }
      })
      for (let i = 0; i < x.length; i++) {
        const w = inverseOf(scene, i)
        if (!w) continue
        v[i] = add(v[i], scale(force[i], w * h))
        x[i] = add(x[i], scale(v[i], h))
      }
    }
    return { x, v }
  }
const hertz = (f) => (m) => m * (2 * Math.PI * f) ** 2

const METHODS = [
  ['positions, half and half, 8 rounds', positions(8)],
  ['positions, half and half, split masses', positions(8, true)],
  ['spring, k = 50 000 N/m, damper 0.3', spring(8, () => 50000, 0.3)],
  ['spring in Hz, 30 Hz, damper 0.3', spring(8, hertz(30), 0.3)],
  ['spring in Hz, 60 Hz, damper 0.3', spring(8, hertz(60), 0.3)],
]

// ---- running and measuring ----------------------------------------------------------------------
// The state after `seconds`, and what the last second looked like: still moving means a position
// changed faster than 0.1 m/s.
const run = (scene, stepper, seconds, state) => {
  state = state ?? { x: scene.start.map((p) => [...p]), v: scene.start.map(() => [0, 0, 0]) }
  const moves = []
  for (let s = 0; s < Math.round(seconds / STEP); s++) {
    const before = state.x
    state = stepper(scene, state)
    if (state.x.some((p) => !p.every(Number.isFinite)) || state.v.some((p) => length(p) > 1000))
      return null
    moves.push(state.x.map((p, i) => length(sub(p, before[i])) / STEP))
  }
  const last = moves.slice(-60)
  const moving = state.x.filter(
    (_, i) => inverseOf(scene, i) && last.some((m) => m[i] > 0.1),
  ).length
  return { ...state, moving }
}
// The deepest overlap, between particles or with a plane, optionally only around particle `only`.
const deepest = (scene, x, only) => {
  let worst = 0
  x.forEach((p, i) => {
    for (let j = i + 1; j < x.length; j++)
      if (only === undefined || i === only || j === only)
        worst = Math.max(worst, DIAMETER - length(sub(p, x[j])))
    if (inverseOf(scene, i) && (only === undefined || i === only))
      for (const pl of scene.planes)
        worst = Math.max(worst, RADIUS - (dot(p, pl.normal) - pl.offset))
  })
  return worst
}
const mm = (m) => `${(m * 1000).toFixed(1)} mm`
const pad = (s, n) => String(s).padEnd(n)

// ---- 1. a light sphere under a heavy one ----------------------------------------------------------
console.log(
  '1. Two spheres on the floor, one on top of the other, after 8 s: how deep each contact is',
)
for (const [label, stepper] of METHODS) {
  const cells = []
  for (const [low, top] of [
    [1, 1],
    [1, 10],
    [1, 100],
    [100, 1],
  ]) {
    const scene = {
      start: [
        [0, RADIUS, 0],
        [0, RADIUS + DIAMETER, 0],
      ],
      mass: [low, top],
      planes: [plane([0, 1, 0], 0)],
    }
    const out = run(scene, stepper, 8)
    cells.push(
      out
        ? `${low}/${top} kg: floor ${mm(RADIUS - out.x[0][1])}, between ${mm(DIAMETER - (out.x[1][1] - out.x[0][1]))}${out.moving ? ', moving' : ''}`
        : `${low}/${top} kg: blows up`,
    )
  }
  console.log(`  ${pad(label, 36)} ${cells.join(' | ')}`)
}

// ---- 2 and 3. boxes -----------------------------------------------------------------------------
const box = (massOf) => {
  const next = random(1)
  const start = []
  for (let layer = 0; layer < 6; layer++)
    for (let a = 0; a < 6; a++)
      for (let b = 0; b < 6; b++)
        start.push([
          -0.5 + a * 0.2 + (next() - 0.5) * 0.04,
          0.3 + layer * 0.22,
          -0.5 + b * 0.2 + (next() - 0.5) * 0.04,
        ])
  const walls = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
  ].map((n) => plane(n, -0.6))
  const masses = random(3)
  return { start, mass: start.map(() => massOf(masses)), planes: [plane([0, 1, 0], 0), ...walls] }
}

console.log(
  '\n2. A box of 216 spheres of 1 kg settles for 4 s, then a sphere of 100 kg falls on it from 0.5 m above',
)
for (const [label, stepper] of METHODS) {
  const scene = box(() => 1)
  const settled = run(scene, stepper, 4)
  if (!settled) {
    console.log(`  ${pad(label, 36)} the box blows up`)
    continue
  }
  const top = Math.max(...settled.x.map((p) => p[1]))
  const heavy = {
    ...scene,
    start: [...scene.start, [0.05, top + 0.5, 0.05]],
    mass: [...scene.mass, 100],
  }
  const out = run(heavy, stepper, 4, {
    x: [...settled.x, [0.05, top + 0.5, 0.05]],
    v: [...settled.v, [0, 0, 0]],
  })
  console.log(
    `  ${pad(label, 36)} ${out ? `deepest around the heavy one ${mm(deepest(heavy, out.x, 216))}, anywhere ${mm(deepest(heavy, out.x))}, still moving ${out.moving}, heavy one at ${out.x[216][1].toFixed(2)} m` : 'blows up'}`,
  )
}

console.log('\n3. A box of 216 spheres, each between 1 and 10 kg at random, after 8 s')
for (const [label, stepper] of METHODS) {
  for (const [name, massOf] of [
    ['all 1 kg', () => 1],
    ['1 to 10 kg', (next) => 1 + 9 * next()],
  ]) {
    const scene = box(massOf)
    const out = run(scene, stepper, 8)
    console.log(
      `  ${pad(label, 36)} ${pad(name, 11)} ${out ? `deepest ${mm(deepest(scene, out.x))}, still moving ${out.moving}` : 'blows up'}`,
    )
  }
}

// ---- 4. compressed masses ------------------------------------------------------------------------
console.log('\n4. Half and half on positions, 8 rounds, with the solver seeing m^alpha')
for (const split of [false, true])
  for (const alpha of [1, 0.5, 0.25, 0]) {
    const stepper = positions(8, split, alpha)
    const cells = []
    for (const [low, top] of [
      [1, 10],
      [1, 100],
    ]) {
      const scene = {
        start: [
          [0, RADIUS, 0],
          [0, RADIUS + DIAMETER, 0],
        ],
        mass: [low, top],
        planes: [plane([0, 1, 0], 0)],
      }
      const out = run(scene, stepper, 8)
      cells.push(`column ${low}/${top}: ${mm(DIAMETER - (out.x[1][1] - out.x[0][1]))}`)
    }
    const scene = box(() => 1)
    const settled = run(scene, stepper, 4)
    const top = Math.max(...settled.x.map((p) => p[1]))
    const heavy = {
      ...scene,
      start: [...scene.start, [0.05, top + 0.5, 0.05]],
      mass: [...scene.mass, 100],
    }
    const out = run(heavy, stepper, 4, {
      x: [...settled.x, [0.05, top + 0.5, 0.05]],
      v: [...settled.v, [0, 0, 0]],
    })
    cells.push(`heavy ball: ends at ${out.x[216][1].toFixed(2)} m, ${out.moving} moving`)
    const mixed = box((next) => 1 + 9 * next())
    const m = run(mixed, stepper, 8)
    cells.push(`mixed box: ${mm(deepest(mixed, m.x))}, ${m.moving} moving`)
    console.log(
      `  ${split ? 'split masses' : 'plain       '} alpha ${String(alpha).padEnd(4)} ${cells.join(' | ')}`,
    )
  }

// ---- 5. Macklin's stiff stacks, alone and with compressed masses ----------------------------------
console.log("\n5. Half and half on positions, 8 rounds, with Macklin's height factor e^(-c h)")
const columnOf = (masses) => ({
  start: masses.map((_, i) => [0, RADIUS + DIAMETER * i, 0]),
  mass: masses,
  planes: [plane([0, 1, 0], 0)],
})
for (const alpha of [1, 0.5])
  for (const height of [0, 1, 3, 5]) {
    const stepper = positions(8, false, alpha, { height })
    const ten = run(columnOf(new Array(10).fill(1)), stepper, 8)
    const pair = run(columnOf([1, 100]), stepper, 8)
    const even = box(() => 1)
    const e = run(even, stepper, 8)
    const mixed = box((next) => 1 + 9 * next())
    const m = run(mixed, stepper, 8)
    const scene = box(() => 1)
    const settled = run(scene, stepper, 4)
    const top = Math.max(...settled.x.map((p) => p[1]))
    const heavy = {
      ...scene,
      start: [...scene.start, [0.05, top + 0.5, 0.05]],
      mass: [...scene.mass, 100],
    }
    const h = run(heavy, stepper, 4, {
      x: [...settled.x, [0.05, top + 0.5, 0.05]],
      v: [...settled.v, [0, 0, 0]],
    })
    console.log(
      `  alpha ${String(alpha).padEnd(3)} c ${height} | column of 10 x 1 kg: top ${ten.x[9][1].toFixed(3)} m (1.900) | column 1/100: ${mm(DIAMETER - (pair.x[1][1] - pair.x[0][1]))} | box 1 kg: ${mm(deepest(even, e.x))}, ${e.moving} moving | box 1-10 kg: ${mm(deepest(mixed, m.x))}, ${m.moving} moving | heavy ball ends at ${h.x[216][1].toFixed(2)} m, ${h.moving} moving`,
    )
  }

// ---- 6. the heavy ball and a liquid ---------------------------------------------------------------
console.log('\n6. The heavy ball, with alpha 0.5 for solids, when the heap is marked as liquid')
for (const marked of [false, true]) {
  const stepper = positions(8, false, 0.5, { liquid: (i) => marked && i < 216 })
  const scene = box(() => 1)
  const settled = run(scene, stepper, 4)
  const top = Math.max(...settled.x.map((p) => p[1]))
  const heavy = {
    ...scene,
    start: [...scene.start, [0.05, top + 0.5, 0.05]],
    mass: [...scene.mass, 100],
  }
  const h = run(heavy, stepper, 4, {
    x: [...settled.x, [0.05, top + 0.5, 0.05]],
    v: [...settled.v, [0, 0, 0]],
  })
  console.log(
    `  heap ${marked ? 'liquid' : 'solid '}: the heavy ball ends at ${h.x[216][1].toFixed(2)} m, ${h.moving} moving`,
  )
}

// ---- 7. levels in the pile instead of height ----------------------------------------------------
// Two spheres of 1 kg meet in the air, one 10 cm higher than the other, flying at 2 m/s toward each
// other. Nothing outside pushes them sideways, so after the hit their centre of mass must still have
// no sideways speed.
const midAir = (stepper) => {
  const scene = {
    start: [
      [-0.3, 3, 0],
      [0.3, 3.1, 0],
    ],
    mass: [1, 1],
    planes: [],
  }
  let state = {
    x: scene.start,
    v: [
      [2, 0, 0],
      [-2, 0, 0],
    ],
  }
  for (let s = 0; s < 30; s++) state = stepper(scene, state)
  return (state.v[0][0] + state.v[1][0]) / 2
}
console.log('\n7. Levels in the pile (per level) against height above the floor (per meter)')
for (const [label, alpha, opts] of [
  ['nothing', 1, {}],
  ['height, c = 5 per meter', 1, { height: 5 }],
  ['levels, c = 1 per level', 1, { levels: 1 }],
  ['levels, c = 2 per level', 1, { levels: 2 }],
  ['alpha 0.5 + height, c = 5', 0.5, { height: 5 }],
  ['alpha 0.5 + levels, c = 1 per level', 0.5, { levels: 1 }],
  ['alpha 0.5 + levels, c = 2 per level', 0.5, { levels: 2 }],
]) {
  const stepper = positions(8, false, alpha, opts)
  const ten = run(columnOf(new Array(10).fill(1)), stepper, 8)
  const pair = run(columnOf([1, 100]), stepper, 8)
  const even = box(() => 1)
  const e = run(even, stepper, 8)
  const mixed = box((next) => 1 + 9 * next())
  const m = run(mixed, stepper, 8)
  console.log(
    `  ${pad(label, 34)} column of 10: top ${ten.x[9][1].toFixed(3)} m | column 1/100: ${mm(DIAMETER - (pair.x[1][1] - pair.x[0][1]))} | box 1 kg: ${mm(deepest(even, e.x))}, ${e.moving} moving | box 1-10 kg: ${mm(deepest(mixed, m.x))}, ${m.moving} moving | mid-air hit, sideways speed of the pair: ${midAir(stepper).toFixed(3)} m/s`,
  )
}
