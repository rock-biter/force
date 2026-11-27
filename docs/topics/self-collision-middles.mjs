// A particle at the middle of every square of a cloth: does it keep cloths from passing through?
// Run with: node docs/topics/self-collision-middles.mjs (about five minutes), or add the numbers
// of the parts to run only those: node docs/topics/self-collision-middles.mjs 6 7
//
// A small copy of our step, on the CPU: 2 substeps of 1/120 s, the speed limit of one radius per
// substep (decision 027), 4 passes over the links in each substep (rigid, give 0), then 3 rounds of
// pushes between touching particles, where each particle moves by half the sum and half the average
// of what its contacts ask (decision 015). No friction, no levels: all masses are equal.
//
// A middle is not simulated: before every round it is put at the average of its 4 corners. It does
// not collide with its own corners. A push on a middle goes to its corners: moving all four by the
// same amount moves the middle by that amount, so a middle weighs as much as its four corners
// together, and each corner moves as much as the middle would.

const r = 0.1
const S = 2 * r // spacing at rest
const SUBSTEPS = 2 // unless a variant sets its own `substeps`
const dt = 1 / 60 / SUBSTEPS
const SPRING_PASSES = 4 // unless a variant sets its own `passes`
const ROUNDS = 3
const LIMIT = r // meters per substep, unless a variant sets its own `limit`
const G = -9.81

const VARIANTS = [
  { name: 'squares', middle: 0 },
  { name: 'middles 1.0 r', middle: 1, skipNext: true },
  { name: 'middles 0.9 r', middle: 0.9, skipNext: false },
]

function world(variant, gravity = true, damping = 1) {
  return {
    variant,
    gravity,
    damping,
    floor: false,
    x: [],
    v: [],
    w: [],
    rad: [],
    links: [],
    mid: [],
    cloths: [],
  }
}

/** A cloth of nx by nz particles in the plane y = y0, `sx` and `sz` apart. */
function addCloth(W, nx, nz, x0, y0, z0, sx, sz, vy = 0, pinned = () => false) {
  const first = W.w.length
  const id = W.cloths.length
  const name = (i, j) => first + i + j * nx
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      W.x.push(x0 + i * sx, y0, z0 + j * sz)
      W.v.push(0, vy, 0)
      W.w.push(pinned(i, j) ? 0 : 1)
      W.rad.push(r)
    }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      if (i + 1 < nx) W.links.push([name(i, j), name(i + 1, j), S])
      if (j + 1 < nz) W.links.push([name(i, j), name(i, j + 1), S])
      if (i + 1 < nx && j + 1 < nz) {
        W.links.push([name(i, j), name(i + 1, j + 1), S * Math.SQRT2])
        W.links.push([name(i + 1, j), name(i, j + 1), S * Math.SQRT2])
        if (W.variant.middle)
          W.mid.push({
            corners: [name(i, j), name(i + 1, j), name(i, j + 1), name(i + 1, j + 1)],
            rad: W.variant.middle * r,
            cloth: id,
            i,
            j,
          })
      }
    }
  W.cloths.push({ first, nx, nz })
  return W.cloths[id]
}

function addGrain(W, x, y, z, vy) {
  W.x.push(x, y, z)
  W.v.push(0, vy, 0)
  W.w.push(1)
  W.rad.push(r)
}

function build(W) {
  W.x = Float64Array.from(W.x)
  W.v = Float64Array.from(W.v)
  W.prev = new Float64Array(W.x.length)
  W.n = W.w.length
  W.m = W.mid.length
  W.mx = new Float64Array(W.m * 3)
  W.dm = new Float64Array(W.m * 3)
  W.dx = new Float64Array(W.n * 3)
  W.wm = W.mid.map((c) => c.corners.reduce((s, k) => s + W.w[k], 0) / 16)
  W.ownMiddles = Array.from({ length: W.n }, () => [])
  W.mid.forEach((c, m) => {
    for (const k of c.corners) W.ownMiddles[k].push(m)
  })
  W.head = new Int32Array(TABLE)
  W.next = new Int32Array(W.n + W.m)
  W.cand = new Int32Array(W.n + W.m)
  W.seen = new Int32Array(27)
  W.pairsChecked = 0
  W.maxMove = 0 // the most any particle moved in one substep, springs and pushes included
  return W
}

const isCorner = (W, m, i) => W.mid[m].corners.includes(i)
const skipMiddles = (W, a, b) => {
  if (!W.variant.skipNext) return false
  const A = W.mid[a]
  const B = W.mid[b]
  return A.cloth === B.cloth && Math.abs(A.i - B.i) + Math.abs(A.j - B.j) === 1
}

/** One push between points at p and q (q the other), as the share of the overlap p takes. */
function ask(acc, px, py, pz, qx, qy, qz, reach, share) {
  const dx = px - qx
  const dy = py - qy
  const dz = pz - qz
  const d2 = dx * dx + dy * dy + dz * dz
  if (d2 >= reach * reach || d2 === 0) return
  const d = Math.sqrt(d2)
  const k = ((reach - d) * share) / d
  acc[0] += dx * k
  acc[1] += dy * k
  acc[2] += dz * k
  acc[3]++
}

