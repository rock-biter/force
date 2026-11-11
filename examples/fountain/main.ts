// A fountain: 5000 particles thrown up from the origin in a narrow cone, drawn by the debug viewer.
// They land on the ground at y = 0, bounce a few times and stop: restart throws them again.

import { World } from 'force-gpu'
import { showError, startDebugViewer } from '../debug/viewer.js'

const PARTICLE_COUNT = 5000
const MIN_SPEED = 4 // m/s
const MAX_SPEED = 10 // m/s: about 5 m high at most
const CONE = (15 * Math.PI) / 180 // the widest angle from straight up, in radians

// Built once, so every restart throws exactly the same fountain.
const positions = new Float32Array(PARTICLE_COUNT * 3) // all at the origin
const velocities = new Float32Array(PARTICLE_COUNT * 3)
for (let i = 0; i < PARTICLE_COUNT; i++) {
  // A direction inside the cone, spread evenly over it (uniform in cos θ), and a speed.
  const cosTheta = 1 - Math.random() * (1 - Math.cos(CONE))
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta)
  const phi = Math.random() * 2 * Math.PI
  const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)
  velocities[i * 3] = speed * sinTheta * Math.cos(phi)
  velocities[i * 3 + 1] = speed * cosTheta
  velocities[i * 3 + 2] = speed * sinTheta * Math.sin(phi)
}

startDebugViewer({
  create: (device, { step, substeps }) =>
    World.create({
      device,
      positions,
      velocities,
      step,
      substeps,
      radius: 0.04,
      ground: {}, // at y = 0, with the default bounce and friction
    }),
  camera: { position: [8, 4, 10], target: [0, 2, 0] },
}).catch(showError)
