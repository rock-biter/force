// Can the particles of FORCE have different sizes, and where does it stop working?
// Run it with: node docs/topics/mixed-sizes.mjs   (a few minutes)
//
// The solver of the live page, on the CPU and in 3D: 60 steps per second, each cut into 2 substeps
// of 3 rounds of half and half (decision 029), masses seen as m^0.5, levels with c = 1.5, no
// friction. What changes: every sphere has its own radius. Two touch when their centers are closer
// than the sum of their radii, and a sphere weighs as its volume.
//
// As on the GPU, a sphere pushes only the neighbours in its list, which holds 32 of them at most.
// The lists are made at every substep, through cells as wide as the widest pair that can touch,
// two of the largest radii, plus the margin: a sphere looks into 3 × 3 × 3 cells.

const BIG = 0.1 // meters: the radius of the large spheres, as in every scene so far
const GRAVITY = 9.81
const STEP = 1 / 60
const SUBSTEPS = 2
const ROUNDS = 3
const ALPHA = 0.5
const LEVELS = 1.5
const RESTS = 0.001 // touching, within 1 mm
const BELOW = 0.5 // the other one is below: within 60 degrees of straight down
const HALF = 0.6 // the box is 1.2 m wide
const NO_LEVEL = 1e9

const random = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// The floor and four walls: a normal and how far the plane is from the origin along it.
const BOX = [
  [0, 1, 0, 0],
  [1, 0, 0, -HALF],
  [-1, 0, 0, -HALF],
  [0, 0, 1, -HALF],
  [0, 0, -1, -HALF],
]

/** A world of n spheres. `w` is 1 / mass, 0 for a sphere held still. */
function world(spheres, options = {}) {
  const n = spheres.length
  const s = {
    n,
    x: new Float64Array(3 * n),
    v: new Float64Array(3 * n),
    r: new Float64Array(n),
    w: new Float64Array(n),
    level: new Float64Array(n).fill(NO_LEVEL),
    planes: options.planes ?? BOX,
    gravity: options.gravity ?? GRAVITY,
    perStep: options.substeps ?? SUBSTEPS,
    cap: options.cap ?? 32, // neighbours a list holds
    margin: options.margin ?? 0, // how far beyond touching the lists look, in meters
    limit: options.limit ?? (() => Number.POSITIVE_INFINITY), // the top speed of a sphere of radius r
    dropped: 0, // neighbours that found a list full, so far
    longest: 0, // the longest list so far, had it no end
    looked: 0, // spheres looked at to make the lists, so far
    listed: 0, // neighbours in the lists, so far
    substeps: 0,
  }
  spheres.forEach((p, i) => {
    s.x.set(p.at, 3 * i)
    if (p.speed) s.v.set(p.speed, 3 * i)
    s.r[i] = p.radius
    // the same stuff: mass as the volume. With `sameMass`, every sphere weighs the same.
    s.w[i] = p.fixed ? 0 : options.sameMass ? 1 : 1 / p.radius ** 3
  })
  s.widest = Math.max(...s.r)
  return s
}

/**
 * The lists of neighbours of positions p: for each sphere, the ones closer than touching plus the
 * margin, `cap` of them at most. Cells as wide as two of the largest radii plus the margin.
 */
function makeLists(s, p) {
  const { n, r, cap } = s
  const cell = 2 * s.widest + s.margin
  const key = (a, b, c) => a + 512 + (b + 512) * 1024 + (c + 512) * 1048576
  const cells = new Map()
  const at = new Int32Array(3 * n)
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) at[3 * i + a] = Math.floor(p[3 * i + a] / cell)
    const k = key(at[3 * i], at[3 * i + 1], at[3 * i + 2])
    const list = cells.get(k)
    if (list) list.push(i)
    else cells.set(k, [i])
  }
  const lists = new Int32Array(n * cap)
  const counts = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    let found = 0
    for (let da = -1; da <= 1; da++)
      for (let db = -1; db <= 1; db++)
        for (let dc = -1; dc <= 1; dc++) {
          const list = cells.get(key(at[3 * i] + da, at[3 * i + 1] + db, at[3 * i + 2] + dc))
          if (!list) continue
          s.looked += list.length
          for (const j of list) {
            if (j === i) continue
            const dx = p[3 * i] - p[3 * j]
            const dy = p[3 * i + 1] - p[3 * j + 1]
            const dz = p[3 * i + 2] - p[3 * j + 2]
            const reach = r[i] + r[j] + s.margin
            if (dx * dx + dy * dy + dz * dz >= reach * reach) continue
            if (found < cap) lists[i * cap + found] = j
            else s.dropped++
            found++
          }
        }
    counts[i] = Math.min(found, cap)
    s.listed += counts[i]
    if (found > s.longest) s.longest = found
  }
  return { lists, counts }
}

