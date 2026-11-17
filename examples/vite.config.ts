import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

// The pages of the site: the home page, and every folder here that has an index.html of its own.
const pages = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(`${root}${entry.name}/index.html`))
  .map((entry) => `${root}${entry.name}/index.html`)

/** Where the site is online, from package.json: "https://<user>.github.io/force/". */
const SITE: string = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).homepage

/**
 * Adds to every page what they all share: the icon of the tab, and the tags a social network or a
 * chat reads to draw the preview of a link (Open Graph). A page only writes its own <title> and
 * <meta name="description">: the rest is worked out from those two.
 */
function sharedHead(): Plugin {
  return {
    name: 'force:shared-head',
    transformIndexHtml(html, context) {
      // "/topic-map/index.html" when building, "/topic-map/" in the dev server: keep the folder.
      const folder = context.path.replace(/^\/|index\.html$/g, '')
      const toRoot = '../'.repeat(folder.split('/').filter(Boolean).length) || './'

      const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? 'FORCE'
      const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1]

      // A preview is drawn by another site, far from this page: it needs full addresses.
      const preview: Record<string, string> = {
        'og:type': 'website',
        'og:site_name': 'FORCE',
        'og:title': title,
        ...(description ? { 'og:description': description } : {}),
        'og:url': SITE + folder,
        'og:image': `${SITE}og.jpg`,
        'og:image:width': '1200',
        'og:image:height': '675',
        'og:image:alt':
          'FORCE, GPU physics engine: a cube of blue particles collapsing onto a grid',
      }

      const tags: HtmlTagDescriptor[] = [
        {
          tag: 'link',
          attrs: { rel: 'icon', type: 'image/svg+xml', href: `${toRoot}favicon.svg` },
        },
        ...Object.entries(preview).map(([property, content]) => ({
          tag: 'meta',
          attrs: { property, content },
        })),
        // X shows the picture large, over the title, only when asked.
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      ]
      return tags.map((tag) => ({ ...tag, injectTo: 'head' as const }))
    },
  }
}

// Examples import 'force-gpu' like real users do, but resolve it to the source for live reload.
export default defineConfig({
  // Relative addresses: the built site works at the root of a domain and inside a folder, such as
  // "<user>.github.io/force/", without knowing which.
  base: './',
  plugins: [sharedHead()],
  resolve: {
    alias: { 'force-gpu': fileURLToPath(new URL('../src/index.ts', import.meta.url)) },
  },
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    outDir: '../_site',
    emptyOutDir: true,
    rolldownOptions: { input: [`${root}index.html`, ...pages] },
  },
})
