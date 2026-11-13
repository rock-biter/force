// The topic map as a graph in 3D: every topic FORCE has met is a node, and its shape, color and
// place say how far we went with it. It does not use the engine: three.js draws it, and
// d3-force-3d lays it out.

import { loadGraph, type Status } from './data.js'
import { createLayout } from './layout.js'
import { mark, showTopic } from './panel.js'
import { GraphScene } from './scene.js'
import { createTimeline } from './timeline.js'

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

// The legend has a row for each area that has topics, after the rows of the statuses.
const areas = document.querySelector('.legend .areas')
for (const [area, { title }] of Object.entries(graph.areas)) {
  if (!areas || !graph.topics.some((topic) => topic.area === area)) continue
  const row = document.createElement('tr')
  for (const content of [mark({ status: 'studied', kind: 'concept', area }), title]) {
    row.insertCell().append(content)
  }
  row.insertCell().dataset.count = area
  if (areas.childElementCount === 0) row.className = 'gap'
  areas.append(row)
}

/** Counts the topics of each status and of each area. On the timeline, only those on the map. */
function count(statuses: (Status | null)[]): void {
  for (const cell of document.querySelectorAll<HTMLElement>('[data-count]')) {
    const key = cell.dataset.count
    const matches = graph.topics.filter(
      (topic, index) => statuses[index] !== null && (statuses[index] === key || topic.area === key),
    )
    cell.textContent = String(matches.length)
  }
}

// Two views. The map is the one of today, at rest. The timeline replays how it grew, with a layout
// of its own, and keeps that layout when the story is over.
const today = graph.topics.map((topic) => topic.status)
count(today)
const timeline = createTimeline(graph, (statuses) => {
  scene.setTimeline(statuses)
  count(statuses)
})
const views = {
  map: document.querySelector<HTMLButtonElement>('.views [data-view="map"]'),
  timeline: document.querySelector<HTMLButtonElement>('.views [data-view="timeline"]'),
}
function view(name: keyof typeof views): void {
  if (document.body.dataset.view === name) return
  document.body.dataset.view = name
  for (const [key, button] of Object.entries(views))
    button?.setAttribute('aria-pressed', String(key === name))
  if (name === 'timeline') {
    timeline?.start()
  } else {
    timeline?.stop()
    scene.setTimeline(null)
    count(today)
  }
}
views.map?.addEventListener('click', () => view('map'))
views.timeline?.addEventListener('click', () => view('timeline'))
