// FORCE+ on the GPU, live. Up to 100 000 particles in a box as big as the grid, pushed apart by
// moving their positions with half and half, masses seen as m^α and levels in the pile (decision
// 015), through lists of neighbours made when needed (decision 016). The pointer pushes them away
// with a ball. The shaders come from contact-cost, where they were checked against JavaScript; only
// the round is this page's own, the same one plus the ball. three.js draws the particles straight
// from the position buffer, on the same device (decision 012).

import type { ButtonGridApi, FpsGraphBladeApi } from '@tweakpane/plugin-essentials'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
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
import finishCode from '../contact-cost/finish.wgsl?raw'
import gridIfCode from '../contact-cost/grid-if.wgsl?raw'
import levelsListCode from '../contact-cost/levels-list.wgsl?raw'
import listCode from '../contact-cost/list.wgsl?raw'
import predictCode from '../contact-cost/predict.wgsl?raw'
import rebuildCode from '../contact-cost/rebuild.wgsl?raw'
import watchCode from '../contact-cost/watch.wgsl?raw'
import { ParticleView } from '../debug/particles.js'
import { showError } from '../debug/viewer.js'
import roundPushCode from './round-push.wgsl?raw'

type Vec3 = [number, number, number]

const RADIUS = 0.1 // meters, as in every scene since chapter 025
const DIAMETER = 2 * RADIUS
const CELL = DIAMETER // a cell as wide as a particle (chapter 024)
const PLACES = 4 // per cell (decision 016)
const STEP = 1 / 60 // seconds
const GRAVITY = 9.81
const ROUNDS = 8 // decision 015
const MARGIN = 0.05 // the lists look 5 cm beyond touching (decision 016)
const MAX_NEIGHBOURS = 32 // as in list.wgsl
const NO_LEVEL = 0xffffffff
const HALF = 12 // the box is 24 m by 24 m on the floor...
const SIZE: Vec3 = [120, 45, 120] // ...and the grid fills it: 120 cells of 20 cm, 9 m tall
const GAP = 0.01 // between particles at the start, in meters
const LAYERS = 28 // at most, at the start: about 5.9 m, well inside the grid's 9 m
const BALL_RADIUS = 2 // meters, at the start: the panel changes it
const BALL_FOLLOW = 0.1 // the share of the way to the pointer the ball covers at each step
const BALL_SPEED = 20 // m/s: the fastest the ball moves, however far the pointer jumps
const BALL_GROWTH = 8 // m/s: how fast its radius grows or shrinks
const MAX_STEPS_PER_FRAME = 2
const MAX_SUBSTEPS = 8
const SAMPLE_EVERY = 30 // frames between two readings of the GPU's numbers
const FORCE_PLUS = { alpha: 0.5, levels: 2, substeps: 1 } // decision 015: 8 rounds per step
// The choices of the masses menu: the lightest and the heaviest, in kg. Only their ratio changes
// what the solver does: gravity pulls every mass alike, and a contact shares by w_i / (w_i + w_j).
const MASSES: Record<string, readonly [number, number]> = {
  '1 kg': [1, 1],
  '1 to 10 kg': [1, 10],
  '1 to 100 kg': [1, 100],
}

// The floor and four walls, as in contact-cost: the normal in xyz, the offset in w.
const PLANES = [
  [0, 1, 0, 0],
  [1, 0, 0, -HALF],
  [-1, 0, 0, -HALF],
  [0, 0, 1, -HALF],
  [0, 0, -1, -HALF],
]

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
  const side = Math.max(Math.ceil(Math.cbrt(count)), Math.ceil(Math.sqrt(count / LAYERS)))
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

/** The compute pipelines, made once: every restart uses them again. */
async function makePipelines(device: GPUDevice) {
  const make = (code: string) =>
    device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code: commonCode + code }) },
    })
  const [predict, watch, clearIf, gridIf, list, levels, round, finish] = await Promise.all(
    [
      predictCode,
      watchCode,
      rebuildCode + clearIfCode,
      rebuildCode + gridIfCode,
      rebuildCode + listCode,
      levelsListCode,
      roundPushCode,
      finishCode,
    ].map(make),
  )
  return { predict, watch, clearIf, gridIf, list, levels, round, finish }
}
type Pipelines = Awaited<ReturnType<typeof makePipelines>>

