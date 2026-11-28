// Loose particles on a real net: do they roll, with a push that knows the surface of the cloth?
// Run with: node docs/topics/grains-on-net.mjs (about a minute)
//
// grains-on-cloth.mjs tried the ways on a flat net that could not move, where the normal was known.
// Here the net is a cloth: it hangs, it is pushed back by what lies on it, and its normal is worked
// out at every particle from its neighbours along the two sides of the net.
//
// A small copy of our step, on the CPU: 3 substeps of 1/180 s, the speed limit of one radius per
// substep (decision 027), 4 passes over the links (rigid, sides and diagonals), then 3 rounds of
// pushes between touching particles, where each particle moves by half the sum and half the
// average of what its contacts ask (decision 015). Between two particles of the same cloth the
// push goes along the line between their centers; between two loose ones along the line they
// were on when the substep began (the side kept, decision 046). Friction as in our shader (decision 025), or none. All masses equal.
//
// The ways, for a loose particle (a grain) against a particle of a cloth. In all of them a
// contact is made as today, when the two spheres overlap. H is half the thickness of the cloth:
// how far from the cloth's surface the grain's own surface should rest.
// - today: the side kept, as between any two bodies.
// - large sphere: the particle of the cloth pushes as a sphere of radius R, moved back along the
//   normal so that its top is H above the cloth, on the side the grain was on when the substep
//   began (Müller and Chentanez 2011, their surface particles, made two-sided).
// - normal: the push goes along the normal, until the grain is H + r from the plane that touches
//   the cloth at that particle. With `once`, a grain joins what the particles of the cloth ask
//   into one contact (see where: the deepest, or one surface blended from them all): they all ask
//   about the same, and our rule would add them up.

const r = 0.1
const S = 2 * r
const SUBSTEPS = 3
const h = 1 / 60 / SUBSTEPS
const PASSES = 4
const ROUNDS = 3
const G = -9.81
const H = 0.2 * r

const WAYS = [
  { name: 'today' },
  { name: 'large sphere, R = 2 r', large: 2 * r },
  { name: 'large sphere, R = 4 r', large: 4 * r },
  { name: 'normal, added up', normal: true },
  { name: 'normal, the deepest', normal: true, once: 'deepest' },
  { name: 'normal, one blended surface', normal: true, once: 'surface' },
]

/** Repeats the same numbers at every run. */
function random(seed) {
  let s = seed
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s / 2 ** 32) * 2 - 1
  }
}

function world(way, friction = 0) {
  return {
    way,
    friction,
    x: [],
    w: [],
    body: [],
    links: [],
    nets: [],
    surface: undefined,
  }
}

/** A net of nx by nz particles, S apart, around (0, y(x, z), 0). `pinned(i, j)` holds a particle. */
function addNet(W, nx, nz, y, pinned, linked = true) {
  const first = W.w.length
  const name = (i, j) => first + i + j * nx
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const [px, pz] = [(i - (nx - 1) / 2) * S, (j - (nz - 1) / 2) * S]
      W.x.push(px, y(px, pz), pz)
      W.w.push(pinned(i, j) ? 0 : 1)
      W.body.push(W.nets.length + 1)
    }
  if (linked)
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        if (i + 1 < nx) W.links.push([name(i, j), name(i + 1, j), S, true])
        if (j + 1 < nz) W.links.push([name(i, j), name(i, j + 1), S, true])
        if (i + 1 < nx && j + 1 < nz) {
          W.links.push([name(i, j), name(i + 1, j + 1), S * Math.SQRT2])
          W.links.push([name(i + 1, j), name(i, j + 1), S * Math.SQRT2])
        }
      }
  W.nets.push({ first, nx, nz })
}

function addGrain(W, x, y, z) {
  W.x.push(x, y, z)
  W.w.push(1)
  W.body.push(0)
}

function build(W) {
  W.x = Float64Array.from(W.x)
  W.n = W.w.length
  W.v = new Float64Array(W.n * 3)
  W.prev = new Float64Array(W.n * 3)
  W.dx = new Float64Array(W.n * 3)
  W.normal = new Float64Array(W.n * 3)
  W.cells = new Map()
  return W
}

