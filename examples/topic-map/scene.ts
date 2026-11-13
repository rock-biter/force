// Draws the graph with three.js: every node in one Points object, every link in one LineSegments,
// and one HTML label per node. The status of a topic is drawn three times: fill (full, half,
// outline only), size and, through the layout, distance from the center. The color is its area.
//
// A node the pointer rests on for half a second is highlighted: the node and the ones a link away
// keep their colors, the ones two links away keep half of them, and the rest fades into the paper.
// A click selects it: the highlight stays, the space around the node opens up (see layout.ts) and
// the camera glides to it. From there, only the nodes still visible can be clicked.
//
// On the timeline the graph shows the map of a past day: the topics not yet on the map are not
// drawn, and the layout is simulated live (see createGrowingLayout), so it reshapes as they come.
// There the color has to be earned: a topic is grey while only mentioned, halfway to its color
// when seen, and fully colored when studied. A link between two studied topics is colored too.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { areaColor, GREY, INK, PAPER } from './colors.js'
import type { Graph, Link, LinkType, Status } from './data.js'
import { createGrowingLayout, type GrowingLayout, type Layout } from './layout.js'

const STATUS_INDEX: Record<Status, number> = { mentioned: 0, seen: 1, studied: 2 }
/** Diameter of a node, in the units of the layout. */
const NODE_SIZE: Record<Status, number> = { mentioned: 4, seen: 6.5, studied: 10 }
/** No node is drawn smaller than this, in CSS pixels. */
const MIN_NODE_PIXELS = 6
/** How much ink a line gets: 0 is the paper, 1 is full ink. */
const LINK_INK: Record<LinkType, number> = { partOf: 0.5, about: 0.2, related: 0.2 }
/**
 * How far from the camera a label is still fully readable, and where it is gone, in radii of the
 * graph. From far away only the studied topics have a name; the others show up as you get closer.
 */
const LABEL_RANGE: Record<Status, [number, number]> = {
  mentioned: [0.6, 1.1],
  seen: [1.4, 2.2],
  studied: [50, 60],
}
/** Labels are monospace, so their size on screen is known without measuring: CSS pixels. */
const LABEL_CHAR_WIDTH = 6.7
const LABEL_HEIGHT = 14
const FOV = 50
/** How much of its ink a node or a line keeps when it is not part of the selection. */
const FADED = 0.12
/** The highlighted node is drawn this much larger, to make room for a ring around it. */
const SELECTED_SCALE = 1.7
/** A click picks the closest node within this distance from its edge, in CSS pixels. */
const PICK_MARGIN = 6
/** The focus of a node two links away from the selected one: between faded (0) and normal (1). */
const SECOND = 0.5
/** How visible the label of such a node is. */
const SECOND_LABEL = 0.6
/** Milliseconds the pointer must rest on a node before the node is highlighted. */
const HOVER_DELAY = 500
/** Seconds a change of colors takes, and seconds the nodes take to move. */
const FADE_TIME = 0.45
const MOVE_TIME = 0.9
/** How fast the camera reaches its goal: higher is faster. */
const CAMERA_EASE = 6
/** How fast a node grows to its size when it comes onto the map, or shrinks when it leaves. */
const POP_EASE = 10
/** How fast colors change on the timeline, where changes come too close together for a Tween. */
const TIMELINE_EASE = 6

/**
 * A list of numbers on its way from where it was to a goal, in a set time. It starts slowly,
 * speeds up and slows down again before landing: an "ease in out" curve.
 */
class Tween {
  private readonly from: Float32Array
  private goal: Float32Array
  private progress = 1 // 0 at the start of the trip, 1 at the goal

  constructor(
    /** The numbers that move: this array is changed in place. */
    private readonly values: Float32Array,
    private readonly seconds: number,
  ) {
    this.from = values.slice()
    this.goal = values
  }

  /** Stops the trip where it is. */
  cancel(): void {
    this.progress = 1
  }

  /** Starts a trip from the values as they are now. */
  to(goal: Float32Array): void {
    this.from.set(this.values)
    this.goal = goal
    this.progress = 0
  }

