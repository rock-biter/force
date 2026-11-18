// How long JavaScript takes to sort the contacts of a step into turns, timed.
// A contact is a rule between two bodies. Two contacts that share a body cannot run at the same
// instant on the GPU, so they are sorted into turns: in a turn no body appears twice. The sorting
// is done on the CPU, at every step. No GPU here: this page times the CPU alone.

const RUNS = 5
/** A turn is one bit in a 32-bit number. The last one is kept for what does not fit. */
const TURNS = 31
const LEFT_OUT = TURNS

interface Scene {
  /** Two body ids for each contact, side by side. */
  pairs: Uint32Array
  /** Bodies from this id up never move, like the ground: nothing writes them, so they block nobody. */
  fixedFrom: number
  bodies: number
}

/** What the sorting keeps from one step to the next. */
interface Sorting {
  /** For each body, the turns it is busy in: one bit each. */
  busy: Uint32Array
  /** For each contact, its turn. */
  turn: Uint8Array
}

/** The first turn where neither body is busy, as Box2D does: both are then marked busy in it. */
function give(scene: Scene, sorting: Sorting, contact: number): void {
  const a = scene.pairs[contact * 2]
  const b = scene.pairs[contact * 2 + 1]
  const moves = (body: number) => body < scene.fixedFrom
  const taken = (moves(a) ? sorting.busy[a] : 0) | (moves(b) ? sorting.busy[b] : 0)
  // The lowest bit that is still 0. With all 31 taken it is the last bit: left out of the turns.
  const free = ~taken & (taken + 1)
  const turn = 31 - Math.clz32(free)
  sorting.turn[contact] = turn
  if (turn < TURNS) {
    if (moves(a)) sorting.busy[a] |= free
    if (moves(b)) sorting.busy[b] |= free
  }
}

/** A contact ended: its two bodies are free again in its turn. */
function take(scene: Scene, sorting: Sorting, contact: number): void {
  const turn = sorting.turn[contact]
  if (turn === LEFT_OUT) {
    return
  }
  const bit = 1 << turn
  const a = scene.pairs[contact * 2]
  const b = scene.pairs[contact * 2 + 1]
  if (a < scene.fixedFrom) sorting.busy[a] &= ~bit
  if (b < scene.fixedFrom) sorting.busy[b] &= ~bit
}

function fromScratch(scene: Scene, sorting: Sorting): void {
  sorting.busy.fill(0)
  const count = scene.pairs.length / 2
  for (let contact = 0; contact < count; contact++) {
    give(scene, sorting, contact)
  }
}

/** The list the GPU needs: the contacts turn by turn, and where each turn starts. */
function group(sorting: Sorting, order: Uint32Array, starts: Uint32Array): void {
  const count = sorting.turn.length
  starts.fill(0)
  for (let contact = 0; contact < count; contact++) {
    starts[sorting.turn[contact] + 1]++
  }
  for (let turn = 0; turn < 32; turn++) {
    starts[turn + 1] += starts[turn]
  }
  const next = starts.slice(0, 32)
  for (let contact = 0; contact < count; contact++) {
    order[next[sorting.turn[contact]]++] = contact
  }
}

/** Boxes stacked in a block: each touches the next along x, y and z, the bottom ones the ground. */
function pile(contacts: number): Scene {
  const side = Math.max(2, Math.round(Math.cbrt(contacts / 3)))
  const bodies = side * side * side
  const ground = bodies
  const list: number[] = []
  const id = (x: number, y: number, z: number) => x + side * (z + side * y)
  for (let y = 0; y < side; y++) {
    for (let z = 0; z < side; z++) {
      for (let x = 0; x < side; x++) {
        if (y === 0) list.push(id(x, y, z), ground)
        if (x + 1 < side) list.push(id(x, y, z), id(x + 1, y, z))
        if (y + 1 < side) list.push(id(x, y, z), id(x, y + 1, z))
        if (z + 1 < side) list.push(id(x, y, z), id(x, y, z + 1))
      }
    }
  }
  return { pairs: shuffled(list), fixedFrom: ground, bodies: bodies + 1 }
}

/** One wide box that moves, with small ones on it: every contact writes the wide box. */
function tray(contacts: number): Scene {
  const list: number[] = []
  for (let small = 1; small <= contacts; small++) {
    list.push(0, small)
  }
  return { pairs: shuffled(list), fixedFrom: contacts + 1, bodies: contacts + 1 }
}

