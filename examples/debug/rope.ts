// Ropes drawn as solids: the same particles the simulation moves, with a shape built around them.
//
// A rope of particles is a line: it has a direction at every particle, and nothing else. To draw a
// box, a cylinder or a ribbon around it, every particle gets a ring of vertices, and two rings in
// a row are joined by triangles: one subdivision per particle, so the shape bends where the rope
// does. As for a cloth (cloth.ts) nothing is copied: the vertex shader asks the register in which
// row its particle is now (decision 036), and reads the position from the simulation's own buffer.
//
// A ring needs two directions across the rope to be placed along, and the line gives none. The
// first is carried from the top of the rope down. At the first particle it is the Z axis, turned
// by the smallest turn that brings "straight down" onto the rope's direction there. From each
// particle to the next it is turned again by the smallest turn that brings the old direction of
// the rope onto the new one. So it never spins around the rope more than the rope's own bends
// force it to (parallel transport: a frame carried so is a Bishop frame). The second direction is
// the cross product of the rope's direction and the first. The simulation has no twist of a rope
// around its own axis, and so neither has the drawing.
//
// The carrying is a loop in the vertex shader: the vertex of the 20th particle walks 20 particles.
// It costs, and for a debug view it is fine. An engine would keep the directions in a buffer.
//
// The normals move with the vertices: each vertex has a normal in its ring, along the same two
// directions, so a face of the box stays lit as a face wherever the rope turns. The two ends are
// closed by a cap, whose normal is the rope's direction.

import {
  attribute,
  cameraProjectionMatrix,
  cross,
  dot,
  Fn,
  float,
  int,
  Loop,
  length,
  mat3,
  max,
  min,
  modelViewMatrix,
  normalize,
  select,
  storage,
  uniform,
  varying,
  vec3,
  vec4,
  vertexIndex,
} from 'three/tsl'
import {
  BufferGeometry,
  type Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  StorageBufferAttribute,
  type WebGPURenderer,
} from 'three/webgpu'
import { shade, useExternalBuffer } from './particles.js'

/** What the view draws: the simulation's buffers, and how the ropes' particles are named. */
export interface RopeSource {
  readonly particleCount: number
  /** One vec4f per particle, in the order the simulation keeps them: the center in xyz. */
  readonly positionBuffer: GPUBuffer
  /** One u32 per name: the row of that particle in `positionBuffer`, now. */
  readonly registerBuffer: GPUBuffer
  /**
   * Every rope is `length` particles, named one after the other from its held end: the particle
   * `along` the rope number `rope` has the name rope × length + along. The last rope may be
   * shorter, if the particles run out.
   */
  readonly length: number
}

/** How a rope is drawn: a box, a cylinder, or a flat ribbon, the particles in its middle. */
export type RopeLook = 'box' | 'cylinder' | 'plane'

const SIDES = 8 // of a cylinder

/**
 * The ring of one particle, the same for all: for each vertex where it is across the rope, in
 * half thicknesses along the two directions of the ring, and its normal along the same two.
 * `faces` are the pairs of vertices joined to the same pair of the next ring, by two triangles.
 * `cap` are more vertices, used only at the two ends of a rope: they close it, in a fan.
 */
interface Ring {
  vertices: [x: number, y: number, normalX: number, normalY: number][]
  faces: [number, number][]
  cap: [x: number, y: number][]
}

function ringOf(look: RopeLook): Ring {
  if (look === 'plane') {
    // A ribbon: two vertices, and one normal for both.
    return {
      vertices: [
        [0, -1, 1, 0],
        [0, 1, 1, 0],
      ],
      faces: [[0, 1]],
      cap: [],
    } // prettier-ignore
  }
  if (look === 'box') {
    // Four faces, and two vertices for each: a corner belongs to two faces, and has a normal for
    // each of them. With one vertex per corner the light would round the edges off.
    const corners: [number, number][] = [
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ] // prettier-ignore
    const normals: [number, number][] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ] // prettier-ignore
    return {
      vertices: normals.flatMap((normal, k) => [
        [...corners[k], ...normal] as Ring['vertices'][number],
        [...corners[(k + 1) % 4], ...normal] as Ring['vertices'][number],
      ]),
      faces: normals.map((_, k) => [2 * k, 2 * k + 1]),
      cap: corners,
    }
  }
  // A cylinder: the vertices on a circle, each with the normal that points away from the middle.
  // The faces share them, and the light makes the sides look round.
  const circle = Array.from({ length: SIDES }, (_, k): [number, number] => {
    const angle = (k / SIDES) * 2 * Math.PI
    return [Math.cos(angle), Math.sin(angle)]
  })
  return {
    vertices: circle.map(([x, y]) => [x, y, x, y]),
    faces: circle.map((_, k) => [k, (k + 1) % SIDES]),
    cap: circle,
  }
}

