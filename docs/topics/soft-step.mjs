// The numbers of docs/topics/soft-step.md, recomputed.
// Run it with: node docs/topics/soft-step.mjs
// Change the constants and see how the solver reacts.

const GRAVITY = -9.81
const STEP = 1 / 60

const round = (value, digits = 2) => Number(value.toFixed(digits))

// The three numbers of a soft rule, as in b2MakeSoft (Box2D, src/solver.h).
// hertz: how many times per second the spring would swing. ratio: how fast the swing dies.
const makeSoft = (hertz, ratio, h) => {
  const omega = 2 * Math.PI * hertz
  const a1 = 2 * ratio + h * omega
  const a2 = h * omega * a1
  const a3 = 1 / (1 + a2)
  return { biasRate: omega / a1, massScale: a2 * a3, impulseScale: a3 }
}

// 1. Box2D's defaults, with a step of 1/60 s split into 4 substeps.
{
  console.log('1. The three numbers of a soft rule, 4 substeps of 1/240 s')
  const h = STEP / 4
  for (const [name, hertz, ratio] of [
    ['joint, 60 Hz, damping ratio 2', 60, 2],
    ['contact, 30 Hz, damping ratio 10', 30, 10],
  ]) {
    const soft = makeSoft(hertz, ratio, h)
    const share = soft.massScale * soft.biasRate * h
    console.log(
      `   ${name}: bias rate ${round(soft.biasRate, 1)} per second, mass scale ${round(soft.massScale, 3)},` +
        ` impulse scale ${round(soft.impulseScale, 3)}, removes ${round(share * 100, 1)}% of the error per substep`,
    )
  }
}

// 2. The pendulum of chapters 013 and 014: a point of 1 kg on a stick of 1 m.
{
  // One rule, solved Box2D's way: gravity, the stored push, the soft push, move, the relax push.
  // With soft = null the push is the nudge of 2005: a share of the error per substep, and no relax.
  const pendulum = ({ angle, substeps, soft, share }) => {
    const h = STEP / substeps
    const numbers = soft && makeSoft(Math.min(soft.hertz, 0.25 / h), soft.ratio, h)
    let [x, y] = [Math.sin((angle * Math.PI) / 180), -Math.cos((angle * Math.PI) / 180)]
    let [vx, vy] = [0, 0]
    let stored = 0
    let highest = -1
    let worst = 0
    const push = (strength) => {
      const length = Math.hypot(x, y)
      vx += (strength * x) / length
      vy += (strength * y) / length
    }
    const alongStick = () => (x * vx + y * vy) / Math.hypot(x, y)
    const steps = Math.round(30 / STEP)
    for (let i = 0; i < steps; i++) {
      for (let s = 0; s < substeps; s++) {
        vy += GRAVITY * h
        const error = Math.hypot(x, y) - 1
        if (numbers) {
          push(stored) // warm start
          const soften = -numbers.massScale * (alongStick() + numbers.biasRate * error)
          const change = soften - numbers.impulseScale * stored
          stored += change
          push(change)
        } else {
          push(-(alongStick() + (share / h) * error))
        }
        x += vx * h
        y += vy * h
        if (numbers) {
          const relax = -alongStick()
          stored += relax
          push(relax)
        }
      }
      worst = Math.max(worst, Math.abs(Math.hypot(x, y) - 1))
      if (i >= steps - 2 / STEP) highest = Math.max(highest, y)
    }
    return { height: highest + 1, worst }
  }

  console.log('2. Pendulum of 1 m: share of its height left after 30 s, and the worst stick error')
  const joint = { hertz: 60, ratio: 2 }
  const rows = [
    ['nudge of 5%, 1 step (chapter 014)', { substeps: 1, share: 0.05 }],
    ['nudge of 5%, 4 substeps', { substeps: 4, share: 0.05 }],
    ['nudge of 25%, 4 substeps', { substeps: 4, share: 0.25 }],
    ['soft rule, 1 step', { substeps: 1, soft: joint }],
    ['soft rule, 4 substeps (Soft Step)', { substeps: 4, soft: joint }],
  ]
  for (const [name, options] of rows) {
    const cells = [90, 10].map((angle) => {
      const full = 1 - Math.cos((angle * Math.PI) / 180)
      const result = pendulum({ angle, ...options })
      return `from ${angle} degrees ${round((result.height / full) * 100, 1)}%, ${round(result.worst * 100)} cm`
    })
    console.log(`   ${name}: ${cells.join(' · ')}`)
  }
}

