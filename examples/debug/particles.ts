// Particles drawn as impostors: one flat triangle per particle that pretends to be a sphere. The
// triangle always faces the camera, the fragment shader cuts a disc out of it, shades the disc as
// if it were round, and writes the depth a real sphere would have, so spheres cross correctly.
// The shaders are TSL, three.js's way to write shaders in JavaScript: it compiles them to WGSL.
//
// A view can also be one half of a drawing in two passes (shadows.ts, decision 030): 'surface'
// writes only what the sphere is made of, for a later pass to light, and 'caster' is the sphere as
// the light sees it, for the shadow map.

import {
  cameraFar,
  cameraNear,
  cameraProjectionMatrix,
  cameraViewMatrix,
  Discard,
  dot,
  Fn,
  floor,
  If,
  instanceIndex,
  log,
  max,
  mix,
  modelViewMatrix,
  mrt,
  normalize,
  positionGeometry,
  pow,
  saturate,
  select,
  sqrt,
  storage,
  uniform,
  varying,
  vec3,
  vec4,
  viewZToOrthographicDepth,
  viewZToPerspectiveDepth,
} from 'three/tsl'
import {
  Color,
  Float32BufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  type StorageBufferAttribute,
  StorageInstancedBufferAttribute,
  Vector3,
  type WebGPURenderer,
} from 'three/webgpu'

// An equilateral triangle around a circle of radius 1: its corners sit 2 from the center. Three
// corners instead of a quad's four, at the cost of more pixels thrown away around the disc.
const SQRT3 = Math.sqrt(3)
const CORNERS = [0, 2, 0, -SQRT3, -1, 0, SQRT3, -1, 0]

/**
 * Where the light comes from, in the world: it stands still when the camera turns, as a shadow
 * needs. One light for every view, and for the shadows.
 */
export const SUN = uniform(new Vector3(0.35, 1, 0.5).normalize())

/**
 * The light of one point of a surface, from its normal in view space: some light everywhere
 * (ambient), more where the surface faces the light (diffuse), and a white highlight where it
 * mirrors the light toward the eye (specular), as in GLSL. `lit` is 1 in the light and 0 in a
 * shadow, which leaves only the ambient. The highlight wants the direction halfway between the
 * light and the eye (Blinn-Phong); the eye is taken straight ahead, along +Z in view space: close
 * enough for small spheres.
 */
export function shade(normal: Node<'vec3'>, lit: Node<'float'> | number = 1) {
  // The same direction as the camera sees it: view space is where the normals are.
  const light = cameraViewMatrix.mul(vec4(SUN, 0)).xyz
  const halfway = normalize(light.add(vec3(0, 0, 1)))
  return {
    diffuse: max(dot(normal, light), 0).mul(lit).mul(0.6).add(0.4),
    // How much the surface faces the light: 1 straight at it, 0 edge-on, below 0 turned away.
    facing: dot(normal, light),
    specular: pow(max(dot(normal, halfway), 0), 20)
      .mul(lit)
      .mul(0.45),
  }
}

/**
 * What the view draws: a FORCE World, or any GPU buffer of one vec4f per particle, the center in
 * xyz and 1 / mass in w (decision 008).
 */
export interface ParticleSource {
  readonly particleCount: number
  readonly positionBuffer: GPUBuffer
  readonly radius: number
  /**
   * For particles of different sizes: one vec4f per particle, its radius in meters in x. The rest
   * belongs to the engine.
   */
  readonly propertiesBuffer?: GPUBuffer
}

export interface ParticleViewOptions {
  /**
   * Colors each particle by its mass, read from w, on a log scale: light blue at the lightest mass
   * given, red at the heaviest. When both are the same, every particle is light blue.
   */
  massRange?: readonly [lightest: number, heaviest: number]
  /**
   * The two colors of `massRange`, in place of light blue and red. The view keeps these very
   * objects: change one, with `set`, and the particles change color at the next frame.
   */
  massColors?: readonly [lightest: Color, heaviest: Color]
  /**
   * Colors the particles by groups, in place of their mass: the first `size` names take the first
   * color, the next `size` the second, and so on, starting again when the colors run out. For a
   * world of several cloths of `size` particles each. It needs the world's properties, where the
   * name of a particle is.
   */
  groups?: { size: number; colors: readonly Color[] }
  /** How the particles are drawn: see Look. */
  look?: Look
  /**
   * For 'sphere': works out the lit color of a pixel in place of the view's own light, from the
   * color with no light, the normal and the place of the sphere's surface, both in view space.
   * With `ShadowStage.lightOn`, each sphere takes shadows in its own shader.
   */
  lighting?: (
    color: Node<'vec3'>,
    normal: Node<'vec3'>,
    viewPosition: Node<'vec3'>,
    shine: number,
  ) => Node<'vec3'>
}

/**
 * - 'sphere', the default, shades each disc as a round sphere and writes the sphere's depth.
 * - 'flat' is the cheapest drawing we could think of, to see what the spheres cost.
 * - 'surface' writes the sphere's depth, its color with no light on it, and its normal in a second
 *   texture: the light comes in a later pass, once per pixel (shadows.ts).
 * - 'caster' is the sphere for the shadow map: only its depth, seen from a light with no
 *   perspective. 'caster-flat' leaves the depth to the flat triangle, which the GPU can test before
 *   it runs the shader.
 */