// The search for neighbours, through a grid of cells as wide as the longest reach of any pair. The
// points are the particles (numbers 0 to n - 1) and the middles (n onward). Pairs are added in the
// order of their numbers, as if every point were looked at, so the grid changes no result.
const CELL = 2 * r
const TABLE = 4096
const cellOf = (q) => Math.floor(q / CELL)
const bucket = (ix, iy, iz) =>
  (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & (TABLE - 1)
const pos = (W, p, k) => (p < W.n ? W.x[p * 3 + k] : W.mx[(p - W.n) * 3 + k])

function fillGrid(W) {
  W.head.fill(-1)
  for (let p = 0; p < W.n + W.m; p++) {
    const b = bucket(cellOf(pos(W, p, 0)), cellOf(pos(W, p, 1)), cellOf(pos(W, p, 2)))
    W.next[p] = W.head[b]
    W.head[b] = p
  }
}

/** The points in the 27 cells around point p, in W.cand by their numbers; returns how many. */
function near(W, p) {
  const cx = cellOf(pos(W, p, 0))
  const cy = cellOf(pos(W, p, 1))
  const cz = cellOf(pos(W, p, 2))
  let count = 0
  let seen = 0
  for (let ix = -1; ix <= 1; ix++)
    for (let iy = -1; iy <= 1; iy++)
      for (let iz = -1; iz <= 1; iz++) {
        const b = bucket(cx + ix, cy + iy, cz + iz)
        if (W.seen.subarray(0, seen).includes(b)) continue // two cells in one bucket
        W.seen[seen++] = b
        for (let q = W.head[b]; q !== -1; q = W.next[q]) if (q !== p) W.cand[count++] = q
      }
  W.cand.subarray(0, count).sort()
  W.pairsChecked += count
  return count
}

function round(W) {
  const { x, w, rad, mx, dm, dx, n, m, wm, cand } = W
  for (let c = 0; c < m; c++) {
    const [a, b, e, f] = W.mid[c].corners
    for (let k = 0; k < 3; k++)
      mx[c * 3 + k] = (x[a * 3 + k] + x[b * 3 + k] + x[e * 3 + k] + x[f * 3 + k]) / 4
  }
  fillGrid(W)
  const acc = [0, 0, 0, 0]
  // the middles first: what each would move, from its own contacts
  for (let c = 0; c < m; c++) {
    acc.fill(0)
    const [px, py, pz] = [mx[c * 3], mx[c * 3 + 1], mx[c * 3 + 2]]
    const count = near(W, n + c)
    for (let t = 0; t < count; t++) {
      const j = cand[t]
      if (j < n) {
        if (isCorner(W, c, j)) continue
        const sum = wm[c] + w[j]
        if (sum === 0) continue
        ask(
          acc,
          px,
          py,
          pz,
          x[j * 3],
          x[j * 3 + 1],
          x[j * 3 + 2],
          W.mid[c].rad + rad[j],
          wm[c] / sum,
        )
      } else {
        const e = j - n
        if (skipMiddles(W, c, e)) continue
        const sum = wm[c] + wm[e]
        if (sum === 0) continue
        const reach = W.mid[c].rad + W.mid[e].rad
        ask(acc, px, py, pz, mx[e * 3], mx[e * 3 + 1], mx[e * 3 + 2], reach, wm[c] / sum)
      }
    }
    const h = acc[3] ? 0.5 + 0.5 / acc[3] : 0
    for (let k = 0; k < 3; k++) dm[c * 3 + k] = acc[k] * h
  }
  // then every particle: its own contacts, and what its middles move
  for (let i = 0; i < n; i++) {
    dx[i * 3] = dx[i * 3 + 1] = dx[i * 3 + 2] = 0
    if (w[i] === 0) continue
    acc.fill(0)
    const [px, py, pz] = [x[i * 3], x[i * 3 + 1], x[i * 3 + 2]]
    const count = near(W, i)
    for (let t = 0; t < count; t++) {
      const j = cand[t]
      if (j < n) {
        const share = w[i] / (w[i] + w[j])
        ask(acc, px, py, pz, x[j * 3], x[j * 3 + 1], x[j * 3 + 2], rad[i] + rad[j], share)
      } else {
        const c = j - n
        if (isCorner(W, c, i)) continue
        const share = w[i] / (w[i] + wm[c])
        const reach = rad[i] + W.mid[c].rad
        ask(acc, px, py, pz, mx[c * 3], mx[c * 3 + 1], mx[c * 3 + 2], reach, share)
      }
    }
    for (const c of W.ownMiddles[i]) {
      const f = w[i] / 4 / wm[c]
      if (dm[c * 3] || dm[c * 3 + 1] || dm[c * 3 + 2]) {
        acc[0] += dm[c * 3] * f
        acc[1] += dm[c * 3 + 1] * f
        acc[2] += dm[c * 3 + 2] * f
        acc[3]++
      }
    }
    const h = acc[3] ? 0.5 + 0.5 / acc[3] : 0
    for (let k = 0; k < 3; k++) dx[i * 3 + k] = acc[k] * h
  }
  for (let k = 0; k < n * 3; k++) x[k] += dx[k]
}

/** No particle below the floor, when there is one. */
function hold(W) {
  if (!W.floor) return
  for (let i = 0; i < W.n; i++) if (W.w[i] && W.x[i * 3 + 1] < r) W.x[i * 3 + 1] = r
}

// A hand on a cloth, as on our pages (examples/cloth/grab.wgsl): a handle moves at `speed` for
// `travel` meters, and after the prediction every held particle covers a share of the way to its
// place around the handle: its weight, 1 at the middle of the hand and 0 at its rim, times the
// pull. The cap on the speed does not see this move.
//
// Three ways for the hand to give way, in `hand.mode`:
// - 'capped': no held particle is moved by the hand more than the cap on the speed, 1 r a substep;
// - 'waits': the handle stops while any link of a held particle is stretched over `hand.most`;
// - 'slips': each held particle is pulled less the more its own links are stretched, and not at
//   all from `hand.most` on. Each particle looks at its own links only, as a pass on the GPU would.
function grab(W, h) {
  const { hand, x } = W
  const stretchOf = (i) => {
    let most = 0
    for (const [o, rest] of hand.links[i]) {
      const len = Math.hypot(
        x[o * 3] - x[i * 3],
        x[o * 3 + 1] - x[i * 3 + 1],
        x[o * 3 + 2] - x[i * 3 + 2],
      )
      most = Math.max(most, len / rest - 1)
    }
    return most
  }
  const tight = hand.mode === 'waits' && hand.held.some(({ i }) => stretchOf(i) > hand.most)
  const go = tight ? 0 : Math.min(hand.speed * h, hand.travel - hand.gone)
  hand.gone += go
  for (let k = 0; k < 3; k++) hand.at[k] += hand.way[k] * go
  const cap = W.variant.limit ?? LIMIT
  for (const { i, from, weight } of hand.held) {
    let share = weight * hand.pull
    if (hand.mode === 'slips') share *= Math.max(0, 1 - stretchOf(i) / hand.most)
    const d = [0, 1, 2].map((k) => (hand.at[k] + from[k] - x[i * 3 + k]) * share)
    const far = Math.hypot(...d)
    const cut = hand.mode === 'capped' && far > cap ? cap / far : 1
    for (let k = 0; k < 3; k++) x[i * 3 + k] += d[k] * cut
  }
}

function step(W) {
  const { x, v, w, prev, n } = W
  const limit = W.variant.limit ?? LIMIT
  const subs = W.variant.substeps ?? SUBSTEPS
  const h = 1 / 60 / subs
  for (let s = 0; s < subs; s++) {
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) prev[i * 3 + k] = x[i * 3 + k]
      if (w[i] === 0) continue
      if (W.gravity) v[i * 3 + 1] += G * h
      const sp = Math.hypot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2])
      const cut = sp * h > limit ? limit / (sp * h) : 1
      for (let k = 0; k < 3; k++) x[i * 3 + k] += v[i * 3 + k] * cut * h
    }
    if (W.hand) grab(W, h)
    hold(W)
    for (let p = 0; p < (W.variant.passes ?? SPRING_PASSES); p++) {
      for (const [a, b, rest] of W.links) {
        const sum = w[a] + w[b]
        if (sum === 0) continue
        const ex = x[b * 3] - x[a * 3]
        const ey = x[b * 3 + 1] - x[a * 3 + 1]
        const ez = x[b * 3 + 2] - x[a * 3 + 2]
        const len = Math.hypot(ex, ey, ez)
        const k = (len - rest) / sum / len
        x[a * 3] += w[a] * k * ex
        x[a * 3 + 1] += w[a] * k * ey
        x[a * 3 + 2] += w[a] * k * ez
        x[b * 3] -= w[b] * k * ex
        x[b * 3 + 1] -= w[b] * k * ey
        x[b * 3 + 2] -= w[b] * k * ez
      }
      hold(W)
    }
    for (let q = 0; q < ROUNDS; q++) {
      round(W)
      hold(W)
    }
    for (let i = 0; i < n; i++) {
      const moved = Math.hypot(
        x[i * 3] - prev[i * 3],
        x[i * 3 + 1] - prev[i * 3 + 1],
        x[i * 3 + 2] - prev[i * 3 + 2],
      )
      if (moved > W.maxMove) W.maxMove = moved
    }
    for (let k = 0; k < n * 3; k++) v[k] = ((x[k] - prev[k]) / h) * W.damping
    // a floor that does not let things slide: what lies on it stops across
    if (W.floor)
      for (let i = 0; i < n; i++) if (x[i * 3 + 1] <= r + 1e-9) v[i * 3] = v[i * 3 + 2] = 0
    W.watch?.(W) // a test may look at the world after every substep
  }
}