  /** Moves the values on by some seconds. Returns false when there was nothing left to do. */
  step(elapsed: number): boolean {
    if (this.progress >= 1) return false
    this.progress = Math.min(this.progress + elapsed / this.seconds, 1)
    const t = this.progress
    // The same idea as smoothstep() in GLSL, a little steeper in the middle.
    const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
    const { values, from, goal } = this
    for (let i = 0; i < values.length; i++) values[i] = from[i] + (goal[i] - from[i]) * eased
    return true
  }
}

const VERTEX = /* glsl */ `
  attribute float aStatus; // 0 mentioned, 1 seen, 2 studied
  attribute float aKind;   // 0 concept, 1 source
  attribute float aSize;   // diameter, in layout units
  attribute vec3 aColor;   // the color of the topic's area
  attribute float aFocus;  // 0 faded, 0.5 two links away, 1 normal, 2 selected
  attribute float aPresent; // 0 not on the map yet, 1 on the map: only the timeline changes it
  uniform float uSelectedScale;
  uniform float uScale;    // layout units to pixels, at distance 1
  uniform float uMinSize;  // pixels
  varying float vStatus;
  varying float vKind;
  varying float vPixels;
  varying float vFocus;
  varying float vSelected;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vFocus = min(aFocus, 1.0);
    vSelected = max(aFocus - 1.0, 0.0);

    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    // Perspective by hand: a point gets smaller as it gets farther, like a mesh would.
    gl_PointSize = max(aSize * uScale / -viewPosition.z, uMinSize);
    gl_PointSize *= mix(1.0, uSelectedScale, vSelected) * aPresent;

    // Faded nodes must not hide the others, even when they are closer. Depth goes from -1 (near)
    // to 1 (far): squeeze each group into a third of it, the faded nodes at the far end.
    float depth = gl_Position.z / gl_Position.w;
    gl_Position.z = (depth / 3.0 + mix(2.0 / 3.0, -2.0 / 3.0, vFocus)) * gl_Position.w;

    // A point cannot have size 0: one that is not on the map is sent out of the view instead.
    if (aPresent < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);

    vStatus = aStatus;
    vKind = aKind;
    vPixels = gl_PointSize;
  }
`

const FRAGMENT = /* glsl */ `
  uniform vec3 uPaper;
  uniform vec3 uGrey;
  uniform float uEarned;  // 0: every node has its color. 1, on the timeline: color by status
  uniform float uOutline; // pixels
  uniform float uSelectedScale;
  uniform float uFaded;
  varying float vStatus;
  varying float vKind;
  varying float vPixels;
  varying float vFocus;
  varying float vSelected;
  varying vec3 vColor;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0; // -1 to 1 across the point
    // A selected point is larger, but its shape keeps the old size: the rest is for the ring.
    float room = mix(1.0, 1.0 / uSelectedScale, vSelected);
    // Distance from the center: round for a concept, square for a source.
    float d = (vKind < 0.5 ? length(p) : max(abs(p.x), abs(p.y)) * 1.13) / room;
    float blur = fwidth(d);
    float shape = 1.0 - smoothstep(0.9 - blur, 0.9, d);

    // The outline keeps the same thickness in pixels, whatever the size of the point.
    float pixelRadius = 0.5 * vPixels;
    float thickness = clamp(uOutline / (pixelRadius * room), 0.1, 0.5);
    float outline = smoothstep(0.9 - thickness - blur, 0.9 - thickness, d);
    float leftHalf = 1.0 - smoothstep(-blur, blur, p.x);

    // studied: full. seen: outline and left half. mentioned: outline only.
    float fill = vStatus > 1.5 ? 1.0 : vStatus > 0.5 ? max(outline, leftHalf) : outline;

    // On the timeline the color is earned: grey when mentioned, halfway when seen, full when
    // studied.
    float earned = vStatus > 1.5 ? 1.0 : vStatus > 0.5 ? 0.5 : 0.0;
    vec3 own = mix(vColor, mix(uGrey, vColor, earned), uEarned);

    // Out of the selection: the ink loses its color, then most of its strength.
    vec3 ink = mix(vec3(dot(own, vec3(0.2126, 0.7152, 0.0722))), own, vFocus);
    // The empty part is paper, not a hole: the lines under a node stay hidden.
    vec3 color = mix(uPaper, ink, fill * mix(uFaded, 1.0, vFocus));

    // The selected node sits on a round disc of paper with an edge of its own color: the ring.
    float r = length(p);
    float ringBlur = fwidth(r);
    float ringWidth = uOutline / pixelRadius;
    float disc = (1.0 - smoothstep(0.95 - ringBlur, 0.95, r)) * vSelected;
    float ring = smoothstep(0.95 - ringWidth - ringBlur, 0.95 - ringWidth, r);

    float alpha = max(shape, disc);
    if (alpha <= 0.0) discard;
    gl_FragColor = vec4(mix(mix(uPaper, own, ring), color, shape), alpha);
    #include <colorspace_fragment>
  }
`