// 3. A chain hanging straight down: 10 links of 10 cm, particles of 1 kg, a weight at the end.
// Everything moves along the vertical only, so a link is one number: how much too long it is.
{
  const LINKS = 10
  const LENGTH = 0.1

  const chain = ({
    weight,
    substeps,
    rounds,
    relax = 0,
    soft,
    share,
    remember = true,
    giveBack = true,
    links = LINKS,
    raw = false,
  }) => {
    const h = STEP / substeps
    const numbers = soft && makeSoft(Math.min(soft.hertz, 0.25 / h), soft.ratio, h)
    if (numbers && !giveBack) numbers.impulseScale = 0
    const y = Array.from({ length: links + 1 }, (_, i) => -i * LENGTH)
    const speed = y.map(() => 0)
    // 1 / mass: 0 for the fixed point at the top.
    const inverse = y.map((_, i) => (i === 0 ? 0 : i === links ? 1 / weight : 1))
    const stored = new Array(links).fill(0)
    const apply = (j, push) => {
      speed[j] += inverse[j] * push
      speed[j + 1] -= inverse[j + 1] * push
    }
    const solve = (correct) => {
      for (let j = 0; j < links; j++) {
        const growing = speed[j] - speed[j + 1]
        const error = y[j] - y[j + 1] - LENGTH
        const k = inverse[j] + inverse[j + 1]
        let push = -growing / k
        if (correct && numbers) {
          const target = growing + numbers.biasRate * error
          push = (-numbers.massScale * target) / k - numbers.impulseScale * stored[j]
        } else if (correct) {
          push = -(growing + (share / h) * error) / k
        }
        stored[j] += push
        apply(j, push)
      }
    }
    let worst = 0
    let stretch = 0
    for (let i = 0; i < Math.round(10 / STEP); i++) {
      for (let s = 0; s < substeps; s++) {
        for (let p = 1; p <= links; p++) speed[p] += GRAVITY * h
        if (remember) for (let j = 0; j < links; j++) apply(j, stored[j])
        else stored.fill(0)
        for (let r = 0; r < rounds; r++) solve(true)
        for (let p = 1; p <= links; p++) y[p] += speed[p] * h
        for (let r = 0; r < relax; r++) solve(false)
      }
      stretch = -y[links] - links * LENGTH
      worst = Math.max(worst, Math.abs(stretch))
      if (!(worst < 1000)) return 'blows up'
    }
    if (raw) return stretch
    return `${round(worst * 100, 1)} cm at worst, ${round(stretch * 100, 1)} cm after 10 s`
  }

  // A soft rule is a spring: at rest each link is too long by force × k / omega².
  const sag = (weight, hertz) => {
    const omega = 2 * Math.PI * hertz
    let total = 0
    for (let j = 0; j < LINKS; j++) {
      const carried = (LINKS - 1 - j + weight) * -GRAVITY // newtons hanging below this link
      const k = (j === 0 ? 0 : 1) + (j === LINKS - 1 ? 1 / weight : 1)
      total += (carried * k) / omega ** 2
    }
    return total
  }

  const joint = { hertz: 60, ratio: 2 }
  const rows = [
    ['2005: 1 step, 8 rounds, nudge of 20%', { substeps: 1, rounds: 8, share: 0.2 }],
    ['the same, forgetting the pushes', { substeps: 1, rounds: 8, share: 0.2, remember: false }],
    ['soft rule, 1 step, 4 rounds + 4 relax', { substeps: 1, rounds: 4, relax: 4, soft: joint }],
    ['Soft Step: 4 substeps, 1 round + 1 relax', { substeps: 4, rounds: 1, relax: 1, soft: joint }],
    [
      'Soft Step without its last term',
      { substeps: 4, rounds: 1, relax: 1, soft: joint, giveBack: false },
    ],
    ['Soft Step: 8 substeps', { substeps: 8, rounds: 1, relax: 1, soft: joint }],
    [
      'Soft Step: 8 substeps, 120 Hz',
      { substeps: 8, rounds: 1, relax: 1, soft: { hertz: 120, ratio: 2 } },
    ],
  ]
  console.log(
    '3. A chain of 1 m with a weight at the end: how much too long, 8 passes over the links per step',
  )
  for (const weight of [1, 100]) {
    console.log(`   carrying ${weight} kg`)
    for (const [name, options] of rows)
      console.log(`     ${name}: ${chain({ weight, ...options })}`)
    console.log(
      `     a spring of 60 Hz would sag by ${round(sag(weight, 60) * 100, 1)} cm, one of 120 Hz by ${round(sag(weight, 120) * 100, 1)} cm`,
    )
  }

  console.log('4. Where the stored nudge blows up, and Soft Step does not')
  for (const weight of [1, 10, 100, 1000]) {
    const old = chain({ weight, ...rows[0][1] })
    const softStep = chain({ weight, ...rows[3][1] })
    console.log(`   ${weight} kg: 2005 with stored pushes ${old} · Soft Step ${softStep}`)
  }

  // One link cannot blow up, so the last term can be switched off to see what else it does.
  console.log('5. One link carrying 100 kg, Soft Step: how much too long after 10 s')
  for (const giveBack of [true, false]) {
    const stretch = chain({ weight: 100, links: 1, raw: true, ...rows[3][1], giveBack })
    console.log(`   ${giveBack ? 'with' : 'without'} its last term: ${round(stretch * 1000, 3)} mm`)
  }
  console.log(
    `   a spring of 60 Hz would sag by ${round((100 * -GRAVITY * 0.01 * 1000) / (2 * Math.PI * 60) ** 2, 3)} mm`,
  )
}
