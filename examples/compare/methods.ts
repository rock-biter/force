// The ways of pushing touching particles apart that we studied in chapters 025 to 030, in
// JavaScript, all with masses. Each one advances a world by one step of 1/60 s. They follow the
// scripts the chapters' numbers come from (docs/topics/collision-response.mjs, mass-ratio.mjs).

export type Vec3 = [number, number, number]
export interface Plane {
  normal: Vec3
  offset: number
}

export const RADIUS = 0.1
export const DIAMETER = 2 * RADIUS
export const STEP = 1 / 60
const GRAVITY = 9.81

/** A world as a method sees it. w is 1 / mass, 0 for a particle that never moves. */
export interface World {
  x: Vec3[]
  v: Vec3[]
  w: number[]
  planes: Plane[]
}

export interface Method {
  label: string
  /** Where the idea comes from: an author, a paper. */
  source: string
  /** The logbook chapters that tell how we met it and what it did, by their file names. */
  logbook: string[]
  /** Makes the stepper for one world: it may keep memory of its own, such as levels or pushes. */
  create(): (world: World) => void
}

// ---- vectors and neighbours ------------------------------------------------------------------------
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
const ZERO: Vec3 = [0, 0, 0]

/** Every pair closer than `reach`, found through cells as wide as `reach`. */
export function pairsWithin(x: Vec3[], reach: number): [number, number][] {
  const cells = new Map<number, number[]>()
  const key = (cx: number, cy: number, cz: number) =>
    cx + 512 + 1024 * (cy + 512 + 1024 * (cz + 512))
  const coords = x.map((p) => p.map((c) => Math.floor(c / reach)) as Vec3)
  coords.forEach(([cx, cy, cz], i) => {
    const k = key(cx, cy, cz)
    const list = cells.get(k)
    if (list) list.push(i)
    else cells.set(k, [i])
  })
  const pairs: [number, number][] = []
  coords.forEach(([cx, cy, cz], i) => {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of cells.get(key(cx + dx, cy + dy, cz + dz)) ?? [])
            if (j > i && length(sub(x[i], x[j])) < reach) pairs.push([i, j])
  })
  return pairs
}

const gravityAndPredict = (world: World, h: number): Vec3[] => {
  world.v = world.v.map((v, i) => (world.w[i] ? add(v, [0, -GRAVITY * h, 0]) : v))
  return world.x.map((x, i) => (world.w[i] ? add(x, scale(world.v[i], h)) : x))
}
const finishPositions = (world: World, p: Vec3[], h: number) => {
  world.v = p.map((pi, i) => (world.w[i] ? scale(sub(pi, world.x[i]), 1 / h) : world.v[i]))
  world.x = p
}

// ---- 1. moving positions ---------------------------------------------------------------------------
type Rule = (list: Vec3[]) => Vec3
const sumOf = (l: Vec3[]) => l.reduce(add, ZERO)
const averageOf = (l: Vec3[]) => (l.length ? scale(sumOf(l), 1 / l.length) : ZERO)
const RULES: Record<string, Rule> = {
  sum: sumOf,
  average: averageOf,
  averageMore: (l) => scale(averageOf(l), 1.5),
  // Lomarco position sum and average: half the sum plus half the average (chapter 026)
  sumAndAverage: (l) => scale(add(sumOf(l), averageOf(l)), 0.5),
  axisMaximum: (l) =>
    [0, 1, 2].map(
      (a) => Math.max(0, ...l.map((c) => c[a])) + Math.min(0, ...l.map((c) => c[a])),
    ) as Vec3,
}

interface PositionOptions {
  /** Passes over the contacts in each substep. */
  rounds?: number
  /** The step is cut into this many substeps, each with its own rounds. */
  substeps?: number
  /** The solver sees m^alpha (chapter 029). */
  alpha?: number
  /** Levels in the pile: a pair weighs the lower one e^(levels × difference) more (chapter 029). */
  levels?: number
  /** Macklin's stiff stacks: during contacts each particle weighs e^(-height × h) times more (chapter 029). */
  height?: number
}

/** `options` is read again at every step, so a page can change it while the world runs. */
function positions(rule: Rule, options: () => PositionOptions) {
  return () => {
    let level: number[] = []
    return (world: World) => {
      const { rounds = 8, substeps = 1 } = options()
      for (let s = 0; s < substeps; s++)
        level = positionSubstep(world, rule, rounds, STEP / substeps, options(), level)
    }
  }
}

