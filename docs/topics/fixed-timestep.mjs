// The frame table of docs/topics/fixed-timestep.md, recomputed. Run it with: node docs/topics/fixed-timestep.mjs
// Change the frame rate and see how steps, leftover time and the drawn picture behave.

const STEP = 1000 / 60 // ms of simulated time per physics step
const FRAME = 1000 / 50 // ms of real time per rendered frame
const FRAMES = 6 // the first frame only warms up the loop, so the table shows the next five

let accumulator = 0
let simulated = 0 // time of the current physics state
let drawnBefore = 0
let currentBefore = 0

const ms = (value) => `${value.toFixed(1)} ms`
console.log(
  'Frame | steps | left over | alpha | moves without blend | moves with blend | drawn behind real time',
)
for (let frame = 1; frame <= FRAMES; frame++) {
  accumulator += FRAME
  let steps = 0
  // Compare with a tiny tolerance: 50 FPS and 60 steps/s do not add up exactly in floating point.
  while (accumulator >= STEP - 1e-9) {
    simulated += STEP
    accumulator -= STEP
    steps++
  }
  accumulator = Math.max(0, accumulator) // hide rounding noise such as -0.0000001
  const alpha = accumulator / STEP
  const drawn = simulated - STEP + alpha * STEP // blend of the previous and the current state
  const real = frame * FRAME
  const row = [
    frame - 1,
    steps,
    ms(accumulator),
    alpha.toFixed(1),
    ms(simulated - currentBefore),
    ms(drawn - drawnBefore),
    ms(real - drawn),
  ]
  if (frame > 1) console.log(row.join(' | '))
  currentBefore = simulated
  drawnBefore = drawn
}