/** The normal of every net at each of its particles, from where the substep began. */
function normals(W) {
  const { prev, normal } = W
  for (const { first, nx, nz } of W.nets)
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const at = (a, b) => (first + a + b * nx) * 3
        const [a1, a0] = [at(Math.min(i + 1, nx - 1), j), at(Math.max(i - 1, 0), j)]
        const [b1, b0] = [at(i, Math.min(j + 1, nz - 1)), at(i, Math.max(j - 1, 0))]
        const a = [0, 1, 2].map((k) => prev[a1 + k] - prev[a0 + k])
        const b = [0, 1, 2].map((k) => prev[b1 + k] - prev[b0 + k])
        const c = [b[1] * a[2] - b[2] * a[1], b[2] * a[0] - b[0] * a[2], b[0] * a[1] - b[1] * a[0]]
        const l = Math.hypot(...c) || 1
        for (let k = 0; k < 3; k++) normal[at(i, j) + k] = c[k] / l
      }
}

const key = (ix, iy, iz) => (ix + 512) * 1048576 + (iy + 512) * 1024 + (iz + 512)
const cell = (q) => Math.floor(q / S)

function round(W) {
  const { x, prev, w, body, dx, normal, n, way, cells } = W
  cells.clear()
  for (let i = 0; i < n; i++) {
    const c = key(cell(x[i * 3]), cell(x[i * 3 + 1]), cell(x[i * 3 + 2]))
    if (!cells.has(c)) cells.set(c, [])
    cells.get(c).push(i)
  }
  const d = [0, 0, 0]
  const p = [0, 0, 0]
  const slide = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    dx[i * 3] = dx[i * 3 + 1] = dx[i * 3 + 2] = 0
    if (w[i] === 0) continue
    const sum = [0, 0, 0]
    const back = [0, 0, 0]
    let count = 0
    // One contact: `ask` is the whole overlap along the way out, of which this particle takes its
    // `share`. Friction as in our shader (decision 025): of how far the two have slid on each
    // other since the substep began (`slide`), across the way out, it takes back µ times the
    // overlap, or all of it if it is shorter.
    const contact = (ask, share) => {
      const overlap = Math.hypot(ask[0], ask[1], ask[2])
      if (overlap === 0) return
      for (let k = 0; k < 3; k++) sum[k] += ask[k] * share
      count++
      if (!W.friction) return
      const along = (slide[0] * ask[0] + slide[1] * ask[1] + slide[2] * ask[2]) / overlap
      const across = [0, 1, 2].map((k) => slide[k] - (ask[k] / overlap) * along)
      const far = Math.hypot(across[0], across[1], across[2])
      if (far === 0) return
      const part = Math.min((W.friction * overlap) / far, 1)
      for (let k = 0; k < 3; k++) back[k] -= across[k] * part * share
    }
    const slideOn = (j) => {
      for (let k = 0; k < 3; k++)
        slide[k] = x[i * 3 + k] - prev[i * 3 + k] - (x[j * 3 + k] - prev[j * 3 + k])
    }
    let deepest = 0 // 'deepest': the largest of what the particles of the cloth ask, and whose
    let deepestOf = -1
    const deep = [0, 0, 0]
    const blend = [0, 0, 0, 0, 0, 0, 0, 0, 0] // 'surface': see below
    const [cx, cy, cz] = [cell(x[i * 3]), cell(x[i * 3 + 1]), cell(x[i * 3 + 2])]
    for (let ix = -1; ix <= 1; ix++)
      for (let iy = -1; iy <= 1; iy++)
        for (let iz = -1; iz <= 1; iz++)
          for (const j of cells.get(key(cx + ix, cy + iy, cz + iz)) ?? []) {
            if (j === i) continue
            for (let k = 0; k < 3; k++) d[k] = x[i * 3 + k] - x[j * 3 + k]
            const now = Math.hypot(d[0], d[1], d[2])
            if (now >= S || now === 0) continue
            const share = w[i] / (w[i] + w[j])
            const same = body[i] !== 0 && body[i] === body[j]
            const onCloth = !same && (body[i] !== 0) !== (body[j] !== 0)
            slideOn(j)
            if (same) {
              // the same cloth: along the line between the centers
              for (let k = 0; k < 3; k++) p[k] = (d[k] / now) * (S - now)
              contact(p, share)
            } else if (!onCloth || !(way.large || way.normal)) {
              // the side kept
              for (let k = 0; k < 3; k++) p[k] = prev[i * 3 + k] - prev[j * 3 + k]
              const d0 = Math.hypot(p[0], p[1], p[2])
              if (d0 === 0) continue
              const over = S - (d[0] * p[0] + d[1] * p[1] + d[2] * p[2]) / d0
              if (over <= 0) continue
              for (let k = 0; k < 3; k++) p[k] *= over / d0
              contact(p, share)
            } else {
              // a grain and a particle of a cloth: what the grain is asked, in p
              const [g, c] = body[i] === 0 ? [i, j] : [j, i]
              const nc = [normal[c * 3], normal[c * 3 + 1], normal[c * 3 + 2]]
              let before = 0
              let out = 0
              for (let k = 0; k < 3; k++) {
                before += (prev[g * 3 + k] - prev[c * 3 + k]) * nc[k]
                out += (x[g * 3 + k] - x[c * 3 + k]) * nc[k]
              }
              const side = before >= 0 ? 1 : -1
              if (way.normal) {
                const depth = H + r - side * out
                if (g === i && way.once === 'surface') {
                  // one surface from all the particles in reach: their normals and how deep the
                  // grain is under each one's plane are blended, by the distance along the cloth,
                  // as a normal is blended across a face when it is drawn (Phong shading). A
                  // plane the grain is above counts too, or only the deepest would ever push
                  const across = Math.sqrt(Math.max(now * now - out * out, 0))
                  const weight = Math.max(1 - across / S, 0)
                  for (let k = 0; k < 3; k++) {
                    blend[k] += weight * side * nc[k]
                    blend[6 + k] += weight * slide[k]
                  }
                  blend[3] += weight * depth
                  blend[4] += weight * share
                  blend[5] += weight
                  continue
                }
                if (depth <= 0) continue
                for (let k = 0; k < 3; k++) p[k] = side * nc[k] * depth
              } else {
                const R = way.large
                for (let k = 0; k < 3; k++)
                  p[k] = x[g * 3 + k] - (x[c * 3 + k] - side * nc[k] * (R - H))
                const far = Math.hypot(p[0], p[1], p[2])
                if (far >= R + r || far === 0) continue
                for (let k = 0; k < 3; k++) p[k] *= (R + r - far) / far
              }
              if (g === i && way.once === 'deepest') {
                const size = Math.hypot(p[0], p[1], p[2]) * share
                if (size > deepest) {
                  deepest = size
                  deepestOf = j
                  for (let k = 0; k < 3; k++) deep[k] = p[k] * share
                }
                continue
              }
              if (g !== i) for (let k = 0; k < 3; k++) p[k] = -p[k]
              contact(p, share)
            }
          }
    if (blend[3] > 0) {
      const size = Math.hypot(blend[0], blend[1], blend[2])
      for (let k = 0; k < 3; k++) {
        p[k] = ((blend[k] / size) * blend[3]) / blend[5]
        slide[k] = blend[6 + k] / blend[5]
      }
      contact(p, blend[4] / blend[5])
    }
    if (deepest) {
      slideOn(deepestOf)
      contact(deep, 1)
    }
    if (count)
      for (let k = 0; k < 3; k++) dx[i * 3 + k] = sum[k] * (0.5 + 0.5 / count) + back[k] / count
  }
  for (let k = 0; k < n * 3; k++) x[k] += dx[k]
}

