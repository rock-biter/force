// The numbers of docs/topics/iterative-dynamics-paper.md, recomputed.
// Run it with: node docs/topics/iterative-dynamics-paper.mjs
// Change the constants and see how the velocity rules react.

const GRAVITY = -9.81
const STEP = 1 / 60

const round = (value, digits = 4) => Number(value.toFixed(digits))
const clamp = (value, low, high) => Math.min(Math.max(value, low), high)

// 1. One contact with the floor: the push that stops the ball, kept between 0 and infinity.
{
  console.log('1. A ball of 2 kg on the floor, one step of 1/60 s')
  const mass = 2
  for (const speed of [-5, 3]) {
    const wanted = (-speed * mass) / STEP // the force that brings the vertical speed to zero
    const force = clamp(wanted, 0, Infinity)
    const after = speed + (force * STEP) / mass
    console.log(`   arrives at ${speed} m/s: push ${round(force)} N, leaves at ${round(after)} m/s`)
  }
}

// 2. Two boxes of 1 kg stacked: floor-A, then A-B, one rule at a time. Pushes are in N·s.
{
  const solve = (floorPush, boxPush, rounds) => {
    // Both boxes fall at 1 m/s after gravity; the pushes we start from have already acted.
    let speedA = -1 + floorPush - boxPush
    let speedB = -1 + boxPush
    const lines = []
    for (let i = 1; i <= rounds; i++) {
      let change = clamp(floorPush - speedA, 0, Infinity) - floorPush
      floorPush += change
      speedA += change
      change = clamp(boxPush - (speedB - speedA) / 2, 0, Infinity) - boxPush
      boxPush += change
      speedB += change
      speedA -= change
      lines.push(
        `   round ${i}: floor ${round(floorPush)}, box ${round(boxPush)}, still falling at ${round(-speedA)}`,
      )
    }
    return lines.join('\n')
  }
  console.log('2. Two stacked boxes, starting from no push')
  console.log(solve(0, 0, 4))
  console.log('   starting from the pushes of the step before (2 and 1)')
  console.log(solve(2, 1, 1))
}

// 3. The nudge against overlap: every step removes a fixed share of the error.
{
  console.log('3. An overlap of 1 cm')
  const left = (share, steps) => round((1 - share) ** steps, 4)
  console.log(
    `   share 5%: ${left(0.05, 1)} cm after 1 step, ${left(0.05, 10)} after 10, ${left(0.05, 60)} after 60`,
  )
  console.log(`   share 150%: ${[1, 2, 3, 4].map((steps) => left(1.5, steps)).join(', ')} cm`)
}

// 4. The pendulum of the Jakobsen notes, 1 m long, with both ways to hold the stick.
{
  const start = (angle) => [Math.sin((angle * Math.PI) / 180), -Math.cos((angle * Math.PI) / 180)]

  // Catto: a rule on the velocity along the stick, plus the nudge. One rule, so one round is exact.
  const velocityRule = (share, angle, seconds) => {
    let [x, y] = start(angle)
    let [vx, vy] = [0, 0]
    let highest = -1
    let worst = 0
    const steps = Math.round(seconds / STEP)
    for (let i = 0; i < steps; i++) {
      vy += GRAVITY * STEP
      const error = 0.5 * (x * x + y * y - 1) // equation 8 of the paper, for a length of 1
      const push = -(x * vx + y * vy + (share / STEP) * error) / (x * x + y * y)
      vx += push * x
      vy += push * y
      x += vx * STEP
      y += vy * STEP
      worst = Math.max(worst, Math.abs(Math.hypot(x, y) - 1))
      if (i >= steps - 2 / STEP) highest = Math.max(highest, y)
    }
    return { height: highest + 1, worst }
  }

  // Jakobsen: Verlet, then projection onto the stick.
  const projection = (angle, seconds) => {
    let [x, y] = start(angle)
    let [px, py] = [x, y]
    let highest = -1
    const steps = Math.round(seconds / STEP)
    for (let i = 0; i < steps; i++) {
      const nx = 2 * x - px
      const ny = 2 * y - py + GRAVITY * STEP * STEP
      const length = Math.hypot(nx, ny)
      px = x
      py = y
      x = nx / length
      y = ny / length
      if (i >= steps - 2 / STEP) highest = Math.max(highest, y)
    }
    return highest + 1
  }

  console.log('4. Pendulum of 1 m, 60 steps per second: share of its height left after 30 s')
  for (const angle of [90, 10]) {
    const full = 1 - Math.cos((angle * Math.PI) / 180)
    const percent = (height) => `${round((height / full) * 100, 1)}%`
    const nudged = velocityRule(0.05, angle, 30)
    console.log(`   let go from ${angle} degrees`)
    console.log(`     projection: ${percent(projection(angle, 30))}`)
    console.log(
      `     velocity rule, nudge of 5%: ${percent(nudged.height)}, stick off by up to ${round(nudged.worst * 100, 1)} cm`,
    )
  }
  const loose = velocityRule(0, 90, 30)
  console.log(
    `   velocity rule with no nudge, from 90 degrees: stick off by up to ${round(loose.worst * 100, 1)} cm`,
  )
}
