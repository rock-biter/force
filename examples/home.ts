// The home page: the README of the repo, shown as it is written, so the two never tell two stories.

import { marked } from 'marked'
import readme from '../README.md?raw'
import { chapterOf, fixLinks } from './links.js'
import { SITE } from './repo.js'

// The images at the root of the repo, by the path the README uses for them: "./force-cover.png".
const images = import.meta.glob<string>('../*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

const article = document.querySelector<HTMLElement>('#readme')
if (article) {
  // The README is ours, written in this repo: its HTML can go in as it is.
  article.innerHTML = await marked.parse(readme)

  for (const image of article.querySelectorAll('img')) {
    const src = image.getAttribute('src') ?? ''
    const url = images[`.${src}`] // "./x.png" in the README is "../x.png" from here
    if (url) image.src = url
  }

  // The README sends who reads it on GitHub to this site. Here that link would lead to the page it
  // is on, so the paragraph that holds it is left out: in the README it has a paragraph of its own.
  const withoutSlash = (address: string) => address.replace(/\/$/, '')
  for (const link of article.querySelectorAll('a')) {
    if (withoutSlash(link.getAttribute('href') ?? '') === withoutSlash(SITE)) {
      link.closest('p')?.remove()
    }
  }

  // A chapter of the logbook opens on the logbook page of the site, anything else on GitHub.
  fixLinks(article, 'README.md', (path) => {
    const chapter = chapterOf(path)
    return chapter && `./logbook/#${chapter}`
  })

  // The README opens with what FORCE is, then where we are. The demos go between the two, first
  // thing after the introduction. The map goes after where we are, before the sections for who
  // wants to use the library.
  const [whereWeAre, next] = article.querySelectorAll('h2')
  const demos = document.querySelector('#examples')
  const map = document.querySelector('#topic-map')
  if (demos) whereWeAre?.before(demos)
  if (map) next?.before(map)
}