function positionSubstep(
  world: World,
  rule: Rule,
  rounds: number,
  h: number,
  options: PositionOptions,
  previous: number[],
): number[] {
  const { alpha = 1, levels = 0, height = 0 } = options
  let level = previous
  const p = gravityAndPredict(world, h)
  const pairs = pairsWithin(p, 1.5 * DIAMETER)
  if (level.length !== p.length) level = p.map(() => Number.POSITIVE_INFINITY)
  if (levels) {
    // one pass per substep, from the last levels: 0 on the floor, one more than what it rests on
    const next = p.map((pi) =>
      world.planes.some(
        (pl) => pl.normal[1] > 0.5 && dot(pi, pl.normal) - pl.offset - RADIUS < 0.001,
      )
        ? 0
        : Number.POSITIVE_INFINITY,
    )
    for (const [i, j] of pairs) {
      const away = sub(p[i], p[j])
      const distance = length(away)
      if (distance - DIAMETER > 0.001) continue
      if (away[1] > 0.5 * distance) next[i] = Math.min(next[i], level[j] + 1)
      if (-away[1] > 0.5 * distance) next[j] = Math.min(next[j], level[i] + 1)
    }
    level = next
  }
  const lift = p.map((pi) => Math.exp(-height * Math.max(pi[1] - RADIUS, 0)))
  const inverse = (i: number) => (world.w[i] ? world.w[i] ** alpha / lift[i] : 0)
  let current = p
  for (let r = 0; r < rounds; r++) {
    const lists: Vec3[][] = current.map(() => [])
    for (const [i, j] of pairs) {
      const away = sub(current[i], current[j])
      const distance = length(away)
      const overlap = DIAMETER - distance
      if (overlap <= 0 || distance === 0) continue
      const tilt =
        levels && Number.isFinite(level[i]) && Number.isFinite(level[j])
          ? Math.exp(levels * (level[i] - level[j]))
          : 1
      const wi = inverse(i) * tilt
      const wj = inverse(j)
      if (wi + wj === 0) continue
      const n = scale(away, 1 / distance)
      if (wi) lists[i].push(scale(n, (overlap * wi) / (wi + wj)))
      if (wj) lists[j].push(scale(n, (-overlap * wj) / (wi + wj)))
    }
    current.forEach((pi, i) => {
      if (!world.w[i]) return
      for (const pl of world.planes) {
        const overlap = RADIUS - (dot(pi, pl.normal) - pl.offset)
        if (overlap > 0) lists[i].push(scale(pl.normal, overlap))
      }
    })
    current = current.map((pi, i) => (lists[i].length ? add(pi, rule(lists[i])) : pi))
  }
  finishPositions(world, current, h)
  return level
}