const run = (W, seconds) => {
  for (let t = 0; t < Math.round(seconds * 60); t++) {
    W.t = t
    step(W)
  }
  return W
}

/** The particle of a cloth nearest to (px, pz) across the plane, and how far across. */
function nearest(W, cloth, px, pz) {
  let best = -1
  let bd = Infinity
  for (let i = cloth.first; i < cloth.first + cloth.nx * cloth.nz; i++) {
    const d = Math.hypot(W.x[i * 3] - px, W.x[i * 3 + 2] - pz)
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return { i: best, d: bd }
}

// 1. Two cloths head on, no gravity. B starts above A, shifted across by a fraction of the spacing,
// each flying at the other at `speed`. The gap at the start is 0.6 m plus a fraction `phase` of what
// they close in a substep, so they do not always meet at the same point of a substep. Count the
// particles of B that started over A and end up below the particle of A nearest to them across,
// after 60 substeps (0.5 s at 2 substeps). Not later: cloths that bounced apart wrinkle and shrink,
// the nearest particle across is no longer under them, and the count sees crossings that never
// happened. Often a whole cloth passes the other in one substep, with no edge ever through a
// triangle: only this count sees it.
/** How far two cloths flying at each other at `speed` close in a substep, after the cap. */
const closing = (variant, speed) =>
  2 * Math.min(speed / 60 / (variant.substeps ?? SUBSTEPS), variant.limit ?? LIMIT)

function headOn(variant, speed, [ox, oz], phase, open = 0) {
  const W = world(variant, false)
  const s = S * (1 + open)
  const A = addCloth(W, 10, 10, 0, 0, 0, s, s, speed)
  const closes = closing(variant, speed)
  const B = addCloth(W, 10, 10, ox * s, 0.6 + phase * closes, oz * s, s, s, -speed)
  for (const link of W.links) link[2] *= 1 + open // see part 6
  const over = []
  for (let i = B.first; i < B.first + 100; i++)
    if (W.x[i * 3] <= 9 * s && W.x[i * 3 + 2] <= 9 * s) over.push(i)
  run(build(W), (0.5 * SUBSTEPS) / (variant.substeps ?? SUBSTEPS))
  let crossed = 0
  for (const i of over) {
    const near = nearest(W, A, W.x[i * 3], W.x[i * 3 + 2])
    if (W.x[i * 3 + 1] < W.x[near.i * 3 + 1]) crossed++
  }
  return { crossed, counted: over.length, pairs: W.pairsChecked, maxMove: W.maxMove }
}

// 2. Grains dropped on a cloth held by its border, stretched both ways, under gravity. With rigid
// links and a held border the net does not stay regular, so it settles first, for 0.3 s. Then 4
// grains are aimed at where the middle of a square is now (the average of its 4 corners) and 4 at
// the middle of a side (the average of its 2 ends). Count the grains that end up below the cloth.
function grains(variant, stretch, speed, phase) {
  const W = world(variant, true)
  const s = S * (1 + stretch)
  const C = addCloth(
    W,
    13,
    13,
    0,
    0,
    0,
    s,
    s,
    0,
    (i, j) => i === 0 || j === 0 || i === 12 || j === 12,
  )
  const squares = [
    [4, 4],
    [4, 7],
    [7, 4],
    [7, 7],
  ]
  const sides = [
    [6, 4],
    [6, 7],
    [4, 6],
    [7, 6],
  ] // from (i, j) to (i, j + 1), and the last two from (i, j) to (i + 1, j)
  const first = W.w.length
  for (let k = 0; k < 8; k++) addGrain(W, k, 50, 0, 0)
  build(W)
  for (let k = 0; k < 8; k++) W.w[first + k] = 0
  run(W, 0.3)
  W.maxMove = 0
  const at = (i, j) => [0, 1, 2].map((q) => W.x[(i + j * 13) * 3 + q])
  const mean = (ps) => [0, 1, 2].map((q) => ps.reduce((t, p) => t + p[q], 0) / ps.length)
  const aims = [
    ...squares.map(([i, j]) => mean([at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)])),
    ...sides.map(([i, j], k) => mean([at(i, j), k < 2 ? at(i, j + 1) : at(i + 1, j)])),
  ]
  aims.forEach((p, k) => {
    const g = first + k
    W.x.set([p[0], p[1] + 4 * r + phase * speed * dt, p[2]], g * 3)
    W.v.set([0, -speed, 0], g * 3)
    W.w[g] = 1
  })
  run(W, 0.4)
  const out = [0, 0]
  aims.forEach((_, k) => {
    const g = first + k
    const near = nearest(W, C, W.x[g * 3], W.x[g * 3 + 2])
    if (W.x[g * 3 + 1] < W.x[near.i * 3 + 1]) out[k < 4 ? 0 : 1]++
  })
  // how stretched the middle of the cloth really is
  let sum = 0
  let n = 0
  for (let j = 4; j <= 8; j++)
    for (let i = 4; i < 8; i++) {
      const p = at(i, j)
      const q = at(i + 1, j)
      sum += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])
      n++
    }
  return { out, real: sum / n / S - 1, maxMove: W.maxMove }
}

