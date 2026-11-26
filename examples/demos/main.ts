// The demos in one page, as the examples of three.js are: a card for each on the left, and the
// one chosen running on the right. Each demo is still a page of its own, in its own folder: here
// it is shown in a frame (an <iframe>), so nothing of it had to change.
//
// The address says which demo is on show, after the #: ".../demos/#cloth-pile". So a link can be
// shared, and it opens on that demo, with its card scrolled into view.

import demosJson from './demos.json?raw'

/** A demo: the folder its page is in, its name, and a line about it. */
interface Demo {
  id: string
  title: string
  text: string
}
const demos: Demo[] = JSON.parse(demosJson)

const cards = document.querySelector<HTMLElement>('.cards')
const stage = document.querySelector<HTMLIFrameElement>('.stage')
const toggle = document.querySelector<HTMLButtonElement>('.toggle')
const now = document.querySelector<HTMLElement>('.now')
if (!cards || !stage) throw new Error('the page is not as main.ts expects it')

// A card each. Its picture is taken by scripts/demo-shots.mjs and kept in public/shots/.
const links = new Map<string, HTMLAnchorElement>()
for (const demo of demos) {
  const link = document.createElement('a')
  link.href = `#${demo.id}`
  const picture = document.createElement('img')
  picture.src = `../shots/${demo.id}.jpg`
  picture.alt = ''
  picture.width = 640
  picture.height = 400
  picture.loading = 'lazy'
  const title = document.createElement('h2')
  title.textContent = demo.title
  const text = document.createElement('p')
  text.textContent = demo.text
  link.append(picture, title, text)
  const item = document.createElement('li')
  item.append(link)
  cards.append(item)
  links.set(demo.id, link)
}

// The search: every word typed must be in the name of a demo or in its line, in any order and in
// capitals or not. The cards of the others are hidden.
const search = document.querySelector<HTMLInputElement>('.search')
const nothing = document.querySelector<HTMLElement>('.nothing')
search?.addEventListener('input', () => {
  const words = search.value.toLowerCase().split(/\s+/).filter(Boolean)
  let found = 0
  for (const demo of demos) {
    const text = `${demo.title} ${demo.text}`.toLowerCase()
    const here = words.every((word) => text.includes(word))
    const item = links.get(demo.id)?.parentElement
    if (item) item.hidden = !here
    if (here) found++
  }
  if (nothing) nothing.hidden = found > 0
})

/** Opens or closes the list, where it is a drawer. */
function openList(open: boolean) {
  document.body.dataset.list = open ? 'open' : 'closed'
  toggle?.setAttribute('aria-expanded', String(open))
}
toggle?.addEventListener('click', () => openList(document.body.dataset.list !== 'open'))
document.querySelector('.veil')?.addEventListener('click', () => openList(false))
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') openList(false)
})

let shown: string | undefined
/** Shows the demo the address asks for, or the first one. */
function show(smooth: boolean) {
  const asked = decodeURIComponent(location.hash.slice(1))
  const demo = demos.find((each) => each.id === asked) ?? demos[0]
  openList(false)
  if (demo.id === shown) return
  shown = demo.id
  for (const [id, link] of links) {
    if (id === demo.id) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  }
  links.get(demo.id)?.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
  document.title = `FORCE: ${demo.title}`
  if (now) now.textContent = demo.title
  // Replaced, not opened: the frame then adds nothing to the history, and one step back in the
  // browser is one demo back.
  const address = new URL(`../${demo.id}/`, location.href).href
  if (stage?.contentWindow) stage.contentWindow.location.replace(address)
  else if (stage) stage.src = address
}

// A link inside a demo, such as its way back to the home page, must leave the whole page, not
// only the frame. The demos are pages of this site, so the frame's document can be reached.
stage.addEventListener('load', () => {
  for (const link of stage.contentDocument?.querySelectorAll('a') ?? [])
    if (!link.target) link.target = '_top'
})

window.addEventListener('hashchange', () => show(true))
show(false)
