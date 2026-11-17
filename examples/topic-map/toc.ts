// The list of every topic, beside the graph: one section per area, and in it the topics in the
// order they came onto the map. A topic that is part of another sits under it, indented, as deep
// as the map goes. Each row has the mark the graph draws for its topic.
//
// The list and the graph share one selection. A click on a row selects its node, and a node
// selected in the graph is marked in the list and scrolled into view. Resting on a row highlights
// its node, as resting on the node does.
//
// Over the list, a field to search the titles. While it has text, the list keeps only the topics
// found, each under the topics it is part of, and the graph fades the others.

import type { Graph } from './data.js'
import { mark } from './panel.js'

export interface Toc {
  /** Marks the row of the selected topic and brings it into view, or clears the mark with null. */
  select(index: number | null): void
}

/**
 * Fills the list. `onSelect` is called when a row is clicked, with the index of its topic, or
 * with null when the row was the selected one. `onHover` is called with the topic the pointer is
 * on, or null. `onSearch` is called when the text of the search changes, with the topics found,
 * or with null when the field is empty.
 */
export function createToc(
  graph: Graph,
  onSelect: (index: number | null) => void,
  onHover: (index: number | null) => void,
  onSearch: (found: Set<number> | null) => void,
): Toc | undefined {
  const nav = document.querySelector<HTMLElement>('.toc .list')
  const field = document.querySelector<HTMLInputElement>('.toc .search')
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
  const items: HTMLLIElement[] = []
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
      items[index] = item
      item.append(row)
      if (children[index].length > 0) item.append(list(children[index]))
      element.append(item)
    }
    return element
  }

  const sections: {
    area: string
    branches: number[]
    element: HTMLDetailsElement
    count: HTMLElement
  }[] = []
  for (const [area, branches] of roots) {
    if (branches.length === 0) continue
    const name = document.createElement('span')
    name.textContent = areas[area].title
    const count = document.createElement('span')
    count.className = 'count'
    const summary = document.createElement('summary')
    summary.append(name, count)
    const element = document.createElement('details')
    element.open = true
    element.append(summary, list(branches))
    nav.append(element)
    sections.push({ area, branches, element, count })
  }
  const nothing = document.createElement('p')
  nothing.className = 'nothing'
  nothing.textContent = 'no topic with these words'
  nav.append(nothing)

  /**
   * Keeps in the list the topics whose title has every word of `text`, in any order and in upper
   * or lower case. With no word, all of them. Each area counts the topics found in it.
   */
  const search = (text: string): void => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    const found = new Set<number>()
    topics.forEach((topic, index) => {
      const title = topic.title.toLowerCase()
      if (words.every((word) => title.includes(word))) found.add(index)
    })

    // A row stays when its topic was found, or when one under it was. In that case it is there
    // only to say where the other one sits, and is drawn lighter.
    const show = (index: number): boolean => {
      let below = false
      for (const child of children[index]) below = show(child) || below
      const here = found.has(index)
      items[index].hidden = !here && !below
      rows[index].classList.toggle('around', !here)
      return here || below
    }
    for (const { area, branches, element, count } of sections) {
      let any = false
      for (const branch of branches) any = show(branch) || any
      element.hidden = !any
      // While searching, an area that was closed opens: what was found must be in sight.
      if (any && words.length > 0) element.open = true
      count.textContent = String(topics.filter((t, i) => t.area === area && found.has(i)).length)
    }
    nothing.hidden = found.size > 0
    nav.scrollTop = 0
    onSearch(words.length > 0 ? found : null)
  }
  search('')

  field?.addEventListener('input', () => search(field.value))
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      // Enter goes to the first topic found, as a click on its row would.
      const first = nav.querySelector<HTMLElement>('li:not([hidden]) > button:not(.around)')
      if (first) onSelect(Number(first.dataset.index))
    } else if (event.key === 'Escape' && field.value !== '') {
      // Escape empties the search first. It clears the selection only from an empty field.
      event.stopPropagation()
      event.preventDefault()
      field.value = ''
      search('')
    }
  })

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