const DOWN = vec3(0, -1, 0)
/** The smaller of two whole numbers: three.js types `min` for decimal ones only. */
const least = min as unknown as (a: Node<'int'>, b: Node<'int'>) => Node<'int'>

/**
 * `side` turned by the smallest turn that brings the direction `from` onto the direction `to`,
 * both of length 1 (Rodrigues' rotation, around the cross product of the two). Two opposite
 * directions have no smallest turn: the division is kept away from zero.
 */
const carry = (side: Node<'vec3'>, from: Node<'vec3'>, to: Node<'vec3'>) => {
  const axis = cross(from, to)
  const cosine = dot(from, to)
  return side
    .mul(cosine)
    .add(cross(axis, side))
    .add(axis.mul(dot(axis, side).div(max(cosine.add(1), 1e-4)))) as unknown as Node<'vec3'>
}

/** The direction of `line`, or `otherwise` if it has no length. */
const direction = (line: Node<'vec3'>, otherwise: Node<'vec3'>) => {
  const far = length(line)
  return select(
    far.greaterThan(1e-6),
    line.div(max(far, 1e-6)),
    otherwise,
  ) as unknown as Node<'vec3'>
}

/** The ropes of one world, drawn as boxes, cylinders or ribbons, straight from the GPU buffers. */
export class RopeView {
  readonly mesh: Mesh
  /** How thick a rope is, in meters. Change `value`, and it changes at the next frame. */
  readonly thickness = uniform(0.2)
  private readonly geometry = new BufferGeometry()
  private readonly material = new MeshBasicNodeMaterial()

