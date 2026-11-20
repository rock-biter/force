// The scenes of chapters 025 to 030, to watch every way side by side, and four that move, after
// the benchmarks of Box2D (erincatto/box2d, shared/benchmarks.c): Rain, Spinner, Smash and Tumbler.

import { DIAMETER, type Plane, RADIUS, STEP, type Vec3, type World } from './methods.js'

export interface Scene {
  label: string
  positions: Vec3[]
  /** In kg; Infinity for a sphere that never moves. */
  masses: number[]
  velocities?: Vec3[]
  planes: Plane[]
  /** Moving or settling: the scene menu groups them. */
  kind: 'moving' | 'settling'
  /**
   * A box to draw around the particles: its half width, its height (1.4 m by default), its centre
   * (on the floor by default), how far it is turned around Y, and how fast it spins, in rad/s.
   */
  walls?: {
    half: number
    height?: number
    center?: Vec3
    turn: number
    spin?: { axis: 'x' | 'z'; speed: number }
  }
  /**
   * What moves by itself: called before every step with the world and the time, to turn the walls,
   * drive spheres along a path, or let new particles in. Made again for every pane, so all panes
   * see the same thing.
   */
  script?: () => (world: World, time: number) => void
  /** Show how fast the particles drift sideways together: it must stay 0 when nothing pushes them. */
  drift?: boolean
  /** A particle held in the air until a moment, then let go with its mass. */
  release?: { index: number; at: number }
  camera: { position: Vec3; target: Vec3 }
}

/** Repeats the same jitter at every run. */
function random(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const turn = (v: Vec3, degrees: number): Vec3 => {
  const a = (degrees * Math.PI) / 180
  return [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)]
}
const floor: Plane = { normal: [0, 1, 0], offset: 0 }
const wallsOf = (half: number, degrees = 0): Plane[] =>
  (
    [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ] as Vec3[]
  ).map((n) => ({ normal: turn(n, degrees), offset: -half }))
const boxCamera = { position: [2.4, 2.1, 2.8] as Vec3, target: [0, 0.55, 0] as Vec3 }

/** 216 spheres dropped from a loose grid into a box 1.2 m wide (chapter 026). */
function box(
  degrees = 0,
  massOf: (next: () => number) => number = () => 1,
): Omit<Scene, 'label' | 'kind'> {
  const next = random(1)
  const masses = random(3)
  const positions: Vec3[] = []
  for (let layer = 0; layer < 6; layer++)
    for (let a = 0; a < 6; a++)
      for (let b = 0; b < 6; b++)
        positions.push(
          turn(
            [
              -0.5 + a * 0.2 + (next() - 0.5) * 0.04,
              0.3 + layer * 0.22,
              -0.5 + b * 0.2 + (next() - 0.5) * 0.04,
            ],
            degrees,
          ),
        )
  return {
    positions,
    masses: positions.map(() => massOf(masses)),
    planes: [floor, ...wallsOf(0.6, degrees)],
    walls: { half: 0.6, turn: degrees },
    camera: boxCamera,
  }
}

