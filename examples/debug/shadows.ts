// Soft shadows for the debug viewer, in three passes written by hand (decision 030):
//
// 1. The shadow map: what casts a shadow is drawn as the light sees it, keeping only the depth,
//    how far the first thing is in each direction.
// 2. The surfaces: what receives light is drawn as the camera sees it, into three textures at
//    once: the depth, the color with no light on it, and the normal. A sphere hidden behind
//    another still runs its shader, since it writes its own depth, but that shader is tiny.
// 3. The screen: one triangle that covers it all. For each pixel it reads the three textures, finds
//    where that point is in the world, asks the shadow map whether the light sees it, and works
//    out the light. Once per pixel, however many spheres were behind it. This is deferred shading.
//
// Lines and anything else drawn the usual way come after, in the same pass as the triangle, which
// also writes the depth it read: so they are hidden by the spheres as before, and keep the smooth
// edges the canvas gives them.
//
// Who takes part is told by layers, three.js's way to show an object to some cameras only.

import {
  cameraProjectionMatrixInverse,
  cameraWorldMatrix,
  Discard,
  dot,
  Fn,
  float,
  getViewPosition,
  If,
  interleavedGradientNoise,
  mix,
  mrt,
  normalize,
  normalView,
  output,
  positionGeometry,
  screenCoordinate,
  screenUV,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec4,
  vogelDiskSample,
} from 'three/tsl'
import {
  AlwaysDepth,
  BufferGeometry,
  type Camera,
  type Color,
  DepthTexture,
  Float32BufferAttribute,
  HalfFloatType,
  LessEqualCompare,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  NearestFilter,
  type Node,
  OrthographicCamera,
  RenderTarget,
  type Scene,
  Vector2,
  type Vector3,
  type WebGPURenderer,
} from 'three/webgpu'
import { SUN, shade } from './particles.js'

/** The layer of what casts a shadow: only the light sees it. */
export const CASTERS = 1
/** The layer of what is lit in the last pass: spheres, and meshes with a `matte` material. */
export const SURFACES = 2
/** The layer of the triangle that covers the screen. */
const SCREEN = 3

/** How many times a pixel reads the shadow map. The GPU blends 4 texels at each read. */
const TAPS = 5

export interface ShadowOptions {
  /** The side of the shadow map, in texels. */
  size?: number
  /** How far around a point the shadow map is read, in texels: the width of the soft edge. */
  softness?: number
}

export class ShadowStage {
  /** The light: a camera with no perspective, since the sun's rays are parallel. */
  readonly light = new OrthographicCamera()
  private readonly map: RenderTarget
  private readonly surfaces: RenderTarget
  private readonly screen: Mesh
  private readonly materials: { shadowed: MeshBasicNodeMaterial; plain: MeshBasicNodeMaterial }
  /**
   * Whether the shadows are made. Without them the shadow map is not drawn and not read: what is
   * left is the light worked out once per pixel.
   */
  shadows = true
  private readonly targets = mrt({ output, normal: vec4(0) })
  /** From the world to the shadow map: the light's view, then its projection. */
  private readonly toLight = uniform(new Matrix4())
  private readonly texel = uniform(1) // the side of a texel of the shadow map, in meters
  private readonly side = uniform(1) // the side of the shadow map, in texels
  /**
   * How dark a shadow is, from 0 to 1: how much of the light left in it is taken away. With 0 a
   * shadow keeps all the ambient light, with 1 it is black.
   */
  readonly darkness = uniform(0.5)
  private covered = 1 // the radius of the ball the light covers, in meters
  private readonly depthRange = uniform(1) // from the light's near plane to its far one, in meters
  private readonly bufferSize = new Vector2()