/** The GPU finds contacts in no order we can count on: mix them, always in the same way. */
function shuffled(list: number[]): Uint32Array {
  const pairs = new Uint32Array(list)
  let seed = 12345
  for (let i = pairs.length / 2 - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = seed % (i + 1)
    for (const k of [0, 1]) {
      const kept = pairs[i * 2 + k]
      pairs[i * 2 + k] = pairs[j * 2 + k]
      pairs[j * 2 + k] = kept
    }
  }
  return pairs
}

function empty(scene: Scene): Sorting {
  return { busy: new Uint32Array(scene.bodies), turn: new Uint8Array(scene.pairs.length / 2) }
}

/** How many turns are in use, how many contacts are left out, and whether a body is twice in a turn. */
function check(scene: Scene, sorting: Sorting) {
  const count = scene.pairs.length / 2
  const seen = new Set<number>()
  let turns = 0
  let leftOut = 0
  let right = true
  for (let contact = 0; contact < count; contact++) {
    const turn = sorting.turn[contact]
    if (turn === LEFT_OUT) {
      leftOut++
      continue
    }
    turns = Math.max(turns, turn + 1)
    for (const k of [0, 1]) {
      const body = scene.pairs[contact * 2 + k]
      if (body >= scene.fixedFrom) continue
      const key = body * 32 + turn
      right &&= !seen.has(key)
      seen.add(key)
    }
  }
  return { turns, leftOut, right }
}

/**
 * Milliseconds for one call. The clock of a page is coarse, a whole millisecond on some phones, so
 * the call is repeated until the stopwatch has run for a while, and the time is shared out.
 */
function time(call: () => void): number {
  const rounds: number[] = []
  call() // one run that does not count
  for (let i = 0; i < RUNS; i++) {
    let repeats = 0
    const start = performance.now()
    let elapsed = 0
    while (elapsed < 40) {
      call()
      repeats++
      elapsed = performance.now() - start
    }
    rounds.push(elapsed / repeats)
  }
  return rounds.sort((a, b) => a - b)[Math.floor(RUNS / 2)]
}

function run(): string {
  const lines = [
    'Sorting contacts into turns, in JavaScript. Milliseconds for one step.',
    'A frame at 60 per second lasts 16.7.',
    '',
    '1. A pile of boxes: each touches up to six others, and the bottom ones the ground',
    '',
    '      contacts   turns   all, from scratch   the 5% that changed   grouping by turn',
  ]
  let allRight = true

  for (const wanted of [1000, 10_000, 100_000, 1_000_000]) {
    const scene = pile(wanted)
    const count = scene.pairs.length / 2
    const sorting = empty(scene)
    const order = new Uint32Array(count)
    const starts = new Uint32Array(33)

    const scratch = time(() => fromScratch(scene, sorting))
    const found = check(scene, sorting)
    allRight &&= found.right && found.leftOut === 0

    // One contact in twenty ends and begins again: the others keep their turn.
    const changed = time(() => {
      for (let contact = 0; contact < count; contact += 20) take(scene, sorting, contact)
      for (let contact = 0; contact < count; contact += 20) give(scene, sorting, contact)
    })
    allRight &&= check(scene, sorting).right

    const grouping = time(() => group(sorting, order, starts))
    allRight &&= starts[32] === count

    lines.push(
      count.toLocaleString('en').padStart(14) +
        String(found.turns).padStart(8) +
        scratch.toFixed(3).padStart(20) +
        changed.toFixed(3).padStart(22) +
        grouping.toFixed(3).padStart(19),
    )
  }

  lines.push('', '2. A tray: one wide box that moves, with small boxes on it', '')
  lines.push('   small boxes   turns   left out of the turns')
  for (const small of [8, 31, 100, 1000]) {
    const scene = tray(small)
    const sorting = empty(scene)
    fromScratch(scene, sorting)
    const found = check(scene, sorting)
    allRight &&= found.right
    lines.push(
      String(small).padStart(14) +
        String(found.turns).padStart(8) +
        String(found.leftOut).padStart(24),
    )
  }

  lines.push(
    '',
    allRight ? 'Checked: no body is twice in a turn.' : 'WRONG: a body is twice in a turn.',
  )
  return lines.join('\n')
}

const output = document.querySelector('#output')
if (output) {
  // Let the page show "Measuring…" before the CPU gets busy.
  setTimeout(() => {
    try {
      output.textContent = run()
    } catch (error) {
      output.textContent = `FAILED: ${error}`
    }
  }, 50)
}
