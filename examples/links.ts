// The links of a markdown page of the repo, once the page is shown on the site.

import { REPO } from './repo.js'

/** The name of a chapter of the logbook, from its path: "docs/logbook/014-the-mirror.md" gives "014-the-mirror". */
export const chapterOf = (path: string): string | undefined =>
  path.match(/^docs\/logbook\/(\d+-[^/]+)\.md$/)?.[1]

/**
 * Makes the links of a rendered markdown page work on the site. `file` is the path of the page
 * from the root of the repo, such as "docs/logbook/014-the-mirror.md": the links in it are written
 * from there.
 *
 * A link to another file of the repo opens on GitHub, unless `onSite` knows a page of the site
 * that shows that file and returns its address. Every link that leaves the site opens a new tab.
 */
export function fixLinks(
  element: HTMLElement,
  file: string,
  onSite?: (path: string) => string | undefined,
): void {
  for (const link of element.querySelectorAll('a')) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('#')) continue

    // Not a full address: a path such as "../topics/integration.md". Work it out from the root.
    if (!/^[a-z]+:/i.test(href)) {
      const target = new URL(href, `https://repo/${file}`)
      const path = target.pathname.slice(1)
      const here = onSite?.(path)
      if (here) {
        link.setAttribute('href', here)
        continue
      }
      link.href = `${REPO}/blob/main/${path}${target.hash}`
    }
    link.target = '_blank'
    link.rel = 'noopener'
  }
}