/** One substep of length h: predict, lists, levels, rounds, then the speed and its limit. */
function substep(s, h) {
  const { n, x, v, r, w, cap, planes } = s
  let p = new Float64Array(3 * n)
  for (let i = 0; i < n; i++) {
    if (w[i]) v[3 * i + 1] -= s.gravity * h
    for (let a = 0; a < 3; a++) p[3 * i + a] = x[3 * i + a] + (w[i] ? v[3 * i + a] * h : 0)
  }
  const { lists, counts } = makeLists(s, p)
  s.substeps++
  // The levels of the pile: 0 on the floor, one more than the lowest sphere it rests on.
  const level = new Float64Array(n).fill(NO_LEVEL)
  for (let i = 0; i < n; i++) {
    if (p[3 * i + 1] - r[i] < RESTS) level[i] = 0
    for (let k = 0; k < counts[i]; k++) {
      const j = lists[i * cap + k]
      const dx = p[3 * i] - p[3 * j]
      const dy = p[3 * i + 1] - p[3 * j + 1]
      const dz = p[3 * i + 2] - p[3 * j + 2]
      const distance = Math.hypot(dx, dy, dz)
      if (distance - r[i] - r[j] > RESTS || dy <= BELOW * distance) continue
      if (s.level[j] !== NO_LEVEL) level[i] = Math.min(level[i], s.level[j] + 1)
    }
  }
  s.level = level
  const light = w.map((wi) => (wi ? wi ** ALPHA : 0))
  for (let round = 0; round < ROUNDS; round++) {
    const q = new Float64Array(p)
    for (let i = 0; i < n; i++) {
      if (!w[i]) continue
      let sx = 0
      let sy = 0
      let sz = 0
      let pushes = 0
      for (let k = 0; k < counts[i]; k++) {
        const j = lists[i * cap + k]
        const dx = p[3 * i] - p[3 * j]
        const dy = p[3 * i + 1] - p[3 * j + 1]
        const dz = p[3 * i + 2] - p[3 * j + 2]
        const distance = Math.hypot(dx, dy, dz)
        const overlap = r[i] + r[j] - distance
        if (overlap <= 0 || distance === 0) continue
        const known = level[i] !== NO_LEVEL && level[j] !== NO_LEVEL
        const wi = light[i] * (known ? Math.exp(LEVELS * (level[i] - level[j])) : 1)
        const share = ((overlap / distance) * wi) / (wi + light[j])
        sx += dx * share
        sy += dy * share
        sz += dz * share
        pushes++
      }
      for (const [a, b, c, offset] of planes) {
        const overlap = r[i] - (p[3 * i] * a + p[3 * i + 1] * b + p[3 * i + 2] * c - offset)
        if (overlap <= 0) continue
        sx += a * overlap
        sy += b * overlap
        sz += c * overlap
        pushes++
      }
      if (!pushes) continue
      const part = 0.5 + 0.5 / pushes // half and half
      q[3 * i] += sx * part
      q[3 * i + 1] += sy * part
      q[3 * i + 2] += sz * part
    }
    p = q
  }
  for (let i = 0; i < n; i++) {
    if (!w[i]) continue
    let speed = 0
    for (let a = 0; a < 3; a++) {
      v[3 * i + a] = (p[3 * i + a] - x[3 * i + a]) / h
      speed += v[3 * i + a] ** 2
    }
    const most = s.limit(r[i], h)
    speed = Math.sqrt(speed)
    if (speed > most) for (let a = 0; a < 3; a++) v[3 * i + a] *= most / speed
  }
  s.x = p
}
const step = (s) => {
  for (let k = 0; k < s.perStep; k++) substep(s, STEP / s.perStep)
}

// ---- part 1: a mix that settles ---------------------------------------------------------------
/**
 * 100 places of 22 cm, 5 × 5 in 4 layers, starting 30 cm above the floor. Half of them hold one
 * large sphere, the others a block of k × k × k small ones, as many as fit: about half of the
 * volume each. With `share` 0 every place holds small ones.
 */
