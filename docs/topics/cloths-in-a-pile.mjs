// Thin cloths in a pile: how much does the lowest gap close under the weight of the cloths above?
// Run with: node docs/topics/cloths-in-a-pile.mjs
//
// On the GPU (examples/net-surface/round-cells-surface.wgsl) two cloths push each other along
// their normals and rest a thickness apart, middle to middle. A pile of 6 cloths 4 cm thick holds,
// one of 12 tangles. The guess to test: under the weight above, the solver lets the lowest two
// cloths come closer than they should by more than the thickness, so one passes the other.
//
// The scene: N flat square cloths of 8 by 8 particles, laid on each other on the floor, each a
// thickness above the one below, at rest. They are flat and stay flat, so the normal of every
// cloth is straight up: only the pushes between cloths are tried here, not the normals. Then our
// step runs for 5 seconds and we read the gap between the two lowest cloths, at their middle.
//
// A small copy of our step, on the CPU: substeps of 1/60 s, the speed limit of decision 045, 4
// passes on the springs, 3 rounds of pushes where a particle moves by half the sum and half the
// average of what its contacts ask (decision 015), the levels of decision 028 (c), no friction.
// Between two cloths, as in the shader: a contact is made when two spheres overlap; all the
// particles of one cloth in reach are blended into one surface, weighed by the distance along
// the cloth, a cloth more than 1.5 resting distances away is left out, and the side is the one
// the particle began the substep on.

const r = 0.1
const SIDE = 8
const ROUNDS = 3
const SPRING_PASSES = 4
const G = 9.81
const RESTS = 0.001

