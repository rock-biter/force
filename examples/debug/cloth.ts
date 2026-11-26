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
//
// Two lights, since a cloth has two sides: the sun of the particles, and a second, cooler light
// from behind and below, so that a fold turned away from the sun is not flat and dark.
//
// A cloth can also be drawn as a slab, with a thickness: two surfaces, each half the thickness
// away from the particles along the normal, and a wall around the border. The particles are then
// the middle of the slab, not one of its faces.
//
// To do: the wall uses the vertices of the two faces, and so their normals. Its edge is lit as if
// it were part of the faces. It needs vertices of its own, with a normal that points out of the
// border, across the faces' one (chapter 066).

import {
  cameraProjectionMatrix,
  cameraViewMatrix,
  cross,
  dot,
  float,
  int,
  max,
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
  Vector3,
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
  /**
   * The cloth is `columns` by `rows` particles, named row after row from `first` on:
   * name = first + column + row × columns. A world can hold several cloths, drawn one view each.
   */
  readonly columns: number
  readonly rows: number
  readonly first?: number
}

/**
 * The second light, in the world: from behind the cloth and a little below, where the sun of the
 * particles (SUN) never reaches.
 */
const BACK = uniform(new Vector3(-0.6, -0.2, -0.8).normalize())

/**
 * How a cloth is drawn: 'surface', one sheet through the particles; 'wires', the edges of that
 * sheet's triangles; 'slab', a sheet with a thickness, the particles in its middle.
 */
export type ClothLook = 'surface' | 'wires' | 'slab'

/** A cloth of one world, drawn as a surface, a slab or its wires, straight from the GPU buffers. */
export class ClothView {
  readonly mesh: Mesh
  /** How thick a slab is, in meters. Change `value`, and the slab changes at the next frame. */
  readonly thickness = uniform(0.1)
  private readonly geometry = new BufferGeometry()
  private readonly material = new MeshBasicNodeMaterial()

  constructor(renderer: WebGPURenderer, world: ClothSource, color: Color, look: ClothLook) {
    const { columns, rows, particleCount } = world
    const wireframe = look === 'wires'
    const slab = look === 'slab'
    const count = columns * rows
    // Two triangles for each square of four neighbours. The vertices have no positions: three.js
    // only needs to know how many there are.
    const index: number[] = []
    for (let b = 0; b + 1 < rows; b++)
      for (let a = 0; a + 1 < columns; a++) {
        const i = a + b * columns
        index.push(i, i + columns, i + 1, i + 1, i + columns, i + columns + 1)
      }
    if (slab) {
      // A slab has every vertex twice: vertex i is on one face, vertex i + count on the other. The
      // second face is the first one turned over, and a wall of two triangles joins the two faces
      // along each piece of the border.
      const faces = index.length
      for (let k = 0; k < faces; k += 3)
        index.push(index[k] + count, index[k + 2] + count, index[k + 1] + count)
      const wall = (i: number, j: number) => index.push(i, j, i + count, j, j + count, i + count)
      for (let a = 0; a + 1 < columns; a++) {
        wall(a + 1, a) // the top row
        wall(a + (rows - 1) * columns, a + 1 + (rows - 1) * columns) // the bottom row
      }
      for (let b = 0; b + 1 < rows; b++) {
        wall(b * columns, (b + 1) * columns) // the first column
        wall(columns - 1 + (b + 1) * columns, columns - 1 + b * columns) // the last column
      }
    }
    this.geometry.setIndex(index)
    this.geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(count * (slab ? 2 : 1) * 3), 3),
    )

    // The simulation's own buffers, read by the vertex shader: no copy.
    const positionData = new StorageBufferAttribute(particleCount, 4)
    useExternalBuffer(renderer, positionData, world.positionBuffer)
    const positions = storage(positionData, 'vec4', particleCount).toReadOnly()
    const registerData = new StorageBufferAttribute(new Uint32Array(particleCount), 1)
    useExternalBuffer(renderer, registerData, world.registerBuffer)
    const register = storage(registerData, 'uint', particleCount).toReadOnly()
    const first = world.first ?? 0
    /** Where the particle with this number in the cloth is, in the world. */
    const at = (name: Node<'int'>) =>
      positions.element(register.element(name.add(first))).xyz as unknown as Node<'vec3'>

    // The particle of this vertex, counted from the cloth's first. In a slab the second half of the vertices are the same
    // particles again, on the other face.
    const vertex = int(vertexIndex) as unknown as Node<'int'>
    const name = (slab ? vertex.mod(count) : vertex) as Node<'int'>
    const side = (
      slab ? select(vertex.lessThan(count), float(1), float(-1)) : float(1)
    ) as Node<'float'>
    const a = name.mod(columns)
    const b = name.div(columns)
    const here = at(name)
    // the neighbours, or the vertex itself at a border
    const left = at(select(a.greaterThan(0), name.sub(1), name) as Node<'int'>)
    const right = at(select(a.lessThan(columns - 1), name.add(1), name) as Node<'int'>)
    const above = at(select(b.greaterThan(0), name.sub(columns), name) as Node<'int'>)
    const below = at(select(b.lessThan(rows - 1), name.add(columns), name) as Node<'int'>)
    // the normal of the sheet at this particle, in the world, and the one of this vertex's face
    const sheet = normalize(cross(right.sub(left), below.sub(above))) as unknown as Node<'vec3'>
    const outward = sheet.mul(side) as unknown as Node<'vec3'>
    const normal = varying(modelViewMatrix.mul(vec4(outward, 0)).xyz)
    // A slab's faces are half its thickness away from the particles, on either side.
    const place = slab ? here.add(outward.mul(this.thickness.mul(0.5))) : here

    this.material.vertexNode = cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(place, 1)))
    // A sheet is lit on both sides: its normal is turned toward whoever looks at it. In view space
    // the eye looks down -Z, so a normal with a negative z points away. A slab's faces already
    // look outward.
    const seen = normalize(normal) as unknown as Node<'vec3'>
    const facing = (slab
      ? seen
      : select(seen.z.lessThan(0), seen.negate(), seen)) as unknown as Node<'vec3'>
    const { diffuse, specular } = shade(facing)
    // The second light, from behind, cooler and weaker than the sun.
    const behind = cameraViewMatrix.mul(vec4(BACK, 0)).xyz
    const backLight = max(dot(facing, behind), 0).mul(0.55)
    const tint = uniform(color) as unknown as Node<'vec3'>
    this.material.colorNode = vec4(
      tint
        .mul(diffuse.mul(0.85))
        .add(tint.mul(vec3(0.75, 0.85, 1)).mul(backLight))
        .add(specular.mul(wireframe ? 0 : 0.4)),
      1,
    )
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