function step(W) {
  const { x, v, w, prev, n } = W
  for (let s = 0; s < SUBSTEPS; s++) {
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) prev[i * 3 + k] = x[i * 3 + k]
      if (w[i] === 0) continue
      v[i * 3 + 1] += G * h
      const sp = Math.hypot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2])
      const cut = sp * h > r ? r / (sp * h) : 1
      for (let k = 0; k < 3; k++) x[i * 3 + k] += v[i * 3 + k] * cut * h
    }
    if (W.exact) W.exact(W)
    else if (W.way.large || W.way.normal) normals(W)
    for (let pass = 0; pass < PASSES; pass++)
      for (const [a, b, rest] of W.links) {
        const sum = w[a] + w[b]
        if (sum === 0) continue
        const e = [0, 1, 2].map((k) => x[b * 3 + k] - x[a * 3 + k])
        const len = Math.hypot(...e)
        const f = (len - rest) / sum / len
        for (let k = 0; k < 3; k++) {
          x[a * 3 + k] += w[a] * f * e[k]
          x[b * 3 + k] -= w[b] * f * e[k]
        }
      }
    for (let q = 0; q < ROUNDS; q++) {
      round(W)
      W.surface?.(W)
    }
    for (let k = 0; k < n * 3; k++) v[k] = (x[k] - prev[k]) / h
  }
}

