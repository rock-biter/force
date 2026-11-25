// FORCE+ on the GPU, live. Up to a million particles in a box that grows with them, pushed apart by
// moving their positions with half and half, masses seen as m^α and levels in the pile (decision
// 015). Who touches whom is found at every round in the cells around each particle, kept in an
// address book on a grid or in a hashed table (decisions 024 and 034), with the particles in the
// order of the book (decision 033). A menu switches to FORCE, the same rule with the real masses
// and no levels (chapter 026), as in the compare page. The pointer pushes them away with a ball.
// three.js draws the particles straight from the position buffer, on the same device (decision
// 012).
//
// The benchmark page times the shaders with lists of neighbours, book-list.wgsl and
// round-push.wgsl: they stay in this folder for it, and this page no longer runs them.

import type { ButtonGridApi, FpsGraphBladeApi } from '@tweakpane/plugin-essentials'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  abs,
  Fn,
  float,
  fract,
  fwidth,
  min,
  mix,
  positionLocal,
  saturate,
  uniform,
} from 'three/tsl'
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Euler,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  type Quaternion,
  Raycaster,
  Scene,
  SphereGeometry,
  TOUCH,
  Vector2,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu'
import { Pane } from 'tweakpane'
import clearIfCode from '../contact-cost/clear-if.wgsl?raw'
import commonCode from '../contact-cost/common.wgsl?raw'
import predictCode from '../contact-cost/predict.wgsl?raw'
import rebuildCode from '../contact-cost/rebuild.wgsl?raw'
import { ClothView } from '../debug/cloth.js'
import { ParticleView, SUN } from '../debug/particles.js'
import { CASTERS, ShadowStage, SURFACES } from '../debug/shadows.js'
import { showError } from '../debug/viewer.js'
import levelsCellsSizedCode from '../mixed-sizes/levels-cells-sized.wgsl?raw'
import propertiesMoveCode from '../mixed-sizes/properties-move.wgsl?raw'
import propertiesSettleCode from '../mixed-sizes/properties-settle.wgsl?raw'
import roundCellsSizedCode from '../mixed-sizes/round-cells-sized.wgsl?raw'
import registerCode from '../ropes/register.wgsl?raw'
import springsCode from '../ropes/springs.wgsl?raw'
import bookBlocksCode from './book-blocks.wgsl?raw'
import bookCountCode from './book-count.wgsl?raw'
import bookEndsCode from './book-ends.wgsl?raw'
import bookFillCode from './book-fill.wgsl?raw'
import bookMoveCode from './book-move.wgsl?raw'
import bookScanCode from './book-scan.wgsl?raw'
import bookSettleCode from './book-settle.wgsl?raw'
import cellsGridCode from './cells-grid.wgsl?raw'
import cellsTableCode from './cells-table.wgsl?raw'
import finishLimitCode from './finish-limit.wgsl?raw'
import levelsCellsCode from './levels-cells.wgsl?raw'
import roundCellsCode from './round-cells.wgsl?raw'

type Vec3 = [number, number, number]

const RADIUS = 0.1 // meters, as in every scene since chapter 025
const DIAMETER = 2 * RADIUS
const CELL = DIAMETER // a cell as wide as a particle (chapter 024)
const STEP = 1 / 60 // seconds
const GRAVITY = 9.81
// decision 029. ?rounds=6 in the address, to measure: this many rounds per substep, from 1 to 12.
const ROUNDS =
  Math.min(
    Math.max(Math.round(Number(new URLSearchParams(location.search).get('rounds'))), 0),
    12,
  ) || 3
const MARGIN = 0.05 // a cell is 5 cm wider than a particle (decision 034)
const NO_LEVEL = 0xffffffff
const BLOCK = 512 // cells per block of the prefix sum, as in book-blocks.wgsl
const HALF = 12 // the box is 24 m by 24 m on the floor, wider when the particles need it (halfFor)...
const HEIGHT = 9 // ...and 9 m tall: 120 by 45 by 120 cells of 20 cm
const ROOM = 1.25 // the floor is at least this many times as wide as the block the particles start in
const MAX_PARTICLES = 1000000
// What a page asks for on its <body>, in place of the numbers above: data-half="4" for a smaller
// box, data-max-particles="50000" for a shorter slider.
// ?half=2 in the address, to measure: half the side of the floor, in meters.
const SMALLEST_HALF =
  Number(new URLSearchParams(location.search).get('half')) ||
  Number(document.body.dataset.half) ||
  HALF
const MOST_PARTICLES = Number(document.body.dataset.maxParticles) || MAX_PARTICLES
// data-sizes="2" on a page's <body>: particles of different sizes, the largest this many times as
// wide as the smallest at the start. 0, on the other pages: one size for all, and shaders that
// know nothing of sizes. The largest keeps the radius of the other pages, RADIUS.
const SIZES = Number(document.body.dataset.sizes) || 0
const MIXED = SIZES > 0
// The particles are kept in the order of the address book (chapter 041, decision 033), unless
// ?sorted=off in the address. With sizes, always: see ../mixed-sizes/round-cells-sized.wgsl.
const TWO = MIXED && new URLSearchParams(location.search).has('two')
// data-springs on a page's <body>, with data-sizes: the particles are joined by springs (decisions
// 036 and 037). "ropes": into ropes of ROPE particles, each held by its first particle. "cloth":
// into one cloth twice as wide as it is tall, held by its top row.
const SPRINGS = MIXED ? document.body.dataset.springs : undefined
const ROPES = SPRINGS === 'ropes'
const CLOTH = SPRINGS === 'cloth'
const ROPE = 30 // particles in a rope: 5.8 m
// The most groups of springs that share no particle: 2 along a rope, 8 in a cloth with diagonals.
const MAX_SPRING_GROUPS = 8
const SPRING_ROUNDS = 3 // passes over the springs in a substep, at the start: the panel changes it
const MAX_SPRING_ROUNDS = 10
const IN_ORDER = new URLSearchParams(location.search).get('sorted') !== 'off' || MIXED
const MAX_SIZES = 4 // the largest radius over the smallest, at most (decision 035)
const MAX_TILT = 30 // degrees, around X and around Z, on the page that tilts the box
const TILT_SPEED = 20 // degrees per second: the floor's far corner, 17 m away, then moves 9.9 cm per step, just under a radius. A wider box turns slower, to keep that
const GAP = 0.01 // between particles at the start, in meters
const LAYERS = 28 // at most, at the start: about 5.9 m, well inside the grid's 9 m
const BALL_RADIUS = 2 // meters, at the start: the panel changes it
// data-ball-height="4" on a page's <body>: the ball's center is that many meters above the floor,
// and the whole ball is drawn. 0, on the other pages: its center is on the floor.
const BALL_HEIGHT = Number(document.body.dataset.ballHeight) || 0
const BALL_FOLLOW = 0.2 // the share of the way to the pointer the ball covers at each step
const BALL_SPEED = 30 // m/s: the fastest the ball moves, however far the pointer jumps
const BALL_GROWTH = 8 // m/s: how fast its radius grows or shrinks
const BALL_MARGIN = 8 // meters: how far beyond the walls the ball may go, more than its widest radius
const MAX_STEPS_PER_FRAME = 2
const MAX_SUBSTEPS = 8
const SAMPLE_EVERY = 30 // frames between two readings of the GPU's numbers
const FORCE_PLUS = { alpha: 0.5, levels: 1.5, substeps: 2 } // decisions 015, 028 and 029
// The choices of the masses menu: the lightest and the heaviest, in kg. Only their ratio changes
// what the solver does: gravity pulls every mass alike, and a contact shares by w_i / (w_i + w_j).
const MASSES: Record<string, readonly [number, number]> = {
  '1 kg': [1, 1],
  '1 to 10 kg': [1, 10],
  '1 to 100 kg': [1, 100],
}

// The floor and four walls, as in contact-cost: the normal in xyz, the offset in w. `half` is half
// the side of the floor, in meters.
const planesOf = (half: number) => [
  [0, 1, 0, 0],
  [1, 0, 0, -half],
  [-1, 0, 0, -half],
  [0, 0, 1, -half],
  [0, 0, -1, -half],
]

/** How many particles on a side of the block they start in: see `cube`. */
const blockSide = (count: number) =>
  Math.max(Math.ceil(Math.cbrt(count)), Math.ceil(Math.sqrt(count / LAYERS)))

/**
 * Half the side of the floor for this many particles, in meters, never less than the page asks
 * (SMALLEST_HALF). With the usual 12 m, the box stays the same up to about 230 000: beyond,
 * the block they start in would not leave room around it, 364 000 would not fit at all, and the
 * box grows to stay ROOM times as wide as the block. A million start 39.7 m wide, in a box of 50 m.
 */
const halfFor = (count: number) =>
  TWO
    ? SMALLEST_HALF // the mix of two sizes starts as a column: see twoSizes
    : ROPES
      ? Math.max(SMALLEST_HALF, Math.ceil((ropeSide(count) * ROPE_GAP) / 2 + 4))
      : CLOTH
        ? Math.max(SMALLEST_HALF, Math.ceil((clothColumns(count) * DIAMETER) / 2 + 2))
        : Math.max(SMALLEST_HALF, Math.ceil(((blockSide(count) * (DIAMETER + GAP)) / 2) * ROOM))

/** Repeats the same numbers at every run, so every restart starts from the same cube. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A cube of particles in the middle of the box, 1 cm apart, each moved by up to 5 mm so that the
 * columns do not stand balanced on each other. Beyond LAYERS layers, 21 952 particles, the block
 * grows wider instead of taller. Masses between the two of `masses`, even on a log
 * scale: from 1 to 100 kg, as many between 1 and 10 kg as between 10 and 100. x, y, z and 1 / mass
 * for each particle.
 */
function cube(count: number, masses: readonly [number, number]): Float32Array {
  const [lightest, heaviest] = masses
  const side = blockSide(count)
  const spacing = DIAMETER + GAP
  const corner = (-(side - 1) * spacing) / 2
  const next = random(1)
  const jitter = () => (next() - 0.5) * 0.01
  const data = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const x = i % side
    const z = Math.floor(i / side) % side
    const y = Math.floor(i / (side * side))
    data.set(
      [
        corner + x * spacing + jitter(),
        RADIUS + GAP + y * spacing + jitter(),
        corner + z * spacing + jitter(),
        1 / (lightest * (heaviest / lightest) ** next()),
      ],
      i * 4,
    )
  }
  return data
}

/**
 * A radius for each particle, in meters: any between the largest, RADIUS, and RADIUS / ratio, all
 * as likely. The same at every run.
 */
function radiiOf(count: number, ratio: number): Float32Array {
  const next = random(2)
  return Float32Array.from({ length: count }, () => RADIUS / (1 + (ratio - 1) * next()))
}

/** A spring: the names of its two ends, its group, and its rest length in meters. */
type Link = [a: number, b: number, group: number, rest: number]
const ROPE_GAP = 0.5 // meters between two ropes
const ROPE_TOP = 8 // meters: the height the ropes hang from
/** How many ropes on a side of the square they hang in. */
const ropeSide = (count: number) => Math.ceil(Math.sqrt(Math.ceil(count / ROPE)))
/**
 * Ropes of ROPE particles, one diameter apart, hanging from a square of points ROPE_TOP high. They
 * start straight and leaning 30 degrees, so that they swing when let go. Where each particle
 * starts, which ones are held, the first of each rope, and the springs: the names of the two ends
 * and the group, 0 or 1. Along a rope the links alternate, so no two of a group share a particle.
 */
