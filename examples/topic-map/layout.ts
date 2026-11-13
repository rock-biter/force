// Where each topic sits in space. Nobody places the nodes by hand: a small simulation does it.
// Three rules push and pull the nodes until they settle:
//
// - a link is a spring: it pulls its two nodes to a set distance;
// - every node pushes every other node away, so they do not pile up;
// - each node is pulled to a shell around the center, chosen by its status: what we studied in the
//   middle, what we only heard of on the outside.
//
// The simulation is d3-force-3d for now. FORCE will take its place when it can.

import { forceLink, forceManyBody, forceRadial, forceSimulation } from 'd3-force-3d'
import type { Graph, LinkType, Status } from './data.js'

/** The knobs of the layout. Distances have no unit: only their proportions matter. */
export const LAYOUT = {
  /** The length each kind of spring wants to have. */
  linkDistance: { partOf: 20, about: 34, related: 44 } satisfies Record<LinkType, number>,
  /** How hard nodes push each other away (negative: it repels). */
  repulsion: -80,
  /** The distance from the center each status is pulled to. */
  shell: { studied: 40, seen: 110, mentioned: 180 } satisfies Record<Status, number>,
  /** How hard the shells pull. At 0 the layout depends on the links alone. */
  shellStrength: 0.3,
  /** How many steps the simulation runs before we draw. */
  ticks: 300,
  /** The share of their strength the springs of the selected node keep: 1 changes nothing. */
  looseSpring: 0.15,
  /** How many more steps the simulation runs to make room around a selected node. */
  looseTicks: 40,
}

export interface Layout {
  /** x, y, z for each topic, in the order of `graph.topics`, with nothing selected. */
  rest: Float32Array
  /**
   * The same, with one topic selected: its springs get weaker, so the push between nodes wins a
   * little and the space around it opens up. Only the topics up to two links away are free to
   * move: the topic itself and the rest of the graph stay where they were.
   */
  around(index: number): Float32Array
}

interface Node {
  status: Status
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
  /** A node with these set is pinned there. */
  fx?: number
  fy?: number
  fz?: number
}

/**
 * Lays the graph out. The same map always gives the same layout: the simulation starts from fixed
 * positions and its random numbers are seeded.
 */
export function createLayout(graph: Graph): Layout {
  const nodes: Node[] = graph.topics.map((topic) => ({ status: topic.status }))
  // d3 swaps source and target for the node objects, so the indices are kept apart in `ends`.
  const links = graph.links.map((link) => ({ ...link, ends: [link.source, link.target] }))
  let loose: number | null = null

  // A spring is weaker when both its nodes have many others: a hub is not crushed by its links.
  // This is d3's own rule, written out so the selected node can change it.
  const strength = (link: (typeof links)[number]) => {
    const [a, b] = link.ends
    const share = a === loose || b === loose ? LAYOUT.looseSpring : 1
    return share / Math.min(graph.neighbors[a].size, graph.neighbors[b].size)
  }
  const springs = forceLink(links)
    .distance((link) => LAYOUT.linkDistance[link.type])
    .strength(strength)

  const simulation = forceSimulation(nodes, 3)
    .stop() // no timer: we run the steps ourselves, when we need them
    .force('link', springs)
    .force('repulsion', forceManyBody().strength(LAYOUT.repulsion))
    .force(
      'shell',
      forceRadial<Node>((node) => LAYOUT.shell[node.status]).strength(LAYOUT.shellStrength),
    )
    .tick(LAYOUT.ticks)

  const read = () => {
    const positions = new Float32Array(nodes.length * 3)
    nodes.forEach((node, index) => {
      positions.set([node.x ?? 0, node.y ?? 0, node.z ?? 0], index * 3)
    })
    return positions
  }
  const rest = read()
  const cache = new Map<number, Float32Array>()

  const around = (index: number) => {
    const cached = cache.get(index)
    if (cached) return cached

    // Always start again from the layout at rest, so the result does not depend on what was
    // selected before.
    nodes.forEach((node, i) => {
      ;[node.x, node.y, node.z] = rest.subarray(i * 3, i * 3 + 3)
      node.vx = node.vy = node.vz = 0
    })
    const free = (i: number) => graph.neighbors[index].has(i) || graph.second[index].has(i)
    const pinned = nodes.filter((_, i) => !free(i))
    for (const node of pinned) [node.fx, node.fy, node.fz] = [node.x, node.y, node.z]
    loose = index
    springs.strength(strength) // reads the strengths again

    // alpha is the "heat" of the simulation: how far a step may move things. It cools by itself.
    simulation.alpha(0.5).tick(LAYOUT.looseTicks)
    const positions = read()

    for (const node of pinned) node.fx = node.fy = node.fz = undefined
    loose = null
    springs.strength(strength)
    cache.set(index, positions)
    return positions
  }

  return { rest, around }
}
