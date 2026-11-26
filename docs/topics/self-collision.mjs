// How thick is a cloth made of spheres, where it is thinnest? Run with: node docs/topics/self-collision.mjs
//
// Our cloth is a square net of spheres of radius r, one diameter apart at rest. Another sphere of
// the same radius comes straight down on the middle of a square of four. It first touches the four
// when its center is `gate` above the plane of the cloth. Below that height the four push it back,
// but once its center is through the plane they push it out of the other side: the gate is all the
// cloth there is to stop it.
//
// Geometry only: nothing is simulated here.

const r = 0.1 // meters, the radius of every particle on our pages
const d = 2 * r

/** Height of first touch above the middle of a cell `a` by `b` meters, or 0 if it passes untouched. */
const gate = (a, b) => Math.sqrt(Math.max(d * d - (a * a + b * b) / 4, 0))

const pct = (x) => `${Math.round(x * 100)}%`.padStart(5)
const radii = (x) => `${(x / r).toFixed(2)} r`.padStart(7)

console.log('1. The gate at the middle of a cell, as the cloth stretches\n')
console.log('stretch | both ways | one way only')
for (const stretch of [0, 0.03, 0.12, 0.2, 0.3, 0.41, 0.5, 0.73]) {
  const s = d * (1 + stretch)
  console.log(`${pct(stretch)}   |  ${radii(gate(s, s))}  |  ${radii(gate(s, d))}`)
}
console.log(
  '\nOver a particle of the cloth the gate is 2 r: the middle of a cell at rest is 1.41 r.',
)
console.log(
  `A cell stretched both ways lets a particle through untouched from ${((Math.SQRT2 - 1) * 100).toFixed(1)}%,`,
)
console.log(`stretched one way only from ${pct(Math.sqrt(3) - 1)}.`)

console.log('\n2. How far two particles come closer in one substep, at the speed limit\n')
console.log(
  'The limit of decision 027 is one radius per substep for each particle, so two that meet',
)
console.log('head on close 2 r in a substep, whatever the number of substeps:\n')
console.log('where it hits     | gate   | closed in a substep | more than the gate?')
for (const [name, g] of [
  ['over a particle  ', d],
  ['middle of a cell ', gate(d, d)],
  ['same, 12% longer ', gate(d * 1.12, d * 1.12)],
]) {
  console.log(`${name} | ${radii(g)} | ${radii(2 * r)}            | ${2 * r > g ? 'yes' : 'no'}`)
}
console.log('\nAgainst a cloth that does not move the particle closes 1 r, and the gate holds.')

console.log('\n3. How much of a push is across the cloth\n')
console.log(
  'A push goes along the line between two centers. At the middle of a cell at rest, with the',
)
console.log('falling particle h above the plane, the part of each push that is across the cloth is')
console.log('h / distance; the part along it spreads the four apart, against the springs:\n')
console.log('h      | overlap | across | along')
for (const h of [1.4, 1.0, 0.5, 0.2, 0]) {
  const dist = Math.sqrt((d * d) / 2 + (h * r) ** 2)
  const along = Math.sqrt(1 - ((h * r) / dist) ** 2)
  console.log(`${h.toFixed(1)} r  | ${radii(d - dist)} | ${pct((h * r) / dist)}  | ${pct(along)}`)
}

console.log('\n4. Fatter spheres: a contact distance c larger than the spacing\n')
console.log(
  'Two particles push each other when their centers are closer than c. At rest our neighbours',
)
console.log(
  'are one diameter apart and c is one diameter. Engines that make c larger must skip the pairs',
)
console.log(
  'that are closer than c at rest, or the cloth pushes itself apart (a rest-pose filter).\n',
)
console.log('c / spacing | gate at rest | gate / c | open from | skipped at rest')
for (const [k, who] of [
  [1, 'ours, most FleX demos'],
  [1.3, 'NvCloth sample, self'],
  [2, 'PhysX sample, NvCloth between cloths'],
]) {
  const c = k * d
  const g = Math.sqrt(c * c - (d * d) / 2)
  const open = (c * Math.SQRT2) / d - 1
  // neighbours of a particle on the grid closer than c at rest, counted up to two places away
  let skipped = 0
  for (let i = -2; i <= 2; i++)
    for (let j = -2; j <= 2; j++) if ((i || j) && Math.hypot(i, j) * d < c - 1e-9) skipped++
  console.log(
    `${k.toFixed(1).padStart(11)} | ${radii(g).padStart(12)} | ${pct(g / c).padStart(8)} | ${pct(open).padStart(9)} | ${String(skipped).padStart(15)}   ${who}`,
  )
}

console.log('\n5. A side that is kept: each contact holds the plane it had at the start\n')
console.log(
  'A particle comes straight down on the middle of a cell, starting 2 r above it. A contact',
)
console.log('with each of the four takes the direction between the two centers at the start of the')
console.log(
  'substep, and keeps it: the particle must stay 2 r away from that corner along it. How low',
)
console.log('can the four let it go, and how far away must a contact be made for this to work?\n')
console.log('stretch | lowest center | distance to the corners at the start')
const h0 = 2 * r
for (const stretch of [0, 0.12, 0.3, 0.41, 1]) {
  const a = (d * (1 + stretch)) / 2 // half the spacing
  const far = Math.sqrt(2 * a * a + h0 * h0)
  const lowest = (d * far - 2 * a * a) / h0
  console.log(`${pct(stretch)}   | ${radii(lowest).padStart(13)} | ${radii(far)}`)
}
console.log(
  '\nBelow 0 the center is under the plane of the cloth, but stopped. Today a contact is made',
)
console.log(
  'only when two spheres already overlap, closer than 2 r: none of these four would be made.',
)