function ropes(count: number) {
  const side = ropeSide(count)
  const at = new Float32Array(count * 3)
  const held: number[] = []
  const links: Link[] = []
  const lean = [Math.sin(Math.PI / 6) * DIAMETER, -Math.cos(Math.PI / 6) * DIAMETER]
  for (let i = 0; i < count; i++) {
    const rope = Math.floor(i / ROPE)
    const along = i % ROPE
    at.set(
      [
        ((rope % side) - (side - 1) / 2) * ROPE_GAP + along * lean[0],
        ROPE_TOP + along * lean[1],
        (Math.floor(rope / side) - (side - 1) / 2) * ROPE_GAP,
      ],
      i * 3,
    )
    if (along === 0) held.push(i)
    else links.push([i - 1, i, along % 2, DIAMETER])
  }
  return { at, held, links }
}

/**
 * A cloth is twice as wide as it is tall, whatever its size: with r rows it has 2 r columns. How
 * many rows the largest such cloth of at most `count` particles has.
 */
const clothRows = (count: number) => Math.max(Math.floor(Math.sqrt(count / 2)), 1)
/** How high a cloth hangs from, in meters: its bottom edge 1.5 m above the floor, where the ball reaches it. */
const clothTop = (count: number) => 1.5 + clothRows(count) * DIAMETER
/** How tall the box is for this many particles, in meters: taller than HEIGHT only for a large cloth. */
const heightFor = (count: number) =>
  CLOTH ? Math.max(HEIGHT, Math.ceil(clothTop(count) + 1)) : HEIGHT
const clothColumns = (count: number) => 2 * clothRows(count)
/** How many particles that cloth has: a little fewer than asked, so that its last row is whole. */
const clothFit = (count: number) => clothRows(count) * clothColumns(count)
/**
 * A cloth of `count` particles, as clothFit gives, twice as wide as tall, one diameter between
 * neighbours, hanging by its top row, which is held. It starts flat
 * and leaning 20 degrees, so that it swings when let go. Each particle is joined to its
 * neighbours along the two sides and, with `diagonals`, along the two diagonals, which keep its
 * squares from leaning into diamonds (shear). The groups: links along a row that start at an
 * even column, at an odd one, the same down the columns, and the same for each diagonal. No two
 * of a group share a particle, so a group can run in one dispatch.
 */
function cloth(count: number, diagonals: boolean) {
  const columns = clothColumns(count)
  const at = new Float32Array(count * 3)
  const held: number[] = []
  const links: Link[] = []
  const lean = [-Math.cos(Math.PI / 9) * DIAMETER, Math.sin(Math.PI / 9) * DIAMETER]
  const top = clothTop(count)
  const name = (a: number, b: number) => a + b * columns
  for (let i = 0; i < count; i++) {
    const a = i % columns
    const b = Math.floor(i / columns)
    at.set([(a - (columns - 1) / 2) * DIAMETER, top + b * lean[0], b * lean[1]], i * 3)
    if (b === 0) held.push(i)
    const right = a + 1 < columns && i + 1 < count
    const below = name(a, b + 1) < count
    if (right) links.push([i, i + 1, a % 2, DIAMETER])
    if (below) links.push([i, name(a, b + 1), 2 + (b % 2), DIAMETER])
    if (!diagonals) continue
    if (right && name(a + 1, b + 1) < count)
      links.push([i, name(a + 1, b + 1), 4 + (a % 2), DIAMETER * Math.SQRT2])
    if (right && below) links.push([i + 1, name(a, b + 1), 6 + (a % 2), DIAMETER * Math.SQRT2])
  }
  return { at, held, links }
}

/**
 * ?two in the address, to measure: only the largest and the smallest size, about half of the
 * volume each, the hardest mix, where every large sphere sits on small ones. The particles start as
 * a column of places as wide as a large sphere, 80% of the floor wide: each place holds one large
 * sphere or a block of k × k × k small ones, as many as fit. Where each particle starts, and its
 * radius.
 */
function twoSizes(count: number, ratio: number, half: number) {
  const next = random(2)
  const place = DIAMETER + GAP
  const side = Math.max(Math.floor((1.6 * half) / place), 1)
  const k = Math.floor(ratio + 1e-9)
  const pitch = DIAMETER / k
  const at = new Float32Array(count * 3)
  const radii = new Float32Array(count)
  let n = 0
  for (let slot = 0; n < count; slot++) {
    const corner = [
      ((slot % side) - side / 2) * place,
      GAP + Math.floor(slot / (side * side)) * place,
      ((Math.floor(slot / side) % side) - side / 2) * place,
    ]
    const jitter = () => (next() - 0.5) * 0.002
    if (next() < 0.5) {
      at.set(
        corner.map((c) => c + RADIUS + jitter()),
        n * 3,
      )
      radii[n++] = RADIUS
      continue
    }
    for (let i = 0; i < k ** 3 && n < count; i++) {
      const cell = [i % k, Math.floor(i / (k * k)), Math.floor(i / k) % k]
      at.set(
        cell.map((m, axis) => corner[axis] + (m + 0.5) * pitch + jitter()),
        n * 3,
      )
      radii[n++] = RADIUS / ratio
    }
  }
  return { at, radii }
}

// ?hash= in the address, to measure: the hash of cells-table.wgsl, which keeps the cells of a row
// along x together, is replaced by another. ?hash=scattered: the one of Teschner and others, which
// scrambles all three coordinates (chapter 039).
// ?hash=zorder: the slot is the cell's number along the Z-order curve, which weaves the bits of
// x, y and z, so cells close in space along all three axes get slots close in memory. With slots
// that are a power of two, a cube of cells keeps that order and repeats through space.
// ?hash=blocks: the same curve inside blocks of 8 × 8 × 8 cells, and the blocks scattered.
const HASH = '(((u.y * 19349663u) ^ (u.z * 83492791u)) + u.x) % slots'
const SPREAD = `
// The low 10 bits of n, with two empty bits after each one.
fn spread(n: u32) -> u32 {
  var x = n & 0x3ffu;
  x = (x | (x << 16u)) & 0x030000ffu;
  x = (x | (x << 8u)) & 0x0300f00fu;
  x = (x | (x << 4u)) & 0x030c30c3u;
  x = (x | (x << 2u)) & 0x09249249u;
  return x;
}
fn zorder(u: vec3u) -> u32 {
  return spread(u.x) | (spread(u.y) << 1u) | (spread(u.z) << 2u);
}
`
const HASHES: Record<string, string> = {
  scattered: '((u.x * 73856093u) ^ (u.y * 19349663u) ^ (u.z * 83492791u)) % slots',
  zorder: 'zorder(u) % slots',
  blocks:
    '((((u.x >> 3u) * 73856093u) ^ ((u.y >> 3u) * 19349663u) ^ ((u.z >> 3u) * 83492791u)) * 512u + zorder(u & vec3u(7u))) % slots',
}

// When the particles are kept in the order of the book, row s of a cell is particle s: a shader
// that reads the cells needs no book.
const listInOrder = (code: string) =>
  code
    .replace(/@group\(0\) @binding\(\d+\) var<storage, read> book: array<u32>;/, '')
    .replace('let j = book[first + s];', 'let j = first + s;')

// A radius for each particle (decisions 031 and 032). The shaders of this folder are written for
// one radius. A page with sizes has its own copies of the two that need it, in ../mixed-sizes:
// the levels and the rounds. They read `properties`, four numbers per particle, the radius first.
/** The compute pipelines, made once: every restart uses them again. */
async function makePipelines(device: GPUDevice, hash: string) {
  // The table, with the hash ?hash= asks for.
  const tableCode = HASHES[hash]
    ? SPREAD + cellsTableCode.replace(HASH, HASHES[hash])
    : cellsTableCode
  const make = (code: string) =>
    device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: commonCode + code }) },
    })
  const [predict, clearIf, finish, ...book] = await Promise.all(
    [
      predictCode,
      rebuildCode + clearIfCode,
      finishLimitCode,
      // the address book: the particles sorted by cell
      rebuildCode + bookBlocksCode,
      rebuildCode + bookScanCode,
      rebuildCode + bookEndsCode,
      rebuildCode + bookMoveCode,
      rebuildCode + bookSettleCode,
      // its two shaders that file a particle under its cell, once with a slot per cell of the
      // grid and once with the slots of a table
      ...[cellsGridCode, tableCode].flatMap((cellsCode) =>
        [bookCountCode, bookFillCode].map((code) => rebuildCode + cellsCode + code),
      ),
    ].map(make),
  )
  const [bookBlocks, bookScan, bookEnds, bookMove, bookSettle, ...filed] = book
  // The levels and the rounds, which read the cells of the book, and the same with the particles
  // kept in its order.
  // In a table, two of the 27 cells a particle reads can share a slot, and its particles would
  // count twice: `repeated` says whether the cell at `offset` from `home` has the slot of one read
  // before it, in the order of the loops, x fastest. `clashing` says first whether any two of the
  // 27 do, which is rare. On a grid every cell has its own slot.
  const NEVER = `
fn clashing(home: vec3i, slots: u32) -> bool { return false; }
fn repeated(home: vec3i, offset: vec3i, slots: u32) -> bool { return false; }
`
  // `clashing`: the 27 slots worked out once, s0 to s26, and every pair of them compared. Written
  // out by this loop, since a shader's own array would be slow to fill and read (chapter 045).
  const cells27 = Array.from({ length: 27 }, (_, m) => m)
  const FIRST = `
fn clashing(home: vec3i, slots: u32) -> bool {
${cells27
  .map(
    (m) =>
      `  let s${m} = slot(home + vec3i(${(m % 3) - 1}, ${(Math.floor(m / 3) % 3) - 1}, ${Math.floor(m / 9) - 1}), slots);`,
  )
  .join('\n')}
  return ${cells27
    .flatMap((m) => cells27.slice(0, m).map((k) => `s${k} == s${m}`))
    .join(' ||\n    ')};
}
fn repeated(home: vec3i, offset: vec3i, slots: u32) -> bool {
  let mine = slot(home + offset, slots);
  let k = (offset.z + 1) * 9 + (offset.y + 1) * 3 + offset.x + 1;
  for (var m = 0; m < k; m++) {
    if (slot(home + vec3i(m % 3 - 1, (m / 3) % 3 - 1, m / 9 - 1), slots) == mine) {
      return true;
    }
  }
  return false;
}
`
  // With sizes and the particles kept in order: the two shaders that move the properties along.
  // With springs: the register of names, and a group of springs.
  // The register needs nothing of common.wgsl, whose functions want `params`: it stands alone.
  const alone = (code: string) =>
    device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code }) },
    })
  const springKit = SPRINGS
    ? await Promise.all([alone(registerCode), make(springsCode)])
    : undefined
  const moveProperties = MIXED
    ? await Promise.all(
        [propertiesMoveCode, propertiesSettleCode].map((code) => make(rebuildCode + code)),
      )
    : undefined
  const reading = await Promise.all(
    [cellsGridCode + NEVER, tableCode + FIRST].flatMap((cellsCode) =>
      // With sizes only the two in order exist: they stand in for the others, never used.
      (MIXED
        ? [
            listInOrder(levelsCellsSizedCode),
            listInOrder(levelsCellsSizedCode),
            listInOrder(roundCellsSizedCode),
            listInOrder(roundCellsSizedCode),
          ]
        : [
            levelsCellsCode,
            listInOrder(levelsCellsCode),
            roundCellsCode,
            listInOrder(roundCellsCode),
          ]
      ).map((code) => make(cellsCode + code)),
    ),
  )
  // For a grid, k = 0, and for a table, k = 1: the shaders that file the particles, and those
  // that read the cells, each one as it is and for particles in order.
  const filing = (k: number) => ({
    bookCount: filed[2 * k],
    bookFill: filed[2 * k + 1],
    levels: reading[4 * k],
    levelsInOrder: reading[4 * k + 1],
    round: reading[4 * k + 2],
    roundInOrder: reading[4 * k + 3],
  })
  return {
    predict,
    clearIf,
    finish,
    bookBlocks,
    bookScan,
    bookEnds,
    bookMove,
    bookSettle,
    byGrid: filing(0),
    byTable: filing(1),
    moveProperties,
    springKit,
  }
}
type Pipelines = Awaited<ReturnType<typeof makePipelines>>

