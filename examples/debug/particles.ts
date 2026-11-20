// Particles drawn as impostors: one flat triangle per particle that pretends to be a sphere. The
// triangle always faces the camera, the fragment shader cuts a disc out of it, shades the disc as
// if it were round, and writes the depth a real sphere would have, so spheres cross correctly.
// The shaders are TSL, three.js's way to write shaders in JavaScript: it compiles them to WGSL.

import {
  cameraFar,
  cameraNear,
  cameraProjectionMatrix,
  cameraViewMatrix,
  Discard,
  dot,
  Fn,
  If,
  instanceIndex,
  log,
  max,
  mix,
  normalize,
  positionGeometry,
  pow,
  saturate,
  sqrt,
  storage,
  uniform,
  varying,
  vec3,
  vec4,
  viewZToPerspectiveDepth,
} from 'three/tsl'
import {
  Color,
  Float32BufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  StorageInstancedBufferAttribute,
  type WebGPURenderer,
} from 'three/webgpu'

// An equilateral triangle around a circle of radius 1: its corners sit 2 from the center. Three
// corners instead of a quad's four, at the cost of more pixels thrown away around the disc.
const SQRT3 = Math.sqrt(3)
const CORNERS = [0, 2, 0, -SQRT3, -1, 0, SQRT3, -1, 0]

// Where the light comes from, in view space: up, right, and toward the camera.
const LIGHT = normalize(vec3(0.4, 0.6, 0.7))
// Halfway between the light and the eye, for the highlight (Blinn-Phong). The eye is taken straight
// ahead, along +Z in view space: close enough for small spheres.
const HALFWAY = normalize(LIGHT.add(vec3(0, 0, 1)))

/**
 * What the view draws: a FORCE World, or any GPU buffer of one vec4f per particle, the center in
 * xyz and 1 / mass in w (decision 008).
 */
export interface ParticleSource {
  readonly particleCount: number
  readonly positionBuffer: GPUBuffer
  readonly radius: number
}

export interface ParticleViewOptions {
  /**
   * Colors each particle by its mass, read from w, on a log scale: light blue at the lightest mass
   * given, red at the heaviest. When both are the same, every particle is light blue.
   */
  massRange?: readonly [lightest: number, heaviest: number]
}

/** The particles of one world, drawn straight from its GPU buffer. */
export class ParticleView {
  readonly mesh: Mesh
  readonly color = uniform(new Color(0x0031f5)) // the blue of the cover in the README
  private readonly geometry: InstancedBufferGeometry
  private readonly material: MeshBasicNodeMaterial

  constructor(renderer: WebGPURenderer, world: ParticleSource, options: ParticleViewOptions = {}) {
    // The positions: the world's own buffer, no copy. Like in GLSL, a shader reads a buffer it is
    // given; here three.js binds it as a read-only storage buffer for the vertex shader.
    const positions = new StorageInstancedBufferAttribute(world.particleCount, 4)
    useExternalBuffer(renderer, positions, world.positionBuffer)
    const centers = storage(positions, 'vec4', world.particleCount).toReadOnly()
    const radius = uniform(world.radius) // the engine's own, so spheres rest on the ground
    const particle = centers.element(instanceIndex)

    // The color: one for all, or from the mass m = 1 / w. log(m / lightest) / log(heaviest /
    // lightest) is 0 at the lightest and 1 at the heaviest; it is worked out in the vertex shader,
    // once per corner, and handed to the fragment shader.
    const light = uniform(new Color(0x4ea3ff))
    const [lightest, heaviest] = options.massRange ?? [1, 1]
    const spread = Math.log(heaviest / lightest)
    const tint = !options.massRange
      ? this.color
      : spread > 0
        ? varying(
            mix(
              light,
              uniform(new Color(0xd1495b)),
              saturate(log(particle.w).negate().sub(Math.log(lightest)).div(spread)),
            ),
          )
        : light

    // Three corners shared by every particle, drawn once per particle (instancing).
    this.geometry = new InstancedBufferGeometry()
    this.geometry.setAttribute('position', new Float32BufferAttribute(CORNERS, 3))
    this.geometry.instanceCount = world.particleCount

    // Vertex shader. The center goes to view space, where the camera looks down -Z, and the corner
    // opens around it in the XY plane, so the triangle always faces the camera (a billboard).
    const corner = positionGeometry.xy
    const viewCenter = cameraViewMatrix.mul(vec4(particle.xyz, 1)).xyz
    const viewCorner = viewCenter.add(vec3(corner.mul(radius), 0))

    // What the fragment shader receives, like GLSL varyings.
    const disc = varying(corner) // the point on the triangle, in radii from the center
    const sphereCenter = varying(viewCenter)

    // Fragment shader. Inside the disc, the sphere's front surface sits at z = sqrt(1 - x² - y²),
    // and that point is also its normal: a sphere's normal points straight out from the center.
    const normal = vec3(disc, sqrt(max(dot(disc, disc).oneMinus(), 0)))

    this.material = new MeshBasicNodeMaterial()
    this.material.vertexNode = cameraProjectionMatrix.mul(vec4(viewCorner, 1))
    this.material.colorNode = Fn(() => {
      If(dot(disc, disc).greaterThan(1), () => {
        Discard() // outside the disc: this pixel was only part of the triangle
      })
      // Some light everywhere (ambient), more where the surface faces the light (diffuse), and a
      // white highlight where it mirrors the light toward the eye (specular), as in GLSL.
      const diffuse = max(dot(normal, LIGHT), 0)
      const specular = pow(max(dot(normal, HALFWAY), 0), 20).mul(0.45)
      return vec4(tint.mul(diffuse.mul(0.6).add(0.4)).add(specular), 1)
    })()
    // The depth of the sphere's surface, not of the flat triangle: like gl_FragDepth in GLSL.
    const surfaceZ = sphereCenter.z.add(normal.z.mul(radius))
    this.material.depthNode = viewZToPerspectiveDepth(surfaceZ, cameraNear, cameraFar)

    this.mesh = new Mesh(this.geometry, this.material)
    // three.js would cull by the three corners around the origin, not by where the particles are.
    this.mesh.frustumCulled = false
  }

  /**
   * Frees what three.js created. Never call dispose() on the positions attribute: three.js would
   * destroy its GPU buffer, which belongs to the world.
   */
  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

/**
 * Makes three.js read a GPU buffer it did not create. three.js r187 has no public way to do this:
 * its backend keeps each attribute's GPUBuffer in a private map, and creates one only when the map
 * has none. So we fill the map first. Checked in three/src/renderers/webgpu/utils/
 * WebGPUAttributeUtils.js, createAttribute(): it may break in a later version of three.js.
 */
function useExternalBuffer(
  renderer: WebGPURenderer,
  attribute: StorageInstancedBufferAttribute,
  buffer: GPUBuffer,
): void {
  const backend = renderer.backend as unknown as { get(object: object): { buffer?: GPUBuffer } }
  backend.get(attribute).buffer = buffer
}
