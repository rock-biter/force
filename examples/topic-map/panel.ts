// The panel in the corner, which says what the selected topic is, and the page that opens from it:
// the guide or theory page of the topic, read from the repo and shown as it is written.

import { marked } from 'marked'
import packageJson from '../../package.json?raw'
import { areaColor, cssColor } from './colors.js'
import type { Topic } from './data.js'

// Every guide and theory page, as text. Each one is loaded only when somebody opens it.
const pages = import.meta.glob<string>('../../docs/{guides,topics}/*.md', {
  query: '?raw',
  import: 'default',
})
/** "https://github.com/<owner>/<repo>", for the links that leave the page. */
const REPO: string = JSON.parse(packageJson)
  .repository.url.replace(/^git\+/, '')
  .replace(/\.git$/, '')

const panel = document.querySelector<HTMLElement>('.panel')
const dialog = document.querySelector<HTMLDialogElement>('.page')
const pagePath = dialog?.querySelector<HTMLElement>('.path')
const pageBody = dialog?.querySelector<HTMLElement>('article')

dialog?.querySelector('.close')?.addEventListener('click', () => dialog.close())
// A click on the dark area around the page closes it: there, the click lands on the dialog itself.
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close()
})

/** The mark of a topic, as the graph draws it: the fill is its status, the color its area. */
export function mark(topic: Pick<Topic, 'status' | 'kind' | 'area'>): HTMLElement {
  const element = document.createElement('span')
  element.className = `mark ${topic.status} ${topic.kind === 'concept' ? '' : 'square'}`
  element.style.setProperty('--mark', cssColor(areaColor(topic.area)))
  return element
}

/** Fills the panel with a topic, or hides it with null. */
export function showTopic(topic: Topic | null): void {
  if (!panel) return
  panel.hidden = topic === null
  if (!topic) return

  const title = document.createElement('h2')
  title.append(mark(topic), ` ${topic.title}`)
  const meta = document.createElement('p')
  meta.className = 'meta'
  meta.textContent = [topic.kind, topic.area, topic.status].join(' · ')
  const summary = document.createElement('p')
  summary.textContent = topic.summary
  panel.replaceChildren(title, meta, summary)

  const actions = document.createElement('p')
  actions.className = 'actions'
  const { page, url } = topic
  if (page) {
    const read = document.createElement('button')
    read.type = 'button'
    read.textContent = page.startsWith('docs/guides/') ? 'read the guide →' : 'read the page →'
    read.addEventListener('click', () => openPage(page))
    actions.append(read)
  }
  if (url) {
    const source = document.createElement('a')
    source.textContent = 'source ↗'
    source.href = url
    source.target = '_blank'
    source.rel = 'noopener'
    actions.append(source)
  }
  if (actions.childElementCount > 0) panel.append(actions)
}

/** The id GitHub gives a heading: "Common mistakes" becomes "common-mistakes". */
const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replaceAll(' ', '-')

/**
 * Opens a page of the repo over the graph. The path is the one the map uses, from the root, with
 * an optional section: "docs/topics/integration.md#substeps".
 */
async function openPage(path: string): Promise<void> {
  const [file, section] = path.split('#')
  const load = pages[`../../${file}`]
  if (!dialog || !pageBody || !pagePath || !load) return

  // The pages are ours, written in this repo: their HTML can go in as it is.
  pageBody.innerHTML = await marked.parse(await load())
  pagePath.textContent = file
  for (const heading of pageBody.querySelectorAll('h1, h2, h3, h4')) {
    heading.id = headingId(heading.textContent ?? '')
  }

  for (const link of pageBody.querySelectorAll('a')) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('#')) {
      link.addEventListener('click', (event) => {
        event.preventDefault()
        document.getElementById(href.slice(1))?.scrollIntoView()
      })
    } else if (/^[a-z]+:/i.test(href)) {
      link.target = '_blank' // already a full address
      link.rel = 'noopener'
    } else {
      // A path written from this file, such as "../../src/world.ts". Work out the path from the
      // root of the repo: another of our pages opens here, anything else on GitHub.
      const target = new URL(href, `https://repo/${file}`)
      const repoPath = target.pathname.slice(1)
      link.href = `${REPO}/blob/main/${repoPath}${target.hash}`
      link.target = '_blank'
      link.rel = 'noopener'
      if (pages[`../../${repoPath}`]) {
        link.addEventListener('click', (event) => {
          event.preventDefault()
          openPage(repoPath + target.hash)
        })
      }
    }
  }

  if (!dialog.open) dialog.showModal()
  const heading = section ? document.getElementById(section) : null
  if (heading) heading.scrollIntoView()
  else pageBody.scrollTop = 0
}