/**
 * The particles on the GPU and how to encode one step of them: the step of contact-cost's part 4,
 * with the list made when needed.
 */
function makeSimulation(
  device: GPUDevice,
  kit: Pipelines,
  pointer: GPUBuffer,
  count: number,
  masses: readonly [number, number],
) {
  const start = cube(count, masses)
  const bytes = start.byteLength
  const cellCount = SIZE[0] * SIZE[1] * SIZE[2]
  const buffers: GPUBuffer[] = []
  const storage = (size: number, extra = 0) => {
    const buffer = device.createBuffer({
      size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | extra,
    })
    buffers.push(buffer)
    return buffer
  }
  const positions = storage(bytes)
  const velocities = storage(bytes)
  const predicted = [storage(bytes), storage(bytes)]
  const counts = storage(cellCount * 4)
  const places = storage(cellCount * PLACES * 4)
  const levels = [storage(count * 4), storage(count * 4)]
  const planes = storage(PLANES.length * 16)
  const neighbours = storage(count * MAX_NEIGHBOURS * 4)
  const neighbourCounts = storage(count * 4)
  const anchors = storage(bytes)
  const control = storage(32, GPUBufferUsage.COPY_SRC) // see rebuild.wgsl
  const params = device.createBuffer({
    size: 80,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  buffers.push(params)

  device.queue.writeBuffer(positions, 0, start)
  for (const b of levels) device.queue.writeBuffer(b, 0, new Uint32Array(count).fill(NO_LEVEL))
  device.queue.writeBuffer(planes, 0, new Float32Array(PLANES.flat()))
  // A list asked for at the first step; from then on the GPU decides by itself.
  device.queue.writeBuffer(control, 0, new Uint32Array([1, 1, 0, 0, 0]))
  // The Params struct of common.wgsl: 80 bytes, in its order.
  const data = new ArrayBuffer(80)
  const floats = new Float32Array(data)
  const words = new Uint32Array(data)
  floats.set([0, -GRAVITY, 0, STEP, -HALF, 0, -HALF, CELL])
  words.set([...SIZE, PLACES], 8)
  floats.set([RADIUS, FORCE_PLUS.alpha, FORCE_PLUS.levels], 12)
  words[15] = PLANES.length
  floats[19] = MARGIN // 16 to 18 belong to the spring, not used here
  device.queue.writeBuffer(params, 0, data)

  const group = (p: GPUComputePipeline, entries: GPUBuffer[]) =>
    device.createBindGroup({
      layout: p.getBindGroupLayout(0),
      entries: entries.map((buffer, binding) => ({ binding, resource: { buffer } })),
    })
  const predictGroup = group(kit.predict, [params, positions, velocities, predicted[0]])
  const watchGroup = group(kit.watch, [params, predicted[0], anchors, control])
  const clearGroup = group(kit.clearIf, [params, control, counts])
  const gridGroup = group(kit.gridIf, [params, predicted[0], counts, places, control])
  const listGroup = group(kit.list, [
    params,
    predicted[0],
    counts,
    places,
    control,
    neighbours,
    neighbourCounts,
    anchors,
  ])
  // Levels alternate between two buffers, a step each; positions between two, a round each.
  const levelGroups = [0, 1].map((k) =>
    group(kit.levels, [
      params,
      predicted[0],
      neighbours,
      neighbourCounts,
      planes,
      levels[k],
      levels[1 - k],
    ]),
  )
  const roundGroups = [0, 1].map((k) =>
    [0, 1].map((from) =>
      group(kit.round, [
        params,
        predicted[from],
        predicted[1 - from],
        neighbours,
        neighbourCounts,
        planes,
        levels[1 - k],
        pointer,
      ]),
    ),
  )
  const finishGroup = group(kit.finish, [params, positions, velocities, predicted[ROUNDS % 2]])
  const workgroups = Math.ceil(count / 64)
  const cellWorkgroups = Math.ceil(cellCount / 64)
  let parity = 0
  let substeps = 1

  return {
    particleCount: count,
    radius: RADIUS,
    positionBuffer: positions,
    control,
    substepCount: 0,

    get substeps() {
      return substeps
    },

    /**
     * One step of 1/60 s, cut into substeps. Each one: predict, the list if needed, the levels, 8
     * rounds with the ball, finish. Before each substep its own ball is copied from `path`, from
     * entry `from` on, into the Pointer uniform. With a `clock`, the GPU clock is read when the
     * first substep starts and when the last one ends.
     */
    encode(encoder: GPUCommandEncoder, path: GPUBuffer, from: number, clock?: GPUQuerySet) {
      for (let s = 0; s < substeps; s++) {
        const first = s === 0
        const last = s === substeps - 1
        encoder.copyBufferToBuffer(path, (from + s) * 16, pointer, 0, 16)
        encoder.clearBuffer(control, 8, 4) // the largest move, measured again at every substep
        const pass = encoder.beginComputePass(
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
        const dispatch = (p: GPUComputePipeline, g: GPUBindGroup, n = workgroups) => {
          pass.setPipeline(p)
          pass.setBindGroup(0, g)
          pass.dispatchWorkgroups(n)
        }
        dispatch(kit.predict, predictGroup)
        dispatch(kit.watch, watchGroup)
        dispatch(kit.clearIf, clearGroup, cellWorkgroups)
        dispatch(kit.gridIf, gridGroup)
        dispatch(kit.list, listGroup)
        dispatch(kit.levels, levelGroups[parity])
        for (let r = 0; r < ROUNDS; r++) dispatch(kit.round, roundGroups[parity][r % 2])
        dispatch(kit.finish, finishGroup)
        pass.end()
        encoder.clearBuffer(control, 0, 4) // only the first substep asks for a list
        parity = 1 - parity
        this.substepCount++
      }
    },

    /**
     * α, c and the substeps, from the next step on. A substep lasts 1/60 s divided by their
     * number: predict and finish read it from the params.
     */
    setSolver(alpha: number, levelStrength: number, count: number) {
      substeps = count
      device.queue.writeBuffer(params, 3 * 4, new Float32Array([STEP / count]))
      device.queue.writeBuffer(params, 13 * 4, new Float32Array([alpha, levelStrength]))
    },

    destroy() {
      for (const b of buffers) b.destroy()
    },
  }
}
type Simulation = ReturnType<typeof makeSimulation>

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
  const kit = await makePipelines(device)

  const renderer = new WebGPURenderer({ device, antialias: true })
  await renderer.init()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.append(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0xe9e9e9)
  // Light for the ball only: the particles shade themselves (debug/particles.ts).
  scene.add(new HemisphereLight(0xffffff, 0x777788, 2))
  const sun = new DirectionalLight(0xffffff, 2)
  sun.position.set(2, 5, 3)
  scene.add(sun)
  // The floor, with a line every meter, 5 cells of the grid, and the box the grid fills.
  scene.add(new GridHelper(2 * HALF, 2 * HALF, 0xbcbcbc, 0xd4d4d4))
  const height = SIZE[1] * CELL
  const box = new LineSegments(
    new EdgesGeometry(new BoxGeometry(2 * HALF, height, 2 * HALF)),
    new LineBasicMaterial({ color: 0x9a9a9a }),
  )
  box.position.y = height / 2
  scene.add(box)

  const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200)
  camera.position.set(17, 14, 23)
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

  // The ball has its center on the floor, y = 0, under the point where the pointer meets the
  // surface of the heap: a flat plane at the height the heap will settle to, since a packed heap
  // holds about 150 particles per cubic meter. It does not jump to the pointer: in each step it
  // covers BALL_FOLLOW of the way there, a lerp, at BALL_SPEED at most, and it grows from nothing at
  // BALL_GROWTH, so it pushes particles instead of throwing them. Only a ball that has shrunk to
  // nothing comes back straight under the pointer. Only its upper half is drawn: the floor is made
  // of lines, and the lower half would show through it.
  const ball = { x: 0, z: 0, radius: 0 }
  const ballMesh = new Mesh(
    new SphereGeometry(1, 48, 12, 0, 2 * Math.PI, 0, Math.PI / 2),
    new MeshStandardMaterial({ color: 0xf2c200, roughness: 1, metalness: 0 }), // matte yellow
  )
  scene.add(ballMesh)
  const raycaster = new Raycaster()
  const surface = new Plane(new Vector3(0, 1, 0), 0)
  const hit = new Vector3()
  /**
   * Moves the ball through the `steps` steps of this frame, `substeps` each, toward the pointer and
   * toward `radius`, and writes where it is at every substep into `ballPath`.
   */
  function moveBall(count: number, steps: number, substeps: number, radius: number) {
    const top = Math.max(count / (150 * (2 * HALF) ** 2), DIAMETER)
    surface.constant = -top // the plane y = top
    raycaster.setFromCamera(screen, camera)
    const on = pointing && raycaster.ray.intersectPlane(surface, hit) !== null
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
      pathData.set([ball.x, 0, ball.z, ball.radius], k * 4)
    }
    if (steps) device.queue.writeBuffer(ballPath, 0, pathData, 0, steps * substeps * 4)
    ballMesh.visible = ball.radius > 0
    ballMesh.scale.setScalar(ball.radius)
    ballMesh.position.set(ball.x, 0, ball.z)
  }

  // ---- the simulation and the panel ----------------------------------------------------------------
  // ?particles=20000 in the address starts with that many, in thousands from 1000 to 100 000.
  const asked = Math.round(Number(new URLSearchParams(location.search).get('particles')) / 1000)
  const settings = {
    ...FORCE_PLUS,
    levels: 1.5, // a gentler start than decision 015, as in compare's tunable copy
    particles: asked >= 1 && asked <= 100 ? asked * 1000 : 20000,
    masses: '1 to 100 kg',
    ball: BALL_RADIUS,
  }
  const stats = { gpu: Number.NaN, lists: Number.NaN }
  let simulation: Simulation | undefined
  let view: ParticleView | undefined
  let paused = false
  let owed = 0 // simulated time the steps still owe to real time
  let lastReading: { lists: number; steps: number } | undefined

  function restart() {
    if (view) {
      scene.remove(view.mesh)
      view.dispose()
    }
    simulation?.destroy()
    const masses = MASSES[settings.masses]
    simulation = makeSimulation(device, kit, pointerBuffer, settings.particles, masses)
    simulation.setSolver(settings.alpha, settings.levels, settings.substeps)
    view = new ParticleView(renderer, simulation, { massRange: masses })
    scene.add(view.mesh)
    owed = 0
    lastReading = undefined
    stats.lists = Number.NaN
  }
  const applySolver = () =>
    simulation?.setSolver(settings.alpha, settings.levels, settings.substeps)

  const pane = new Pane({ title: 'FORCE+ on the GPU', expanded: window.innerWidth >= 600 })
  pane.registerPlugin(EssentialsPlugin)
  const solver = pane.addFolder({ title: 'Solver' })
  const alpha = solver
    .addBinding(settings, 'alpha', { label: 'α', min: 0, max: 1, step: 0.05 })
    .on('change', applySolver)
  const levels = solver
    .addBinding(settings, 'levels', { label: 'c', min: 0, max: 4, step: 0.25 })
    .on('change', applySolver)
  // Each substep has its own 8 rounds, so a step costs about as many times more.
  const substeps = solver
    .addBinding(settings, 'substeps', { min: 1, max: MAX_SUBSTEPS, step: 1 })
    .on('change', applySolver)
  solver.addButton({ title: 'as decision 015' }).on('click', () => {
    Object.assign(settings, FORCE_PLUS)
    alpha.refresh()
    levels.refresh()
    substeps.refresh()
    applySolver()
  })
  const particles = pane.addFolder({ title: 'Particles' })
  // A new count builds everything again, so only when the slider is let go.
  particles
    .addBinding(settings, 'particles', { label: 'count', min: 1000, max: 100000, step: 1000 })
    .on('change', (event) => {
      if (event.last) restart()
    })
  particles
    .addBinding(settings, 'masses', {
      options: Object.fromEntries(Object.keys(MASSES).map((label) => [label, label])),
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
  const ballFolder = pane.addFolder({ title: 'Ball' })
  ballFolder.addBinding(settings, 'ball', { label: 'radius', min: 0.3, max: 3, step: 0.1 })
  const numbers = pane.addFolder({ title: 'Numbers' })
  const fps = numbers.addBlade({ view: 'fpsgraph', label: 'fps', rows: 2 }) as FpsGraphBladeApi
  numbers.addBinding(stats, 'gpu', {
    label: 'GPU step',
    readonly: true,
    format: (v) => (Number.isNaN(v) ? 'n/a' : `${v.toFixed(2)} ms`),
  })
  numbers.addBinding(stats, 'lists', {
    label: 'new lists',
    readonly: true,
    format: (v) => (Number.isNaN(v) ? '…' : `${(v * 100).toFixed(0)}% of substeps`),
  })

  // ---- the GPU's numbers ---------------------------------------------------------------------------
  // Every SAMPLE_EVERY frames one step, all its substeps, is timed on the GPU clock, and the count
  // of lists made is copied out, both into one buffer JavaScript can read when the GPU is done.
  const stamps = hasClock ? device.createQuerySet({ type: 'timestamp', count: 2 }) : undefined
  const resolved = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })
  const readback = device.createBuffer({
    size: 48,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })
  let reading = false
  function read(from: Simulation) {
    reading = true
    const steps = from.substepCount
    readback.mapAsync(GPUMapMode.READ).then(() => {
      const data = readback.getMappedRange()
      const [begin, end] = new BigUint64Array(data, 0, 2)
      const lists = new Uint32Array(data, 16, 8)[3]
      readback.unmap()
      reading = false
      if (stamps && end > begin) {
        const ms = Number(end - begin) / 1e6
        stats.gpu = Number.isNaN(stats.gpu) ? ms : 0.7 * stats.gpu + 0.3 * ms
      }
      if (from !== simulation) return // restarted meanwhile
      if (lastReading && steps > lastReading.steps)
        stats.lists = (lists - lastReading.lists) / (steps - lastReading.steps)
      lastReading = { lists, steps }
    }, showError)
  }

  restart()

  let last: number | undefined
  let frame = 0
  renderer.setAnimationLoop((now) => {
    fps.begin()
    const dt = last === undefined ? 0 : Math.min((now - last) / 1000, 0.1)
    last = now
    orbit.update()
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
      moveBall(sim.particleCount, steps, sim.substeps, settings.ball)
      const sample = steps > 0 && !reading && frame++ % SAMPLE_EVERY === 0
      const encoder = device.createCommandEncoder()
      for (let s = 0; s < steps; s++)
        sim.encode(encoder, ballPath, s * sim.substeps, sample && s === 0 ? stamps : undefined)
      if (sample) {
        if (stamps) {
          encoder.resolveQuerySet(stamps, 0, 2, resolved, 0)
          encoder.copyBufferToBuffer(resolved, 0, readback, 0, 16)
        }
        encoder.copyBufferToBuffer(sim.control, 0, readback, 16, 32)
      }
      device.queue.submit([encoder.finish()])
      if (sample) read(sim)
    }
    // Same queue, same order: the steps sent above run before this drawing reads the positions.
    renderer.render(scene, camera)
    fps.end()
  })
}

start().catch(showError)
