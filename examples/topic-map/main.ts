// The topic map as a graph in 3D: every topic FORCE has met is a node, and its shape, color and
// place say how far we went with it. It does not use the engine: three.js draws it, and
// d3-force-3d lays it out.

import { loadGraph, type Status } from './data.js'
import { createLayout } from './layout.js'
import { mark, showTopic } from './panel.js'
import { GraphScene } from './scene.js'

const graph = loadGraph()
const scene = new GraphScene(graph, createLayout(graph), (index) => {
  const topic = index === null ? null : graph.topics[index]
  showTopic(topic)
  // The address follows the selection, so a topic can be linked: /topic-map/#buffer
  history.replaceState(null, '', topic ? `#${topic.id}` : location.pathname)
})

// Opening the page with a topic in the address selects it.
const fromAddress = graph.topics.findIndex((topic) => topic.id === location.hash.slice(1))
if (fromAddress !== -1) scene.select(fromAddress)

// The legend counts the topics of each status, then of each area.
for (const status of ['studied', 'seen', 'mentioned'] satisfies Status[]) {
  const count = graph.topics.filter((topic) => topic.status === status).length
  const cell = document.querySelector(`[data-count="${status}"]`)
  if (cell) cell.textContent = String(count)
}
const areas = document.querySelector('.legend .areas')
for (const [area, { title }] of Object.entries(graph.areas)) {
  const count = graph.topics.filter((topic) => topic.area === area).length
  if (count === 0 || !areas) continue
  const row = document.createElement('tr')
  const cells = [mark({ status: 'studied', kind: 'concept', area }), title, String(count)]
  for (const content of cells) row.insertCell().append(content)
  if (areas.childElementCount === 0) row.className = 'gap'
  areas.append(row)
}