// --- 1. A net hung by its 4 corners, and a layer of grains let fall all over it ----------------

function hung(way, friction) {
  const W = world(way, friction)
  const N = 21
  const Y = 3
  addNet(
    W,
    N,
    N,
    () => Y,
    (i, j) => (i === 0 || i === N - 1) && (j === 0 || j === N - 1),
  )
  const jitter = random(7)
  const grains = []
  for (let a = 0; a < 10; a++)
    for (let b = 0; b < 10; b++) {
      grains.push(W.w.length)
      addGrain(W, (a - 4.5) * 0.36 + jitter() * 0.05, Y + 0.3, (b - 4.5) * 0.36 + jitter() * 0.05)
    }
  build(W)
  const spread = () => {
    const on = grains.filter((g) => W.x[g * 3 + 1] > lowest() - 4 * r)
    return Math.sqrt(on.reduce((s, g) => s + W.x[g * 3] ** 2 + W.x[g * 3 + 2] ** 2, 0) / on.length)
  }
  const lowest = () => {
    let y = Infinity
    for (let i = 0; i < N * N; i++) y = Math.min(y, W.x[i * 3 + 1])
    return y
  }
  const start = spread()
  let top = 0
  let landed = 0 // the spread once the grains are down, after half a second
  for (let t = 0; t < 60 * 10; t++) {
    step(W)
    if (t === 30) landed = spread()
    if (t > 30) for (const g of grains) top = Math.max(top, W.x[g * 3 + 1] - Y)
  }
  const on = grains.filter((g) => W.x[g * 3 + 1] > lowest() - 4 * r)
  const speed =
    on.reduce((s, g) => s + Math.hypot(W.v[g * 3], W.v[g * 3 + 1], W.v[g * 3 + 2]), 0) / on.length
  let stretch = 0
  for (const [a, b, rest, side] of W.links) {
    if (!side) continue
    const len = Math.hypot(...[0, 1, 2].map((k) => W.x[b * 3 + k] - W.x[a * 3 + k]))
    stretch = Math.max(stretch, len / rest - 1)
  }
  // how far the surface of a grain that touches the net is from the net, along its normal
  normals(Object.assign(W, { prev: W.x }))
  let gap = 0
  let touching = 0
  for (const g of on) {
    let best = Infinity
    let c = -1
    for (let i = 0; i < N * N; i++) {
      const far = Math.hypot(...[0, 1, 2].map((k) => W.x[g * 3 + k] - W.x[i * 3 + k]))
      if (far < best) [best, c] = [far, i]
    }
    if (best >= S) continue
    touching++
    gap += Math.abs(
      [0, 1, 2].reduce((s, k) => s + (W.x[g * 3 + k] - W.x[c * 3 + k]) * W.normal[c * 3 + k], 0),
    )
  }
  return {
    start,
    landed,
    end: spread(),
    through: grains.length - on.length,
    top,
    speed,
    sag: Y - lowest(),
    stretch,
    gap: gap / touching / r - 1,
  }
}

// --- 2. A bowl that cannot move, and one grain ------------------------------------------------
//
// The particles of a net lie on a ball of radius 3 m, all pinned. With no friction a grain let go
// on the slope should slide down, climb the other side almost as high, and never gain height.