export type Look = 'sphere' | 'flat' | 'surface' | 'caster' | 'caster-flat'

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
    const particle = centers.element(instanceIndex)
    // The radius: the engine's own, so spheres rest on the ground. One for all, or one each, read
    // from the world's buffer in the vertex shader and handed to the fragment shader.
    let cornerRadius = uniform(world.radius) as unknown as Node<'float'>
    let radius = cornerRadius
    let name: Node<'float'> | undefined // the particle's name, the second of its properties
    if (world.propertiesBuffer) {
      const properties = new StorageInstancedBufferAttribute(world.particleCount, 4)
      useExternalBuffer(renderer, properties, world.propertiesBuffer)
      const own = storage(properties, 'vec4', world.particleCount)
        .toReadOnly()
        .element(instanceIndex)
      cornerRadius = own.x as unknown as Node<'float'>
      radius = varying(cornerRadius) as unknown as Node<'float'>
      name = own.y as unknown as Node<'float'>
    }

    // The color: one for all, or from the mass m = 1 / w. log(m / lightest) / log(heaviest /
    // lightest) is 0 at the lightest and 1 at the heaviest; it is worked out in the vertex shader,
    // once per corner, and handed to the fragment shader.
    const light = uniform(options.massColors?.[0] ?? new Color(0x4ea3ff))
    const [lightest, heaviest] = options.massRange ?? [1, 1]
    const spread = Math.log(heaviest / lightest)
    // Or by groups of names: which group, then which of the colors, chosen one by one, since
    // there are few. Worked out in the vertex shader too.
    const groups = options.groups
    const grouped =
      groups && name
        ? (() => {
            const turn = floor(name.add(0.5).div(groups.size)).mod(groups.colors.length)
            let color = uniform(groups.colors[0]) as unknown as Node<'vec3'>
            for (let k = 1; k < groups.colors.length; k++)
              color = select(
                turn.greaterThan(k - 0.5),
                uniform(groups.colors[k]),
                color,
              ) as unknown as Node<'vec3'>
            return varying(color)
          })()
        : undefined
    const tint = grouped
      ? grouped
      : !options.massRange
        ? this.color
        : spread > 0
          ? varying(
              mix(
                light,
                uniform(options.massColors?.[1] ?? new Color(0xd1495b)),
                saturate(log(particle.w).negate().sub(Math.log(lightest)).div(spread)),
              ),
            )
          : light

    // Three corners shared by every particle, drawn once per particle (instancing).
    this.geometry = new InstancedBufferGeometry()
    this.geometry.setAttribute('position', new Float32BufferAttribute(CORNERS, 3))
    this.geometry.instanceCount = world.particleCount

    // Vertex shader. The center goes to view space, where the camera looks down -Z, through the
    // mesh's own matrix too, so a mesh that is turned turns its particles. Then the corner
    // opens around it in the XY plane, so the triangle always faces the camera (a billboard).
    const corner = positionGeometry.xy
    const viewCenter = modelViewMatrix.mul(vec4(particle.xyz, 1)).xyz
    const viewCorner = viewCenter.add(vec3(corner.mul(cornerRadius), 0))

    // What the fragment shader receives, like GLSL varyings.
    const disc = varying(corner) // the point on the triangle, in radii from the center
    const sphereCenter = varying(viewCenter)

    // Fragment shader. Inside the disc, the sphere's front surface sits at z = sqrt(1 - x² - y²),
    // and that point is also its normal: a sphere's normal points straight out from the center.
    const normal = vec3(disc, sqrt(max(dot(disc, disc).oneMinus(), 0)))

    this.material = new MeshBasicNodeMaterial()
    this.material.vertexNode = cameraProjectionMatrix.mul(vec4(viewCorner, 1))
    if (options.look === 'flat') {
      // No normal, no light, no depth of its own: lighter toward the top right, darker toward the
      // bottom left, which is enough to read the discs as round.
      this.material.colorNode = Fn(() => {
        If(dot(disc, disc).greaterThan(1), () => {
          Discard()
        })
        return vec4(tint.mul(disc.x.add(disc.y).mul(0.2).add(0.8)), 1)
      })()
      this.mesh = new Mesh(this.geometry, this.material)
      this.mesh.frustumCulled = false
      return
    }
    const look = options.look ?? 'sphere'
    this.material.colorNode = Fn(() => {
      If(dot(disc, disc).greaterThan(1), () => {
        Discard() // outside the disc: this pixel was only part of the triangle
      })
      // For the shadow map only the depth counts. For a later pass, the color with no light on it.
      if (look === 'caster' || look === 'caster-flat') return vec4(0, 0, 0, 1)
      if (look === 'surface') return vec4(tint, 1)
      if (options.lighting) {
        const surface = sphereCenter.add(normal.mul(radius))
        return vec4(options.lighting(tint as Node<'vec3'>, normal, surface, 1), 1)
      }
      const { diffuse, specular } = shade(normal)
      return vec4(tint.mul(diffuse).add(specular), 1)
    })()
    // The second texture of that later pass: the normal, and 1 for "this surface shines".
    if (look === 'surface') this.material.mrtNode = mrt({ normal: vec4(normal, 1) })
    // The depth of the sphere's surface, not of the flat triangle: like gl_FragDepth in GLSL.
    // The light of the shadow map has no perspective, so its depth is worked out another way.
    const surfaceZ = sphereCenter.z.add(normal.z.mul(radius))
    if (look === 'caster')
      this.material.depthNode = viewZToOrthographicDepth(surfaceZ, cameraNear, cameraFar)
    else if (look !== 'caster-flat')
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
export function useExternalBuffer(
  renderer: WebGPURenderer,
  attribute: StorageBufferAttribute | StorageInstancedBufferAttribute,
  buffer: GPUBuffer,
): void {
  const backend = renderer.backend as unknown as { get(object: object): { buffer?: GPUBuffer } }
  backend.get(attribute).buffer = buffer
}