/** One radius per substep, in m/s: 6 with 1 substep, 12 with 2, the safe limit (decision 017). */
const safeSpeed = (substeps: number) => (RADIUS * substeps) / STEP
/** The limit of decision 019, as a share of the safe one: 9 m/s with 1 substep, 18 with 2. */
const DEFAULT_SHARE = 1.5

/** The grid of cells: where its first corner is, in meters, and how many cells along x, y, z. */
interface Grid {
  origin: Vec3
  size: Vec3
}
/**
 * How the cells keep their particles: one list of all the particles sorted by cell, the address
 * book of chapter 024, where a cell is never full. 'book': with a slot for every cell of the grid.
 * 'table': with the slots of a table, about two per particle, shared by all the cells of a space
 * with no border (spatial hashing).
 */
type Cells = 'book' | 'table'
/**
 * The grid of the level box, with cells of this width: 120 by 45 by 120 of them at 20 cm, in the
 * box of 24 m.
 */
const levelGrid = (cell: number, half: number, height = HEIGHT): Grid => ({
  origin: [-half, 0, -half],
  size: [2 * half, height, 2 * half].map((m) => Math.ceil(m / cell - 1e-6)) as Vec3,
})

/**
 * The grid never turns: its cells stay along the world's axes. So for a box that tilts, it must be
 * big enough to hold the box at every tilt, up to `most` degrees around X and around Z. The box
 * turns around the middle of its floor.
 */
function gridAround(most: number, cell: number, half: number): Grid {
  const low = new Vector3(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  )
  const high = low.clone().negate()
  const corner = new Vector3()
  const turn = new Euler()
  for (let x = -most; x <= most; x += 5)
    for (let z = -most; z <= most; z += 5) {
      turn.set(MathUtils.degToRad(x), 0, MathUtils.degToRad(z))
      for (const sx of [-half, half])
        for (const y of [0, HEIGHT])
          for (const sz of [-half, half]) {
            corner.set(sx, y, sz).applyEuler(turn)
            low.min(corner)
            high.max(corner)
          }
    }
  const origin = low.toArray().map((v) => Math.floor(v / cell) * cell - cell) as Vec3
  const size = high.toArray().map((v, a) => Math.ceil((v - origin[a]) / cell) + 1) as Vec3
  return { origin, size }
}

/**
 * The particles on the GPU and how to encode one step of them.
 */