  constructor(
    private readonly renderer: WebGPURenderer,
    private readonly scene: Scene,
    options: ShadowOptions = {},
  ) {
    const size = options.size ?? 2048
    const softness = uniform(options.softness ?? 2)

    // The shadow map. Its depth texture answers a comparison, not a value: "is this depth nearer
    // than what you hold?", blended over the 4 texels around the point.
    this.side.value = size
    this.map = new RenderTarget(size, size)
    this.map.depthTexture = new DepthTexture(size, size)
    this.map.depthTexture.compareFunction = LessEqualCompare
    this.map.depthTexture.minFilter = this.map.depthTexture.magFilter = LinearFilter
    this.light.layers.set(CASTERS)
    this.light.coordinateSystem = renderer.coordinateSystem

    // The surfaces: two color textures, named as the outputs that fill them, and the depth.
    this.surfaces = new RenderTarget(1, 1, { count: 2, type: HalfFloatType })
    this.surfaces.textures[0].name = 'output'
    this.surfaces.textures[1].name = 'normal'
    for (const each of this.surfaces.textures) each.minFilter = each.magFilter = NearestFilter
    this.surfaces.depthTexture = new DepthTexture(1, 1)

    // The last pass, as a fragment shader over a triangle that covers the screen.
    const color = texture(this.surfaces.textures[0], screenUV)
    const surface = texture(this.surfaces.textures[1], screenUV)
    // A depth texture gives one number, whatever three.js's types say.
    const depth = texture(this.surfaces.depthTexture, screenUV) as unknown as Node<'float'>
    const shadowMap = this.map.depthTexture
    // Written twice: with the shadows, and with the light alone, which never reads the shadow map.
    const lightUp = (shadows: boolean) =>
      Fn(() => {
        // No normal: nothing of ours was drawn here. The background stays.
        If(dot(surface.xyz, surface.xyz).lessThan(0.25), () => {
          Discard()
        })
        const normal = normalize(surface.xyz)
        if (!shadows) {
          const { diffuse, specular } = shade(normal)
          return vec4(color.rgb.mul(diffuse).add(specular.mul(surface.w)), 1)
        }
        // Where the pixel is: from its place on the screen and its depth back to view space, the
        // projection undone, then to the world.
        const viewPosition = getViewPosition(screenUV, depth, cameraProjectionMatrixInverse)
        const worldNormal = cameraWorldMatrix.mul(vec4(normal, 0)).xyz
        // Moved a little off the surface, or the surface would shadow itself: the shadow map
        // knows depths only texel by texel.
        const worldPosition = cameraWorldMatrix
          .mul(vec4(viewPosition, 1))
          .xyz.add(worldNormal.mul(this.texel.mul(1.5)))
        // The same point as the light sees it: x and y say where to read the shadow map, z is
        // the depth to compare. A texture's y runs downward.
        const seen = this.toLight.mul(vec4(worldPosition, 1))
        const at = vec2(seen.x.mul(0.5).add(0.5), seen.y.mul(-0.5).add(0.5))
        const mine = seen.z.sub(this.texel.div(this.depthRange))
        // A soft edge: a few reads on a small disc around the point, averaged (PCF). The disc is
        // turned by a different angle at every pixel, which trades bands for a fine grain.
        const turn = interleavedGradientNoise(screenCoordinate.xy).mul(2 * Math.PI)
        const reach = softness.div(this.side)
        const read = (tap: number) =>
          texture(
            shadowMap,
            at.add(vogelDiskSample(float(tap), float(TAPS), turn).mul(reach)),
          ).compare(mine) as unknown as Node<'float'>
        let lit = read(0)
        for (let tap = 1; tap < TAPS; tap++) lit = lit.add(read(tap))
        const { diffuse, specular, facing } = shade(normal, lit.div(TAPS))
        // A shadow that only took the sun away would leave the ambient light, 40% of the full
        // one: too pale. So it also dims what is left, by `darkness`. A side turned away from
        // the sun is in its own shadow, and dims the same way: without that, the dark would start
        // with a hard line where the shadow map takes over.
        const sunlit = lit.div(TAPS).mul(smoothstep(0, 0.3, facing))
        const dim = mix(this.darkness.oneMinus(), 1, sunlit)
        return vec4(color.rgb.mul(diffuse).add(specular.mul(surface.w)).mul(dim), 1)
      })()
    const screenMaterial = (shadows: boolean) => {
      const material = new MeshBasicNodeMaterial()
      material.vertexNode = vec4(positionGeometry.xy, 0, 1)
      material.colorNode = lightUp(shadows)
      // The depth goes on to the canvas, for what is drawn after: like gl_FragDepth in GLSL.
      material.depthNode = depth
      material.depthFunc = AlwaysDepth
      return material
    }
    this.materials = { shadowed: screenMaterial(true), plain: screenMaterial(false) }
    const triangle = new BufferGeometry()
    triangle.setAttribute(
      'position',
      new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    )
    this.screen = new Mesh(triangle, this.materials.shadowed)
    this.screen.frustumCulled = false
    this.screen.renderOrder = -1 // before everything else in its pass
    this.screen.layers.set(SCREEN)
    scene.add(this.screen)
  }

