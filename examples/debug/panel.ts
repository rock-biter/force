// The debug panel, built with Tweakpane: the controls of the simulation and a few live numbers.

import type { ButtonGridApi, FpsGraphBladeApi } from '@tweakpane/plugin-essentials'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import { Pane } from 'tweakpane'

/** What the panel changes. The viewer reads it every frame. */
export interface Controls {
  /** Seconds of simulated time per step. */
  step: number
  substeps: number
  /** Particle radius in meters, for drawing only. */
  radius: number
}

/** What the panel shows. The viewer writes it every frame, and the panel polls it. */
export interface Stats {
  particles: number
  /** Seconds of simulated time. */
  time: number
  steps: number
  stepsLastFrame: number
  /** Milliseconds the CPU spent on the last frame: simulation and drawing commands, not the GPU. */
  cpuMs: number
  /** JavaScript heap in megabytes. Chrome only: other browsers do not tell. */
  heapMb: number
  /** GPU memory three.js knows it is using, in megabytes. The world's other buffers are not in it. */
  gpuMb: number
}

export interface PanelActions {
  /** Pauses or resumes, and returns whether the simulation is now paused. */
  togglePause(): boolean
  /** Runs exactly one step, while paused. */
  stepOnce(): void
  /** Builds the world again from the start, with the current controls. */
  restart(): void
}

const STEP_OPTIONS = { '1/30 s': 1 / 30, '1/60 s': 1 / 60, '1/120 s': 1 / 120, '1/240 s': 1 / 240 }

export class Panel {
  private readonly fps: FpsGraphBladeApi

  constructor(controls: Controls, stats: Stats, actions: PanelActions) {
    const pane = new Pane({ title: 'FORCE debug' })
    pane.registerPlugin(EssentialsPlugin)

    // Simulation
    const simulation = pane.addFolder({ title: 'Simulation' })
    const buttons = simulation.addBlade({
      view: 'buttongrid',
      size: [3, 1],
      cells: (x: number) => ({ title: ['pause', 'step', 'restart'][x] }),
    }) as ButtonGridApi
    const stepButton = buttons.cell(1, 0)
    if (stepButton) stepButton.disabled = true // only while paused
    buttons.on('click', ({ index: [x] }) => {
      if (x === 0) {
        const paused = actions.togglePause()
        const pauseButton = buttons.cell(0, 0)
        if (pauseButton) pauseButton.title = paused ? 'resume' : 'pause'
        if (stepButton) stepButton.disabled = !paused
      } else if (x === 1) {
        actions.stepOnce()
      } else {
        actions.restart()
      }
    })
    // A new step or substep count starts the world again: every run starts from the same state.
    simulation.addBinding(controls, 'step', { options: STEP_OPTIONS }).on('change', actions.restart)
    simulation
      .addBinding(controls, 'substeps', { min: 1, max: 16, step: 1 })
      .on('change', actions.restart)
    simulation.addBinding(controls, 'radius', { min: 0.01, max: 0.5 })

    // World
    const world = pane.addFolder({ title: 'World' })
    world.addBinding(stats, 'particles', { readonly: true, format: (v) => v.toFixed(0) })
    world.addBinding(stats, 'time', { readonly: true, format: (v) => `${v.toFixed(2)} s` })
    world.addBinding(stats, 'steps', { readonly: true, format: (v) => v.toFixed(0) })
    world.addBinding(stats, 'stepsLastFrame', {
      label: 'steps/frame',
      readonly: true,
      format: (v) => v.toFixed(0),
    })

    // Performance
    const performance = pane.addFolder({ title: 'Performance' })
    this.fps = performance.addBlade({ view: 'fpsgraph', label: 'fps', rows: 2 }) as FpsGraphBladeApi
    performance.addBinding(stats, 'cpuMs', {
      label: 'cpu',
      readonly: true,
      view: 'graph',
      min: 0,
      max: 16,
      format: (v) => `${v.toFixed(2)} ms`,
    })
    performance.addBinding(stats, 'heapMb', {
      label: 'js heap',
      readonly: true,
      format: (v) => (Number.isNaN(v) ? 'n/a' : `${v.toFixed(1)} MB`),
    })
    performance.addBinding(stats, 'gpuMb', {
      label: 'three gpu',
      readonly: true,
      format: (v) => `${v.toFixed(2)} MB`,
    })
  }

  /** Call at the start of every frame, for the fps graph. */
  beginFrame(): void {
    this.fps.begin()
  }

  /** Call at the end of every frame, for the fps graph. */
  endFrame(): void {
    this.fps.end()
  }
}