// ---- 2. changing velocities --------------------------------------------------------------------------
// Catto's velocity rule with a 20% nudge, his stored pushes and pushes that can be taken back, the
// copies of mass splitting counted as in the Lomarco sum and average, and Box2D's relax rounds
// (chapter 027).
function velocities(rounds: number, relax: number) {
  const NUDGE = 0.2
  interface Contact {
    i: number
    j: number // -1 for a plane
    plane: number
    normal: Vec3
    gap: number
    key: string
  }
  const contactsOf = (world: World, x: Vec3[]): Contact[] => {
    const list: Contact[] = []
    x.forEach((xi, i) => {
      if (!world.w[i]) return
      world.planes.forEach((pl, k) => {
        const gap = dot(xi, pl.normal) - pl.offset - RADIUS
        if (gap < RADIUS)
          list.push({ i, j: -1, plane: k, normal: pl.normal, gap, key: `${i}p${k}` })
      })
    })
    for (const [i, j] of pairsWithin(x, 1.5 * DIAMETER)) {
      if (!world.w[i] && !world.w[j]) continue
      const away = sub(x[i], x[j])
      const distance = length(away)
      list.push({
        i,
        j,
        plane: -1,
        normal: scale(away, 1 / distance),
        gap: distance - DIAMETER,
        key: `${i}:${j}`,
      })
    }
    return list
  }
  const solve = (
    world: World,
    v: Vec3[],
    contacts: Contact[],
    count: number,
    nudge: number,
    push: Map<string, number>,
    warm: boolean,
  ) => {
    const w = world.w
    if (warm)
      for (const c of contacts) {
        const old = push.get(c.key) ?? 0
        v[c.i] = add(v[c.i], scale(c.normal, w[c.i] * old))
        if (c.j >= 0) v[c.j] = sub(v[c.j], scale(c.normal, w[c.j] * old))
      }
    const target = (c: Contact) => (c.gap > 0 ? -c.gap / STEP : (nudge * -c.gap) / STEP)
    const approach = (c: Contact) => dot(sub(v[c.i], c.j >= 0 ? v[c.j] : ZERO), c.normal)
    const pushing = v.map(() => 0)
    for (const c of contacts)
      if (c.gap <= 0 || (push.get(c.key) ?? 0) > 0 || approach(c) < target(c)) {
        pushing[c.i]++
        if (c.j >= 0) pushing[c.j]++
      }
    const copies = pushing.map((n) => (n > 1 ? (2 * n) / (n + 1) : 1)) // Lomarco sum and average
    for (let r = 0; r < count; r++) {
      const change: Vec3[] = v.map(() => [0, 0, 0])
      for (const c of contacts) {
        const split = w[c.i] * copies[c.i] + (c.j >= 0 ? w[c.j] * copies[c.j] : 0)
        if (split === 0) continue
        const old = push.get(c.key) ?? 0
        const total = Math.max(old + (target(c) - approach(c)) / split, 0)
        push.set(c.key, total)
        const delta = total - old
        change[c.i] = add(change[c.i], scale(c.normal, w[c.i] * delta))
        if (c.j >= 0) change[c.j] = sub(change[c.j], scale(c.normal, w[c.j] * delta))
      }
      v = v.map((vi, i) => add(vi, change[i]))
    }
    return v
  }
  return () => {
    let stored = new Map<string, number>()
    return (world: World) => {
      let v = world.v.map((vi, i) => (world.w[i] ? add(vi, [0, -GRAVITY * STEP, 0]) : vi))
      const contacts = contactsOf(world, world.x)
      const push = new Map<string, number>()
      for (const c of contacts) push.set(c.key, stored.get(c.key) ?? 0)
      v = solve(world, v, contacts, rounds, NUDGE, push, true)
      world.x = world.x.map((xi, i) => (world.w[i] ? add(xi, scale(v[i], STEP)) : xi))
      // relax: the same contacts measured again, no nudge, from the pushes just found
      const again = contacts.map((c) => {
        if (c.j < 0) {
          const pl = world.planes[c.plane]
          return { ...c, gap: dot(world.x[c.i], pl.normal) - pl.offset - RADIUS }
        }
        const away = sub(world.x[c.i], world.x[c.j])
        const distance = length(away)
        return { ...c, normal: scale(away, 1 / distance), gap: distance - DIAMETER }
      })
      world.v = solve(world, v, again, relax, 0, push, false)
      stored = push
    }
  }
}

// ---- 3. springs ----------------------------------------------------------------------------------
// A spring and a damper on every overlap, the step cut into substeps. stiffnessOf(m) gives a
// contact's stiffness from the mass it moves (both bodies seen as one).
function springs(substeps: number, stiffnessOf: (m: number) => number, damper: number) {
  return () => (world: World) => {
    const h = STEP / substeps
    const pairs = pairsWithin(world.x, 1.5 * DIAMETER)
    let { x, v } = world
    const w = world.w
    const contact = (m: number, overlap: number, closing: number) => {
      const k = stiffnessOf(m)
      return k * overlap - 2 * damper * Math.sqrt(k * m) * closing
    }
    for (let s = 0; s < substeps; s++) {
      const force: Vec3[] = x.map((_, i) => (w[i] ? [0, -GRAVITY / w[i], 0] : [0, 0, 0]))
      for (const [i, j] of pairs) {
        if (w[i] + w[j] === 0) continue
        const away = sub(x[i], x[j])
        const distance = length(away)
        const overlap = DIAMETER - distance
        if (overlap <= 0) continue
        const n = scale(away, 1 / distance)
        const f = contact(1 / (w[i] + w[j]), overlap, dot(sub(v[i], v[j]), n))
        force[i] = add(force[i], scale(n, f))
        force[j] = sub(force[j], scale(n, f))
      }
      x.forEach((p, i) => {
        if (!w[i]) return
        for (const pl of world.planes) {
          const overlap = RADIUS - (dot(p, pl.normal) - pl.offset)
          if (overlap > 0)
            force[i] = add(
              force[i],
              scale(pl.normal, contact(1 / w[i], overlap, dot(v[i], pl.normal))),
            )
        }
      })
      v = v.map((vi, i) => (w[i] ? add(vi, scale(force[i], w[i] * h)) : vi))
      x = x.map((xi, i) => (w[i] ? add(xi, scale(v[i], h)) : xi))
    }
    world.x = x
    world.v = v
  }
}
const hertz = (f: number) => (m: number) => m * (2 * Math.PI * f) ** 2

