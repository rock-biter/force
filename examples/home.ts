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

  // The README opens with what FORCE is and where we are. The examples and the map go right after
  // that, before the sections for who wants to use the library.
  const sections = document.querySelectorAll('#examples, #topic-map')
  article.querySelectorAll('h2')[1]?.before(...sections)
}
