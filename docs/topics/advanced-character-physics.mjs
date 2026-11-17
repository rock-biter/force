// The numbers of docs/topics/advanced-character-physics.md, recomputed.
// Run it with: node docs/topics/advanced-character-physics.mjs
// Change the constants and see what projection does to each example.

const GRAVITY = -9.81
const STEP = 1 / 60

const round = (value, digits = 4) => Number(value.toFixed(digits))

// One Verlet step: no velocity is stored, only the position before this one.
const verlet = (x, previous, acceleration, h) => 2 * x - previous + acceleration * h * h

// 1. A floor at y = 0, no gravity: the clamp alone removes the speed into the floor.
{
  console.log('1. Projection on a floor (y before 2, then -3)')
  let previous = 2
  let y = -3
  for (let step = 1; step <= 2; step++) {
    y = Math.max(y, 0)
    console.log(`   step ${step}: clamped to ${y}, speed seen by Verlet ${y - previous} per step`)
    const next = verlet(y, previous, 0, STEP)
    previous = y
    y = next
  }
}

// 2. The stick, as printed on page 6 of our copy and with the signs swapped.
{
  const rest = 1
  const [x1, x2] = [0, 1.2]
  const delta = x2 - x1
  const diff = (Math.abs(delta) - rest) / Math.abs(delta)
  const printed = x2 + delta * 0.5 * diff - (x1 - delta * 0.5 * diff)
  const swapped = x2 - delta * 0.5 * diff - (x1 + delta * 0.5 * diff)
  console.log('2. A stick of 1 m stretched to 1.2 m')
  console.log(
    `   as printed (x1 -=, x2 +=): ${round(printed)} m. Signs swapped: ${round(swapped)} m`,
  )
}

// 3. Relaxation: a stick of 100 in a box from 0 to 1000, in one dimension.
{
  console.log('3. Relaxation: box 0..1000, stick of 100, points at -20 and 60')
  let [x1, x2] = [-20, 60]
  for (let roundNumber = 1; roundNumber <= 4; roundNumber++) {
    x1 = Math.min(Math.max(x1, 0), 1000)
    x2 = Math.min(Math.max(x2, 0), 1000)
    const delta = x2 - x1
    const diff = (Math.abs(delta) - 100) / Math.abs(delta)
    x1 += delta * 0.5 * diff
    x2 -= delta * 0.5 * diff
    console.log(`   round ${roundNumber}: ${round(x1)}, ${round(x2)} (x1 is ${round(-x1)} outside)`)
  }
}

// 4. The stick without a square root (page 9), for a rest length of 1 m.
{
  console.log('4. Square root approximation, stick of 1 m')
  const rest = 1
  for (const length of [1.2, 1.05, 1.01]) {
    const factor = (rest * rest) / (length * length + rest * rest) - 0.5
    const after = length + 2 * length * factor
    console.log(
      `   ${length} m -> ${round(after, 5)} m (off by ${round((rest - after) * 1000, 2)} mm)`,
    )
  }
}

// 5. Verlet and semi-implicit Euler give the same positions.
{
  const compare = (acceleration, start, steps) => {
    let [xe, ve] = [start, 0]
    let [xv, previous] = [start, start]
    let worst = 0
    for (let i = 0; i < steps; i++) {
      ve += acceleration(xe) * STEP
      xe += ve * STEP
      const next = verlet(xv, previous, acceleration(xv), STEP)
      previous = xv
      xv = next
      worst = Math.max(worst, Math.abs(xe - xv))
    }
    return worst
  }
  console.log('5. Verlet against semi-implicit Euler, largest difference in position')
  console.log(
    `   free fall from 5 m, 600 steps: ${compare(() => GRAVITY, 5, 600).toExponential(1)} m`,
  )
  console.log(
    `   spring of 100 N/m, 6000 steps: ${compare((x) => -100 * x, 1, 6000).toExponential(1)} m`,
  )

  let [x, previous] = [1, 1]
  const peaks = []
  for (let i = 0; i < 6000; i++) {
    const next = verlet(x, previous, -100 * x, STEP)
    previous = x
    x = next
    peaks.push(Math.abs(x))
  }
  const first = Math.max(...peaks.slice(0, 1200))
  const last = Math.max(...peaks.slice(4800))
  console.log(
    `   spring, Verlet alone: widest swing ${round(first)} m in the first 20 s, ${round(last)} m in the last 20 s`,
  )
}

// 6. A pendulum of 1 m: Verlet, then one projection onto the stick, at every step.
{
  // startAngle is measured from straight down: 90 degrees is horizontal.
  const climb = (h, from, to, startAngle = 90) => {
    const angle = (startAngle * Math.PI) / 180
    let [x, y] = [Math.sin(angle), -Math.cos(angle)]
    let [px, py] = [x, y]
    let highest = -1
    for (let i = 0; i < Math.round(to / h); i++) {
      const nx = verlet(x, px, 0, h)
      const ny = verlet(y, py, GRAVITY, h)
      const length = Math.hypot(nx, ny)
      px = x
      py = y
      x = nx / length
      y = ny / length
      if (i >= Math.round(from / h)) highest = Math.max(highest, y)
    }
    return highest + 1 // height above the lowest point
  }
  console.log('6. Pendulum of 1 m: how high it climbs back (it should be 1 m forever)')
  for (const stepsPerSecond of [60, 240]) {
    const h = 1 / stepsPerSecond
    const after10 = round(climb(h, 8, 10) * 100, 1)
    const after30 = round(climb(h, 28, 30) * 100, 1)
    console.log(
      `   ${stepsPerSecond} steps per second: ${after10} cm after 10 s, ${after30} cm after 30 s`,
    )
  }
  // The same pendulum let go from 10 degrees: the share it loses is about the same.
  const start = 1 - Math.cos((10 * Math.PI) / 180)
  for (const stepsPerSecond of [60, 240]) {
    const kept = round((climb(1 / stepsPerSecond, 28, 30, 10) / start) * 100, 1)
    console.log(
      `   from 10 degrees, ${stepsPerSecond} steps per second: ${kept}% of its height left after 30 s`,
    )
  }
}
