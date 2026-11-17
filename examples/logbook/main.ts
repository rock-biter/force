// The logbook as a list of cards, the latest chapter first. A card shows how a chapter starts, and
// opens the whole of it over the list. The chapters are read from docs/logbook/ as they are
// written: a new one shows up here by itself.

import { marked } from 'marked'
import { chapterOf, fixLinks } from '../links.js'

const files = import.meta.glob<string>('../../docs/logbook/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

interface Chapter {
  /** "014-the-mirror": the name of the file, and the address of the chapter on this page. */
  id: string
  /** The path from the root of the repo. */
  file: string
  /** "014 · The Mirror" */
  title: string
  /** "November 17, 2026 · 4 min read" */
  meta: string
  /** The paragraph that starts with "In short:", as markdown. */
  summary: string
  text: string
}

// Every chapter opens with the same three pieces: "# title", "*date · reading time*" and
// "**In short:** ...". The cards are made of those.
const chapters: Chapter[] = Object.entries(files)
  .map(([key, text]) => {
    const file = key.replace('../../', '')
    const summary = text.match(/^\*\*In short:\*\* ([\s\S]+?)(?:\n\n|$)/m)?.[1] ?? ''
    return {
      id: chapterOf(file) ?? file,
      file,
      title: text.match(/^# (.+)$/m)?.[1] ?? file,
      meta: text.match(/^\*([^*]+)\*$/m)?.[1] ?? '',
      // After "In short:" it starts in lower case. On a card it starts the text.
      summary: summary.charAt(0).toUpperCase() + summary.slice(1),
      text,
    }
  })
  .sort((a, b) => b.id.localeCompare(a.id)) // the names start with the number: latest first

/** A link to another chapter stays on this page: "#012-the-family-tree". */
const onSite = (path: string) => {
  const chapter = chapterOf(path)
  return chapter && `#${chapter}`
}

const list = document.querySelector<HTMLElement>('.chapters')
const count = document.querySelector<HTMLElement>('[data-count]')
if (count) count.textContent = String(chapters.length)

for (const chapter of chapters) {
  const card = document.createElement('article')
  card.className = 'card'

  const title = document.createElement('h2')
  const link = document.createElement('a')
  link.href = `#${chapter.id}`
  link.textContent = chapter.title
  title.append(link)

  const meta = document.createElement('p')
  meta.className = 'meta'
  meta.textContent = chapter.meta

  // The chapters are ours, written in this repo: their HTML can go in as it is.
  const summary = document.createElement('p')
  summary.innerHTML = await marked.parseInline(chapter.summary)
  fixLinks(summary, chapter.file, onSite)

  const actions = document.createElement('p')
  actions.className = 'actions'
  const read = document.createElement('a')
  read.href = `#${chapter.id}`
  read.textContent = 'read the chapter →'
  actions.append(read)

  card.append(title, meta, summary, actions)
  list?.append(card)
}

const dialog = document.querySelector<HTMLDialogElement>('.page')
const pagePath = dialog?.querySelector<HTMLElement>('.path')
const pageBody = dialog?.querySelector<HTMLElement>('article')
const listTitle = document.title

/**
 * Shows the chapter the address asks for, or none. The address is the only switch: a card is a
 * plain link to "#014-the-mirror", so a chapter can be shared, and the back button closes it.
 */
async function showChapter(): Promise<void> {
  if (!dialog || !pageBody || !pagePath) return
  const chapter = chapters.find(({ id }) => id === location.hash.slice(1))
  if (!chapter) {
    if (dialog.open) dialog.close()
    return
  }

  pageBody.innerHTML = await marked.parse(chapter.text)
  fixLinks(pageBody, chapter.file, onSite)
  pagePath.textContent = chapter.file
  document.title = `FORCE: ${chapter.title}`
  if (!dialog.open) dialog.showModal()
  pageBody.scrollTop = 0
}

dialog?.querySelector('.close')?.addEventListener('click', () => dialog.close())
// A click on the area around the page closes it: there, the click lands on the dialog itself.
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close()
})
// However it was closed, the Escape key included, the address goes back to the list.
dialog?.addEventListener('close', () => {
  document.title = listTitle
  if (location.hash) history.replaceState(null, '', location.pathname + location.search)
})

addEventListener('hashchange', showChapter)
showChapter()