function pile(count, thickness, c, substeps, seconds = 5) {
  const dt = 1 / 60 / substeps
  const limit = ((substeps >= 3 ? 0.75 : 1) * r) / dt
  const each = SIDE * SIDE
  const n = count * each
  const x = new Float64Array(n * 3)
  const v = new Float64Array(n * 3)
  const prev = new Float64Array(n * 3)
  const next = new Float64Array(n * 3)
  let levels = new Int32Array(n).fill(-1)
  for (let k = 0; k < count; k++)
    for (let b = 0; b < SIDE; b++)
      for (let a = 0; a < SIDE; a++) {
        const i = (k * each + b * SIDE + a) * 3
        // each cloth a little to the side of the one below, so that particles are not in columns
        x[i] = a * 2 * r + ((k * 7) % 5) * 0.04
        x[i + 1] = r + k * thickness
        x[i + 2] = b * 2 * r + ((k * 3) % 5) * 0.04
      }
  const springs = []
  for (let k = 0; k < count; k++)
    for (let b = 0; b < SIDE; b++)
      for (let a = 0; a < SIDE; a++) {
        const i = k * each + b * SIDE + a
        if (a + 1 < SIDE) springs.push([i, i + 1])
        if (b + 1 < SIDE) springs.push([i, i + SIDE])
      }
  const body = (i) => Math.floor(i / each)
  // every pair of particles of two cloths whose spheres can overlap: the cloths only move up and
  // down, so the pairs within a diameter along the floor are all there will ever be
  const near = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (body(i) === body(j)) continue
      const across = Math.hypot(x[i * 3] - x[j * 3], x[i * 3 + 2] - x[j * 3 + 2])
      if (across < 2 * r) near[i].push([j, Math.max(1 - across / (2 * r), 0), across])
    }

  for (let step = 0; step < 60 * seconds; step++) {
    // the levels, from last step's: 0 on the floor, one more than the lowest particle under it
    const now = new Int32Array(n).fill(-1)
    for (let i = 0; i < n; i++) {
      let level = x[i * 3 + 1] - r < RESTS ? 0 : -1
      for (const [j, , across] of near[i]) {
        if (levels[j] < 0) continue
        const up = x[i * 3 + 1] - x[j * 3 + 1]
        const far = Math.hypot(across, up)
        if (far - 2 * r < RESTS && up > 0.5 * far)
          level = level < 0 ? levels[j] + 1 : Math.min(level, levels[j] + 1)
      }
      now[i] = level
    }
    levels = now
    for (let s = 0; s < substeps; s++) {
      prev.set(x)
      for (let i = 0; i < n; i++) {
        v[i * 3 + 1] -= G * dt
        const speed = Math.hypot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2])
        const cut = speed > limit ? limit / speed : 1
        for (let k = 0; k < 3; k++) x[i * 3 + k] += v[i * 3 + k] * cut * dt
      }
      for (let pass = 0; pass < SPRING_PASSES; pass++)
        for (const [i, j] of springs) {
          const d = [0, 1, 2].map((k) => x[i * 3 + k] - x[j * 3 + k])
          const far = Math.hypot(...d)
          const move = (far - 2 * r) / far / 2
          for (let k = 0; k < 3; k++) {
            x[i * 3 + k] -= d[k] * move
            x[j * 3 + k] += d[k] * move
          }
        }
      for (let round = 0; round < ROUNDS; round++) {
        for (let i = 0; i < n; i++) {
          let sum = 0
          let contacts = 0
          const y = x[i * 3 + 1]
          if (y < r) {
            sum += r - y
            contacts++
          }
          // one surface for each cloth in reach
          const surfaces = new Map()
          for (const [j, weight, across] of near[i]) {
            const height = y - x[j * 3 + 1]
            if (Math.hypot(across, height) >= 2 * r) continue
            if (Math.abs(height) >= 1.5 * thickness) continue
            let tilt = 1
            if (c > 0 && levels[i] >= 0 && levels[j] >= 0)
              tilt = Math.exp(c * (levels[i] - levels[j]))
            const it = surfaces.get(body(j)) ?? { height: 0, was: 0, share: 0, weight: 0 }
            it.height += height * weight
            it.was += (prev[i * 3 + 1] - prev[j * 3 + 1]) * weight
            it.share += (tilt / (tilt + 1)) * weight
            it.weight += weight
            surfaces.set(body(j), it)
          }
          for (const it of surfaces.values()) {
            if (it.weight <= 0) continue
            const side = it.was >= 0 ? 1 : -1
            const overlap = thickness - (side * it.height) / it.weight
            if (overlap <= 0) continue
            sum += (side * overlap * it.share) / it.weight
            contacts++
          }
          next[i] = contacts ? y + sum * (0.5 + 0.5 / contacts) : y
        }
        for (let i = 0; i < n; i++) x[i * 3 + 1] = next[i]
      }
      for (let i = 0; i < n * 3; i++) v[i] = (x[i] - prev[i]) / dt
    }
  }
  // the gaps at the middle of the cloths: the lowest, and the smallest of them all
  const middle = (k) => {
    let y = 0
    for (const b of [3, 4]) for (const a of [3, 4]) y += x[(k * each + b * SIDE + a) * 3 + 1] / 4
    return y
  }
  let smallest = Infinity
  for (let k = 1; k < count; k++) smallest = Math.min(smallest, middle(k) - middle(k - 1))
  return { lowest: middle(1) - middle(0), smallest, top: middle(count - 1) - middle(0) }
}

const cm = (m) => `${(m * 100).toFixed(1)} cm`
function table(title, c, substeps) {
  console.log(`\n${title}\n`)
  console.log(
    '| Cloths | Thickness | Lowest gap | Smallest gap | Passed through | Height of the pile, of what it should be |',
  )
  console.log('| --- | --- | --- | --- | --- | --- |')
  for (const thickness of [0.04, 0.08, 0.14])
    for (const count of [2, 6, 12, 20]) {
      const { lowest, smallest, top } = pile(count, thickness, c, substeps)
      console.log(
        `| ${count} | ${cm(thickness)} | ${cm(lowest)} | ${cm(smallest)} | ${smallest <= 0 ? 'yes' : 'no'} | ${((top / ((count - 1) * thickness)) * 100).toFixed(0)}% |`,
      )
    }
}

table('3 substeps, with the levels (c = 1.5): as the page', 1.5, 3)
table('3 substeps, no levels (c = 0)', 0, 3)
table('8 substeps, with the levels (c = 1.5)', 1.5, 8)