const BOWL = 3
function bowl(way, startX, seconds, truth, z = 0.1, friction = 0) {
  const W = world(way, friction)
  if (!truth)
    addNet(
      W,
      21,
      21,
      (x, z) => BOWL - Math.sqrt(BOWL * BOWL - x * x - z * z),
      () => true,
      false,
    )
  const reach = BOWL - H - r // from the middle of the ball to the center of a grain that rests
  const at = (x) => BOWL - Math.sqrt(reach * reach - x * x - z * z)
  addGrain(W, startX, at(startX) + (truth || way.normal ? 0 : r), z)
  build(W)
  if (truth)
    W.surface = () => {
      const c = [W.x[0], W.x[1] - BOWL, W.x[2]]
      const far = Math.hypot(...c)
      if (far > reach) for (let k = 0; k < 3; k++) W.x[k] -= (c[k] / far) * (far - reach)
    }
  if (way.exact)
    W.exact = () => {
      for (let i = 0; i < W.n - 1; i++) {
        const c = [-W.x[i * 3], BOWL - W.x[i * 3 + 1], -W.x[i * 3 + 2]]
        const far = Math.hypot(...c)
        for (let k = 0; k < 3; k++) W.normal[i * 3 + k] = c[k] / far
      }
    }
  const g = W.n - 1
  // half a second held over its spot, to come to rest at the height this way gives it
  for (let t = 0; t < 30; t++) {
    step(W)
    W.x[g * 3] = startX
    W.x[g * 3 + 2] = z
    W.v[g * 3] = W.v[g * 3 + 2] = 0
  }
  const lift = W.x[g * 3 + 1] - at(startX) // how much higher than on a true bowl it rests
  const height = () => W.x[g * 3 + 1] - lift - at(0)
  const from = height()
  let other = 0 // the highest it gets on the other side
  let most = 0 // the highest it gets anywhere
  let aside = 0 // the most it leaves the line it should slide along
  for (let t = 0; t < 60 * seconds; t++) {
    step(W)
    if (W.x[g * 3] < 0) other = Math.max(other, height())
    most = Math.max(most, height())
    aside = Math.max(
      aside,
      Math.abs(W.x[g * 3] * z - W.x[g * 3 + 2] * startX) / Math.hypot(startX, z),
    )
  }
  return {
    other: other / from,
    most: most / from,
    aside,
    from: Math.hypot(W.x[g * 3], W.x[g * 3 + 2]),
    speed: Math.hypot(W.v[g * 3], W.v[g * 3 + 1], W.v[g * 3 + 2]),
    fell: W.x[g * 3 + 1] < -1,
  }
}

const cm = (m) => `${(m * 100).toFixed(0)} cm`
const pc = (f) => `${(f * 100).toFixed(0)}%`

console.log(`Half the thickness of the cloth: ${(H / r).toFixed(1)} r.\n`)
for (const friction of [0, 0.15]) {
  console.log(
    `\n1. A net of 21 by 21 hung by its corners, 100 grains let fall all over it, 10 s. Friction ${friction}\n`,
  )
  console.log(
    '| Way | Spread: landed, after 10 s | Fell through | Thrown up to | Speed at the end | Net: sag, most stretch | Grain to cloth |',
  )
  console.log('| --- | --- | --- | --- | --- | --- | --- |')
  for (const way of WAYS) {
    const a = hung(way, friction)
    console.log(
      `| ${way.name} | ${a.landed.toFixed(2)} m, ${a.end.toFixed(2)} m | ${a.through} | ${cm(Math.max(a.top, 0))} | ${a.speed.toFixed(2)} m/s | ${cm(a.sag)}, ${pc(a.stretch)} | ${a.gap.toFixed(2)} r |`,
    )
  }
}

// With friction µ a grain on a slope stays if the slope is under atan(µ): 8.5° for 0.15. Let go
// where the bowl slopes by 19° it should slide, and stop before the bottom or a little past it.
for (const friction of [0, 0.15]) {
  console.log(
    `\n2. A bowl that cannot move, 3 m of radius, one grain let go 1 m out, where it slopes by 19°. Friction ${friction}\n`,
  )
  console.log(
    '| Way | Climbs the other side to | Highest in 10 s | Leaves its line by, the most of 5 starts | Ends, from the bottom | Speed after 10 s |',
  )
  console.log('| --- | --- | --- | --- | --- | --- |')
  for (const way of [
    ...WAYS,
    {
      name: 'normal, one blended surface, the true normals',
      normal: true,
      once: 'surface',
      exact: true,
    },
    { name: 'a true bowl', truth: true },
  ]) {
    const go = bowl(way, 1, 10, way.truth, 0.1, friction)
    const aside = Math.max(
      ...[0.05, 0.1, 0.15, 0.3, 0.45].map((z) => bowl(way, 1, 10, way.truth, z, friction).aside),
    )
    console.log(
      `| ${way.name} | ${go.fell ? 'falls through' : pc(go.other)} | ${pc(go.most)} | ${cm(aside)} | ${cm(go.from)} | ${go.speed.toFixed(2)} m/s |`,
    )
  }
}
