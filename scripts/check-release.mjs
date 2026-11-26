// Runs before `npm publish` (prepublishOnly in package.json) and stops it unless the website is
// being published with it: the commit about to go on npm must be the one `main` is at on GitHub,
// and must have the tag of its version. That is what `npm run release` leaves behind
// (scripts/release.mjs), so a version cannot reach npm while the website still shows the one before.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const stop = (why) => {
  console.error(
    `\nNot published: ${why}\nRun \`npm run release -- patch\` (or minor) first: it puts the website online and makes the version, then \`npm publish\` goes through.\n`,
  )
  process.exit(1)
}

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
if (git('status', '--porcelain')) stop('there are changes not committed yet.')
git('fetch', 'origin', '--tags')
const here = git('rev-parse', 'HEAD')
if (git('rev-parse', 'origin/main') !== here)
  stop('main on GitHub is not at this commit, so the website would not show this version.')
let tagged = ''
try {
  tagged = git('rev-parse', `v${version}^{commit}`)
} catch {}
if (tagged !== here) stop(`this commit does not have the tag v${version}.`)
console.log(`v${version} is on main, with its tag: the website is being built from it.`)
