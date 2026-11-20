// Every way of pushing touching particles apart, side by side. Each pane runs one method on its
// own copy of the scene, in JavaScript, and three.js draws all eight on one canvas: the canvas is
// cleared once per frame, then each pane is drawn inside its own rectangle (viewport and scissor).
// One camera for all, so every pane is seen from the same point.

import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MeshStandardMaterial,
  PerspectiveCamera,
  SphereGeometry,
  Scene as ThreeScene,
  WebGPURenderer,
} from 'three/webgpu'
import {
  DEFAULT_PANES,
  FORCE_PLUS,
  METHODS,
  measure,
  RADIUS,
  STEP,
  tunable,
  type World,
} from './methods.js'
import { SCENES, type Scene } from './scenes.js'

const stage = document.getElementById('stage') as HTMLElement
const panesElement = document.getElementById('panes') as HTMLElement
const sceneSelect = document.getElementById('scene') as HTMLSelectElement
const timeLabel = document.getElementById('time') as HTMLElement

/** Light blue for 1 kg, red for 100 kg, on a log scale; grey for spheres that never move. */
function colorOf(mass: number): Color {
  if (!Number.isFinite(mass)) return new Color(0x8a8a8a)
  const t = Math.min(Math.max(Math.log10(mass) / 2, 0), 1)
  return new Color(0x4ea3ff).lerp(new Color(0xd1495b), t)
}

class Pane {
  readonly element = document.createElement('div')
  readonly select = document.createElement('select')
  private readonly source = document.createElement('div')
  private readonly stats = document.createElement('div')
  scene = new ThreeScene()
  private mesh?: InstancedMesh
  private outline?: LineSegments
  private script?: (world: World, time: number) => void
  private world!: World
  private stepper!: (world: World) => void
  private spec!: Scene
  private time = 0
  /** Milliseconds of JavaScript per step, averaged as it goes. */
  private cost = 0
  private released = false

  constructor(
    public method: string,
    onChange: () => void,
  ) {
    this.element.className = 'pane'
    this.source.className = 'source'
    this.stats.className = 'stats'
    for (const [key, m] of Object.entries(METHODS)) this.select.add(new Option(m.label, key))
    this.select.value = method
    this.select.addEventListener('change', () => {
      this.method = this.select.value
      onChange()
    })
    this.element.append(this.select, this.source, this.stats)
    panesElement.append(this.element)
  }

  /** Starts the scene again from the beginning, with this pane's method. */
  reset(spec: Scene) {
    this.spec = spec
    this.time = 0
    this.released = false
    const m = METHODS[this.method]
    this.source.textContent = m.source
    this.stepper = m.create()
    this.world = {
      x: spec.positions.map((p) => [...p]),
      v: spec.positions.map((_, i) => [...(spec.velocities?.[i] ?? [0, 0, 0])]),
      w: spec.masses.map((mass, i) =>
        i === spec.release?.index || !Number.isFinite(mass) ? 0 : 1 / mass,
      ),
      planes: [...spec.planes],
    }
    this.script = spec.script?.()

    this.scene = new ThreeScene()
    this.scene.add(new HemisphereLight(0xffffff, 0x777788, 2))
    const sun = new DirectionalLight(0xffffff, 2)
    sun.position.set(2, 5, 3)
    this.scene.add(sun)
    if (spec.planes.some((p) => p.normal[1] > 0.5))
      this.scene.add(new GridHelper(4, 20, 0x999999, 0xcccccc))
    this.outline = undefined
    if (spec.walls) {
      const { half, height = 1.4, center, turn } = spec.walls
      const edges = new LineSegments(
        new EdgesGeometry(new BoxGeometry(2 * half, height, 2 * half)),
        new LineBasicMaterial({ color: 0x777777 }),
      )
      edges.position.set(...(center ?? [0, height / 2, 0]))
      edges.rotation.y = (turn * Math.PI) / 180
      this.scene.add(edges)
      this.outline = edges
    }
    this.mesh = new InstancedMesh(
      new SphereGeometry(RADIUS, 16, 12),
      new MeshStandardMaterial({ roughness: 0.6 }),
      spec.positions.length,
    )
    const mesh = this.mesh
    // three.js skips an instanced mesh whose instances it believes are out of view, from where they
    // were when first drawn. Particles that wait far below and then rain in would stay hidden.
    mesh.frustumCulled = false
    for (const [i, mass] of spec.masses.entries()) mesh.setColorAt(i, colorOf(mass))
    this.scene.add(mesh)
    this.draw()
  }

  step() {
    this.script?.(this.world, this.time)
    const { release } = this.spec
    if (release && !this.released && this.time >= release.at) {
      this.world.w[release.index] = 1 / this.spec.masses[release.index]
      this.released = true
    }
    const start = performance.now()
    this.stepper(this.world)
    this.cost += (performance.now() - start - this.cost) * 0.05
    this.time += STEP
  }

  /** Copies the positions into the instances. */
  draw() {
    const spin = this.spec.walls?.spin
    if (this.outline && spin) this.outline.rotation[spin.axis] = spin.speed * this.time
    if (!this.mesh) return
    const matrix = new Matrix4()
    for (const [i, [x, y, z]] of this.world.x.entries())
      this.mesh.setMatrixAt(i, matrix.makeTranslation(x, y, z))
    this.mesh.instanceMatrix.needsUpdate = true
  }

