// A loose particle on a net of spheres: how far must the net tilt before the particle leaves the
// dimple it sits in? Run with: node docs/topics/grains-on-cloth.mjs
//
// The net is flat and held still: every one of its particles is pinned. A grain of radius r starts
// at rest in the dimple between four of them. Tilting the net is the same as turning gravity, so
// gravity turns, slowly (1 degree per second), toward the lowest way out of the dimple: the saddle
// between two neighbours. The answer is the angle at which the grain has moved one spacing.
//
// A small copy of our step, on the CPU: 3 substeps of 1/180 s, the speed limit of one radius per
// substep (decision 027), 3 rounds of pushes, where the grain moves by half the sum and half the
// average of what its contacts ask (decision 015). No friction: only the shape holds the grain.

const r = 0.1
const SUBSTEPS = 3
const dt = 1 / 60 / SUBSTEPS
const ROUNDS = 3
const G = 9.81
const RATE = 1 // degrees of tilt per second
const deg = (a) => (a * 180) / Math.PI

/** What the geometry says: the slope of the way out, where it is steepest, at the dimple. */
function predicted(fine, stretch) {
  const a = (r / fine) * stretch // half the spacing
  const D = r + r / fine // between two centers that touch
  const under = D * D - 2 * a * a
  return under <= 0 ? NaN : deg(Math.atan(a / Math.sqrt(under)))
}

/** The tilt, in degrees, at which the grain leaves its dimple. NaN if it falls through the net. */
function measured(fine, stretch) {
  const rn = r / fine
  const pitch = 2 * rn * stretch
  const side = 16 * fine
  const net = []
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) net.push([i * pitch, 0, j * pitch])
  const mid = (side / 2 - 0.5) * pitch // the middle of a square
  const D = r + rn
  const under = D * D - (pitch * pitch) / 2
  if (under <= 0) return NaN
  const x = [mid, Math.sqrt(under), mid]
  const v = [0, 0, 0]
  const start = x[0]

  for (let step = 0; step < 60 * 90; step++) {
    const tilt = (step / 60) * RATE * (Math.PI / 180)
    const g = [G * Math.sin(tilt), -G * Math.cos(tilt), 0]
    for (let s = 0; s < SUBSTEPS; s++) {
      const prev = [...x]
      for (let k = 0; k < 3; k++) v[k] += g[k] * dt
      const move = Math.hypot(...v) * dt
      if (move > r) for (let k = 0; k < 3; k++) v[k] *= r / move
      for (let k = 0; k < 3; k++) x[k] += v[k] * dt
      for (let round = 0; round < ROUNDS; round++) {
        const sum = [0, 0, 0]
        let count = 0
        for (const p of net) {
          const d = [x[0] - p[0], x[1] - p[1], x[2] - p[2]]
          const dist = Math.hypot(...d)
          if (dist >= D || dist === 0) continue
          for (let k = 0; k < 3; k++) sum[k] += (d[k] * (D - dist)) / dist // a pinned one gives nothing
          count++
        }
        if (count) for (let k = 0; k < 3; k++) x[k] += sum[k] / 2 + sum[k] / count / 2
      }
      for (let k = 0; k < 3; k++) v[k] = (x[k] - prev[k]) / dt
    }
    if (x[1] < 0) return NaN
    if (x[0] - start > pitch) return deg(tilt)
  }
  return Infinity
}

const show = (a) => (Number.isNaN(a) ? 'falls through' : `${a.toFixed(1)}°`)
console.log('The tilt at which a grain at rest leaves its dimple, with no friction\n')
console.log('| Net | Stretch | By geometry | By our step |')
console.log('| --- | --- | --- | --- |')
for (const [fine, stretch] of [
  [1, 1],
  [1, 1.1],
  [1, 1.2],
  [1, 1.3],
  [1, 1.42],
  [2, 1],
  [3, 1],
  [3, 1.2],
  [4, 1],
])
  console.log(
    `| spheres ${fine === 1 ? 'as large as the grain' : `${fine} times smaller`} | ${Math.round((stretch - 1) * 100)}% | ${show(predicted(fine, stretch))} | ${show(measured(fine, stretch))} |`,
  )