// 3. A strip 4 wide and 16 long held flat by its first two rows, under gravity, with a little damping
// so it settles. Where does its tip end, and what is the sharpest fold along it?
function strip(variant) {
  const W = world(variant, true, 0.98)
  addCloth(W, 4, 16, 0, 0, 0, S, S, 0, (_i, j) => j < 2)
  run(build(W), 4)
  const row = (j) => {
    const p = [0, 0, 0]
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) p[k] += W.x[(i + j * 4) * 3 + k] / 4
    return p
  }
  let sharpest = 0
  for (let j = 1; j < 15; j++) {
    const [a, b, c] = [row(j - 1), row(j), row(j + 1)]
    const u = a.map((_, k) => b[k] - a[k])
    const v = a.map((_, k) => c[k] - b[k])
    const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(...u) / Math.hypot(...v)
    sharpest = Math.max(sharpest, (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI)
  }
  return { tip: row(15)[1], sharpest }
}

// 4. A flat cloth alone, no gravity, for a second: does anything move by itself?
function still(variant) {
  const W = world(variant, false)
  addCloth(W, 10, 10, 0, 0, 0, S, S)
  const start = Float64Array.from(build(W).x)
  run(W, 1)
  let most = 0
  for (let k = 0; k < start.length; k++) most = Math.max(most, Math.abs(W.x[k] - start[k]))
  return most
}

// 0. Geometry: the gate, the lowest height of first touch over the whole net, stretched both ways.
function gateOf(middle, stretch) {
  const sx = S * (1 + stretch)
  const pts = []
  for (let i = -2; i <= 2; i++)
    for (let j = -2; j <= 2; j++) {
      pts.push([i * sx, j * sx, 2 * r])
      if (middle) pts.push([(i + 0.5) * sx, (j + 0.5) * sx, r + middle * r])
    }
  let low = Infinity
  const N = 200
  for (let a = 0; a <= N; a++)
    for (let b = 0; b <= N; b++) {
      const px = (a / N) * sx
      const pz = (b / N) * sx
      let h = 0
      for (const [qx, qz, reach] of pts) {
        const d2 = (px - qx) ** 2 + (pz - qz) ** 2
        if (d2 < reach * reach) h = Math.max(h, Math.sqrt(reach * reach - d2))
      }
      low = Math.min(low, h)
    }
  return low
}

// 6. Two nets as open as cloths stretched both ways, head on: headOn with `open`. A cloth that is
// really stretched, held by its border, does not stay even under our solver: its middle stretches
// less than its edge and its particles leave the grid. So the links here are as long as the
// stretched spacing: the same holes, and no pull.

