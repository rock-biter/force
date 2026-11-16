// The list of every topic, beside the graph: one section per area, and in it the topics in the
// order they came onto the map. A topic that is part of another sits under it, indented, as deep
// as the map goes. Each row has the mark the graph draws for its topic.
//
// The list and the graph share one selection. A click on a row selects its node, and a node
// selected in the graph is marked in the list and scrolled into view. Resting on a row highlights
// its node, as resting on the node does.

import type { Graph } from './data.js'
import { mark } from './panel.js'

export interface Toc {
  /** Marks the row of the selected topic and brings it into view, or clears the mark with null. */
  select(index: number | null): void
}

/**
 * Fills the list. `onSelect` is called when a row is clicked, with the index of its topic, or
 * with null when the row was the selected one. `onHover` is called with the topic the pointer is
 * on, or null.
 */
export function createToc(
  graph: Graph,
  onSelect: (index: number | null) => void,
  onHover: (index: number | null) => void,
): Toc | undefined {
  const nav = document.querySelector<HTMLElement>('.toc')
  if (!nav) return
  const { topics, areas } = graph

  // The tree: under each topic, the topics that are part of it. One with no parent, or with a
  // parent in another area, starts a branch of its area.
  const indexOf = new Map(topics.map((topic, index) => [topic.id, index]))
  const children = topics.map((): number[] => [])
  const roots = new Map(Object.keys(areas).map((area): [string, number[]] => [area, []]))
  topics.forEach((topic, index) => {
    const parent = topic.partOf === undefined ? undefined : indexOf.get(topic.partOf)
    if (parent !== undefined && topics[parent].area === topic.area) children[parent].push(index)
    else roots.get(topic.area)?.push(index)
  })

  // The day each topic came onto the map: the oldest of the days in `since`. Dates are written as
  // YYYY-MM-DD, so the order of the alphabet is the order of time. Topics of the same day keep the
  // order of the map.
  const entered = topics.map((topic) => Object.values(topic.since).sort()[0] ?? '')
  const byDate = (a: number, b: number) => entered[a].localeCompare(entered[b])

  const rows: HTMLButtonElement[] = []
  const list = (indices: number[]): HTMLUListElement => {
    const element = document.createElement('ul')
    for (const index of indices.sort(byDate)) {
      const topic = topics[index]
      const row = document.createElement('button')
      row.type = 'button'
      row.className = topic.status
      row.dataset.index = String(index)
      row.title = topic.title // a long title is cut: the full one shows on hover
      row.append(mark(topic), ` ${topic.title}`)
      rows[index] = row
      const item = document.createElement('li')
      item.append(row)
      if (children[index].length > 0) item.append(list(children[index]))
      element.append(item)
    }
    return element
  }

  for (const [area, branches] of roots) {
    if (branches.length === 0) continue
    const name = document.createElement('span')
    name.textContent = areas[area].title
    const count = document.createElement('span')
    count.className = 'count'
    count.textContent = String(topics.filter((topic) => topic.area === area).length)
    const summary = document.createElement('summary')
    summary.append(name, count)
    const section = document.createElement('details')
    section.open = true
    section.append(summary, list(branches))
    nav.append(section)
  }

  let selected: number | null = null
  /** The topic of the row an event happened on, or null when it was not on a row. */
  const topicAt = (event: Event): number | null => {
    const row =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('button[data-index]')
        : null
    return row ? Number(row.dataset.index) : null
  }
  // One listener for all the rows: 295 buttons, and the number grows.
  nav.addEventListener('click', (event) => {
    const index = topicAt(event)
    if (index !== null) onSelect(index === selected ? null : index)
  })
  nav.addEventListener('pointerover', (event) => onHover(topicAt(event)))
  nav.addEventListener('pointerleave', () => onHover(null))

  return {
    select(index) {
      if (selected !== null) rows[selected]?.removeAttribute('aria-current')
      selected = index
      const row = index === null ? undefined : rows[index]
      if (!row) return
      row.setAttribute('aria-current', 'true')
      // The row may be in an area that was closed.
      const section = row.closest('details')
      if (section) section.open = true
      // A row out of sight comes to the middle of the list; one already in sight stays put, so
      // the list does not jump under the pointer that just clicked it.
      const box = nav.getBoundingClientRect()
      const { top, bottom } = row.getBoundingClientRect()
      if (top < box.top + 28 || bottom > box.bottom) row.scrollIntoView({ block: 'center' })
    },
  }
}