function makeSimulation(
  device: GPUDevice,
  kit: Pipelines,
  pointer: GPUBuffer,
  count: number,
  masses: readonly [number, number],
  grid: Grid,
  box: Matrix4,
  cells: Cells,
  margin: number,
  cell: number,
  slotsEach: number,
  inOrder: boolean,
  half: number,
  ratio = 1,
  diagonals = true,
) {
  // The cube stands on the floor of the box, wherever the box is turned.
  const start = cube(count, masses)
  const two = TWO ? twoSizes(count, ratio, half) : undefined
  const roped = ROPES ? ropes(count) : CLOTH ? cloth(count, diagonals) : undefined
  const placed = two?.at ?? roped?.at
  if (placed) for (let i = 0; i < count; i++) start.set(placed.subarray(i * 3, i * 3 + 3), i * 4)
  for (const i of roped?.held ?? []) start[i * 4 + 3] = 0 // 1 / mass of 0: it never moves
  const point = new Vector3()
  for (let i = 0; i < count; i++) {
    point.fromArray(start, i * 4).applyMatrix4(box)
    start.set(point.toArray(), i * 4)
  }
  // On a page with sizes, `masses` are the densities, lightest and heaviest: a particle weighs its
  // density times its volume, the largest sphere of density 1 being 1 kg. One material is one
  // density for all, and the weight then follows the size alone.
  const sizes = MIXED ? (two?.radii ?? radiiOf(count, ratio)) : undefined
  if (sizes) for (let i = 0; i < count; i++) start[i * 4 + 3] /= (sizes[i] / RADIUS) ** 3
  const bytes = start.byteLength
  // The slots that count particles: one per cell of the grid, or those of the table, the first
  // power of two that gives at least `slotsEach` per particle.
  const cellCount =
    cells === 'table'
      ? 2 ** Math.ceil(Math.log2(Math.max(slotsEach * count, 1024)))
      : grid.size[0] * grid.size[1] * grid.size[2]
  const buffers: GPUBuffer[] = []
  const storage = (size: number, extra = 0) => {
    const buffer = device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | extra,
    })
    buffers.push(buffer)
    return buffer
  }
  const positions = storage(bytes, GPUBufferUsage.COPY_SRC) // read back by ?profile
  const velocities = storage(bytes)
  const predicted = [storage(bytes), storage(bytes)]
  const counts = storage(cellCount * 4)
  // The address book: a row per particle, where each cell's rows begin, and the sums of the
  // blocks the prefix sum is made in
  const blockCount = Math.ceil(cellCount / BLOCK)
  // The particles kept in the order of the book (book-move.wgsl). With sizes their properties
  // move with them, in two passes of their own.
  const sorted = inOrder
  const spare = storage(sorted ? bytes : 16)
  const book = storage(count * 4)
  const starts = storage(cellCount * 4)
  const blocks = storage(blockCount * 4)
  const file = cells === 'table' ? kit.byTable : kit.byGrid
  const levels = [storage(count * 4), storage(count * 4)]
  const walls = planesOf(half)
  const planes = storage(walls.length * 16)
  const control = storage(32, GPUBufferUsage.COPY_SRC) // see rebuild.wgsl
  const params = device.createBuffer({
    size: 80,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  buffers.push(params)

  // What a particle is, and does not change during a step: four numbers each, in one buffer, so
  // that a shader spends one of its 8 storage buffers on all of them (decision 032). The radius
  // first, then the particle's name; the other two are free, for what comes next.
  const properties = storage(sizes ? count * 16 : 16, GPUBufferUsage.COPY_SRC) // read back by ?profile
  if (sizes) {
    const data = new Float32Array(count * 4)
    // the radius, then the name: the number a particle keeps while its row changes (decision 036)
    sizes.forEach((radius, i) => {
      data[i * 4] = radius
      data[i * 4 + 1] = i
    })
    device.queue.writeBuffer(properties, 0, data)
  }
  device.queue.writeBuffer(positions, 0, start)
  for (const b of levels) device.queue.writeBuffer(b, 0, new Uint32Array(count).fill(NO_LEVEL))
  device.queue.writeBuffer(planes, 0, new Float32Array(walls.flat()))
  // The shaders of the address book ask `rebuild()` whether to run (contact-cost/rebuild.wgsl), as
  // when lists of neighbours decided it: here the first flag stays up, and they always do.
  device.queue.writeBuffer(control, 0, new Uint32Array([1, 1, 0, 0, 0]))
  // The Params struct of common.wgsl: 80 bytes, in its order.
  const data = new ArrayBuffer(80)
  const floats = new Float32Array(data)
  const words = new Uint32Array(data)
  floats.set([0, -GRAVITY, 0, STEP, ...grid.origin, cell])
  words.set([...grid.size, 0], 8) // no places per cell: the address book
  floats.set([RADIUS, FORCE_PLUS.alpha, FORCE_PLUS.levels], 12)
  words[15] = walls.length
  floats[19] = margin // 16 to 18 belong to the spring, not used here
  device.queue.writeBuffer(params, 0, data)

  const group = (p: GPUComputePipeline, entries: GPUBuffer[]) =>
    device.createBindGroup({
      layout: p.getBindGroupLayout(0),
      entries: entries.map((buffer, binding) => ({ binding, resource: { buffer } })),
    })
  const predictGroup = group(kit.predict, [params, positions, velocities, predicted[0]])
  const clearGroup = group(kit.clearIf, [params, control, counts])
  const bookGroups = {
    count: group(file.bookCount, [params, predicted[0], counts, control]),
    blocks: group(kit.bookBlocks, [params, control, counts, blocks]),
    scan: group(kit.bookScan, [params, control, blocks]),
    ends: group(kit.bookEnds, [params, control, counts, blocks, starts]),
    fill: group(file.bookFill, [params, predicted[0], starts, book, control]),
    // Moving the particles into the order of the book, in a substep whose levels are read from
    // levels[k]. The spare buffers: the second buffer of the rounds, free until the first round,
    // one more for the predicted positions, and the levels the substep is about to write.
    move: [0, 1].map((k) =>
      group(kit.bookMove, [
        params,
        control,
        book,
        positions,
        predicted[0],
        levels[k],
        predicted[1],
        spare,
        levels[1 - k],
      ]),
    ),
    settle: [0, 1].map((k) =>
      group(kit.bookSettle, [
        params,
        control,
        predicted[1],
        spare,
        levels[1 - k],
        positions,
        predicted[0],
        levels[k],
      ]),
    ),
  }
  // µ, the friction of round-push.wgsl: 4 bytes, in a buffer of the usual 16.
  const rub = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  buffers.push(rub)
  const spareProperties = storage(sorted && sizes ? count * 16 : 16)
  const propertyGroups =
    sorted && sizes && kit.moveProperties
      ? [
          group(kit.moveProperties[0], [params, control, book, properties, spareProperties]),
          group(kit.moveProperties[1], [params, control, spareProperties, properties]),
        ]
      : undefined
  // The springs (decision 037): one list, each spring once, sorted into groups that share no
  // particle. A register says in which row each name is. One dispatch per group, in place on the
  // predicted positions, before the levels and the rounds of the contacts.
  const springs = roped && kit.springKit ? [...roped.links].sort((p, q) => p[2] - q[2]) : []
  const rowOf = storage(springs.length ? count * 4 : 4)
  const springList = storage(Math.max(springs.length, 1) * 20) // the Spring struct: 5 numbers
  // what each spring has asked for so far in this substep: its running total (chapter 064)
  const springTotals = storage(Math.max(springs.length, 1) * 4)
  const writeSprings = (compliance: number, damping = 0) => {
    const data = new ArrayBuffer(springs.length * 20)
    const names = new Uint32Array(data)
    const floats = new Float32Array(data)
    springs.forEach(([a, b, , rest], i) => {
      names.set([a, b], i * 5)
      floats.set([rest, compliance, damping], i * 5 + 2)
    })
    if (springs.length) device.queue.writeBuffer(springList, 0, data)
  }
  writeSprings(0)
  const registerGroup =
    springs.length && kit.springKit ? group(kit.springKit[0], [properties, rowOf]) : undefined
  // each group: where it begins in the list and how many springs, then its bind group
  const springGroups = Array.from({ length: MAX_SPRING_GROUPS }, (_, g) => g).flatMap((g) => {
    const first = springs.findIndex((link) => link[2] === g)
    const n = springs.filter((link) => link[2] === g).length
    if (!n || !kit.springKit) return []
    // two bind groups: for the first pass of a substep, where the running totals start from zero,
    // and for the others
    const pipeline = kit.springKit[1]
    const [fresh, later] = [1, 0].map((flag) => {
      const part = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
      buffers.push(part)
      device.queue.writeBuffer(part, 0, new Uint32Array([first, n, flag]))
      return group(pipeline, [
        params,
        part,
        springList,
        rowOf,
        predicted[0],
        springTotals,
        positions, // where each particle began the substep: the damping measures from there
      ])
    })
    return [{ workgroups: Math.ceil(n / 64), fresh, later }]
  })
  let springRounds = SPRING_ROUNDS
  // Levels alternate between two buffers, a step each; positions between two, a round each.
  // The levels and the rounds read the cells of the book: the counts and the starts, then, after
  // their other buffers, the properties, with sizes, and the book, unless in order.
  const levelsKit = sorted ? file.levelsInOrder : file.levels
  const roundKit = sorted ? file.roundInOrder : file.round
  const bookLast = [...(sizes ? [properties] : []), ...(sorted ? [] : [book])]
  const levelGroups = [0, 1].map((k) =>
    group(levelsKit, [
      params,
      predicted[0],
      counts,
      starts,
      planes,
      levels[k],
      levels[1 - k],
      ...bookLast,
    ]),
  )
  const roundGroups = [0, 1].map((k) =>
    [0, 1].map((from) =>
      group(roundKit, [
        params,
        predicted[from],
        predicted[1 - from],
        counts,
        starts,
        planes,
        levels[1 - k],
        pointer,
        positions, // where each particle was when the substep began: friction measures from there
        rub,
        ...bookLast,
      ]),
    ),
  )
  // The speed limit of finish-limit.wgsl, in m/s: 4 bytes, in a buffer of the usual 16.
  const limit = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  buffers.push(limit)
  const finishGroup = group(kit.finish, [
    params,
    positions,
    velocities,
    predicted[ROUNDS % 2],
    limit,
  ])
  const workgroups = Math.ceil(count / 64)
  const cellWorkgroups = Math.ceil(cellCount / 64)
  const blockWorkgroups = Math.ceil(blockCount / 64)
  let parity = 0
  let substeps = 1
  let levelsOn = true // the levels pass runs only when the rounds read the levels, c > 0

  return {
    particleCount: count,
    radius: RADIUS,
    // four numbers per particle, the radius first: for who draws them
    propertiesBuffer: sizes ? properties : undefined,
    // the register: for each name, the row of that particle now (decision 036)
    registerBuffer: springs.length ? rowOf : undefined,
    // a cloth's shape, in particles: for who draws it as a surface
    cloth: CLOTH ? { columns: clothColumns(count), rows: clothRows(count) } : undefined,
    positionBuffer: positions,
    substepCount: 0,

    get substeps() {
      return substeps
    },

    /**
     * One step of 1/60 s, cut into substeps. Each one: predict, the address book, the levels, the
     * rounds with the ball, finish. Before each substep its own ball is copied from `path`, from
     * entry `from` on, into the Pointer uniform. With a `clock`, the GPU clock is read when the
     * first substep starts and when the last one ends. With a `profile`, every shader runs in a
     * compute pass of its own, between two readings of the profile's clock, and its name is added
     * to the profile's names: pass k of the step wrote entries 2k and 2k + 1.
     */
    encode(
      encoder: GPUCommandEncoder,
      path: GPUBuffer,
      from: number,
      clock?: GPUQuerySet,
      profile?: Profile,
    ) {
      for (let s = 0; s < substeps; s++) {
        const first = s === 0
        const last = s === substeps - 1
        encoder.copyBufferToBuffer(path, (from + s) * 16, pointer, 0, 16)
        encoder.clearBuffer(control, 8, 4) // the largest move, measured again at every substep
        const whole = profile
          ? undefined
          : encoder.beginComputePass(
              clock && (first || last)
                ? {
                    timestampWrites: {
                      querySet: clock,
                      beginningOfPassWriteIndex: first ? 0 : undefined,
                      endOfPassWriteIndex: last ? 1 : undefined,
                    },
                  }
                : undefined,
            )
        const dispatch = (name: string, p: GPUComputePipeline, g: GPUBindGroup, n = workgroups) => {
          const k = profile?.names.push(name) ?? 0
          const pass =
            whole ??
            encoder.beginComputePass({
              timestampWrites: {
                querySet: (profile as Profile).clock,
                beginningOfPassWriteIndex: 2 * k - 2,
                endOfPassWriteIndex: 2 * k - 1,
              },
            })
          pass.setPipeline(p)
          pass.setBindGroup(0, g)
          pass.dispatchWorkgroups(n)
          if (!whole) pass.end()
        }
        dispatch('predict', kit.predict, predictGroup)
        // The address book, made again at every substep: the cells are read at every round.
        dispatch('clear', kit.clearIf, clearGroup, cellWorkgroups)
        dispatch('count', file.bookCount, bookGroups.count)
        dispatch('sum', kit.bookBlocks, bookGroups.blocks, blockWorkgroups)
        dispatch('sum', kit.bookScan, bookGroups.scan, 1)
        dispatch('sum', kit.bookEnds, bookGroups.ends, blockWorkgroups)
        dispatch('fill', file.bookFill, bookGroups.fill)
        if (sorted) {
          dispatch('move', kit.bookMove, bookGroups.move[parity])
          dispatch('move', kit.bookSettle, bookGroups.settle[parity])
          if (propertyGroups && kit.moveProperties) {
            dispatch('move', kit.moveProperties[0], propertyGroups[0])
            dispatch('move', kit.moveProperties[1], propertyGroups[1])
          }
        }
        if (registerGroup && kit.springKit) {
          dispatch('names', kit.springKit[0], registerGroup)
          for (let r = 0; r < springRounds; r++)
            for (const g of springGroups)
              dispatch('springs', kit.springKit[1], r === 0 ? g.fresh : g.later, g.workgroups)
        }
        if (levelsOn) dispatch('levels', levelsKit, levelGroups[parity])
        for (let r = 0; r < ROUNDS; r++) dispatch('rounds', roundKit, roundGroups[parity][r % 2])
        dispatch('finish', kit.finish, finishGroup)
        whole?.end()
        parity = 1 - parity
        this.substepCount++
      }
    },

    /**
     * α, c, the substeps and the speed limit, from the next step on. A substep lasts 1/60 s
     * divided by their number: predict and finish read it from the params. No particle may go
     * faster than `maxSpeed`, in m/s, 0 for no limit (decisions 017 to 019). With c = 0 the levels
     * are not computed: the levels of the pile then catch up in a few steps when c comes back.
     */
    setSolver(alpha: number, levelStrength: number, count: number, maxSpeed: number) {
      substeps = count
      levelsOn = levelStrength > 0
      device.queue.writeBuffer(params, 3 * 4, new Float32Array([STEP / count]))
      device.queue.writeBuffer(params, 13 * 4, new Float32Array([alpha, levelStrength]))
      device.queue.writeBuffer(limit, 0, new Float32Array([maxSpeed]))
    },

    /** The floor and the walls, turned as the box is: only their normals change. */
    setBox(turn: Quaternion) {
      const normal = new Vector3()
      const data = walls.flatMap(([x, y, z, offset]) => [
        ...normal.set(x, y, z).applyQuaternion(turn).toArray(),
        offset,
      ])
      device.queue.writeBuffer(planes, 0, new Float32Array(data))
    },

    /** The springs, as two names and a rest length: for who measures how far they stretch. */
    springs: springs.map(([a, b, , rest]) => [a, b, rest] as const),
    /**
     * How many passes over the springs in a substep, their compliance, 1 / stiffness in meters
     * per newton, 0 for a rod, and their damping ratio, 0 for none.
     */
    setSprings(rounds: number, compliance: number, damping: number) {
      springRounds = rounds
      writeSprings(compliance, damping)
    },

    /** The drag on every particle, in 1 / s: 0 is none (finish-limit.wgsl). */
    setDrag(drag: number) {
      device.queue.writeBuffer(limit, 4, new Float32Array([drag]))
    },

    /** µ, how much of their slide two touching particles take back: 0 is none (decision 020). */
    setFriction(mu: number) {
      device.queue.writeBuffer(rub, 0, new Float32Array([mu]))
    },

    destroy() {
      for (const b of buffers) b.destroy()
    },
  }
}
type Simulation = ReturnType<typeof makeSimulation>
/** A clock with two entries per shader of a step, and the names of the shaders that wrote them. */
type Profile = { clock: GPUQuerySet; names: string[] }
// The most shaders a step runs: sixteen, the rounds, and the groups of springs in each of their
// rounds, in every substep.
const MAX_PASSES = (16 + ROUNDS + MAX_SPRING_GROUPS * MAX_SPRING_ROUNDS) * MAX_SUBSTEPS

async function start() {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) throw new Error('no WebGPU here')
  // The GPU clock, where there is one, to time a step.
  const hasClock = adapter.features.has('timestamp-query')
  const device = await adapter.requestDevice({
    requiredFeatures: hasClock ? ['timestamp-query'] : [],
  })
  // WebGPU reports a rejected command here, not with an exception: each one is shown once.
  const seen = new Set<string>()
  device.addEventListener('uncapturederror', (event) => {
    const message = (event as GPUUncapturedErrorEvent).error.message.split('\n')[0]
    if (!seen.has(message)) showError(message)
    seen.add(message)
  })
  const kit = await makePipelines(device, new URLSearchParams(location.search).get('hash') ?? '')

  // three.js times its own drawing on the GPU clock too, for the "GPU draw" of the panel.
  const renderer = new WebGPURenderer({ device, antialias: true, trackTimestamp: hasClock })
  await renderer.init()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.append(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0xe9e9e9)
  // Light for the ball only, when it is not lit by the stage: the particles shade themselves
  // (debug/particles.ts), from the same direction.
  scene.add(new HemisphereLight(0xffffff, 0x777788, 2))
  const sun = new DirectionalLight(0xffffff, 2)
  sun.position.copy(SUN.value)
  scene.add(sun)
  // The shadows (debug/shadows.ts, decision 030). ?shadowmap=4096 in the address sets the side of
  // the shadow map, ?soft=3 the width of the soft edge, both in texels.
  const asks = new URLSearchParams(location.search)
  const stage = new ShadowStage(renderer, scene, {
    size: MathUtils.clamp(
      Math.round(Number(asks.get('shadowmap'))) || 2048,
      256,
      device.limits.maxTextureDimension2D,
    ),
    softness: asks.has('soft') ? Number(asks.get('soft')) || 0 : undefined,
  })
  // The floor, with a line every meter, 5 cells of the grid, and the box the grid fills.
  // They and the ball sit in one group, the box. The tilted-box page turns the group, and the
  // floor and the walls of the simulation with it. The particles are not in the group: they live in
  // the world, where the grid of cells stays still and gravity points down.
  const world = new Group()
  scene.add(world)
  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200)
  // A smaller box is still as tall, and the block the particles start in is tall too: the camera
  // comes closer by less than the floor shrinks.
  camera.position.set(17, 14, 23).multiplyScalar(Math.sqrt(SMALLEST_HALF / HALF))
  // The box is as wide as the particles need (halfFor): its lines are drawn again when it changes,
  // and the camera moves back or forth by as much, to keep the whole box in view.
  let half = 0
  let height = HEIGHT // of the box, in meters: taller for a large cloth
  const lines: (GridHelper | LineSegments)[] = []
  // A floor to take the shadows, of the color of the background. Only the stage draws it: without
  // it the floor is the grid's lines alone, as before. Lines drawn the usual way come after the
  // light and take no shadow, so with the stage the floor paints the same grid itself, a line
  // every meter, and the lines of the GridHelper are hidden (floorLines).
  const floorSide = uniform(1) // meters
  const floorGrid = Fn(() => {
    // Where this pixel is on the floor, in meters from its center, and how far from the nearest
    // line, in pixels: fwidth says how many meters one pixel covers here, as in GLSL.
    const at = positionLocal.xy.mul(floorSide)
    const pixel = fwidth(at)
    const toLine = abs(fract(at.sub(0.5)).sub(0.5)).div(pixel)
    const toAxis = abs(at).div(pixel)
    const line = saturate(float(1).sub(min(toLine.x, toLine.y)))
    const axis = saturate(float(1).sub(min(toAxis.x, toAxis.y)))
    const ground = uniform(scene.background as Color)
    return mix(mix(ground, uniform(new Color(0xd4d4d4)), line), uniform(new Color(0xbcbcbc)), axis)
  })()
  // Two materials: lit by the stage's last pass, or by itself when all is drawn straight to the
  // screen (redraw).
  const floorDeferred = stage.matte(floorGrid)
  const floorForward = stage.lit(floorGrid)
  const floor = new Mesh(new PlaneGeometry(1, 1), floorDeferred)
  let floorLines = false // whether the floor is drawn, with its own lines
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.005
  floor.layers.set(SURFACES)
  world.add(floor)
  function fitBox(next: number, tall = HEIGHT) {
    if (next === half && tall === height) return
    height = tall
    floor.scale.set(2 * next, 2 * next, 1)
    floorSide.value = 2 * next
    // The light covers a ball around the box, at any tilt: the box turns around its floor's center.
    stage.fit(new Vector3(), Math.hypot(next, next, height))
    for (const line of lines.splice(0)) {
      world.remove(line)
      line.geometry.dispose()
    }
    const box = new LineSegments(
      new EdgesGeometry(new BoxGeometry(2 * next, height, 2 * next)),
      new LineBasicMaterial({ color: 0x9a9a9a }),
    )
    box.position.y = height / 2
    lines.push(new GridHelper(2 * next, 2 * next, 0xbcbcbc, 0xd4d4d4), box)
    lines[0].visible = !floorLines
    world.add(...lines)
    if (half) camera.position.multiplyScalar(next / half)
    camera.far = (200 * next) / HALF
    camera.updateProjectionMatrix()
    half = next
  }
  fitBox(SMALLEST_HALF)
  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.target.set(0, 0.5, 0)
  orbit.enableDamping = true
  orbit.dampingFactor = 0.08
  // On a phone one finger pushes the particles, so the camera turns with two.
  orbit.touches = { ONE: null, TWO: TOUCH.DOLLY_ROTATE }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // ---- the pointer ---------------------------------------------------------------------------------
  // The Pointer struct of round-push.wgsl: the center of the ball, then its radius. The ball moves
  // at every substep, not once per step: moved all at once, it would cover a step's way in the
  // first substep, and push particles as many times faster. So JavaScript writes where it is at
  // every substep of the frame in `ballPath`, and the GPU copies each one in before its substep.
  const pointerBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const ballPath = device.createBuffer({
    size: MAX_STEPS_PER_FRAME * MAX_SUBSTEPS * 16,
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  })
  const pathData = new Float32Array(MAX_STEPS_PER_FRAME * MAX_SUBSTEPS * 4)
  const canvas = renderer.domElement
  const screen = new Vector2() // the pointer from -1 to 1, as the camera sees the canvas
  let pointing = false
  let fingers = 0
  const aim = (event: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    screen.set(
      ((event.clientX - r.left) / r.width) * 2 - 1,
      -((event.clientY - r.top) / r.height) * 2 + 1,
    )
  }
  // A mouse pushes while it hovers with no button down: dragging turns the camera. A finger pushes
  // while it is the only one on the screen.
  canvas.addEventListener('pointerdown', (event) => {
    aim(event)
    if (event.pointerType === 'mouse') pointing = false
    else pointing = ++fingers === 1
  })
  canvas.addEventListener('pointermove', (event) => {
    aim(event)
    pointing = event.pointerType === 'mouse' ? event.buttons === 0 : fingers === 1
  })
  const lift = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') pointing = event.type === 'pointerup'
    else {
      fingers = Math.max(fingers - 1, 0)
      pointing = false
    }
  }
  canvas.addEventListener('pointerup', lift)
  canvas.addEventListener('pointercancel', lift)
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') pointing = false
  })

  // The ball has its center on the floor, y = 0, at the point of the floor behind the pointer: so
  // on the screen the pointer is on the ball's center, however deep the heap is. Aimed at the
  // surface of the heap instead, with the center on the floor under it, the ball looked off to
  // one side, by more the deeper the heap. It does not jump to the pointer: in each step it
  // covers BALL_FOLLOW of the way there, a lerp, at BALL_SPEED at most, and it grows from nothing at
  // BALL_GROWTH, so it pushes particles instead of throwing them. Only a ball that has shrunk to
  // nothing comes back straight under the pointer. Only its upper half is drawn: the floor is made
  // of lines, and the lower half would show through it. A page can lift the ball (BALL_HEIGHT), to
  // reach what hangs: its center then follows the pointer on a plane at that height, and the whole
  // ball is drawn.
  const ball = { x: 0, z: 0, radius: 0 }
  // Two materials: three.js's own, lit by the lights of the scene, and one that takes its light
  // and its shadows from the last pass of the stage. The ball casts a shadow too.
  // matte yellow, or tomato red among the yellow ropes
  const ballLit = new MeshStandardMaterial({
    color: ROPES ? 0xc8402a : 0xf2c200,
    roughness: 1,
    metalness: 0,
  })
  const ballShadowed = stage.matte(ballLit.color)
  const ballForward = stage.lit(ballLit.color)
  const ballMesh: Mesh = new Mesh(
    BALL_HEIGHT > 0
      ? new SphereGeometry(1, 48, 24)
      : new SphereGeometry(1, 48, 12, 0, 2 * Math.PI, 0, Math.PI / 2),
    ballLit,
  )
  stage.cast(ballMesh)
  world.add(ballMesh)
  const raycaster = new Raycaster()
  const surface = new Plane(new Vector3(0, 1, 0), -BALL_HEIGHT) // the floor, or the ball's height
  const hit = new Vector3()
  const inside = new Matrix4()
  const center = new Vector3()
  /**
   * Moves the ball through the `steps` steps of this frame, `substeps` each, toward the pointer and
   * toward `radius`, and writes where it is at every substep into `ballPath`.
   */
  function moveBall(steps: number, substeps: number, radius: number) {
    // a lifted ball stays clear of the floor, however large the panel makes it
    const lift = BALL_HEIGHT > 0 ? Math.max(BALL_HEIGHT, radius + 0.3) : 0
    surface.constant = -lift
    raycaster.setFromCamera(screen, camera)
    // the ray as the box sees it, since the plane and the ball are the box's own
    raycaster.ray.applyMatrix4(inside.copy(world.matrixWorld).invert())
    const on = pointing && raycaster.ray.intersectPlane(surface, hit) !== null
    // A pointer near the horizon hits the plane very far away, and the ball would take a long time
    // to come back: it stays within a margin of the walls.
    const most = half + BALL_MARGIN
    hit.x = MathUtils.clamp(hit.x, -most, most)
    hit.z = MathUtils.clamp(hit.z, -most, most)
    if (on && ball.radius === 0) {
      ball.x = hit.x
      ball.z = hit.z
    }
    const h = STEP / substeps
    // the lerp of a substep, so that a whole step still covers BALL_FOLLOW of the way
    const follow = 1 - (1 - BALL_FOLLOW) ** (1 / substeps)
    for (let k = 0; k < steps * substeps; k++) {
      if (on) {
        const dx = hit.x - ball.x
        const dz = hit.z - ball.z
        const far = Math.hypot(dx, dz)
        const move = far > 0 ? Math.min(follow, (BALL_SPEED * h) / far) : 0
        ball.x += dx * move
        ball.z += dz * move
      }
      // The radius goes toward its target at BALL_GROWTH, also when the panel changes it.
      const change = (on ? radius : 0) - ball.radius
      ball.radius += Math.min(Math.max(change, -BALL_GROWTH * h), BALL_GROWTH * h)
      // the simulation wants the ball in the world, not in the box
      center.set(ball.x, lift, ball.z).applyMatrix4(world.matrixWorld)
      pathData.set([center.x, center.y, center.z, ball.radius], k * 4)
    }
    if (steps) device.queue.writeBuffer(ballPath, 0, pathData, 0, steps * substeps * 4)
    ballMesh.visible = ball.radius > 0
    ballMesh.scale.setScalar(ball.radius)
    ballMesh.position.set(ball.x, lift, ball.z)
  }

  // ---- the simulation and the panel ----------------------------------------------------------------
  // ?particles=20000 in the address starts with that many, in thousands from 1000 to a million.
  // ?draw=flat or ?draw=none starts with the cheap discs, or with no particles drawn at all.
  const query = new URLSearchParams(location.search)
  // The debug-viewer page, with data-render on its <body>: a small simulation whose panel is about
  // how the particles are drawn. On the other pages the panel is about the simulation, and the
  // particles are spheres lit in their own shader, with no shadows.
  const renderPage = document.body.dataset.render !== undefined
  const asked = Math.round(Number(query.get('particles')) / 1000)
  const askedDraw = query.get('draw')
  const askedFriction = Number(query.get('friction') ?? Number.NaN) // ?friction=0 starts as a liquid
  const startTilt = (key: 'tiltX' | 'tiltZ') =>
    MathUtils.clamp(
      Number(query.get(key) ?? document.body.dataset[key] ?? 0) || 0,
      -MAX_TILT,
      MAX_TILT,
    )
  const settings = {
    // FORCE+ ('plus') or FORCE ('force'): the same rule, with α = 1 and c = 0
    method: 'plus',
    ...FORCE_PLUS,
    // ?substeps=1 in the address starts with that many
    substeps: MathUtils.clamp(
      Math.round(Number(query.get('substeps'))) || FORCE_PLUS.substeps,
      1,
      MAX_SUBSTEPS,
    ),
    // ?c=0 in the address starts without levels
    levels: query.has('c') ? MathUtils.clamp(Number(query.get('c')) || 0, 0, 4) : FORCE_PLUS.levels,
    // The speed limit: 'safe', the default, one radius per substep (decision 027), 'auto', 1.5 ×
    // the safe one, 'custom', `speed` in m/s, or 'off' (decisions 017 to 019). With the default 2
    // substeps, 'safe' is 12 m/s.
    maxSpeed: 'safe',
    speed: 20,
    // µ: 0 is the liquid of chapter 031, 0.3 already makes a pile stand (chapter 034). A page
    // sets its own start with data-friction on its <body>.
    friction:
      askedFriction >= 0 && askedFriction <= 1
        ? askedFriction
        : Number(document.body.dataset.friction ?? 0),
    // The tilt of the box around X and around Z, in degrees: only the tilted-box page has the
    // sliders.
    // ?tiltX=20 in the address starts tilted that much; else as the page's <body> says.
    tiltX: startTilt('tiltX'),
    tiltZ: startTilt('tiltZ'),
    // ?particles= in the address, or data-particles on the page's <body>, or 20 000.
    particles:
      asked >= 1 && asked <= MOST_PARTICLES / 1000
        ? asked * 1000
        : Number(document.body.dataset.particles) || 20000,
    // On a page with sizes these are the densities: one material, where the weight follows the
    // size alone, or materials from 1 to 10 times as dense.
    masses: MIXED ? '1 kg' : '1 to 100 kg',
    // The largest radius over the smallest, on a page with sizes: 1 is all the same.
    // ?sizes=3 in the address starts with that ratio.
    sizes: MathUtils.clamp(Number(query.get('sizes')) || SIZES, 1, MAX_SIZES),
    // How the particles are drawn. 'spheres': each sphere lit in its own shader. 'deferred':
    // spheres that write only their depth, color and normal, lit in a later pass once per pixel
    // (decision 030), where the debug-viewer page starts. Flat discs, or nothing at all, to see
    // how much of a frame goes into drawing them. ?draw=deferred, ?draw=spheres, ?draw=flat or
    // ?draw=none in the address starts with that one, on any page.
    draw: ['deferred', 'spheres', 'flat', 'none'].includes(askedDraw ?? '')
      ? (askedDraw as string)
      : renderPage
        ? 'deferred'
        : 'spheres',
    // The shadows the spheres cast on each other, on the floor and on the ball, with 'deferred'
    // and with 'spheres', where each sphere reads the shadow map in its own shader. What the
    // light sees of a particle is its sphere, 'sphere', or a flat disc, 'flat', which the GPU can
    // skip when hidden. Off but on the debug-viewer page. ?shadows=sphere, ?shadows=flat or
    // ?shadows=off in the address.
    shadows: ['sphere', 'flat', 'off'].includes(query.get('shadows') ?? '')
      ? (query.get('shadows') as string)
      : renderPage
        ? 'sphere'
        : 'off',
    // The color of the lightest particle and of the heaviest: the others are in between, by the
    // logarithm of their mass. With one mass for all, only the first is used.
    // On the page with ropes, the yellow of spaghetti.
    light: ROPES ? '#f2d16b' : '#4ea3ff',
    heavy: '#d1495b',
    // The side of the shadow map, in texels: as ?shadowmap=4096 in the address asks, or 2048.
    shadowMap: stage.mapSize,
    // How dark a shadow is, from 0, only the sun taken away, to 1, black. ?dark=0.7 in the address.
    darkness: query.has('dark')
      ? MathUtils.clamp(Number(query.get('dark')) || 0, 0, 1)
      : stage.darkness.value,
    // How the cells keep their particles: the address book with a table (decision 024), or with
    // a slot per cell of the grid, with ?cells=book in the address.
    cells: (query.get('cells') === 'book' ? 'book' : 'table') as Cells,
    ball: Number(document.body.dataset.ball) || BALL_RADIUS, // data-ball on the page's <body>
    // The springs of a page with ropes: passes over them in a substep, and how much they give,
    // in millimeters per newton (the compliance, 1 / stiffness): 0 is a rod.
    // ?springrounds=6 and ?give=0.1 in the address start with those.
    springRounds: MathUtils.clamp(
      Math.round(Number(query.get('springrounds'))) || SPRING_ROUNDS,
      1,
      MAX_SPRING_ROUNDS,
    ),
    give: MathUtils.clamp(Number(query.get('give')) || 0, 0, 2),
    // How fast a spring's own swing dies, a damping ratio: 0 never, 1 without a bounce. It does
    // nothing to a rod. ?damping=0.3 in the address.
    damping: MathUtils.clamp(Number(query.get('damping')) || 0, 0, 1),
    // The drag on every particle, like air, in 1 / s: what stops a rope that swings. A page sets
    // its own with data-drag on its <body>; ?drag=0 in the address.
    drag: MathUtils.clamp(Number(query.get('drag') ?? document.body.dataset.drag ?? 0) || 0, 0, 5),
    // A cloth's links: along its sides only, 4 per particle, or along its diagonals too, 8.
    // ?links=4 in the address starts without the diagonals.
    diagonals: query.get('links') !== '4',
    // How a cloth is drawn: its particles, a surface through them, or the wires of that surface.
    // ?cloth=surface or ?cloth=wires in the address starts with that one.
    cloth: ['surface', 'wires'].includes(query.get('cloth') ?? '')
      ? (query.get('cloth') as string)
      : 'particles',
  }
  // How much wider than the largest particle a cell is, in meters. The cells are filed when a
  // substep begins and read at every round, while the particles move a little: the margin is the
  // room they have before one is looked for in the wrong cell. ?margin=0 in the address, to
  // measure: cells as wide as a particle.
  const margin = query.has('margin')
    ? MathUtils.clamp(Number(query.get('margin')) || 0, 0, CELL)
    : MARGIN
  const stats = {
    gpu: Number.NaN,
    draw: Number.NaN,
    stretch: Number.NaN, // how much longer than at rest the springs are, on average, in %
    worst: Number.NaN, // and the most stretched of them
  }
  /** α and c as the solver sees them: FORCE uses the real masses and no levels. */
  const solverAlpha = () => (settings.method === 'plus' ? settings.alpha : 1)
  const solverLevels = () => (settings.method === 'plus' ? settings.levels : 0)
  /** The speed limit asked for, in m/s, 0 for none. */
  const maxSpeed = () =>
    settings.maxSpeed === 'auto'
      ? DEFAULT_SHARE * safeSpeed(settings.substeps)
      : settings.maxSpeed === 'safe'
        ? safeSpeed(settings.substeps)
        : settings.maxSpeed === 'custom'
          ? settings.speed
          : 0
  // A page that tilts the box needs a grid that holds it at every tilt.
  // Cells as wide as the largest particle plus the margin, so that 3 × 3 × 3 of them hold every
  // particle that can touch (decision 023). With sizes the margin follows the smallest particle,
  // half its radius as with one size.
  const listMargin = () => (MIXED ? margin / settings.sizes : margin)
  const cellWidth = () => (query.has('narrow') ? CELL : DIAMETER + listMargin())
  const gridOf = (cell: number) =>
    document.body.dataset.tilt !== undefined
      ? gridAround(MAX_TILT, cell, half)
      : levelGrid(cell, half, height)
  // ?slots=8 in the address: slots of the table per particle, at least; 2 without it.
  const slotsEach = Math.max(Number(query.get('slots')) || 2, 1)
  let switching = false
  let fitBallSlider = () => {} // set when the panel is made
  const note = document.createElement('p')
  note.style.cssText = 'position:fixed;left:16px;bottom:16px;margin:0;max-width:60ch'
  document.body.append(note)
  let simulation: Simulation | undefined
  // The colors of the lightest and of the heaviest particle, which the panel can change.
  const massColors = [new Color(settings.light), new Color(settings.heavy)] as const
  let view: ParticleView | undefined
  let caster: ParticleView | undefined // the same particles as the light sees them
  let clothView: ClothView | undefined // a cloth drawn as a surface, or as its wires
  /**
   * Whether this frame is drawn in the stage's passes, whether with shadows, and whether with
   * shadows but straight to the screen, each sphere reading the shadow map itself.
   */
  const deferred = () => settings.draw === 'deferred'
  const shadowed = () => (deferred() || settings.draw === 'spheres') && settings.shadows !== 'off'
  const forward = () => shadowed() && !deferred()
  let paused = false
  let owed = 0 // simulated time the steps still owe to real time

  /** The lightest and the heaviest particle, in kg: with sizes, a small one of the lightest stuff. */
  const massRange = (): readonly [number, number] => {
    const [lightest, heaviest] = MASSES[settings.masses]
    return MIXED ? [lightest / settings.sizes ** 3, heaviest] : [lightest, heaviest]
  }
  /** Draws the same simulation again, in the way the panel asks. */
  function redraw() {
    for (const each of [view, caster]) {
      if (!each) continue
      scene.remove(each.mesh)
      each.dispose()
    }
    view = caster = undefined
    if (clothView) {
      scene.remove(clothView.mesh)
      clothView.dispose()
      clothView = undefined
    }
    // With shadows the ball takes its light from the stage, like the spheres: from its last pass,
    // or in its own shader. So does the floor, which without the stage is not drawn at all.
    ballMesh.material = deferred() ? ballShadowed : forward() ? ballForward : ballLit
    ballMesh.layers.set(deferred() ? SURFACES : 0)
    floor.material = forward() ? floorForward : floorDeferred
    floor.layers.set(forward() ? 0 : SURFACES)
    stage.shadows = shadowed()
    floorLines = deferred() || forward()
    lines[0].visible = !floorLines
    if (!simulation || settings.draw === 'none') return
    // A cloth as a surface or as its wires, in place of its particles.
    if (settings.cloth !== 'particles' && simulation.cloth && simulation.registerBuffer) {
      clothView = new ClothView(
        renderer,
        { ...simulation, ...simulation.cloth, registerBuffer: simulation.registerBuffer },
        massColors[0],
        settings.cloth === 'wires',
      )
      scene.add(clothView.mesh)
      return
    }
    view = new ParticleView(renderer, simulation, {
      massRange: massRange(),
      massColors,
      look: settings.draw === 'flat' ? 'flat' : deferred() ? 'surface' : 'sphere',
      lighting: forward() ? (...surface) => stage.lightOn(...surface) : undefined,
    })
    scene.add(view.mesh)
    if (deferred()) view.mesh.layers.set(SURFACES)
    if (!shadowed()) return
    caster = new ParticleView(renderer, simulation, {
      look: settings.shadows === 'flat' ? 'caster-flat' : 'caster',
    })
    caster.mesh.layers.set(CASTERS)
    scene.add(caster.mesh)
  }

  function restart() {
    if (switching) return // the menu was only told of the change below
    simulation?.destroy()
    fitBox(halfFor(settings.particles), heightFor(settings.particles))
    fitBallSlider()
    // A grid has a slot per cell, and a shader with a thread per cell: beyond what the device
    // can dispatch or bind, the cells go into the table, which has no such limit (decision 024).
    note.textContent = ''
    if (settings.cells !== 'table') {
      const cellCount = gridOf(cellWidth()).size.reduce((a, b) => a * b)
      const perCell = 4 // bytes
      const most = Math.min(
        device.limits.maxComputeWorkgroupsPerDimension * 64,
        device.limits.maxStorageBufferBindingSize / perCell,
      )
      if (cellCount > most) {
        note.textContent = `A grid for this box has ${cellCount.toLocaleString('en')} cells, more than the ${most.toLocaleString('en')} this device takes: switched to the table.`
        settings.cells = 'table'
        switching = true
        cellsMenu.refresh()
        switching = false
      }
    }
    const masses = MASSES[settings.masses]
    simulation = makeSimulation(
      device,
      kit,
      pointerBuffer,
      CLOTH ? clothFit(settings.particles) : settings.particles,
      masses,
      gridOf(cellWidth()),
      world.matrixWorld,
      settings.cells,
      listMargin(),
      cellWidth(),
      slotsEach,
      IN_ORDER,
      half,
      settings.sizes,
      settings.diagonals,
    )
    simulation.setBox(world.quaternion)
    applySolver()
    redraw()
    owed = 0
  }
  // The box as it is turned now, in degrees. It follows the sliders at TILT_SPEED, not at once: a
  // floor that jumped by one degree would move 21 cm at its edge, more than a particle's radius.
  const tilt = { x: settings.tiltX, z: settings.tiltZ }
  const turnBox = () => {
    world.rotation.set(MathUtils.degToRad(tilt.x), 0, MathUtils.degToRad(tilt.z))
    world.updateMatrixWorld()
    simulation?.setBox(world.quaternion)
  }
  turnBox()
  /** Moves the box toward the tilt the sliders ask, for a frame that lasted dt seconds. */
  const followTilt = (dt: number) => {
    if (tilt.x === settings.tiltX && tilt.z === settings.tiltZ) return
    const most = ((TILT_SPEED * HALF) / half) * dt
    tilt.x += MathUtils.clamp(settings.tiltX - tilt.x, -most, most)
    tilt.z += MathUtils.clamp(settings.tiltZ - tilt.z, -most, most)
    turnBox()
  }
  const applySolver = () => {
    simulation?.setSolver(solverAlpha(), solverLevels(), settings.substeps, maxSpeed())
    simulation?.setFriction(settings.friction)
    simulation?.setSprings(settings.springRounds, settings.give / 1000, settings.damping)
    simulation?.setDrag(settings.drag)
  }

  const pane = new Pane({ title: 'FORCE on the GPU', expanded: window.innerWidth >= 600 })
  pane.registerPlugin(EssentialsPlugin)
  // The debug-viewer page keeps the solver as decided, and does not show it.
  const solver = pane.addFolder({ title: 'Solver', hidden: renderPage })
  // FORCE or FORCE+: with FORCE, α and c do not apply, and their sliders rest.
  const method = solver
    .addBinding(settings, 'method', { options: { 'FORCE+': 'plus', FORCE: 'force' } })
    .on('change', () => {
      alpha.disabled = levels.disabled = settings.method !== 'plus'
      applySolver()
    })
  const alpha = solver
    .addBinding(settings, 'alpha', { label: 'α', min: 0, max: 1, step: 0.05 })
    .on('change', applySolver)
  const levels = solver
    .addBinding(settings, 'levels', { label: 'c', min: 0, max: 4, step: 0.25 })
    .on('change', applySolver)
  // Each substep has its own rounds, so a step costs about as many times more.
  const substeps = solver
    .addBinding(settings, 'substeps', { min: 1, max: MAX_SUBSTEPS, step: 1 })
    .on('change', applySolver)
  // The speed limit: 1.5 × the safe one by default, the safe one, one radius per substep, or any
  // speed in m/s, at the risk of splashes above the safe one (decisions 017 to 019).
  solver
    .addBinding(settings, 'maxSpeed', {
      label: 'max speed',
      options: { 'default, safe': 'safe', '1.5 × safe': 'auto', 'in m/s': 'custom', off: 'off' },
    })
    .on('change', () => {
      speed.disabled = settings.maxSpeed !== 'custom'
      applySolver()
    })
  const speed = solver
    .addBinding(settings, 'speed', { label: 'm/s', min: 1, max: 60, step: 1, disabled: true })
    .on('change', applySolver)
  // The limit in use, and the safe one, read again by the panel a few times per second.
  const cap = {
    get value() {
      const now = maxSpeed()
      const short = (v: number) => String(Number(v.toFixed(1))) // 7.5, not 7.50; 9, not 9.0
      return `${now ? `${short(now)} m/s` : 'none'}, safe ${short(safeSpeed(settings.substeps))}`
    },
  }
  solver.addBinding(cap, 'value', { label: 'limit', readonly: true })
  solver
    .addBinding(settings, 'friction', { label: 'friction µ', min: 0, max: 1, step: 0.05 })
    .on('change', applySolver)
  solver.addButton({ title: 'as decision 015' }).on('click', () => {
    Object.assign(settings, FORCE_PLUS, { method: 'plus' })
    alpha.disabled = levels.disabled = false
    method.refresh()
    alpha.refresh()
    levels.refresh()
    substeps.refresh()
    applySolver()
  })
  const particles = pane.addFolder({ title: 'Particles' })
  // A new count builds everything again, so only when the slider is let go.
  particles
    .addBinding(settings, 'particles', {
      label: 'count',
      min: 1000,
      max: MOST_PARTICLES,
      step: 1000,
    })
    .on('change', (event) => {
      if (event.last) restart()
    })
  particles
    .addBinding(settings, 'masses', {
      label: MIXED ? 'made of' : 'masses',
      options: MIXED
        ? { 'one material': '1 kg', 'materials, 1 to 10 times as dense': '1 to 10 kg' }
        : Object.fromEntries(Object.keys(MASSES).map((label) => [label, label])),
      hidden: renderPage,
    })
    .on('change', restart)
  particles
    .addBinding(settings, 'sizes', {
      label: 'large / small',
      min: 1,
      max: MAX_SIZES,
      step: 0.1,
      hidden: !MIXED,
    })
    .on('change', restart)
  // A new way to keep the grid builds everything again.
  const cellsMenu = particles
    .addBinding(settings, 'cells', {
      label: 'grid',
      options: { 'address book': 'book', 'address book, table': 'table' },
      hidden: renderPage,
    })
    .on('change', restart)
  const buttons = particles.addBlade({
    view: 'buttongrid',
    size: [2, 1],
    cells: (x: number) => ({ title: ['pause', 'restart'][x] }),
  }) as ButtonGridApi
  buttons.on('click', ({ index: [x] }) => {
    if (x === 1) return restart()
    paused = !paused
    const cell = buttons.cell(0, 0)
    if (cell) cell.title = paused ? 'resume' : 'pause'
  })
  if (document.body.dataset.tilt !== undefined) {
    const tiltFolder = pane.addFolder({ title: 'Tilt' })
    for (const [key, label] of [
      ['tiltX', 'around X'],
      ['tiltZ', 'around Z'],
    ] as const)
      tiltFolder.addBinding(settings, key, {
        label,
        min: -MAX_TILT,
        max: MAX_TILT,
        step: 1,
        format: (v) => `${v}°`,
      })
    tiltFolder.addButton({ title: 'level' }).on('click', () => {
      settings.tiltX = settings.tiltZ = 0
      pane.refresh()
    })
  }
  stage.darkness.value = settings.darkness
  // How the particles are drawn, their colors and their shadows: only on the debug-viewer page.
  if (renderPage) {
    const rendering = pane.addFolder({ title: 'Rendering' })
    const shadows = pane.addFolder({ title: 'Shadows' })
    rendering
      .addBinding(settings, 'draw', {
        options: {
          'spheres, deferred': 'deferred',
          'spheres, forward': 'spheres',
          'flat discs': 'flat',
          nothing: 'none',
        },
      })
      .on('change', () => {
        shadowsMenu.disabled = !deferred() && settings.draw !== 'spheres'
        shadowMapMenu.disabled = darknessSlider.disabled = !shadowed()
        redraw()
      })
    rendering.addBinding(settings, 'light', { label: 'color, light' }).on('change', () => {
      massColors[0].set(settings.light)
    })
    rendering.addBinding(settings, 'heavy', { label: 'color, heavy' }).on('change', () => {
      massColors[1].set(settings.heavy)
    })
    const shadowsMenu = shadows
      .addBinding(settings, 'shadows', {
        label: 'cast',
        options: { 'from spheres': 'sphere', 'from flat discs': 'flat', off: 'off' },
        disabled: !deferred() && settings.draw !== 'spheres',
      })
      .on('change', () => {
        shadowMapMenu.disabled = darknessSlider.disabled = !shadowed()
        redraw()
      })
    // A map this device cannot hold is not offered. One asked for in the address always is.
    const mapSizes = [512, 1024, 2048, 4096, 8192].filter(
      (size) => size <= device.limits.maxTextureDimension2D,
    )
    if (!mapSizes.includes(settings.shadowMap)) mapSizes.push(settings.shadowMap)
    const darknessSlider = shadows
      .addBinding(settings, 'darkness', {
        label: 'darkness',
        min: 0,
        max: 1,
        step: 0.05,
        disabled: !shadowed(),
      })
      .on('change', () => {
        stage.darkness.value = settings.darkness
      })
    const shadowMapMenu = shadows
      .addBinding(settings, 'shadowMap', {
        label: 'map',
        options: Object.fromEntries(
          mapSizes.sort((a, b) => a - b).map((size) => [`${size} px`, size]),
        ),
        disabled: !shadowed(),
      })
      .on('change', () => {
        stage.mapSize = settings.shadowMap
      })
  }
  // The springs: only on a page with ropes.
  const springFolder = pane.addFolder({ title: 'Springs', hidden: !SPRINGS })
  springFolder
    .addBinding(settings, 'springRounds', {
      label: 'rounds',
      min: 1,
      max: MAX_SPRING_ROUNDS,
      step: 1,
    })
    .on('change', applySolver)
  springFolder
    .addBinding(settings, 'give', { label: 'give, mm/N', min: 0, max: 2, step: 0.01 })
    .on('change', applySolver)
  springFolder
    .addBinding(settings, 'damping', { label: 'damping ζ', min: 0, max: 1, step: 0.05 })
    .on('change', applySolver)
  springFolder
    .addBinding(settings, 'drag', { label: 'drag, 1/s', min: 0, max: 5, step: 0.1 })
    .on('change', applySolver)
  springFolder
    .addBinding(settings, 'diagonals', {
      label: 'links',
      options: { 'along the sides, 4': false, 'and the diagonals, 8': true },
      hidden: !CLOTH,
    })
    .on('change', restart)
  springFolder
    .addBinding(settings, 'cloth', {
      label: 'drawn as',
      options: { particles: 'particles', 'a surface': 'surface', wires: 'wires' },
      hidden: !CLOTH,
    })
    .on('change', redraw)
  const ballFolder = pane.addFolder({ title: 'Ball' })
  const ballSlider = ballFolder.addBinding(settings, 'ball', {
    label: 'radius',
    min: 0.3,
    max: 3,
    step: 0.1,
  })
  // A large cloth wants a large ball: the slider goes up to a third of the cloth's height, 3 m at
  // least. Called at every restart, since the cloth changes size with the count of particles.
  fitBallSlider = () => {
    const most = CLOTH ? Math.max(3, Math.round((clothRows(settings.particles) * DIAMETER) / 3)) : 3
    ;(ballSlider as unknown as { max: number }).max = most
    if (settings.ball > most) {
      settings.ball = most
      ballSlider.refresh()
    }
  }
  fitBallSlider()
  const numbers = pane.addFolder({ title: 'Numbers' })
  const fps = numbers.addBlade({ view: 'fpsgraph', label: 'fps', rows: 2 }) as FpsGraphBladeApi
  numbers.addBinding(stats, 'gpu', {
    label: 'GPU step',
    readonly: true,
    format: (v) => (Number.isNaN(v) ? 'n/a' : `${v.toFixed(2)} ms`),
  })
  // What three.js spends drawing a frame, all its passes added up, on the same clock.
  numbers.addBinding(stats, 'draw', {
    label: 'GPU draw',
    readonly: true,
    format: (v) => (Number.isNaN(v) ? 'n/a' : `${v.toFixed(2)} ms`),
  })
  // How much longer than at rest the springs are: all of them on average, and the worst one.
  numbers.addBinding(stats, 'stretch', {
    label: 'stretch',
    readonly: true,
    hidden: !SPRINGS,
    format: (v) => (Number.isNaN(v) ? '…' : `${v.toFixed(2)}%`),
  })
  numbers.addBinding(stats, 'worst', {
    label: 'worst',
    readonly: true,
    hidden: !SPRINGS,
    format: (v) => (Number.isNaN(v) ? '…' : `${v.toFixed(2)}%`),
  })
  // ---- the GPU's numbers ---------------------------------------------------------------------------
  // Every SAMPLE_EVERY frames one step, all its substeps, is timed on the GPU clock, into a buffer
  // JavaScript can read when the GPU is done.
  const stamps = hasClock ? device.createQuerySet({ type: 'timestamp', count: 2 }) : undefined
  const resolved = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })
  const readback = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })
  let reading = false
  // The stretch of the springs: the positions and the properties, where the names are, copied at
  // the same moment, since the rows change from one substep to the next. A particle is found by
  // its name, and each spring's length measured against its rest length.
  let stretching = false
  async function readStretch(sim: Simulation) {
    if (stretching || !sim.propertiesBuffer || !sim.springs.length) return
    stretching = true
    const size = sim.particleCount * 16
    const back = device.createBuffer({
      size: 2 * size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    })
    const encoder = device.createCommandEncoder()
    encoder.copyBufferToBuffer(sim.positionBuffer, 0, back, 0, size)
    encoder.copyBufferToBuffer(sim.propertiesBuffer, 0, back, size, size)
    device.queue.submit([encoder.finish()])
    await back.mapAsync(GPUMapMode.READ)
    const both = new Float32Array(back.getMappedRange().slice(0))
    back.destroy()
    stretching = false
    if (sim !== simulation) return // restarted meanwhile
    const rowOf = new Uint32Array(sim.particleCount)
    for (let row = 0; row < sim.particleCount; row++)
      rowOf[both[(sim.particleCount + row) * 4 + 1]] = row
    let sum = 0
    let worst = 0
    for (const [a, b, rest] of sim.springs) {
      const i = rowOf[a] * 4
      const j = rowOf[b] * 4
      const far = Math.hypot(
        both[i] - both[j],
        both[i + 1] - both[j + 1],
        both[i + 2] - both[j + 2],
      )
      const longer = (far / rest - 1) * 100
      sum += longer
      worst = Math.max(worst, longer)
    }
    stats.stretch = sum / sim.springs.length
    stats.worst = worst
  }
  function read() {
    reading = true
    readback.mapAsync(GPUMapMode.READ).then(() => {
      const [begin, end] = new BigUint64Array(readback.getMappedRange(), 0, 2)
      readback.unmap()
      reading = false
      if (end > begin) {
        const ms = Number(end - begin) / 1e6
        stats.gpu = Number.isNaN(stats.gpu) ? ms : 0.7 * stats.gpu + 0.3 * ms
      }
    }, showError)
  }

  restart()

  // ?profile=120 in the address: once ?after=600 steps have run, time every shader of the next 120
  // steps on the GPU clock, each in a pass of its own, and write under the title how many ms of a
  // step each one takes, on average. Shaders with the same name are added up: the three of the
  // sum, the six rounds.
  const profileSteps = hasClock && query.has('profile') ? Number(query.get('profile')) || 120 : 0
  const profileAfter = Number(query.get('after')) || 600
  const profileClock = profileSteps
    ? device.createQuerySet({ type: 'timestamp', count: 2 * MAX_PASSES })
    : undefined
  const profileResolved = device.createBuffer({
    size: 16 * MAX_PASSES,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })
  const profiled = {
    sent: 0,
    read: 0,
    ms: new Map<string, number>(),
    whole: Number.NaN, // a step in one pass, as the panel showed it just before
  }
  /** The positions as they are now, read back from the GPU: x, y, z and 1 / mass each. */
  async function positionsOf(sim: Simulation) {
    const size = sim.particleCount * 16
    const back = device.createBuffer({
      size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    })
    const encoder = device.createCommandEncoder()
    encoder.copyBufferToBuffer(sim.positionBuffer, 0, back, 0, size)
    device.queue.submit([encoder.finish()])
    await back.mapAsync(GPUMapMode.READ)
    const p = new Float32Array(back.getMappedRange().slice(0))
    back.destroy()
    return p
  }

  /**
   * How still the particles are: how far each one goes in about a second, as a speed. Not with
   * the particles kept in order, which moves them to other rows between the two readings.
   */
  async function rest(sim: Simulation) {
    const from = sim.substepCount
    const before = await positionsOf(sim)
    while (sim.substepCount < from + 60 * settings.substeps)
      await new Promise((done) => setTimeout(done, 50))
    const after = await positionsOf(sim)
    const seconds = ((sim.substepCount - from) / settings.substeps) * STEP
    let fast = 0
    let slow = 0
    let fastest = 0
    let height = 0
    for (let i = 0; i < sim.particleCount; i++) {
      const speed =
        Math.hypot(
          after[i * 4] - before[i * 4],
          after[i * 4 + 1] - before[i * 4 + 1],
          after[i * 4 + 2] - before[i * 4 + 2],
        ) / seconds
      if (speed > 0.1) fast++
      if (speed > 0.01) slow++
      fastest = Math.max(fastest, speed)
      height += after[i * 4 + 1] / sim.particleCount
    }
    return (
      `rest: over ${seconds.toFixed(2)} s, ${fast} particles faster than 10 cm/s, ${slow} faster ` +
      `than 1 cm/s, the fastest at ${(100 * fastest).toFixed(1)} cm/s, mean height ${height.toFixed(4)} m`
    )
  }

  /**
   * How deep the particles are into each other now: the positions are read back, and every pair
   * closer than a diameter is measured in JavaScript, with a grid of its own.
   */
  async function overlaps(sim: Simulation) {
    // The positions and, with sizes, the properties, copied at the same moment: kept in order, the
    // particles change rows from one substep to the next.
    const size = sim.particleCount * 16
    const back = device.createBuffer({
      size: 2 * size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    })
    const encoder = device.createCommandEncoder()
    encoder.copyBufferToBuffer(sim.positionBuffer, 0, back, 0, size)
    if (sim.propertiesBuffer) encoder.copyBufferToBuffer(sim.propertiesBuffer, 0, back, size, size)
    device.queue.submit([encoder.finish()])
    await back.mapAsync(GPUMapMode.READ)
    const both = new Float32Array(back.getMappedRange().slice(0))
    back.destroy()
    const p = both.subarray(0, sim.particleCount * 4)
    const sized = sim.propertiesBuffer !== undefined
    const radiusOf = (i: number) => (sized ? both[(sim.particleCount + i) * 4] : RADIUS)
    const cellOf = (i: number, a: number) => Math.floor(p[i * 4 + a] / DIAMETER) + 4096
    const key = (x: number, y: number, z: number) => (x * 8192 + y) * 8192 + z
    const grid = new Map<number, number[]>()
    for (let i = 0; i < sim.particleCount; i++) {
      const k = key(cellOf(i, 0), cellOf(i, 1), cellOf(i, 2))
      const cell = grid.get(k)
      if (cell) cell.push(i)
      else grid.set(k, [i])
    }
    let touching = 0
    let deep = 0
    let deepest = 0
    let half = 0 // pairs deeper than half the smaller radius
    let share = 0 // the deepest, as a share of the smaller radius
    for (let i = 0; i < sim.particleCount; i++)
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++)
            for (const j of grid.get(
              key(cellOf(i, 0) + dx, cellOf(i, 1) + dy, cellOf(i, 2) + dz),
            ) ?? []) {
              if (j <= i) continue
              const depth =
                radiusOf(i) +
                radiusOf(j) -
                Math.hypot(
                  p[i * 4] - p[j * 4],
                  p[i * 4 + 1] - p[j * 4 + 1],
                  p[i * 4 + 2] - p[j * 4 + 2],
                )
              if (depth <= 0) continue
              touching++
              // deep: by more than a tenth of the smaller radius, 1 cm with one size
              const smaller = Math.min(radiusOf(i), radiusOf(j))
              if (depth > 0.1 * smaller) deep++
              if (depth > 0.5 * smaller) half++
              share = Math.max(share, depth / smaller)
              deepest = Math.max(deepest, depth)
            }
    return (
      `overlaps: ${touching} pairs closer than ${sized ? 'their two radii' : 'a diameter'}, ${deep} of them by more than ` +
      `${sized ? 'a tenth of the smaller radius' : `${RADIUS * 10} cm`}, the deepest by ${(deepest * 100).toFixed(1)} cm${sized ? `, ${half} by more than half of it, at most ${(share * 100).toFixed(0)}% of it` : ''}`
    )
  }

  /** Reads the clock entries of one step. */
  async function readProfile(back: GPUBuffer, names: string[]) {
    await back.mapAsync(GPUMapMode.READ)
    const data = back.getMappedRange()
    const times = new BigUint64Array(data, 0, 2 * names.length)
    names.forEach((name, k) => {
      const ms = Number(times[2 * k + 1] - times[2 * k]) / 1e6
      profiled.ms.set(name, (profiled.ms.get(name) ?? 0) + ms)
    })
    back.destroy()
    if (++profiled.read < profileSteps) return
    const total = [...profiled.ms.values()].reduce((a, b) => a + b, 0) / profileSteps
    const lines = [
      `profile ${settings.cells}: ${settings.particles} particles, ${profileSteps} steps after ` +
        `${profileAfter}, ${settings.substeps} substeps, margin ${margin} m, cells of ${cellWidth()} m${query.has('hash') ? `, hash ${query.get('hash')}` : ''}${settings.cells === 'table' ? `, ${slotsEach} slots each` : ''}${IN_ORDER ? ', particles in order' : ''}`,
      ...[...profiled.ms].map(
        ([name, ms]) =>
          `${name.padEnd(8)} ${(ms / profileSteps).toFixed(3).padStart(7)} ms  ` +
          `${((100 * ms) / profileSteps / total).toFixed(0).padStart(3)}%`,
      ),
      `${'total'.padEnd(8)} ${total.toFixed(3).padStart(7)} ms`,
      `a step in one pass, just before: ${profiled.whole.toFixed(2)} ms`,
      simulation ? await overlaps(simulation) : '',
      simulation && !IN_ORDER ? await rest(simulation) : '',
    ]
    const note = document.createElement('pre')
    note.id = 'profile'
    note.textContent = lines.join('\n')
    document.querySelector('.crumb')?.append(note)
  }

  // ?drawtime=60 in the address: once ?after=600 steps have run, read 60 times how long a frame's
  // drawing takes on the GPU clock, and write under the title the middle one of them, with the
  // lowest and the highest. To compare the ways of drawing, one page load each.
  const drawReadings = hasClock && query.has('drawtime') ? Number(query.get('drawtime')) || 60 : 0
  const drawTimes: number[] = []
  function reportDrawTimes() {
    const sorted = [...drawTimes].sort((a, b) => a - b)
    const size = renderer.getDrawingBufferSize(new Vector2())
    const note = document.createElement('pre')
    note.id = 'drawtime'
    note.textContent =
      `drawtime: draw ${settings.draw}, shadows ${shadowed() ? `${settings.shadows}, map ${stage.mapSize}` : 'off'}, ` +
      `${settings.particles} particles, canvas ${size.x} × ${size.y}: ` +
      `median ${sorted[sorted.length >> 1].toFixed(2)} ms, from ${sorted[0].toFixed(2)} to ` +
      `${sorted[sorted.length - 1].toFixed(2)}, ${sorted.length} readings`
    document.querySelector('.crumb')?.append(note)
  }

  let last: number | undefined
  let frame = 0
  let drawn = 0
  let timing = false
  renderer.setAnimationLoop((now) => {
    fps.begin()
    const dt = last === undefined ? 0 : Math.min((now - last) / 1000, 0.1)
    last = now
    orbit.update()
    if (!paused) followTilt(dt)
    if (simulation) {
      const sim = simulation
      // A fixed step of 1/60 s: as many as real time asks, two per frame at most.
      if (!paused) owed += dt
      let steps = 0
      while (owed >= STEP && steps < MAX_STEPS_PER_FRAME) {
        owed -= STEP
        steps++
      }
      if (owed >= STEP) owed = 0 // the GPU cannot keep up: slow down rather than pile up
      moveBall(steps, sim.substeps, settings.ball)
      const sample = steps > 0 && !reading && frame++ % SAMPLE_EVERY === 0
      // the first step of this frame is profiled, if ?profile asks and the wait is over
      const profile =
        profileClock &&
        steps > 0 &&
        profiled.sent < profileSteps &&
        sim.substepCount >= profileAfter * sim.substeps
          ? { clock: profileClock, names: [] as string[] }
          : undefined
      if (profile && profiled.sent++ === 0) profiled.whole = stats.gpu
      const encoder = device.createCommandEncoder()
      for (let s = 0; s < steps; s++)
        sim.encode(
          encoder,
          ballPath,
          s * sim.substeps,
          sample && s === 0 && !profile ? stamps : undefined,
          s === 0 ? profile : undefined,
        )
      let profileBack: GPUBuffer | undefined
      if (profile) {
        const size = 16 * profile.names.length
        profileBack = device.createBuffer({
          size,
          usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        })
        encoder.resolveQuerySet(profile.clock, 0, 2 * profile.names.length, profileResolved, 0)
        encoder.copyBufferToBuffer(profileResolved, 0, profileBack, 0, size)
      }
      if (sample && stamps) {
        encoder.resolveQuerySet(stamps, 0, 2, resolved, 0)
        encoder.copyBufferToBuffer(resolved, 0, readback, 0, 16)
      }
      device.queue.submit([encoder.finish()])
      if (sample && stamps) read()
      if (sample) readStretch(sim).catch(showError)
      if (profile && profileBack) readProfile(profileBack, profile.names).catch(showError)
    }
    // Same queue, same order: the steps sent above run before this drawing reads the positions.
    if (deferred()) stage.render(camera)
    else if (forward()) stage.renderForward(camera)
    else renderer.render(scene, camera)
    // Every SAMPLE_EVERY frames, ask three.js how long its passes took on the GPU: all the passes
    // of the last frame, added up. With ?drawtime, once the wait is over, at every frame it can.
    const measuring =
      drawTimes.length < drawReadings &&
      simulation !== undefined &&
      simulation.substepCount >= profileAfter * simulation.substeps
    if (hasClock && !timing && (measuring || drawn++ % SAMPLE_EVERY === 0)) {
      timing = true
      renderer.resolveTimestampsAsync('render').then((ms) => {
        timing = false
        if (typeof ms !== 'number' || !(ms > 0)) return
        stats.draw = Number.isNaN(stats.draw) ? ms : 0.7 * stats.draw + 0.3 * ms
        if (measuring && drawTimes.push(ms) === drawReadings) reportDrawTimes()
      }, showError)
    }
    fps.end()
  })
}

start().catch(showError)