  /** Tells the light what to cover: a ball of the world, by its center and radius in meters. */
  fit(center: Vector3, radius: number): void {
    const { light } = this
    light.position
      .copy(SUN.value)
      .multiplyScalar(2 * radius)
      .add(center)
    light.lookAt(center)
    light.left = light.bottom = -radius
    light.right = light.top = radius
    light.near = radius
    light.far = 3 * radius
    light.updateProjectionMatrix()
    light.updateMatrixWorld()
    this.covered = radius
    this.texel.value = (2 * radius) / this.map.width
    this.depthRange.value = light.far - light.near
  }

  /** The side of the shadow map, in texels: more of them draw a finer shadow, and cost more. */
  get mapSize(): number {
    return this.map.width
  }

  set mapSize(size: number) {
    if (size === this.map.width) return
    this.map.setSize(size, size)
    this.side.value = size
    this.texel.value = (2 * this.covered) / size
  }

  /**
   * A material for a mesh that takes its light, and its shadows, from the last pass: put the mesh
   * on the SURFACES layer. It shows the color as it is, with no highlight. The color is one for
   * the whole mesh, or a piece of shader that works it out at every pixel.
   */
  matte(color: Color | Node<'vec3'>): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial()
    material.colorNode = vec4('isColor' in color ? uniform(color) : color, 1)
    material.mrtNode = mrt({ normal: vec4(normalView, 0) })
    return material
  }

  /** Makes a mesh cast a shadow: a copy of it that only the light sees, and that follows it. */
  cast(mesh: Mesh): void {
    const copy = new Mesh(mesh.geometry, new MeshBasicNodeMaterial())
    copy.layers.set(CASTERS)
    mesh.add(copy)
  }

  /** Draws a frame: the shadow map, the surfaces, then the screen with everything else. */
  render(camera: Camera): void {
    const { renderer, scene, light } = this
    const { x, y } = renderer.getDrawingBufferSize(this.bufferSize)
    if (this.surfaces.width !== x || this.surfaces.height !== y) this.surfaces.setSize(x, y)
    this.toLight.value.multiplyMatrices(light.projectionMatrix, light.matrixWorldInverse)
    const layers = camera.layers.mask
    this.screen.material = this.shadows ? this.materials.shadowed : this.materials.plain

    if (this.shadows) {
      renderer.setRenderTarget(this.map)
      renderer.render(scene, light)
    }

    camera.layers.set(SURFACES)
    renderer.setMRT(this.targets)
    renderer.setRenderTarget(this.surfaces)
    renderer.render(scene, camera)
    renderer.setMRT(null)
    renderer.setRenderTarget(null)

    camera.layers.mask = layers
    camera.layers.enable(SCREEN)
    renderer.render(scene, camera)
    camera.layers.mask = layers
  }

  dispose(): void {
    this.scene.remove(this.screen)
    this.screen.geometry.dispose()
    this.materials.shadowed.dispose()
    this.materials.plain.dispose()
    this.map.dispose()
    this.surfaces.dispose()
  }
}