export class GraphScene {
  private readonly renderer = new WebGLRenderer({ antialias: true })
  private readonly labelRenderer = new CSS2DRenderer()
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(FOV, 1, 1, 10000)
  private readonly orbit: OrbitControls
  private readonly nodes: ShaderMaterial
  private readonly labels: CSS2DObject[]
  /** The distance from the center of the farthest node. */
  private readonly radius: number
  /** Layout units to CSS pixels, at distance 1. */
  private pixelScale = 1
  /** Where each node is on the page (x, y in CSS pixels) and how far in front of the camera. */
  private readonly screen: Float32Array

  /** The selected topic, as an index into `graph.topics`. */
  private selected: number | null = null
  /** The topic the colors are centered on: the selected one, or else the one under the pointer. */
  private highlighted: number | null = null
  /** The topic under the pointer, and the timer that will highlight it if the pointer stays. */
  private hovered: number | null = null
  private hoverTimer = 0
  /** Per node: x, y, z now. They move when a node is selected. */
  private readonly positions: Float32Array
  private readonly positionTween: Tween
  private readonly nodePosition: BufferAttribute
  private readonly linePosition: BufferAttribute
  /** Per node: 0 faded, 1 normal, 2 selected. `focus` is drawn, and moves toward `focusGoal`. */
  private readonly focus: BufferAttribute
  private readonly focusGoal: Float32Array
  private readonly focusTween: Tween
  /** Per line vertex: its color now, its goal, and the two colors it moves between. */
  private readonly lineColor: BufferAttribute
  private readonly lineColorGoal: Float32Array
  private readonly lineColorTween: Tween
  private readonly lineColorNormal: Float32Array
  private readonly lineColorFaded: Float32Array
  /** The lines that leave the highlighted node, drawn again in its color over the others. */
  private readonly spokes: LineSegments<BufferGeometry, LineBasicMaterial>
  private spokeLinks: Link[] = []
  private readonly spokesOpacity = new Float32Array(1)
  private readonly spokesTween = new Tween(this.spokesOpacity, FADE_TIME)
  /** Where the camera is gliding to. Null when it rests or the user took over. */
  private flight: { target: Vector3; distance: number } | null = null
  private readonly overviewDistance: number
  private lastTime = 0

  /** The status each topic is drawn with. Null only on the timeline: not on the map yet. */
  private statuses: (Status | null)[]
  /** True while the graph shows a past day of the timeline. */
  private onTimeline = false
  /** The live layout of the timeline, made the first time it is needed. */
  private growing: GrowingLayout | null = null
  private readonly statusAttribute: BufferAttribute
  private readonly sizeAttribute: BufferAttribute
  /** Per node: 0 when it is not on the map, 1 when it is, and in between while it pops in. */
  private readonly present: BufferAttribute
  /** Per line vertex: the color of the area of the link's first topic. */
  private readonly lineColorArea: Float32Array