// 7. A curtain 12 by 30 particles, nearly upright, dropped on a floor from `drop` meters: it folds
// onto itself into a pile. After every substep, count the edges of its own surface (the sides and
// one diagonal of each square, through the centers) that pass through one of its triangles sharing
// no corner with them. A pile with its layers on the right side has none; part of the cloth passing
// through another part has some while it passes, and sometimes after.
function surface(W) {
  const edges = []
  const tris = []
  for (const { first, nx, nz } of W.cloths) {
    const id = (i, j) => first + i + j * nx
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        if (i + 1 < nx) edges.push([id(i, j), id(i + 1, j)])
        if (j + 1 < nz) edges.push([id(i, j), id(i, j + 1)])
        if (i + 1 < nx && j + 1 < nz) {
          edges.push([id(i, j), id(i + 1, j + 1)])
          tris.push([id(i, j), id(i + 1, j), id(i + 1, j + 1)])
          tris.push([id(i, j), id(i + 1, j + 1), id(i, j + 1)])
        }
      }
  }
  return { edges, tris }
}

/** Does the segment from particle p to q pass through the triangle a, b, c? (Möller and Trumbore) */
function through(x, p, q, a, b, c) {
  const v = (i, k) => x[i * 3 + k]
  const d = [0, 1, 2].map((k) => v(q, k) - v(p, k))
  const e1 = [0, 1, 2].map((k) => v(b, k) - v(a, k))
  const e2 = [0, 1, 2].map((k) => v(c, k) - v(a, k))
  const o = [0, 1, 2].map((k) => v(p, k) - v(a, k))
  const cross = (u, w) => [
    u[1] * w[2] - u[2] * w[1],
    u[2] * w[0] - u[0] * w[2],
    u[0] * w[1] - u[1] * w[0],
  ]
  const dot = (u, w) => u[0] * w[0] + u[1] * w[1] + u[2] * w[2]
  const h = cross(d, e2)
  const det = dot(e1, h)
  if (Math.abs(det) < 1e-14) return false
  const u = dot(o, h) / det
  if (u < 0 || u > 1) return false
  const g = cross(o, e1)
  const t = dot(d, g) / det
  if (t < 0 || u + t > 1) return false
  const along = dot(e2, g) / det
  return along >= 0 && along <= 1
}

function crossings(W, { edges, tris }) {
  const { x } = W
  const C = 0.4 // meters: wider than any edge or triangle, so a cell and its neighbours hold all
  const key = (ix, iy, iz) => `${ix},${iy},${iz}`
  const grid = new Map()
  for (const [p, q] of edges) {
    const k = key(...[0, 1, 2].map((a) => Math.floor((x[p * 3 + a] + x[q * 3 + a]) / 2 / C)))
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push([p, q])
  }
  let count = 0
  for (const [a, b, c] of tris) {
    const lo = [0, 1, 2].map((k) => Math.min(x[a * 3 + k], x[b * 3 + k], x[c * 3 + k]))
    const hi = [0, 1, 2].map((k) => Math.max(x[a * 3 + k], x[b * 3 + k], x[c * 3 + k]))
    const cx = Math.floor((lo[0] + hi[0]) / 2 / C)
    const cy = Math.floor((lo[1] + hi[1]) / 2 / C)
    const cz = Math.floor((lo[2] + hi[2]) / 2 / C)
    for (let ix = -1; ix <= 1; ix++)
      for (let iy = -1; iy <= 1; iy++)
        for (let iz = -1; iz <= 1; iz++)
          for (const [p, q] of grid.get(key(cx + ix, cy + iy, cz + iz)) ?? []) {
            if (p === a || p === b || p === c || q === a || q === b || q === c) continue
            let apart = false
            for (let k = 0; k < 3; k++)
              if (
                Math.max(x[p * 3 + k], x[q * 3 + k]) < lo[k] ||
                Math.min(x[p * 3 + k], x[q * 3 + k]) > hi[k]
              )
                apart = true
            if (!apart && through(x, p, q, a, b, c)) count++
          }
  }
  return count
}

function curtain(variant, drop, wave) {
  const W = world(variant, true)
  W.floor = true
  const C = addCloth(W, 12, 30, 0, 0, 0, S, S)
  const lean = Math.PI / 180 // one degree, and a small wave across, so it does not stand on its edge
  for (let j = 0; j < 30; j++)
    for (let i = 0; i < 12; i++) {
      const k = C.first + i + j * 12
      W.x[k * 3 + 1] = r + drop + j * S * Math.cos(lean)
      W.x[k * 3 + 2] = j * S * Math.sin(lean) + 0.1 * r * Math.sin(j * 1.3 + i * 0.4 + wave)
    }
  build(W)
  const surf = surface(W)
  let frames = 0 // steps of 1/60 s in which any substep has a crossing
  let last = -1
  let stretch = 0 // the most any link was ever longer than at rest
  W.watch = () => {
    if (W.t !== last && crossings(W, surf)) {
      frames++
      last = W.t
    }
    for (const [a, b, rest] of W.links) {
      const len = Math.hypot(...[0, 1, 2].map((k) => W.x[b * 3 + k] - W.x[a * 3 + k]))
      stretch = Math.max(stretch, len / rest - 1)
    }
  }
  run(W, 3)
  let top = 0
  for (let i = 0; i < W.n; i++) top = Math.max(top, W.x[i * 3 + 1])
  return { frames, left: crossings(W, surf), top, maxMove: W.maxMove, stretch }
}