  constructor(
    renderer: WebGPURenderer,
    world: RopeSource,
    color: Color,
    look: RopeLook,
    wires = false,
  ) {
    const { particleCount, length: ropeLength } = world
    const ring = ringOf(look)
    const sides = ring.vertices.length
    const each = sides + ring.cap.length // vertices per particle

    // Every particle has the same vertices: its ring, then its cap. Only the caps of the two ends
    // of a rope are in a triangle: a vertex in no triangle is never drawn, and costs only memory.
    const corner = new Float32Array(particleCount * each * 4)
    for (let i = 0; i < particleCount; i++) {
      for (const [k, vertex] of ring.vertices.entries()) corner.set(vertex, (i * each + k) * 4)
      // A cap vertex has no normal in the ring: by that the shader knows it.
      for (const [k, vertex] of ring.cap.entries())
        corner.set([...vertex, 0, 0], (i * each + sides + k) * 4)
    }
    const index: number[] = []
    for (let i = 0; i < particleCount; i++) {
      const along = i % ropeLength
      const last = along === ropeLength - 1 || i === particleCount - 1
      // the sides, from this ring to the next
      if (!last)
        for (const [p, q] of ring.faces) {
          const a = i * each + p
          const b = i * each + q
          index.push(a, b, a + each, b, b + each, a + each)
        }
      // the cap of an end
      if (along === 0 || last)
        for (let k = 1; k + 1 < ring.cap.length; k++) {
          const c = i * each + sides
          index.push(c, c + k, c + k + 1)
        }
    }
    this.geometry.setIndex(index)
    this.geometry.setAttribute('corner', new Float32BufferAttribute(corner, 4))
    // three.js wants a position, and counts the vertices by it: it is never read.
    this.geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(particleCount * each * 3), 3),
    )

    // The simulation's own buffers, read by the vertex shader: no copy.
    const positionData = new StorageBufferAttribute(particleCount, 4)
    useExternalBuffer(renderer, positionData, world.positionBuffer)
    const positions = storage(positionData, 'vec4', particleCount).toReadOnly()
    const registerData = new StorageBufferAttribute(new Uint32Array(particleCount), 1)
    useExternalBuffer(renderer, registerData, world.registerBuffer)
    const register = storage(registerData, 'uint', particleCount).toReadOnly()
    /** Where the particle with this name is, in the world. */
    const at = (name: Node<'int'>) =>
      positions.element(register.element(name)).xyz as unknown as Node<'vec3'>

    // The particle of this vertex, and where it is in its rope.
    const name = int(vertexIndex).div(each) as unknown as Node<'int'>
    const along = name.mod(ropeLength) as unknown as Node<'int'>
    const first = name.sub(along) as unknown as Node<'int'>
    // the last particle of this rope, counted from its first: the last rope may be a short one
    const end = least(
      int(ropeLength - 1) as unknown as Node<'int'>,
      int(particleCount - 1).sub(first) as unknown as Node<'int'>,
    )
    /** The particle that far along this rope, or the end of the rope if there is none. */
    const particle = (k: Node<'int'>) => at(first.add(least(k, end)) as unknown as Node<'int'>)

    // The walk from the top of the rope to this particle. It gives back three things in the
    // columns of a matrix: where the particle is, the direction of the rope there, and the first
    // direction of the ring.
    const walk = Fn(() => {
      // The direction of the rope at a particle: from the one before it to the one after it.
      const before = particle(int(0) as unknown as Node<'int'>).toVar()
      const here = before.toVar()
      const after = particle(int(1) as unknown as Node<'int'>).toVar()
      const tangent = direction(after.sub(before) as unknown as Node<'vec3'>, DOWN).toVar()
      const side = carry(vec3(0, 0, 1), DOWN, tangent).toVar()
      Loop({ start: int(1), end: along.add(1), type: 'int', condition: '<' }, ({ i }) => {
        before.assign(here)
        here.assign(after)
        after.assign(particle(i.add(1) as unknown as Node<'int'>))
        const next = direction(after.sub(before) as unknown as Node<'vec3'>, tangent).toVar()
        side.assign(carry(side, tangent, next))
        tangent.assign(next)
      })
      // Many small turns add up their rounding: the side is put back across the rope.
      side.assign(normalize(side.sub(tangent.mul(dot(side, tangent)))))
      return mat3(here, tangent, side)
    })().toVar() as unknown as { element(column: Node<'int'>): Node<'vec3'> }
    const center = walk.element(int(0) as unknown as Node<'int'>)
    const tangent = walk.element(int(1) as unknown as Node<'int'>)
    const side = walk.element(int(2) as unknown as Node<'int'>)
    const other = cross(tangent, side) as unknown as Node<'vec3'>

    // The vertex in its ring: across the rope, half a thickness for each unit.
    const ringAt = attribute('corner', 'vec4') as unknown as Node<'vec4'>
    const place = center.add(
      side.mul(ringAt.x).add(other.mul(ringAt.y)).mul(this.thickness.mul(0.5)),
    )
    // Its normal, in the world: in the ring, or for a cap along the rope, out of its end.
    const capped = ringAt.z.abs().add(ringAt.w.abs()).lessThan(0.5)
    const outward = select(
      capped,
      tangent.mul(select(along.equal(0), float(-1), float(1))),
      side.mul(ringAt.z).add(other.mul(ringAt.w)),
    ) as unknown as Node<'vec3'>
    const normal = varying(modelViewMatrix.mul(vec4(outward, 0)).xyz)

    this.material.vertexNode = cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(place, 1)))
    // A ribbon is lit on both sides, as a cloth is: its normal is turned toward whoever looks at
    // it. In view space the eye looks down -Z. A box and a cylinder already look outward.
    const seen = normalize(normal) as unknown as Node<'vec3'>
    const facing = (look === 'plane'
      ? select(seen.z.lessThan(0), seen.negate(), seen)
      : seen) as unknown as Node<'vec3'>
    const { diffuse, specular } = shade(facing)
    const tint = uniform(color) as unknown as Node<'vec3'>
    this.material.colorNode = vec4(tint.mul(diffuse).add(specular.mul(wires ? 0 : 0.4)), 1)
    this.material.side = DoubleSide
    this.material.wireframe = wires

    this.mesh = new Mesh(this.geometry, this.material)
    // three.js would cull by the vertices it knows, all at the origin.
    this.mesh.frustumCulled = false
  }

  /** Frees what three.js created. The GPU buffers belong to the world: they are left alone. */
  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