function mix(ratio, share = 0.5, seed = 1) {
  const next = random(seed)
  const small = BIG / ratio
  const k = Math.floor(ratio + 1e-9)
  const spheres = []
  const SLOT = 0.22
  for (let layer = 0; layer < 4; layer++)
    for (let a = 0; a < 5; a++)
      for (let b = 0; b < 5; b++) {
        const center = [(a - 2) * SLOT, 0.3 + BIG + layer * SLOT, (b - 2) * SLOT]
        const jitter = () => (next() - 0.5) * 0.004
        if (next() < share) {
          spheres.push({ radius: BIG, at: center.map((c) => c + jitter()) })
          continue
        }
        const pitch = (2 * BIG) / k
        for (let i = 0; i < k; i++)
          for (let j = 0; j < k; j++)
            for (let l = 0; l < k; l++)
              spheres.push({
                radius: small,
                at: [i, j, l].map((m, axis) => center[axis] - BIG + (m + 0.5) * pitch + jitter()),
              })
      }
  return spheres
}

/** Every pair that overlaps, whatever the lists say: how many, and how deep, in radii of the smaller. */
function overlaps(s) {
  const all = { ...s, cap: 4096, margin: 0, dropped: 0, longest: 0, looked: 0, listed: 0 }
  const { lists, counts } = makeLists(all, s.x)
  let deep = 0
  let deepest = 0
  for (let i = 0; i < s.n; i++)
    for (let k = 0; k < counts[i]; k++) {
      const j = lists[i * all.cap + k]
      if (j < i) continue
      const distance = Math.hypot(...[0, 1, 2].map((a) => s.x[3 * i + a] - s.x[3 * j + a]))
      const depth = (s.r[i] + s.r[j] - distance) / Math.min(s.r[i], s.r[j])
      if (depth > 0.1) deep++
      deepest = Math.max(deepest, depth)
    }
  return { deep, deepest }
}

/** Lets a mix fall and settle for 4 s, and says what happened. */
function settle(ratio, options) {
  const small = BIG / ratio
  const s = world(mix(ratio, options.share), { margin: 0.5 * small, ...options })
  let top = 0
  for (let i = 0; i < s.n; i++) top = Math.max(top, s.x[3 * i + 1])
  let highest = 0
  for (let t = 0; t < 240; t++) {
    step(s)
    for (let i = 0; i < s.n; i++) {
      if (!Number.isFinite(s.x[3 * i + 1])) return null
      highest = Math.max(highest, s.x[3 * i + 1] - top)
    }
  }
  let moving = 0
  for (let i = 0; i < s.n; i++)
    if (Math.hypot(s.v[3 * i], s.v[3 * i + 1], s.v[3 * i + 2]) > 0.1) moving++
  return {
    n: s.n,
    mean: s.listed / s.substeps / s.n,
    longest: s.longest,
    dropped: s.dropped / s.substeps,
    looked: s.looked / s.substeps / s.n,
    splash: highest * 100,
    moving,
    ...overlaps(s),
  }
}

const pad = (value, width) => String(value).padStart(width)
function line(tag, out) {
  if (!out) return console.log(`${tag}  blows up`)
  console.log(
    `${tag} ${pad(out.n, 5)} | ${pad(out.mean.toFixed(1), 5)} ${pad(out.longest, 4)} ${pad(out.dropped.toFixed(0), 7)} | ` +
      `${pad(out.looked.toFixed(0), 6)} | ${pad(out.deep, 5)} ${pad(`${(out.deepest * 100).toFixed(0)}%`, 6)} | ` +
      `${pad(out.moving, 5)} ${pad(`${out.splash.toFixed(0)} cm`, 7)}`,
  )
}
const HEAD =
  '                          spheres |  mean  max  left out | looked |  deep deepest | moving  splash'

console.log('Part 1. A mix of large spheres, radius 10 cm, and small ones falls into a box and')
console.log(
  'settles for 4 s. Lists: the mean length, the longest had it no end, and the neighbours',
)
console.log('left out of full lists per substep. Looked: spheres a sphere reads to make its list.')
console.log(
  'Deep: pairs that overlap by more than a tenth of the smaller radius at the end, and the',
)
console.log('deepest. Moving: faster than 0.1 m/s at the end. Splash: how far above the start a')
console.log('sphere flew. The margin of the lists is half the smaller radius.\n')
console.log(HEAD)
for (const ratio of [1, 1.5, 2, 3, 4])
  for (const cap of ratio === 1 ? [32] : [32, 64, 256])
    line(`ratio ${pad(ratio, 3)}, lists of ${pad(cap, 3)}  `, settle(ratio, { cap }))

