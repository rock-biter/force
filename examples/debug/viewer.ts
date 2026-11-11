// The debug viewer: a three.js scene that draws a FORCE world while we build the engine. A tool for
// us, not part of the npm package. three.js draws on the same GPU device the world simulates on
// (decision 010), so the particles go from the simulation to the screen with no copy through the CPU.

import { requestGPUDevice, type World } from 'force-gpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  AxesHelper,
  Color,
  GridHelper,
  PerspectiveCamera,
  Scene,
  WebGPURenderer,
} from 'three/webgpu'
import { type Controls, Panel, type Stats } from './panel.js'
import { ParticleView } from './particles.js'

type Vec3 = [number, number, number]

export interface DebugViewerOptions {
  /**
   * Builds the world to show, on the viewer's device and with the panel's step and substeps.
   * Called again on every restart.
   */
  create(device: GPUDevice, settings: { step: number; substeps: number }): Promise<World>
  /** Where the camera starts and what it looks at, in meters. */
  camera?: { position: Vec3; target: Vec3 }
  /** Particle radius in meters, for drawing only. Default: 0.05. */
  radius?: number
}

export async function startDebugViewer(options: DebugViewerOptions): Promise<void> {
  // One device for both: FORCE asks for it, three.js receives it.
  const device = await requestGPUDevice()
  const renderer = new WebGPURenderer({ device, antialias: true })
  await renderer.init()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.append(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0xd8d8d8)
  scene.add(new GridHelper(20, 20, 0x888888, 0xb0b0b0)) // cells of 1 m
  scene.add(new AxesHelper(1)) // 1 m long: X red, Y green, Z blue

  const { position = [6, 4, 10], target = [0, 1, 0] } = options.camera ?? {}
  const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200)
  camera.position.set(...position)
  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.target.set(...target)
  orbit.update()

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const controls: Controls = { step: 1 / 60, substeps: 1, radius: options.radius ?? 0.05 }
  const stats: Stats = {
    particles: 0,
    time: 0,
    steps: 0,
    stepsLastFrame: 0,
    cpuMs: 0,
    heapMb: Number.NaN,
    gpuMb: 0,
  }
  let world: World | undefined
  let particles: ParticleView | undefined
  let paused = false

  // Swaps in a fresh world. Restarts queue up, so two never run at once.
  let restarting = Promise.resolve()
  const restart = () => {
    restarting = restarting
      .then(async () => {
        const { step, substeps } = controls
        const next = await options.create(device, { step, substeps })
        if (particles) {
          scene.remove(particles.mesh)
          particles.dispose()
        }
        world?.destroy() // the device stays: FORCE did not create it
        world = next
        particles = new ParticleView(renderer, world)
        scene.add(particles.mesh)
      })
      .catch(showError)
  }

  const panel = new Panel(controls, stats, {
    togglePause: () => {
      paused = !paused
      return paused
    },
    stepOnce: () => {
      // The time of one step adds exactly one: what is left from earlier frames is less than a step.
      if (world && paused) world.update(world.step)
    },
    restart,
  })

  restart()

  let last: number | undefined
  renderer.setAnimationLoop((now) => {
    panel.beginFrame()
    const start = performance.now()
    // The loop gives milliseconds; the engine wants seconds.
    const frameTime = last === undefined ? 0 : (now - last) / 1000
    last = now

    if (world && particles) {
      stats.stepsLastFrame = paused ? 0 : world.update(frameTime)
      stats.particles = world.particleCount
      stats.time = world.time
      stats.steps = world.stepCount
      particles.radius.value = controls.radius
    }
    // Same queue, same order: the steps sent above run before this drawing reads the positions.
    renderer.render(scene, camera)

    stats.cpuMs = performance.now() - start
    stats.heapMb = heapMegabytes()
    stats.gpuMb = renderer.info.memory.total / 1e6
    panel.endFrame()
  })
}

/** Writes an error on the page, where it cannot be missed. */
export function showError(error: unknown): void {
  const output = document.createElement('pre')
  output.textContent = `FAILED: ${error}`
  output.style.cssText = 'position:fixed;top:0;left:0;margin:16px;color:#b00020'
  document.body.append(output)
}

/** The JavaScript heap in megabytes: `performance.memory` is Chrome's own, outside the standard. */
function heapMegabytes(): number {
  const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory
  return memory ? memory.usedJSHeapSize / 1e6 : Number.NaN
}
