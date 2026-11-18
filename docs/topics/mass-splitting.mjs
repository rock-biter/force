// The numbers of docs/logbook/019-the-price-of-copies.md, recomputed.
// Run it with: node docs/topics/mass-splitting.mjs
// The chain is the one of docs/topics/soft-step.mjs: 10 links of 10 cm hanging straight down,
// particles of 1 kg, a weight at the end. Here the links are solved in three different orders.

const GRAVITY = -9.81
const STEP = 1 / 60
const LINKS = 10
const LENGTH = 0.1

const cm = (value) => (Number.isNaN(value) ? 'blows up' : `${(value * 100).toFixed(1)} cm`)

// The three numbers of a soft rule, as in b2MakeSoft (Box2D, src/solver.h).
const makeSoft = (hertz, ratio, h) => {
  const omega = 2 * Math.PI * hertz
  const a1 = 2 * ratio + h * omega
  const a2 = h * omega * a1
  const a3 = 1 / (1 + a2)
  return { biasRate: omega / a1, massScale: a2 * a3, impulseScale: a3 }
}

// order:
//   'row'    one link after the other, top to bottom, as on a CPU
//   'turns'  the even links together, then the odd links together: no particle is in a group twice
//   'copies' all the links together: each one counts a particle's mass divided by the number of
//            its links, and the pushes are added on the whole particle (mass splitting)
//   'sum'    all the links together with the full mass, and the pushes added: no share
// Returns how much too long the chain is at the end, in meters, or NaN if it blew up.
const chain = ({ weight, order, substeps, rounds, relax = 0, soft, share, seconds = 10 }) => {
  const h = STEP / substeps
  const numbers = soft && makeSoft(Math.min(soft.hertz, 0.25 / h), soft.ratio, h)
  const y = Array.from({ length: LINKS + 1 }, (_, i) => -i * LENGTH)
  const speed = y.map(() => 0)
  // 1 / mass: 0 for the fixed point at the top.
  const inverse = y.map((_, i) => (i === 0 ? 0 : i === LINKS ? 1 / weight : 1))
  // How many links touch each particle: its mass is shared among them.
  const count = y.map((_, i) => (i === 0 || i === LINKS ? 1 : 2))
  const stored = new Array(LINKS).fill(0)
  const apply = (j, push) => {
    speed[j] += inverse[j] * push
    speed[j + 1] -= inverse[j + 1] * push
  }
  // The push of link j, read from the current speeds. k is 1 / mass of its two ends, added.
  const pushOf = (j, correct, shared) => {
    const k = shared
      ? count[j] * inverse[j] + count[j + 1] * inverse[j + 1]
      : inverse[j] + inverse[j + 1]
    const growing = speed[j] - speed[j + 1]
    const error = y[j] - y[j + 1] - LENGTH
    if (correct && numbers) {
      const target = growing + numbers.biasRate * error
      return (-numbers.massScale * target) / k - numbers.impulseScale * stored[j]
    }
    if (correct) return -(growing + (share / h) * error) / k
    return -growing / k
  }
  const one = (j, correct) => {
    const push = pushOf(j, correct, false)
    stored[j] += push
    apply(j, push)
  }
  const solve = (correct) => {
    if (order === 'row') {
      for (let j = 0; j < LINKS; j++) one(j, correct)
    } else if (order === 'turns') {
      for (let j = 0; j < LINKS; j += 2) one(j, correct)
      for (let j = 1; j < LINKS; j += 2) one(j, correct)
    } else {
      // Every link reads the same old speeds, then all the pushes are applied.
      const pushes = stored.map((_, j) => pushOf(j, correct, order === 'copies'))
      for (let j = 0; j < LINKS; j++) {
        stored[j] += pushes[j]
        apply(j, pushes[j])
      }
    }
  }
  let stretch = 0
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    for (let s = 0; s < substeps; s++) {
      for (let p = 1; p <= LINKS; p++) speed[p] += GRAVITY * h
      // Soft Step starts each substep from the pushes of the one before. The solver of 2005 is
      // run here without that memory, which is what makes it blow up (chapter 015).
      if (numbers) for (let j = 0; j < LINKS; j++) apply(j, stored[j])
      else stored.fill(0)
      for (let r = 0; r < rounds; r++) solve(true)
      for (let p = 1; p <= LINKS; p++) y[p] += speed[p] * h
      for (let r = 0; r < relax; r++) solve(false)
    }
    stretch = -y[LINKS] - LINKS * LENGTH
    if (!(Math.abs(stretch) < 1000)) return Number.NaN
  }
  return stretch
}

