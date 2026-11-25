// A cloth drawn as a surface: the same particles the simulation moves, joined into triangles.
//
// Nothing is copied. The mesh has one vertex per particle and no positions of its own: the vertex
// shader takes the number of its vertex, which is the particle's name, asks the register in which
// row that particle is now (decision 036), and reads its position from the simulation's own
// buffer. In GLSL this would be a texture of positions read with the vertex id (vertex pulling).
//
// The normal is a simple one: at each vertex, the cross product of "from my left neighbour to my
// right one" and "from the one above to the one below", read the same way. At a border the missing
// neighbour is the vertex itself. It is smooth across the cloth and right enough to read its folds.
// The cloth is lit on both sides.

import {
  cameraProjectionMatrix,
  cross,
  faceDirection,
  int,
  modelViewMatrix,
  normalize,
  select,
  storage,
  uniform,
  varying,
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

/** What the view draws: the simulation's buffers, and how the cloth's particles are named. */
export interface ClothSource {
  readonly particleCount: number
  /** One vec4f per particle, in the order the simulation keeps them: the center in xyz. */
  readonly positionBuffer: GPUBuffer
  /** One u32 per name: the row of that particle in `positionBuffer`, now. */
  readonly registerBuffer: GPUBuffer
  /** The cloth is `columns` by `rows` particles, named row after row: name = column + row × columns. */
  readonly columns: number
  readonly rows: number
}

/** A cloth of one world, drawn as a surface or as its wires, straight from the GPU buffers. */
export class ClothView {
  readonly mesh: Mesh
  private readonly geometry = new BufferGeometry()
  private readonly material = new MeshBasicNodeMaterial()

  constructor(renderer: WebGPURenderer, world: ClothSource, color: Color, wireframe: boolean) {
    const { columns, rows, particleCount } = world
    // Two triangles for each square of four neighbours. The vertices have no positions: three.js
    // only needs to know how many there are.
    const index: number[] = []
    for (let b = 0; b + 1 < rows; b++)
      for (let a = 0; a + 1 < columns; a++) {
        const i = a + b * columns
        index.push(i, i + columns, i + 1, i + 1, i + columns, i + columns + 1)
      }
    this.geometry.setIndex(index)
    this.geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(columns * rows * 3), 3),
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

    const name = int(vertexIndex) as unknown as Node<'int'>
    const a = name.mod(columns)
    const b = name.div(columns)
    const here = at(name)
    // the neighbours, or the vertex itself at a border
    const left = at(select(a.greaterThan(0), name.sub(1), name) as Node<'int'>)
    const right = at(select(a.lessThan(columns - 1), name.add(1), name) as Node<'int'>)
    const above = at(select(b.greaterThan(0), name.sub(columns), name) as Node<'int'>)
    const below = at(select(b.lessThan(rows - 1), name.add(columns), name) as Node<'int'>)
    const normal = varying(
      modelViewMatrix.mul(vec4(normalize(cross(right.sub(left), below.sub(above))), 0)).xyz,
    )

    this.material.vertexNode = cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(here, 1)))
    // Lit on both sides: seen from behind, the normal is turned around.
    const facing = normalize(normal).mul(faceDirection) as unknown as Node<'vec3'>
    const { diffuse, specular } = shade(facing)
    const tint = uniform(color)
    this.material.colorNode = vec4(tint.mul(diffuse).add(specular.mul(wireframe ? 0 : 0.4)), 1)
    this.material.side = DoubleSide
    this.material.wireframe = wireframe

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