// ---------------------------------------------------------------------------------------------
// Part 2. Other ways to push, on a net whose spheres stay as large as the grain.
//
// The net is flat, pinned, in the plane y = 0, so its normal is +y everywhere. Each way is a
// function that takes the grain, a particle of the net and the side the grain was on when the
// substep began (+1 above, -1 below: the side kept of decision 046), and gives the push it asks,
// or nothing. H is half the thickness of the cloth: where the grain's surface should rest.
//
// - today: along the line between the two centers.
// - closer: today's push, on a net with the same spheres half a diameter apart (4 times as many).
// - large sphere: a sphere of radius R whose top is H above the particle, one for each side
//   (Müller and Chentanez 2011, their surface particles). A contact is made as today, when the
//   two plain spheres overlap; `wide` makes it when the large one is touched.
// - normal: a contact is made as today, and the push goes along the normal of the cloth, until
//   the grain's surface is H above the plane. Every particle of the net in reach asks the same
//   push, and our rule adds them up, so the grain is thrown back: `once` counts the cloth once.
// - a true plane: no net at all. What a perfect answer would measure.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a) => Math.hypot(a[0], a[1], a[2])

const centers = (x, p) => {
  const d = sub(x, p)
  const dist = len(d)
  return dist < 2 * r && dist > 0 ? d.map((c) => (c * (2 * r - dist)) / dist) : null
}
const largeSphere = (R, H, wide) => (x, p, side) => {
  if (!wide && len(sub(x, p)) >= 2 * r) return null
  const d = sub(x, [p[0], p[1] - side * (R - H), p[2]])
  const dist = len(d)
  return dist < R + r ? d.map((c) => (c * (R + r - dist)) / dist) : null
}
const normal = (H) => (x, p, side) => {
  if (len(sub(x, p)) >= 2 * r) return null
  const depth = H + r - side * (x[1] - p[1])
  return depth > 0 ? [0, side * depth, 0] : null
}

/**
 * Runs the step on one grain. `tilt(t)` gives the tilt in radians at time t, `hold` keeps the
 * grain over one spot (to read how high it rests there), `until(x, t)` stops the run.
 */
function run({
  push,
  once,
  pitch = 2 * r,
  plane,
  start,
  speed = 0,
  tilt = () => 0,
  hold,
  seconds,
  until,
}) {
  const net = []
  if (plane === undefined)
    for (let j = 0; j < Math.round(1.6 / pitch); j++)
      for (let i = 0; i < Math.round(4 / pitch); i++) net.push([i * pitch, 0, j * pitch])
  const x = [...start]
  const v = [speed, 0, 0]
  let contacts = 0
  for (let step = 0; step < 60 * seconds; step++) {
    const a = tilt(step / 60)
    const g = [G * Math.sin(a), -G * Math.cos(a), 0]
    for (let s = 0; s < SUBSTEPS; s++) {
      const prev = [...x]
      const side = prev[1] >= 0 ? 1 : -1
      for (let k = 0; k < 3; k++) v[k] += g[k] * dt
      const move = len(v) * dt
      if (move > r) for (let k = 0; k < 3; k++) v[k] *= r / move
      for (let k = 0; k < 3; k++) x[k] += v[k] * dt
      for (let round = 0; round < ROUNDS; round++) {
        const sum = [0, 0, 0]
        let count = 0
        let deepest // with `once`, the whole cloth is one contact: the deepest of what its particles ask
        if (plane !== undefined && x[1] < plane + r) {
          sum[1] += plane + r - x[1]
          count++
        }
        for (const p of net) {
          const ask = push?.(x, p, side)
          if (!ask) continue
          if (once) {
            if (!deepest || len(ask) > len(deepest)) deepest = ask
            continue
          }
          for (let k = 0; k < 3; k++) sum[k] += ask[k]
          count++
        }
        if (deepest) {
          for (let k = 0; k < 3; k++) sum[k] += deepest[k]
          count++
        }
        if (count) for (let k = 0; k < 3; k++) x[k] += sum[k] / 2 + sum[k] / count / 2
        if (round === 0) contacts += count
      }
      if (hold) [x[0], x[2]] = [start[0], start[2]]
      for (let k = 0; k < 3; k++) v[k] = (x[k] - prev[k]) / dt
    }
    if (until?.(x, step / 60)) return { x, t: step / 60, contacts }
  }
  return { x, t: seconds, contacts }
}