// 10 and 11. A hand pulls a cloth up through the one lying on it. A lies on the floor, B on top of it,
// shifted across; they settle for 0.3 s. Then a hand takes A by its middle, 3 particles around, and
// pulls it straight up for 1.5 m. B is free, or held by its border. Count the steps in which an
// edge of one passes through a triangle of the other (or of itself).
function pull(variant, speed, [ox, oz], heldB, mode = 'firm') {
  const W = world(variant, true)
  W.floor = true
  const N = 12
  const A = addCloth(W, N, N, 0, r, 0, S, S)
  const border = (i, j) => heldB && (i === 0 || j === 0 || i === N - 1 || j === N - 1)
  addCloth(W, N, N, ox * S, 3 * r, oz * S, S, S, 0, border)
  build(W)
  run(W, 0.3)
  const mid = (N - 1) / 2
  const held = []
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const t = Math.min(Math.hypot(i - mid, j - mid) / 3, 1)
      const weight = 1 - t * t * (3 - 2 * t)
      const k = A.first + i + j * N
      if (weight > 0) held.push({ i: k, weight, from: [(i - mid) * S, 0, (j - mid) * S] })
    }
  const c = A.first + Math.floor(mid) + Math.floor(mid) * N
  const at = [W.x[c * 3] + S / 2, W.x[c * 3 + 1], W.x[c * 3 + 2] + S / 2]
  const links = Array.from({ length: W.n }, () => [])
  for (const [a, b, rest] of W.links) {
    links[a].push([b, rest])
    links[b].push([a, rest])
  }
  const way = [0, 1, 0]
  W.hand = { held, at, way, speed, travel: 1.5, gone: 0, pull: 0.5, mode, most: 0.2, links }
  const y0 = W.x[c * 3 + 1]
  const surf = surface(W)
  let frames = 0
  let last = -1
  let stretch = 0
  W.maxMove = 0
  W.watch = () => {
    if (W.t !== last && crossings(W, surf)) {
      frames++
      last = W.t
    }
    for (const [a, b, rest] of W.links) {
      const len = Math.hypot(...[0, 1, 2].map((k) => W.x[b * 3 + k] - W.x[a * 3 + k]))
      stretch = Math.max(stretch, len / rest - 1)
    }
  }
  run(W, 1.5)
  const lift = W.x[c * 3 + 1] - y0 // how high the middle of the hand got
  return { frames, left: crossings(W, surf), stretch, maxMove: W.maxMove, lift }
}

// node docs/topics/self-collision-middles.mjs 6 7 runs only parts 6 and 7
const PARTS = process.argv.slice(2)
const want = (k) => PARTS.length === 0 || PARTS.includes(String(k))

const pad = (s, n) => String(s).padStart(n)
const radii = (x) => `${(x / r).toFixed(2)} r`

const WAVES = [0, 1.6, 3.2, 4.8] // where the wave across the curtain starts
const PHASES = [0.0625, 0.1875, 0.3125, 0.4375, 0.5625, 0.6875, 0.8125, 0.9375]
const aims = [
  ['square middles', [0.5, 0.5]],
  ['side middles', [0.5, 0]],
  ['in between', [0.3, 0.15]],
]

// 5. The same tests with a tighter cap on the speed: 0.75 r per substep instead of 1 r. At 2
// substeps of 1/120 s that is 9 m/s instead of 12, so only the runs at 12 m/s change. The cap cuts
// the speed only: the springs and the pushes move particles after it, so we also measure the most
// any particle moved in one substep.
const CAP = 0.75 * r
const CAPPED = [
  { name: 'squares', middle: 0, limit: CAP },
  { name: 'middles 1.0 r', middle: 1, skipNext: true, limit: CAP },
]

if (want(0)) {
  console.log('0. The gate, stretched both ways\n')
  console.log(`${'stretch'.padEnd(14)}| ${VARIANTS.map((v) => pad(v.name, 13)).join(' | ')}`)
  for (const st of [0, 0.2, 0.41, 0.6, 0.8]) {
    console.log(
      `${`${Math.round(st * 100)}%`.padEnd(14)}| ${VARIANTS.map((v) => pad(radii(gateOf(v.middle, st)), 13)).join(' | ')}`,
    )
  }
}

if (want(1)) {
  console.log('\n1. Two cloths head on: particles of B that end up below A, over 8 starting gaps\n')
  console.log(
    'where B aims    | speed each | closes per substep | ' +
      VARIANTS.map((v) => pad(v.name, 13)).join(' | '),
  )
  const pairs = VARIANTS.map(() => 0)
  for (const [label, off] of aims)
    for (const speed of [3, 6, 9, 12]) {
      const cells = VARIANTS.map((v, k) => {
        let crossed = 0
        let counted = 0
        for (const phase of PHASES) {
          const out = headOn(v, speed, off, phase)
          pairs[k] += out.pairs
          crossed += out.crossed
          counted += out.counted
        }
        return `${Math.round((100 * crossed) / counted)}%`
      })
      console.log(
        `${label.padEnd(16)}| ${pad(`${speed} m/s`, 10)} | ${pad(radii(2 * speed * dt), 18)} | ${cells.map((c) => pad(c, 13)).join(' | ')}`,
      )
    }
  console.log(
    `\npairs looked at, relative to squares: ${pairs.map((p) => (p / pairs[0]).toFixed(2)).join(', ')}`,
  )
}

if (want(2)) {
  console.log('\n2. Grains on a cloth held by its border, through it over 8 starting heights:')
  console.log('   of 32 aimed at square middles + of 32 aimed at side middles\n')
  console.log(`held (middle) | speed  | ${VARIANTS.map((v) => pad(v.name, 13)).join(' | ')}`)
  for (const st of [0, 0.2, 0.41, 0.6])
    for (const speed of [3, 6, 12]) {
      let real = 0
      const cells = VARIANTS.map((v) => {
        const t = [0, 0]
        for (const phase of PHASES) {
          const g = grains(v, st, speed, phase)
          t[0] += g.out[0]
          t[1] += g.out[1]
          real = g.real
        }
        return t.join(' + ')
      })
      const label = `${Math.round(st * 100)}% (${Math.round(real * 100)}%)`
      console.log(
        `${pad(label, 11)} | ${pad(`${speed} m/s`, 6)} | ${cells.map((c) => pad(c, 13)).join(' | ')}`,
      )
    }
}

