// Reads the topic map (docs/topics/topics.json) and turns it into a graph: one node per topic, one
// link per relation. The file is read as it is, with no copy: the graph always shows the real map.

import raw from '../../docs/topics/topics.json?raw'

export type Status = 'mentioned' | 'seen' | 'studied'

/** The relations of the map that become lines. `citedIn` is left out: it says where, not what. */
export type LinkType = 'partOf' | 'related' | 'about'

/** A topic, with only the fields the graph uses. */
export interface Topic {
  id: string
  kind: string
  title: string
  summary: string
  area: string
  status: Status
  /** The day the topic reached each status, as YYYY-MM-DD: the oldest is the day it entered. */
  since: Partial<Record<Status, string>>
  partOf?: string
  related?: string[]
  about?: string[]
  url?: string
  page?: string
}

export interface Link {
  /** Indices into `Graph.topics`. */
  source: number
  target: number
  type: LinkType
}

export interface Graph {
  topics: Topic[]
  /** The areas of the map, by id, in the order of the file. */
  areas: Record<string, { title: string }>
  links: Link[]
  /** For each topic, the topics one link away from it. */
  neighbors: Set<number>[]
  /** For each topic, the topics two links away from it: the neighbors of its neighbors. */
  second: Set<number>[]
}

export function loadGraph(): Graph {
  const { topics, areas } = JSON.parse(raw) as Pick<Graph, 'topics' | 'areas'>
  const indexOf = new Map(topics.map((topic, index) => [topic.id, index]))
  const links: Link[] = []
  const neighbors = topics.map(() => new Set<number>())

  const connect = (source: number, id: string, type: LinkType) => {
    const target = indexOf.get(id)
    // One line per pair: the first relation wins, and partOf comes first.
    if (target === undefined || target === source || neighbors[source].has(target)) return
    links.push({ source, target, type })
    neighbors[source].add(target)
    neighbors[target].add(source)
  }

  for (const type of ['partOf', 'about', 'related'] as const) {
    topics.forEach((topic, index) => {
      for (const id of [topic[type] ?? []].flat()) connect(index, id, type)
    })
  }

  const second = neighbors.map((near, index) => {
    const beyond = new Set<number>()
    for (const neighbor of near) {
      for (const other of neighbors[neighbor]) {
        if (other !== index && !near.has(other)) beyond.add(other)
      }
    }
    return beyond
  })
  return { topics, areas, links, neighbors, second }
}