/** FORCE+ as decision 015 sets it. */
export const FORCE_PLUS = { alpha: 0.5, levels: 2, rounds: 8, substeps: 1 }
/**
 * The knobs of the tunable copy of FORCE+, which the page changes while the worlds run. It starts
 * with a gentler level strength than decision 015, as the user asked.
 */
export const tunable = { ...FORCE_PLUS, levels: 1.5 }

// ---- the list -------------------------------------------------------------------------------------
export const METHODS: Record<string, Method> = {
  forcePlus: {
    label: 'FORCE+',
    source:
      'Lomarco position sum and average, masses m^0.5, levels in the pile: Macklin 2014 §5.2, improved',
    logbook: ['026-the-marble-in-the-pocket', '029-heavy-on-light', '030-the-lazy-list'],
    create: positions(RULES.sumAndAverage, () => FORCE_PLUS),
  },
  forcePlusTuned: {
    label: 'FORCE+ tunable',
    source: 'FORCE+ with the knobs at the top of the page',
    logbook: ['029-heavy-on-light'],
    create: positions(RULES.sumAndAverage, () => tunable),
  },
  force: {
    label: 'FORCE',
    source: 'Lomarco position sum and average',
    logbook: ['026-the-marble-in-the-pocket'],
    create: positions(RULES.sumAndAverage, () => ({})),
  },
  average: {
    label: 'Constraint averaging',
    source: 'Macklin, Müller, Chentanez, Kim 2014, §4.2',
    logbook: ['026-the-marble-in-the-pocket', '028-the-ranking'],
    create: positions(RULES.average, () => ({})),
  },
  averageMore: {
    label: 'Averaging × 1.5 (SOR)',
    source: 'Macklin, Müller, Chentanez, Kim 2014, §4.3',
    logbook: ['026-the-marble-in-the-pocket'],
    create: positions(RULES.averageMore, () => ({})),
  },
  sum: {
    label: 'Jacobi sum',
    source: 'Macklin, Müller, Chentanez, Kim 2014, §4.2',
    logbook: ['026-the-marble-in-the-pocket', '028-the-ranking'],
    create: positions(RULES.sum, () => ({})),
  },
  stiffStacks: {
    label: 'Stiff stacks',
    source: 'Macklin, Müller, Chentanez, Kim 2014, §5.2',
    logbook: ['029-heavy-on-light'],
    create: positions(RULES.sumAndAverage, () => ({ height: 5 })),
  },
  axisMaximum: {
    label: 'Largest push per axis',
    source: 'Lomarco, a test set aside',
    logbook: ['026-the-marble-in-the-pocket'],
    create: positions(RULES.axisMaximum, () => ({})),
  },
  spring: {
    label: 'Spring (DEM)',
    source: 'Green 2010, Harada 2007 · 50 000 N/m, 8 substeps',
    logbook: ['025-the-pillow', '028-the-ranking'],
    create: springs(8, () => 50000, 0.3),
  },
  springHertz: {
    label: 'Spring in hertz',
    source: 'Catto, Box2D Soft Step · 60 Hz, 8 substeps',
    logbook: ['015-the-stiff-spring', '029-heavy-on-light', '030-the-lazy-list'],
    create: springs(8, hertz(60), 0.3),
  },
  velocities: {
    label: 'Velocities + relax',
    source: 'Catto 2005, Tonge 2012, Box2D · 4 + 4 rounds',
    logbook: ['027-the-stored-nudge', '028-the-ranking'],
    create: velocities(4, 4),
  },
}

export const DEFAULT_PANES = [
  'forcePlus',
  'forcePlusTuned',
  'force',
  'average',
  'stiffStacks',
  'spring',
  'springHertz',
  'velocities',
]

/** The deepest overlap, between particles or with a plane, and how many move faster than 0.1 m/s. */
export function measure(world: World): { deepest: number; moving: number } {
  let deepest = 0
  for (const [i, j] of pairsWithin(world.x, DIAMETER))
    deepest = Math.max(deepest, DIAMETER - length(sub(world.x[i], world.x[j])))
  world.x.forEach((p, i) => {
    if (!world.w[i]) return
    for (const pl of world.planes)
      deepest = Math.max(deepest, RADIUS - (dot(p, pl.normal) - pl.offset))
  })
  const moving = world.v.filter((v, i) => world.w[i] && length(v) > 0.1).length
  return { deepest, moving }
}