if (want(3)) {
  console.log('\n3. A strip held flat by one end: where its tip ends, and its sharpest fold\n')
  for (const v of [
    ...VARIANTS,
    { name: 'middles 1.0 r, next ones not skipped', middle: 1, skipNext: false },
  ]) {
    const { tip, sharpest } = strip(v)
    console.log(
      `${v.name.padEnd(38)} | tip ${tip.toFixed(2)} m | sharpest fold ${sharpest.toFixed(0)}°`,
    )
  }
}

if (want(4)) {
  console.log('\n4. A flat cloth alone for a second: the most any particle moved')
  for (const v of VARIANTS) console.log(`${v.name.padEnd(14)} | ${still(v).toExponential(1)} m`)
}

if (want(5)) {
  console.log(
    `\n5. A cap of ${radii(CAP)} per substep (${(CAP / dt).toFixed(0)} m/s), at 12 m/s each\n`,
  )
  console.log(`where B aims    | ${CAPPED.map((v) => pad(v.name, 13)).join(' | ')}`)
  const most = CAPPED.map(() => 0)
  for (const [label, off] of aims) {
    const cells = CAPPED.map((v, k) => {
      let crossed = 0
      let counted = 0
      for (const phase of PHASES) {
        const out = headOn(v, 12, off, phase)
        crossed += out.crossed
        counted += out.counted
        most[k] = Math.max(most[k], out.maxMove)
      }
      return `${Math.round((100 * crossed) / counted)}%`
    })
    console.log(`${label.padEnd(16)}| ${cells.map((c) => pad(c, 13)).join(' | ')}`)
  }
  console.log(`most moved in a substep  | ${most.map((m) => pad(radii(m), 13)).join(' | ')}`)

  console.log('\nGrains at 12 m/s, through of 32 at square middles + of 32 at side middles\n')
  console.log(`held          | ${CAPPED.map((v) => pad(v.name, 13)).join(' | ')}`)
  const mostG = CAPPED.map(() => 0)
  for (const st of [0.2, 0.41, 0.6]) {
    const cells = CAPPED.map((v, k) => {
      const t = [0, 0]
      for (const phase of PHASES) {
        const g = grains(v, st, 12, phase)
        t[0] += g.out[0]
        t[1] += g.out[1]
        mostG[k] = Math.max(mostG[k], g.maxMove)
      }
      return t.join(' + ')
    })
    console.log(
      `${`${Math.round(st * 100)}%`.padEnd(14)}| ${cells.map((c) => pad(c, 13)).join(' | ')}`,
    )
  }
  console.log(`most moved in a substep | ${mostG.map((m) => pad(radii(m), 13)).join(' | ')}`)
}

if (want(6)) {
  console.log(
    `\n6. Two nets as open as cloths stretched both ways, head on, cap ${radii(CAP)}: particles of B`,
  )
  console.log(
    '   below A, aimed at square middles / side middles / in between, over 8 starting gaps\n',
  )
  console.log(
    `open as | gate, middles | speed  | closes | ${CAPPED.map((v) => pad(v.name, 15)).join(' | ')}`,
  )
  for (const open of [0.2, 0.41, 0.6, 0.8])
    for (const speed of [6, 12]) {
      const cells = CAPPED.map((v) =>
        aims
          .map(([, off]) => {
            let crossed = 0
            let counted = 0
            for (const phase of PHASES) {
              const out = headOn(v, speed, off, phase, open)
              crossed += out.crossed
              counted += out.counted
            }
            return `${Math.round((100 * crossed) / counted)}%`
          })
          .join(' / '),
      )
      const closes = 2 * Math.min(speed * dt, CAP)
      console.log(
        `${pad(`${Math.round(open * 100)}%`, 7)} | ${pad(radii(gateOf(1, open)), 13)} | ${pad(`${speed} m/s`, 6)} | ${pad(radii(closes), 6)} | ${cells.map((c) => pad(c, 15)).join(' | ')}`,
      )
    }
}

if (want(7)) {
  const FOUR = [
    { name: 'squares, 1 r', middle: 0 },
    { name: 'squares, 0.75 r', middle: 0, limit: CAP },
    { name: 'middles, 1 r', middle: 1, skipNext: true },
    { name: 'middles, 0.75 r', middle: 1, skipNext: true, limit: CAP },
  ]
  console.log(
    '\n7. A curtain dropped on a floor folds onto itself: steps of 1/60 s in which its surface crosses',
  )
  console.log(
    '   itself, over 4 starting waves, and (crossings left at the end). Variant, cap per substep\n',
  )
  console.log(`drop  | ${FOUR.map((v) => pad(v.name, 15)).join(' | ')}`)
  const tops = []
  const moved = FOUR.map(() => 0)
  for (const drop of [0, 3, 6, 10]) {
    const cells = FOUR.map((v, k) => {
      let frames = 0
      let left = 0
      for (const wave of WAVES) {
        const c = curtain(v, drop, wave)
        frames += c.frames
        left += c.left
        tops.push(c.top)
        moved[k] = Math.max(moved[k], c.maxMove)
      }
      return `${frames} (${left})`
    })
    console.log(`${pad(`${drop} m`, 5)} | ${cells.map((c) => pad(c, 15)).join(' | ')}`)
  }
  console.log(
    `\nThe piles end ${Math.min(...tops).toFixed(2)} to ${Math.max(...tops).toFixed(2)} m high, 2 r a layer.`,
  )
  console.log(`most moved in a substep | ${moved.map((m) => pad(radii(m), 15)).join(' | ')}`)
}

