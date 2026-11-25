// The numbers of docs/topics/spring.md: a weight on a spring, simulated in steps so small that the
// way of stepping does not matter, to check the formulas of the page against what really happens.
// Run it with: node docs/topics/spring.mjs
//
// One weight of mass m, in kg, on a spring of stiffness k, in newtons per meter, and a damper c, in
// newtons per meter per second. x is how far the spring is from its rest length, in meters:
//   force = -k × x - c × speed

const STEP = 1e-5 // seconds

/** Lets go of the weight at `start` meters, at rest, and returns where it is at every step. */
function run(k, m, c, start, seconds) {
  let x = start
  let v = 0
  const path = [x]
  for (let t = 0; t < seconds; t += STEP) {
    v += ((-k * x - c * v) / m) * STEP
    x += v * STEP
    path.push(x)
  }
  return path
}

/** How many times a second the weight goes back and forth, counted where it passes rest going down. */
function frequency(path) {
  const crossings = []
  for (let i = 1; i < path.length; i++)
    if (path[i - 1] > 0 && path[i] <= 0) crossings.push(i * STEP)
  return (crossings.length - 1) / (crossings[crossings.length - 1] - crossings[0])
}

const hertz = (k, m) => Math.sqrt(k / m) / (2 * Math.PI)

console.log('Part 1. No damper: how many times a second, counted and from √(k / m) / 2π.')
for (const [k, m, start] of [
  [100, 1, 0.01],
  [100, 1, 0.1],
  [100, 4, 0.01],
  [400, 1, 0.01],
]) {
  const counted = frequency(run(k, m, 0, start, 20))
  console.log(
    `  k ${String(k).padStart(3)} N/m, ${m} kg, let go at ${String(start * 100).padStart(2)} cm: ` +
      `${counted.toFixed(3)} Hz counted, ${hertz(k, m).toFixed(3)} Hz from the formula`,
  )
}

console.log('\nPart 2. k 100 N/m, 1 kg, let go at 10 cm, with a damper c = 2 × ζ × √(k × m).')
console.log('How far it swings past rest the first time, and when it stays within 1 mm for good.')
for (const zeta of [0, 0.1, 0.3, 0.7, 1, 3]) {
  const k = 100
  const m = 1
  const c = 2 * zeta * Math.sqrt(k * m)
  const path = run(k, m, c, 0.1, 30)
  let past = 0
  for (const x of path) past = Math.max(past, -x)
  let last = path.length - 1
  while (last > 0 && Math.abs(path[last]) < 0.001) last--
  const settled = last === path.length - 1 ? 'never' : `${(last * STEP).toFixed(2)} s`
  // each swing against the one before, on the same side
  const peaks = []
  for (let i = 1; i < path.length - 1; i++)
    if (path[i] > path[i - 1] && path[i] >= path[i + 1] && path[i] > 1e-6) peaks.push(path[i])
  const ratio = peaks.length ? (peaks[0] / 0.1).toFixed(2) : '—'
  console.log(
    `  ζ ${String(zeta).padStart(3)}, c ${c.toFixed(0).padStart(2)}: ${(past * 100).toFixed(1).padStart(4)} cm past rest, ` +
      `next swing ${ratio.padStart(4)} of the one before, within 1 mm after ${settled}`,
  )
}