// 1. The solver of 2005 with no memory: 1 step, N rounds, each fixing 20% of the error.
{
  console.log(
    '1. Solver of 2005, no stored pushes: how much too long after 10 s, by rounds per step',
  )
  const hard = { substeps: 1, share: 0.2 }
  for (const weight of [1, 100]) {
    console.log(`   carrying ${weight} kg`)
    for (const order of ['row', 'turns', 'copies']) {
      const cells = [8, 16, 32, 64, 128].map(
        (rounds) => `${rounds}: ${cm(chain({ weight, order, rounds, ...hard }))}`,
      )
      console.log(`     ${order.padEnd(6)} ${cells.join(' · ')}`)
    }
  }
}

const joint = { hertz: 60, ratio: 2 }
const softStep = { rounds: 1, relax: 1, soft: joint }

// 2. Soft Step: where the chain comes to rest.
{
  // A soft rule is a spring: at rest each link is too long by force × k / omega².
  const sag = (weight, shared) => {
    const omega = 2 * Math.PI * joint.hertz
    let total = 0
    for (let j = 0; j < LINKS; j++) {
      const carried = (LINKS - 1 - j + weight) * -GRAVITY // newtons hanging below this link
      const top = j === 0 ? 0 : shared ? 2 : 1
      const bottom = j === LINKS - 1 ? 1 / weight : shared ? 2 : 1
      total += (carried * (top + bottom)) / omega ** 2
    }
    return total
  }
  console.log('2. Soft Step, 1 round + 1 relax per substep: how much too long after 40 s')
  for (const weight of [1, 10, 100]) {
    const run = (order, substeps) =>
      cm(chain({ weight, order, substeps, seconds: 40, ...softStep }))
    const more = cm(
      chain({
        weight,
        order: 'copies',
        substeps: 4,
        seconds: 40,
        ...softStep,
        rounds: 8,
        relax: 8,
      }),
    )
    console.log(
      `   ${weight} kg: row ${run('row', 4)} · turns ${run('turns', 4)} · copies, 5 substeps ${run('copies', 5)}` +
        ` · copies, 4 substeps of 8 rounds + 8 relax ${more}` +
        ` · a spring of 60 Hz sags ${cm(sag(weight, false))}, with shared mass ${cm(sag(weight, true))}`,
    )
  }
}

// 3. Soft Step with its defaults, 4 substeps: the copies do not stay still.
{
  console.log('3. Soft Step with copies, 1 kg: how much too long, over time')
  const at = (options) =>
    [2, 6, 10, 20, 40]
      .map(
        (seconds) => `${seconds} s: ${cm(chain({ weight: 1, seconds, ...softStep, ...options }))}`,
      )
      .join(' · ')
  console.log(`   copies, 4 substeps: ${at({ order: 'copies', substeps: 4 })}`)
  console.log(`   copies, 5 substeps: ${at({ order: 'copies', substeps: 5 })}`)
  console.log(`   copies, 4 substeps, 2 rounds: ${at({ order: 'copies', substeps: 4, rounds: 2 })}`)
  console.log(`   turns, 4 substeps: ${at({ order: 'turns', substeps: 4 })}`)
  console.log(`   no share of the mass, 4 substeps: ${at({ order: 'sum', substeps: 4 })}`)
  let alive = 0
  while (
    !Number.isNaN(chain({ weight: 1, order: 'sum', substeps: 4, seconds: alive, ...softStep }))
  )
    alive += 0.1
  console.log(`   no share of the mass: gone past 1 km within ${alive.toFixed(1)} s`)
}