if (want(8)) {
  console.log('\n8. Two cloths head on with more substeps, cap 1 r per substep: particles of B')
  console.log('   below A, the worst of the three aims, over 8 gaps, and (how far they close in a')
  console.log('   substep). With no gravity, 4 substeps at 18 m/s are 2 substeps at 9 m/s\n')
  const SPEEDS = [9, 12, 18, 24]
  console.log(`variant        | substeps | ${SPEEDS.map((sp) => pad(`${sp} m/s`, 12)).join(' | ')}`)
  for (const base of VARIANTS.slice(0, 2))
    for (const substeps of [2, 3, 4]) {
      const v = { ...base, substeps }
      const cells = SPEEDS.map((speed) => {
        let worst = 0
        for (const [, off] of aims) {
          let crossed = 0
          let counted = 0
          for (const phase of PHASES) {
            const out = headOn(v, speed, off, phase)
            crossed += out.crossed
            counted += out.counted
          }
          worst = Math.max(worst, crossed / counted)
        }
        return `${Math.round(worst * 100)}% (${(closing(v, speed) / r).toFixed(1)} r)`
      })
      console.log(
        `${base.name.padEnd(15)}| ${pad(substeps, 8)} | ${cells.map((c) => pad(c, 12)).join(' | ')}`,
      )
    }
}

if (want(9)) {
  console.log(
    '\n9. The curtain of part 7 with more substeps, or more passes over the links, cap 1 r',
  )
  console.log(
    '   per substep: steps with a crossing, over 4 waves, and (crossings left at the end);',
  )
  console.log('   the most stretched link, and the most a particle moved in a substep\n')
  const DROPS = [3, 6, 10]
  console.log(
    `variant        | substeps | passes | ${DROPS.map((d) => pad(`${d} m`, 8)).join(' | ')} | stretch | moved`,
  )
  for (const base of VARIANTS.slice(0, 2))
    for (const [substeps, passes] of [
      [2, 4],
      [2, 8],
      [3, 4],
      [4, 4],
    ]) {
      const v = { ...base, substeps, passes }
      let stretch = 0
      let moved = 0
      const cells = DROPS.map((drop) => {
        let frames = 0
        let left = 0
        for (const wave of WAVES) {
          const c = curtain(v, drop, wave)
          frames += c.frames
          left += c.left
          stretch = Math.max(stretch, c.stretch)
          moved = Math.max(moved, c.maxMove)
        }
        return `${frames} (${left})`
      })
      console.log(
        `${base.name.padEnd(15)}| ${pad(substeps, 8)} | ${pad(passes, 6)} | ${cells.map((c) => pad(c, 8)).join(' | ')} | ${pad(`${Math.round(stretch * 100)}%`, 7)} | ${radii(moved)}`,
      )
    }
}

if (want(10)) {
  console.log(
    '\n10. A hand pulls a cloth up through the one lying on it, cap 1 r per substep: steps',
  )
  console.log('    with a crossing, over 4 shifts of B, and (crossings left at the end); the most')
  console.log('    stretched link, and the most a particle moved in a substep\n')
  const CASES = [
    ['B free, 2 m/s', 2, false],
    ['B free, 10 m/s', 10, false],
    ['B held, 2 m/s', 2, true],
    ['B held, 10 m/s', 10, true],
  ]
  console.log(
    `variant        | substeps | ${CASES.map(([n]) => pad(n, 14)).join(' | ')} | stretch | moved`,
  )
  for (const base of VARIANTS.slice(0, 2))
    for (const substeps of [2, 3, 4]) {
      const v = { ...base, substeps }
      let stretch = 0
      let moved = 0
      const cells = CASES.map(([, speed, heldB]) => {
        let frames = 0
        let left = 0
        for (const off of [...aims.map(([, o]) => o), [0, 0]]) {
          const c = pull(v, speed, off, heldB)
          frames += c.frames
          left += c.left
          stretch = Math.max(stretch, c.stretch)
          moved = Math.max(moved, c.maxMove)
        }
        return `${frames} (${left})`
      })
      console.log(
        `${base.name.padEnd(15)}| ${pad(substeps, 8)} | ${cells.map((c) => pad(c, 14)).join(' | ')} | ${pad(`${Math.round(stretch * 100)}%`, 7)} | ${radii(moved)}`,
      )
    }
}

if (want(11)) {
  console.log(
    '\n11. The same pull with a hand that gives way, 3 substeps: steps with a crossing, over',
  )
  console.log('    4 shifts of B, (crossings left at the end) and how high the hand got, of 1.5 m;')
  console.log('    then the most stretched link\n')
  const CASES = [
    ['B free, 10 m/s', 10, false],
    ['B held, 2 m/s', 2, true],
    ['B held, 10 m/s', 10, true],
  ]
  console.log(`variant        | hand   | ${CASES.map(([n]) => pad(n, 18)).join(' | ')} | stretch`)
  for (const base of VARIANTS.slice(0, 2))
    for (const mode of ['firm', 'capped', 'waits', 'slips']) {
      const v = { ...base, substeps: 3 }
      let stretch = 0
      const cells = CASES.map(([, speed, heldB]) => {
        let frames = 0
        let left = 0
        let lift = 0
        for (const off of [...aims.map(([, o]) => o), [0, 0]]) {
          const c = pull(v, speed, off, heldB, mode)
          frames += c.frames
          left += c.left
          lift += c.lift / 4
          stretch = Math.max(stretch, c.stretch)
        }
        return `${frames} (${left}) ${lift.toFixed(2)} m`
      })
      console.log(
        `${base.name.padEnd(15)}| ${mode.padEnd(6)} | ${cells.map((c) => pad(c, 18)).join(' | ')} | ${pad(`${Math.round(stretch * 100)}%`, 7)}`,
      )
    }
}