function part2(H) {
  const ways = [
    { name: 'today', push: centers },
    { name: 'closer, 4 times the particles', push: centers, pitch: r },
    { name: 'large sphere, R = 2 r', push: largeSphere(2 * r, H) },
    { name: 'large sphere, R = 2 r, wide', push: largeSphere(2 * r, H, true) },
    { name: 'large sphere, R = 4 r', push: largeSphere(4 * r, H) },
    { name: 'large sphere, R = 4 r, wide', push: largeSphere(4 * r, H, true) },
    { name: 'normal', push: normal(H) },
    { name: 'normal, the cloth as one contact', push: normal(H), once: true },
    { name: 'a true plane', plane: H },
  ]
  console.log(`\nHalf the thickness of the cloth: ${H / r} r\n`)
  console.log(
    '| Way | Leaves at a tilt of | Rests, lowest to highest | Slides in 2 s at 1 m/s | Bounces to, from 0.5 m |',
  )
  console.log('| --- | --- | --- | --- | --- |')
  for (const way of ways) {
    const pitch = way.pitch ?? 2 * r
    const i0 = Math.round(1 / pitch)
    const j0 = Math.round(0.8 / pitch)
    const over = (u, w) => [(i0 + u) * pitch, 2.2 * r + H, (j0 + w) * pitch]
    // how high the grain's surface rests above the plane of the cloth, over 6 by 6 spots of a square
    let low = Infinity
    let high = -Infinity
    let through = false
    for (let a = 0; a <= 5; a++)
      for (let b = 0; b <= 5; b++) {
        const { x } = run({
          ...way,
          start: over(a / 10, b / 10),
          hold: true,
          seconds: 1,
        })
        if (x[1] < 0) through = true
        low = Math.min(low, x[1] - r)
        high = Math.max(high, x[1] - r)
      }
    // the tilt at which it leaves, from rest in the middle of a square
    const settle = run({ ...way, start: over(0.5, 0.5), seconds: 1 }).x
    const left = run({
      ...way,
      start: settle,
      tilt: (t) => (t * RATE * Math.PI) / 180,
      seconds: 90,
      until: (x) => x[0] - settle[0] > 2 * r || x[1] < 0,
    })
    // a grain sent along the level net: how far in 2 seconds, of the 2 m of a perfect plane
    const slid = run({ ...way, start: settle, speed: 1, seconds: 2 })
    // a grain dropped from 0.5 m, off the middle of a square: how high it comes back
    let down = false
    let top = 0
    const from = over(0.3, 0.2)
    run({
      ...way,
      start: [from[0], H + r + 0.5, from[2]],
      seconds: 2,
      until: (x) => {
        if (x[1] - r - H < 0.05) down = true
        else if (down) top = Math.max(top, x[1] - r - H)
      },
    })
    console.log(
      `| ${way.name} | ${left.x[1] < 0 ? 'falls through' : `${left.t.toFixed(1)}°`} | ${(low / r).toFixed(2)} r to ${(high / r).toFixed(2)} r | ${slid.x[1] < 0 ? 'falls through' : `${(slid.x[0] - settle[0]).toFixed(2)} m`} | ${top ? `${top.toFixed(2)} m` : 'stays down'}${through ? ', falls through' : ''} |`,
    )
  }
}

for (const H of [0, 0.3 * r, 0.6 * r]) part2(H)