  measure() {
    const { deepest, moving } = measure(this.world)
    let text = `deepest ${(deepest * 1000).toFixed(1)} mm · moving ${moving} · ${this.cost.toFixed(1)} ms/step in JS`
    if (this.spec.drift) {
      // the mean sideways speed of the particles that move: the pair's drift
      const mobile = this.world.v.filter((_, i) => this.world.w[i])
      const drift = mobile.reduce((sum, v) => sum + v[0], 0) / mobile.length
      text += ` · drift ${drift.toFixed(2)} m/s`
    }
    this.stats.textContent = text
  }
}

async function start() {
  const renderer = new WebGPURenderer({ antialias: true })
  await renderer.init()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0xe9e9e9)
  renderer.autoClear = false // cleared once per frame, then each pane draws in its own rectangle
  stage.prepend(renderer.domElement)

  const camera = new PerspectiveCamera(40, 1, 0.05, 100)
  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.enableDamping = true

  // the scene menu, in two groups
  for (const [kind, title] of [
    ['moving', 'Moving, after Box2D'],
    ['settling', 'Settling'],
  ] as const) {
    const group = document.createElement('optgroup')
    group.label = title
    for (const [key, make] of Object.entries(SCENES)) {
      const scene = make()
      if (scene.kind === kind) group.append(new Option(scene.label, key))
    }
    sceneSelect.append(group)
  }
  const params = new URLSearchParams(location.search)
  if (params.get('scene') && SCENES[params.get('scene') as string])
    sceneSelect.value = params.get('scene') as string

  const panes: Pane[] = []
  const restart = () => {
    const spec = SCENES[sceneSelect.value]()
    for (const pane of panes) pane.reset(spec)
    camera.position.set(...spec.camera.position)
    orbit.target.set(...spec.camera.target)
    elapsed = 0
  }
  for (const method of DEFAULT_PANES) panes.push(new Pane(method, () => restart()))

  let paused = false
  let slow = false
  let elapsed = 0
  let owed = 0
  let frames = 0
  sceneSelect.addEventListener('change', restart)
  document.getElementById('restart')?.addEventListener('click', restart)
  const pauseButton = document.getElementById('pause') as HTMLButtonElement
  pauseButton.addEventListener('click', () => {
    paused = !paused
    pauseButton.textContent = paused ? 'Play' : 'Pause'
  })
  const slowBox = document.getElementById('slow') as HTMLInputElement
  slowBox.addEventListener('change', () => {
    slow = slowBox.checked
  })
  restart()

  // The knobs of FORCE+ tunable: they act at the next step, with no restart.
  const knobs: [keyof typeof tunable, number][] = [
    ['alpha', 2],
    ['levels', 2],
    ['rounds', 0],
    ['substeps', 0],
  ]
  const show = () => {
    for (const [key, digits] of knobs) {
      const input = document.getElementById(key) as HTMLInputElement
      input.value = String(tunable[key])
      const output = input.nextElementSibling
      if (output instanceof HTMLOutputElement) output.value = tunable[key].toFixed(digits)
    }
  }
  for (const [key] of knobs) {
    const input = document.getElementById(key) as HTMLInputElement
    input.addEventListener('input', () => {
      const value = Number(input.value)
      if (!Number.isFinite(value) || input.value === '') return
      tunable[key] = key === 'rounds' || key === 'substeps' ? Math.max(1, Math.round(value)) : value
      show()
    })
  }
  document.getElementById('defaults')?.addEventListener('click', () => {
    Object.assign(tunable, FORCE_PLUS)
    show()
  })
  show()

  const resize = () => renderer.setSize(stage.clientWidth, stage.clientHeight, false)
  window.addEventListener('resize', resize)
  resize()

  let last = performance.now()
  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    if (!paused) {
      // a fixed step of 1/60 s: as many as real time asks, two per frame at most
      owed += dt * (slow ? 0.25 : 1)
      let steps = 0
      while (owed >= STEP && steps < 2) {
        for (const pane of panes) pane.step()
        owed -= STEP
        elapsed += STEP
        steps++
      }
      if (steps === 2) owed = 0 // the CPU cannot keep up: slow down rather than pile up
      for (const pane of panes) pane.draw()
    }
    if (frames++ % 15 === 0) for (const pane of panes) pane.measure()
    timeLabel.textContent = `${elapsed.toFixed(2)} s simulated`
    orbit.update()

    renderer.setScissorTest(false)
    renderer.clear()
    renderer.setScissorTest(true)
    const box = renderer.domElement.getBoundingClientRect()
    for (const pane of panes) {
      const r = pane.element.getBoundingClientRect()
      const x = r.left - box.left
      const y = r.top - box.top
      renderer.setViewport(x, y, r.width, r.height)
      renderer.setScissor(x, y, r.width, r.height)
      camera.aspect = r.width / r.height
      camera.updateProjectionMatrix()
      renderer.render(pane.scene, camera)
    }
  })
}

start().catch((error: unknown) => {
  const box = document.createElement('pre')
  box.id = 'error'
  box.textContent = `Failed: ${error instanceof Error ? error.message : String(error)}`
  stage.append(box)
})