console.log('\nRatio 4 again, lists of 256, with a limit on speed, in radii per substep:')
console.log(HEAD)
const perSubstep = (radius) => (_, h) => radius / h
line('no limit                  ', settle(4, { cap: 256 }))
line('one large radius, 12 m/s  ', settle(4, { cap: 256, limit: perSubstep(BIG) }))
line('one small radius, 3 m/s   ', settle(4, { cap: 256, limit: perSubstep(BIG / 4) }))
line('each its own radius       ', settle(4, { cap: 256, limit: (r, h) => r / h }))
console.log('\nIs it the mix? Lists of 256, small spheres of 2.5 cm:')
console.log(HEAD)
line('mixed with large ones     ', settle(4, { cap: 256 }))
line('mixed, all the same mass  ', settle(4, { cap: 256, sameMass: true }))
line('small ones only           ', settle(4, { cap: 256, share: 0 }))
line('small only, 4 substeps    ', settle(4, { cap: 256, share: 0, substeps: 4 }))
line('mixed, 4 substeps         ', settle(4, { cap: 256, substeps: 4 }))
console.log('\nRatio 4, lists of 32, with the margin of today, 5 cm, two small radii:')
console.log(HEAD)
line('margin 5 cm               ', settle(4, { cap: 32, margin: 0.05 }))

// ---- part 2: passing through ------------------------------------------------------------------
/**
 * A small sphere is shot at another sphere, aimed to hit it well: off its center by up to half of
 * where they would just touch. No gravity, no walls. Missed: it comes out the other side as it
 * went in, never pushed. 400 shots, each from a different distance and aim.
 */
function shots(speed, target, headOn) {
  const small = BIG / 4
  const next = random(11)
  let missed = 0
  const COUNT = 400
  for (let shot = 0; shot < COUNT; shot++) {
    const off = next() * 0.5 * (small + target)
    const s = world(
      [
        { radius: small, at: [-0.5 - next() * 0.2, off, 0], speed: [speed, 0, 0] },
        { radius: target, at: [0, 0, 0], fixed: !headOn, speed: headOn ? [-speed, 0, 0] : null },
      ],
      { planes: [], gravity: 0, margin: 0.5 * small },
    )
    if (headOn) s.x[3] = 0.5 + next() * 0.2
    for (let t = 0; t < 2 / STEP && s.x[0] < 1; t++) step(s)
    if (Math.abs(s.v[1]) < 1e-9 && Math.abs(s.v[0] - speed) < 1e-9) missed++
  }
  return `${pad(((100 * missed) / COUNT).toFixed(0), 3)}%`
}
console.log(
  '\nPart 2. A small sphere, radius 2.5 cm, shot at another: how many shots pass through.',
)
console.log(
  '  speed, in small radii per substep |  at a small one, still | two small ones, head on | at a large one, still',
)
for (const radii of [1, 2, 3, 4, 6, 8]) {
  const speed = (radii * (BIG / 4) * SUBSTEPS) / STEP
  console.log(
    `  ${pad(radii, 2)} radii, ${pad(speed.toFixed(0), 2)} m/s                 | ${pad(shots(speed, BIG / 4, false), 22)} | ` +
      `${pad(shots(speed, BIG / 4, true), 23)} | ${pad(shots(speed, BIG, false), 20)}`,
  )
}

// ---- part 3: a limit for each size ------------------------------------------------------------
/** When a sphere alone, falling from 3 m, touches the floor, and how fast it goes then. */
function fall(radius, limit) {
  const s = world([{ radius, at: [0, 3 + radius, 0] }], { limit })
  let t = 0
  let speed = 0
  while (s.x[1] - radius > RESTS && t < 600) {
    speed = -s.v[1]
    step(s)
    t++
  }
  return `after ${(t * STEP).toFixed(2)} s, at ${speed.toFixed(1)} m/s`
}
console.log(
  '\nPart 3. A sphere alone falls 3 m: when it lands. Each with a top speed of its own radius',
)
console.log('per substep.')
for (const radius of [BIG, BIG / 2, BIG / 4])
  console.log(
    `  radius ${pad((radius * 100).toFixed(1), 4)} cm: lands ${fall(radius, (r, h) => r / h)}  (no limit: ${fall(radius)})`,
  )