  constructor(
    private readonly graph: Graph,
    private readonly layout: Layout,
    /** Called when the selection changes, with the index of the topic or null. */
    private readonly onSelect: (index: number | null) => void,
  ) {
    const { topics, links } = graph
    this.statuses = topics.map((topic) => topic.status)
    this.scene.background = new Color(PAPER)

    const positions = layout.rest.slice()
    this.positions = positions
    this.positionTween = new Tween(positions, MOVE_TIME)
    let radius = 0
    for (let i = 0; i < positions.length; i += 3) {
      radius = Math.max(radius, Math.hypot(positions[i], positions[i + 1], positions[i + 2]))
    }
    this.radius = radius
    this.screen = new Float32Array(topics.length * 3)

    // The links: two vertices each, colored like ink thinned with paper.
    const linePositions = new Float32Array(links.length * 6)
    this.lineColorNormal = new Float32Array(links.length * 6)
    this.lineColorFaded = new Float32Array(links.length * 6)
    this.lineColorArea = new Float32Array(links.length * 6)
    const paper = new Color(PAPER)
    links.forEach((link, index) => {
      const normal = paper.clone().lerp(new Color(INK), LINK_INK[link.type])
      const faded = paper.clone().lerp(new Color(INK), LINK_INK[link.type] * FADED)
      for (const [end, node] of [link.source, link.target].entries()) {
        const offset = index * 6 + end * 3
        linePositions.set(positions.subarray(node * 3, node * 3 + 3), offset)
        normal.toArray(this.lineColorNormal, offset)
        faded.toArray(this.lineColorFaded, offset)
        new Color(areaColor(topics[link.source].area)).toArray(this.lineColorArea, offset)
      }
    })
    this.lineColorGoal = this.lineColorNormal.slice()
    const lineColors = this.lineColorNormal.slice()
    this.lineColor = new BufferAttribute(lineColors, 3)
    this.lineColorTween = new Tween(lineColors, FADE_TIME)
    this.linePosition = new BufferAttribute(linePositions, 3)
    const lineGeometry = new BufferGeometry()
    lineGeometry.setAttribute('position', this.linePosition)
    lineGeometry.setAttribute('color', this.lineColor)
    // Lines are drawn first and leave no trace in the depth buffer, so no line ever crosses a node.
    const lineMaterial = new LineBasicMaterial({ vertexColors: true, depthWrite: false })
    const lines = new LineSegments(lineGeometry, lineMaterial)
    lines.frustumCulled = false // the nodes move: no fixed bounds to test against the view
    this.scene.add(lines)

    this.spokes = new LineSegments(
      new BufferGeometry(),
      new LineBasicMaterial({ transparent: true, opacity: 0, depthTest: false }),
    )
    this.spokes.renderOrder = 0.5 // over the lines, under the nodes
    this.spokes.frustumCulled = false
    this.scene.add(this.spokes)

    // The nodes: one point each. The fragment shader draws the shape inside the point.
    const nodeGeometry = new BufferGeometry()
    const attribute = (value: (index: number) => number) =>
      new BufferAttribute(
        Float32Array.from(topics, (_, index) => value(index)),
        1,
      )
    this.nodePosition = new BufferAttribute(positions, 3)
    nodeGeometry.setAttribute('position', this.nodePosition)
    this.statusAttribute = attribute((i) => STATUS_INDEX[topics[i].status])
    nodeGeometry.setAttribute('aStatus', this.statusAttribute)
    nodeGeometry.setAttribute(
      'aKind',
      attribute((i) => (topics[i].kind === 'concept' ? 0 : 1)),
    )
    this.sizeAttribute = attribute((i) => NODE_SIZE[topics[i].status])
    nodeGeometry.setAttribute('aSize', this.sizeAttribute)
    this.present = attribute(() => 1)
    nodeGeometry.setAttribute('aPresent', this.present)
    // three.js wants colors as "linear" numbers: Color does the conversion from the usual hex.
    const colors = new Float32Array(topics.length * 3)
    topics.forEach((topic, index) => {
      new Color(areaColor(topic.area)).toArray(colors, index * 3)
    })
    nodeGeometry.setAttribute('aColor', new BufferAttribute(colors, 3))
    this.focusGoal = new Float32Array(topics.length).fill(1)
    const focus = this.focusGoal.slice()
    this.focus = new BufferAttribute(focus, 1)
    this.focusTween = new Tween(focus, FADE_TIME)
    nodeGeometry.setAttribute('aFocus', this.focus)
    this.nodes = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uPaper: { value: new Color(PAPER) },
        uGrey: { value: new Color(GREY) },
        uEarned: { value: 0 },
        uScale: { value: 1 },
        uMinSize: { value: 1 },
        uOutline: { value: 1 },
        uSelectedScale: { value: SELECTED_SCALE },
        uFaded: { value: FADED },
      },
      // The soft edge of a shape becomes "how many samples of this pixel are covered", so the
      // points stay opaque and need no sorting, as a transparent material would.
      alphaToCoverage: true,
    })
    const points = new Points(nodeGeometry, this.nodes)
    points.renderOrder = 1 // after the lines
    points.frustumCulled = false
    this.scene.add(points)

    // The labels: plain HTML, moved over the canvas by CSS2DRenderer.
    this.labels = topics.map((topic, index) => {
      const element = document.createElement('div')
      element.className = `label ${topic.status}`
      element.textContent = topic.title
      const label = new CSS2DObject(element)
      label.center.set(0, 0.5) // the node is at the middle of the label's left side
      label.position.fromArray(positions, index * 3)
      this.scene.add(label)
      return label
    })

    this.labelRenderer.domElement.className = 'labels'
    document.body.append(this.renderer.domElement, this.labelRenderer.domElement)

    // Far enough to see the whole graph: the few nodes at the very edge may fall outside.
    this.overviewDistance = (radius / Math.sin((FOV / 2) * (Math.PI / 180))) * 0.85
    this.camera.position.set(0, this.overviewDistance * 0.25, this.overviewDistance)
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement)
    this.orbit.enableDamping = true
    this.orbit.dampingFactor = 0.08
    // The moment the user moves the camera, the glide lets go.
    this.orbit.addEventListener('start', () => {
      this.flight = null
    })

    this.listenForClicks()
    window.addEventListener('resize', () => this.resize())
    this.resize()
    this.renderer.setAnimationLoop((time) => this.frame(time))
  }

  /** Selects a topic, or clears the selection with null. */
  select(index: number | null): void {
    if (index === this.selected || (this.onTimeline && index !== null)) return
    this.selected = index
    this.hover(null)
    this.highlight(index)

    // Weaker springs around the selected node: its neighbors drift away from it.
    const positionGoal = index === null ? this.layout.rest : this.layout.around(index)
    this.positionTween.to(positionGoal)

    if (index === null) {
      this.flight = { target: new Vector3(), distance: this.overviewDistance }
    } else {
      // Close enough to frame the node with everything a link away from it, where it will be.
      const target = new Vector3().fromArray(positionGoal, index * 3)
      const point = new Vector3()
      let reach = 0
      for (const node of this.graph.neighbors[index]) {
        reach = Math.max(reach, point.fromArray(positionGoal, node * 3).distanceTo(target))
      }
      const distance = (Math.max(reach, 40) / Math.sin((FOV / 2) * (Math.PI / 180))) * 1.15
      this.flight = { target, distance }
    }
    this.onSelect(index)
  }

  /**
   * Shows the map of a past day: the status of each topic that day, null for a topic not on the
   * map yet. With null, goes back to the map of today, and the nodes glide to their usual places.
   */
  setTimeline(statuses: (Status | null)[] | null): void {
    const { topics } = this.graph
    if (statuses === null) {
      if (!this.onTimeline) return
      this.onTimeline = false
      this.positionTween.to(this.layout.rest)
      this.lineColorGoal.set(this.lineColorNormal)
      this.lineColorTween.to(this.lineColorGoal)
    } else {
      if (!this.onTimeline) {
        this.select(null)
        this.hover(null)
        this.positionTween.cancel()
      }
      this.onTimeline = true
      this.growing ??= createGrowingLayout(this.graph)
      this.growing.set(statuses)
    }

    this.statuses = statuses ? [...statuses] : topics.map((topic) => topic.status)
    this.statuses.forEach((status, index) => {
      if (status === null) return
      this.statusAttribute.array[index] = STATUS_INDEX[status]
      this.sizeAttribute.array[index] = NODE_SIZE[status]
      const name = `label ${status}`
      const label = this.labels[index].element
      if (label.className !== name) label.className = name
    })
    this.statusAttribute.needsUpdate = true
    this.sizeAttribute.needsUpdate = true

    // On the timeline, a link between two studied topics takes the color of the first of them.
    if (!this.onTimeline) return
    this.lineColorTween.cancel()
    this.graph.links.forEach((link, line) => {
      const studied = [link.source, link.target].every((node) => this.statuses[node] === 'studied')
      const colors = studied ? this.lineColorArea : this.lineColorNormal
      this.lineColorGoal.set(colors.subarray(line * 6, line * 6 + 6), line * 6)
    })
  }

  /**
   * Centers the colors on a topic, or gives every node its own back with null. Nothing moves:
   * this is all that hovering a node does.
   */
  private highlight(index: number | null): void {
    if (index === this.highlighted) return
    this.highlighted = index
    const { links, neighbors, second } = this.graph
    const goal = this.focusGoal

    goal.forEach((_, node) => {
      if (index === null || neighbors[index].has(node)) goal[node] = 1
      else if (node === index) goal[node] = 2
      else goal[node] = second[index].has(node) ? SECOND : 0
    })

    // A line keeps its color when it leaves the highlighted node or one of its neighbors, and
    // ends on a node that is still visible.
    links.forEach((link, line) => {
      const near = Math.max(goal[link.source], goal[link.target]) >= 1
      const visible = Math.min(goal[link.source], goal[link.target]) > 0
      const colors = near && visible ? this.lineColorNormal : this.lineColorFaded
      this.lineColorGoal.set(colors.subarray(line * 6, line * 6 + 6), line * 6)
    })

    // The lines that leave the highlighted node are drawn again in its color, starting from
    // nothing.
    // With no node the old ones stay where they are and fade out.
    if (index !== null) {
      this.spokeLinks = links.filter((link) => link.source === index || link.target === index)
      const ends = new Float32Array(this.spokeLinks.length * 6)
      this.spokes.geometry.setAttribute('position', new BufferAttribute(ends, 3))
      this.spokes.material.color.set(areaColor(this.graph.topics[index].area))
      this.updateLines()
      this.spokesOpacity[0] = 0
    }
    this.spokesTween.to(Float32Array.of(index === null ? 0 : 1))
    this.focusTween.to(goal)
    this.lineColorTween.to(this.lineColorGoal)
  }

  /**
   * Puts both ends of every line where its nodes are now. A line to a topic that is not on the
   * map gets both ends in the same place, so nothing is drawn.
   */
  private updateLines(): void {
    const write = (attribute: BufferAttribute, lines: Link[]) => {
      lines.forEach((link, line) => {
        const drawn = this.statuses[link.source] !== null && this.statuses[link.target] !== null
        for (const [end, node] of [link.source, drawn ? link.target : link.source].entries()) {
          attribute.array.set(this.positions.subarray(node * 3, node * 3 + 3), line * 6 + end * 3)
        }
      })
      attribute.needsUpdate = true
    }
    write(this.linePosition, this.graph.links)
    const spokes = this.spokes.geometry.getAttribute('position')
    if (spokes instanceof BufferAttribute) write(spokes, this.spokeLinks)
  }

  /** A press and a release at the same spot is a click. With movement between, it is a drag. */
  private listenForClicks(): void {
    const canvas = this.renderer.domElement
    let pressed: { x: number; y: number } | null = null
    canvas.addEventListener('pointerdown', (event) => {
      pressed = { x: event.clientX, y: event.clientY }
      this.hover(null) // a drag is starting, or a click
    })
    canvas.addEventListener('pointerup', (event) => {
      const moved = pressed && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y)
      pressed = null
      if (moved !== null && moved < 4) this.select(this.pick(event.clientX, event.clientY))
    })
    canvas.addEventListener('pointermove', (event) => {
      if (pressed) return
      const node = this.pick(event.clientX, event.clientY)
      canvas.style.cursor = node === null ? '' : 'pointer'
      this.hover(node)
    })
    canvas.addEventListener('pointerleave', () => this.hover(null))
    window.addEventListener('keydown', (event) => {
      // Escape also closes the page of a topic, when one is open: then it is not for us.
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) this.select(null)
    })
  }

  /**
   * Notes which node is under the pointer. The highlight comes only if the pointer is still on
   * that node after a moment, so crossing the graph does not make it flash. It goes at once.
   */
  private hover(node: number | null): void {
    if (node === this.hovered) return
    this.hovered = node
    window.clearTimeout(this.hoverTimer)
    // With a node selected the highlight belongs to it: hovering changes nothing.
    if (this.selected !== null) return
    this.highlight(null)
    if (node === null) return
    this.hoverTimer = window.setTimeout(() => {
      if (this.hovered === node && this.selected === null) this.highlight(node)
    }, HOVER_DELAY)
  }

  /**
   * The node under a point of the page, or null. Among several, the closest to the point. With a
   * node selected, the faded ones cannot be picked: a click that misses does not send the camera
   * to the other side of the graph.
   */
  private pick(x: number, y: number): number | null {
    const { screen } = this
    if (this.onTimeline) return null // the timeline is to watch: nothing to pick
    let best: number | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    this.graph.topics.forEach((_, index) => {
      const depth = screen[index * 3 + 2]
      if (depth <= 0) return // behind the camera
      const faded = this.focusGoal[index] === 0
      if (faded && this.selected !== null) return
      const distance = Math.hypot(screen[index * 3] - x, screen[index * 3 + 1] - y)
      if (distance > this.nodeRadius(index) + PICK_MARGIN) return
      // While hovering, the faded nodes can be picked, but the others win.
      const penalty = faded ? PICK_MARGIN : 0
      if (distance + penalty < bestDistance) {
        best = index
        bestDistance = distance + penalty
      }
    })
    return best
  }

  /** The radius of a node on screen, in CSS pixels. */
  private nodeRadius(index: number): number {
    const size = NODE_SIZE[this.statuses[index] ?? 'mentioned']
    const pixels = Math.max((size * this.pixelScale) / this.screen[index * 3 + 2], MIN_NODE_PIXELS)
    return (pixels * (index === this.highlighted ? SELECTED_SCALE : 1)) / 2
  }

  private resize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    const pixelRatio = Math.min(window.devicePixelRatio, 2)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height)
    this.labelRenderer.setSize(width, height)

    this.pixelScale = height / (2 * Math.tan((FOV / 2) * (Math.PI / 180)))
    // gl_PointSize is in pixels of the canvas, which has pixelRatio of them per CSS pixel.
    this.nodes.uniforms.uScale.value = this.pixelScale * pixelRatio
    this.nodes.uniforms.uMinSize.value = MIN_NODE_PIXELS * pixelRatio
    this.nodes.uniforms.uOutline.value = 1.25 * pixelRatio
  }

  private frame(time: number): void {
    const elapsed = Math.min((time - this.lastTime) / 1000, 0.1)
    this.lastTime = time

    this.settle(elapsed)
    this.grow(elapsed)
    this.fly(elapsed)
    this.orbit.update()
    this.camera.updateMatrixWorld()
    this.updateLabels()
    this.renderer.render(this.scene, this.camera)
    this.labelRenderer.render(this.scene, this.camera)
  }

  /** Moves the colors and the positions of nodes and lines on toward their goal. */
  private settle(elapsed: number): void {
    if (this.focusTween.step(elapsed)) this.focus.needsUpdate = true
    if (this.lineColorTween.step(elapsed)) this.lineColor.needsUpdate = true
    if (this.spokesTween.step(elapsed)) this.spokes.material.opacity = this.spokesOpacity[0]

    if (this.positionTween.step(elapsed)) this.moveNodes()
  }

  /** Tells three.js that the nodes moved, and takes lines and labels along. */
  private moveNodes(): void {
    this.nodePosition.needsUpdate = true
    this.updateLines()
    this.labels.forEach((label, index) => {
      label.position.fromArray(this.positions, index * 3)
    })
  }

  /** On the timeline: one more step of the live layout, and the nodes pop in or out. */
  private grow(elapsed: number): void {
    if (this.onTimeline && this.growing) {
      this.growing.step()
      this.positions.set(this.growing.positions)
      this.moveNodes()
    }
    // The colors of the timeline come in gently, and go the same way when it is left.
    const colorShare = 1 - Math.exp(-elapsed * TIMELINE_EASE)
    const earned = this.nodes.uniforms.uEarned
    earned.value += ((this.onTimeline ? 1 : 0) - earned.value) * colorShare
    if (this.onTimeline) {
      const colors = this.lineColor.array
      for (let i = 0; i < colors.length; i++) {
        colors[i] += (this.lineColorGoal[i] - colors[i]) * colorShare
      }
      this.lineColor.needsUpdate = true
    }

    const present = this.present.array
    const share = 1 - Math.exp(-elapsed * POP_EASE)
    let moving = false
    this.statuses.forEach((status, index) => {
      const goal = status === null ? 0 : 1
      if (present[index] === goal) return
      present[index] += (goal - present[index]) * share
      if (Math.abs(goal - present[index]) < 0.005) present[index] = goal
      moving = true
    })
    if (moving) this.present.needsUpdate = true
  }

  /** Moves the camera toward the selected node, keeping the direction it looks from. */
  private fly(elapsed: number): void {
    if (!this.flight) return
    // Each frame covers a share of the distance left: fast at first, then slower and slower. The
    // share depends on the time passed, so the glide looks the same at 60 or 120 frames a second.
    const share = 1 - Math.exp(-elapsed * CAMERA_EASE)
    const { target, distance } = this.flight
    const offset = this.camera.position.clone().sub(this.orbit.target)
    const length = offset.length()
    this.orbit.target.lerp(target, share)
    offset.setLength(length + (distance - length) * share)
    this.camera.position.copy(this.orbit.target).add(offset)
    const arrived =
      this.orbit.target.distanceTo(target) < 0.05 && Math.abs(distance - length) < 0.05
    if (arrived) this.flight = null
  }

  /**
   * Decides which labels to show. A label fades with its distance from the camera, and gives way
   * when it would cover a more important one: studied first, then the closest. With a highlight,
   * only the nodes up to two links away have a label, at any distance, and the closest in links
   * come first.
   */
  private updateLabels(): void {
    const { positions, radius, screen } = this
    const { topics } = this.graph
    const width = window.innerWidth
    const height = window.innerHeight
    const point = new Vector3()
    const opacities = new Float32Array(topics.length)
    const candidates: number[] = []

    this.labels.forEach((label, index) => {
      const depth = point.fromArray(positions, index * 3).distanceTo(this.camera.position)
      // project() takes a point to the camera's view: x and y from -1 to 1 across the canvas, and
      // z past 1 when it is behind the camera.
      point.project(this.camera)
      const x = (point.x * 0.5 + 0.5) * width
      const y = (0.5 - point.y * 0.5) * height
      // A node behind the camera gets depth 0: nothing to show, nothing to click.
      screen.set([x, y, point.z < 1 ? depth : 0], index * 3)

      const status = this.statuses[index]
      if (status === null) {
        label.visible = false // not on the map yet
        return
      }
      const [near, far] = LABEL_RANGE[status]
      const byDistance = Math.min(Math.max((far * radius - depth) / ((far - near) * radius), 0), 1)
      const focus = this.focusGoal[index]
      const byHighlight = focus >= 1 ? 1 : focus === SECOND ? SECOND_LABEL : 0
      const opacity = this.highlighted === null ? byDistance : byHighlight
      const inView = point.z < 1 && x > -200 && x < width && y > 0 && y < height
      label.visible = inView && opacity > 0.02
      if (label.visible) {
        opacities[index] = opacity
        candidates.push(index)
      }
    })

    candidates.sort(
      (a, b) =>
        this.focusGoal[b] - this.focusGoal[a] ||
        STATUS_INDEX[this.statuses[b] ?? 'mentioned'] -
          STATUS_INDEX[this.statuses[a] ?? 'mentioned'] ||
        screen[a * 3 + 2] - screen[b * 3 + 2],
    )
    const placed: [left: number, top: number, right: number, bottom: number][] = []
    for (const index of candidates) {
      const topic = topics[index]
      const padding = Math.round(this.nodeRadius(index) + 4)
      const left = screen[index * 3]
      const top = screen[index * 3 + 1] - LABEL_HEIGHT / 2
      const right = left + padding + topic.title.length * LABEL_CHAR_WIDTH
      const bottom = top + LABEL_HEIGHT
      const covered = placed.some(
        (box) => left < box[2] && right > box[0] && top < box[3] && bottom > box[1],
      )
      if (!covered) placed.push([left, top, right, bottom])

      // Write to the page only when something changed: 258 labels, 60 times a second.
      const style = this.labels[index].element.style
      const opacity = covered ? '0' : (Math.round(opacities[index] * 20) / 20).toString()
      if (style.opacity !== opacity) style.opacity = opacity
      if (style.paddingLeft !== `${padding}px`) style.paddingLeft = `${padding}px`
    }
  }
}