export const SCENES: Record<string, () => Scene> = {
  // ---- moving, after Box2D's benchmarks ----
  rain: () => {
    // Box2D's Rain makes new bodies every 8 steps. Here one particle comes in every 2 steps, from a
    // random point above the box. The others wait far below, held still, until their turn.
    const count = 300
    const every = 2
    const waiting: Vec3[] = Array.from({ length: count }, (_, i) => [
      ((i % 20) - 10) * 0.5,
      -50,
      (Math.floor(i / 20) - 8) * 0.5,
    ])
    return {
      label: 'Rain, after Box2D',
      kind: 'moving',
      positions: waiting,
      masses: new Array(count).fill(1),
      planes: [floor, ...wallsOf(0.6)],
      walls: { half: 0.6, turn: 0 },
      camera: { position: [2.8, 2.9, 3.4], target: [0, 0.9, 0] },
      script: () => {
        const next = random(7)
        let inside = 0
        let first = true
        return (world, time) => {
          if (first) {
            for (let i = 0; i < count; i++) world.w[i] = 0
            first = false
          }
          const due = Math.min(count, Math.floor(time / (every * STEP)) + 1)
          for (; inside < due; inside++) {
            world.x[inside] = [(next() - 0.5) * 1.0, 2.2, (next() - 0.5) * 1.0]
            world.v[inside] = [0, -1, 0]
            world.w[inside] = 1
          }
        }
      },
    }
  },
  spinner: () => {
    // Box2D's Spinner turns a long bar at 5 rad/s among thousands of bodies. Here a bar of 12 held
    // spheres turns at 2 rad/s at the bottom of the box: the script sets where each one is at the
    // end of the step, and how fast it moves, so springs and velocities feel it move.
    const base = box()
    const heap = base.positions.map(([x, y, z]) => [x, y + 0.3, z] as Vec3)
    const bar: [number, number][] = []
    for (const y of [RADIUS, RADIUS + DIAMETER])
      for (const r of [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5]) bar.push([r, y])
    const speed = 2
    return {
      label: 'Spinner, after Box2D',
      kind: 'moving',
      positions: [...heap, ...bar.map(([r, y]) => [r, y, 0] as Vec3)],
      masses: [...base.masses, ...bar.map(() => Number.POSITIVE_INFINITY)],
      planes: base.planes,
      walls: base.walls,
      camera: boxCamera,
      script: () => (world, time) => {
        const angle = speed * (time + STEP)
        bar.forEach(([r, y], k) => {
          const i = heap.length + k
          world.x[i] = [r * Math.cos(angle), y, r * Math.sin(angle)]
          world.v[i] = [-speed * r * Math.sin(angle), 0, speed * r * Math.cos(angle)]
        })
      },
    }
  },
  smash: () => {
    // Box2D's Smash throws a heavy box at 40 m/s into a grid of small ones. Here a sphere of 10 kg
    // flies at 8 m/s into a block of 125 spheres of 1 kg.
    const next = random(5)
    const positions: Vec3[] = []
    for (let a = 0; a < 5; a++)
      for (let b = 0; b < 5; b++)
        for (let c = 0; c < 5; c++)
          positions.push([
            0.3 + a * DIAMETER + (next() - 0.5) * 0.002,
            RADIUS + b * DIAMETER,
            -0.4 + c * DIAMETER + (next() - 0.5) * 0.002,
          ])
    return {
      label: 'Smash, after Box2D',
      kind: 'moving',
      positions: [...positions, [-1.2, 0.5, 0]],
      masses: [...positions.map(() => 1), 10],
      velocities: [...positions.map(() => [0, 0, 0] as Vec3), [8, 0, 0]],
      planes: [floor, ...wallsOf(1.6)],
      walls: { half: 1.6, height: 0.8, turn: 0 },
      camera: { position: [0, 3.4, 5.4], target: [0, 0, 0] },
    }
  },
  tumbler: () => {
    // Box2D's Tumbler turns a closed box at 25°/s with many small bodies inside. Here a closed box
    // 1.2 m wide, half full, turns around Z at the same speed: the script turns its six walls.
    const center: Vec3 = [0, 1.0, 0]
    const half = 0.6
    const speed = (25 * Math.PI) / 180
    const faces: Vec3[] = [
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, 1, 0],
      [0, 0, -1],
      [0, 0, 1],
    ]
    const planesAt = (angle: number): Plane[] =>
      faces.map(([x, y, z]) => {
        const normal: Vec3 = [
          x * Math.cos(angle) - y * Math.sin(angle),
          x * Math.sin(angle) + y * Math.cos(angle),
          z,
        ]
        const offset = normal[0] * center[0] + normal[1] * center[1] + normal[2] * center[2] - half
        return { normal, offset }
      })
    const next = random(9)
    const positions: Vec3[] = []
    for (let a = 0; a < 5; a++)
      for (let b = 0; b < 5; b++)
        for (let c = 0; c < 5; c++)
          positions.push([
            -0.44 + a * 0.22 + (next() - 0.5) * 0.02,
            0.56 + b * 0.22,
            -0.44 + c * 0.22 + (next() - 0.5) * 0.02,
          ])
    return {
      label: 'Tumbler, after Box2D',
      kind: 'moving',
      positions,
      masses: positions.map(() => 1),
      planes: planesAt(0),
      walls: { half, height: 2 * half, center, turn: 0, spin: { axis: 'z', speed } },
      camera: { position: [1.0, 1.6, 3.8], target: [0, 1.0, 0] },
      script: () => (world, time) => {
        world.planes = planesAt(speed * (time + STEP))
      },
    }
  },

  // ---- settling: the scenes of chapters 026 to 029 ----
  box: () => ({ label: 'A box filling up', kind: 'settling', ...box() }),
  turned: () => ({ label: 'The same box, turned by 45°', kind: 'settling', ...box(45) }),
  mixed: () => ({
    label: 'Masses from 1 to 10 kg',
    kind: 'settling',
    ...box(0, (next) => 1 + 9 * next()),
  }),
  heavy: () => {
    const base = box()
    return {
      label: 'A ball of 100 kg on a heap of 1 kg',
      kind: 'settling',
      ...base,
      positions: [...base.positions, [0.05, 2.4, 0.05]],
      masses: [...base.masses, 100],
      release: { index: base.positions.length, at: 3 },
    }
  },
  fixedFloor: () => {
    const next = random(2)
    const positions: Vec3[] = []
    const masses: number[] = []
    for (let a = 0; a < 8; a++)
      for (let b = 0; b < 8; b++) {
        positions.push([-0.7 + a * DIAMETER, 0, -0.7 + b * DIAMETER])
        masses.push(Number.POSITIVE_INFINITY)
      }
    for (let layer = 0; layer < 4; layer++)
      for (let a = 0; a < 5; a++)
        for (let b = 0; b < 5; b++) {
          positions.push([
            -0.4 + a * 0.2 + (next() - 0.5) * 0.04,
            0.4 + layer * 0.22,
            -0.4 + b * 0.2 + (next() - 0.5) * 0.04,
          ])
          masses.push(1)
        }
    return {
      label: 'A floor of fixed spheres',
      kind: 'settling',
      positions,
      masses,
      planes: wallsOf(0.8),
      walls: { half: 0.8, turn: 0 },
      camera: { position: [2.6, 1.9, 3.0], target: [0, 0.2, 0] },
    }
  },
  column: () => ({
    label: 'A column of 10',
    kind: 'settling',
    positions: Array.from({ length: 10 }, (_, i) => [0, RADIUS + DIAMETER * i, 0] as Vec3),
    masses: new Array(10).fill(1),
    planes: [floor],
    camera: { position: [1.6, 1.3, 2.6], target: [0, 0.95, 0] },
  }),
  lightUnderHeavy: () => ({
    label: '1 kg under 100 kg',
    kind: 'settling',
    positions: [
      [0, RADIUS, 0],
      [0, RADIUS + DIAMETER, 0],
    ],
    masses: [1, 100],
    planes: [floor],
    camera: { position: [0.7, 0.45, 1.1], target: [0, 0.2, 0] },
  }),
  midAir: () => ({
    label: 'A hit in the air',
    kind: 'settling',
    // one sphere 10 cm higher than the other, flying at 2 m/s toward each other
    positions: [
      [-0.5, 2.5, 0],
      [0.5, 2.6, 0],
    ],
    masses: [1, 1],
    velocities: [
      [2, 0, 0],
      [-2, 0, 0],
    ],
    planes: [floor],
    drift: true,
    camera: { position: [0, 1.6, 5.2], target: [0, 1.1, 0] },
  }),
}
