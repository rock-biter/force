// Puts what is on `dev` online, in one command.
//
//   npm run publish:site           the website: demos, logbook, home page
//   npm run release -- patch       the website, and a new version of the package: 0.1.0 -> 0.1.1
//   npm run release -- minor       0.1.0 -> 0.2.0, when what the package offers changed
//
// We work on one branch, `dev`. `main` is what is online: the website is built from it at every
// push (.github/workflows/pages.yml), and every version on npm is a commit of it with a tag,
// v0.1.1. `main` only ever moves forward to where `dev` is (a fast-forward): it never has a commit
// of its own, so the two cannot drift apart and there is nothing to merge.
//
// A release adds one commit that changes the version in package.json, and its tag. The last step,
// `npm publish`, is left to a person: it asks for a login, and it cannot be taken back.
// `npm publish` by itself refuses to go on unless this script ran first (check-release.mjs): a
// version never reaches npm without the website being published with it.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const bump = process.argv[2] // 'site', or how the version grows: patch, minor, major
const BUMPS = ['patch', 'minor', 'major']
if (bump !== 'site' && !BUMPS.includes(bump)) {
  console.error(
    'Say what to release: npm run publish:site, or npm run release -- patch | minor | major',
  )
  process.exit(1)
}

const run = (command, args, show = true) =>
  execFileSync(command, args, { stdio: show ? 'inherit' : 'pipe', encoding: 'utf8' })
const git = (...args) => (run('git', args, false) ?? '').trim()
const stop = (why) => {
  console.error(`\nNot released: ${why}`)
  process.exit(1)
}

// Only from `dev`, with nothing left to commit, and with `main` still behind it.
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'dev') stop('this is not the branch dev.')
if (git('status', '--porcelain')) stop('there are changes not committed yet.')
git('fetch', 'origin')
const behind = (ref) => Number(git('rev-list', '--count', `dev..${ref}`))
if (behind('origin/main'))
  stop('main has commits that dev does not have: bring them into dev first.')
try {
  if (behind('origin/dev')) stop('origin/dev has commits that are not here: pull first.')
} catch {} // no dev on GitHub yet: the first push makes it
const waiting = Number(git('rev-list', '--count', 'origin/main..dev'))
if (!waiting && bump === 'site') stop('main is already where dev is.')

console.log(`\n${waiting} commit(s) on dev are not on main yet:`)
console.log(git('log', '--oneline', '-15', 'origin/main..dev') || '  (none)')
const version = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version
console.log(
  bump === 'site'
    ? '\nThe website will be built again from them. The package on npm stays as it is.'
    : `\nThe website will be built again from them, and the version goes from ${version} up by a ${bump}.`,
)
const ask = createInterface({ input: process.stdin, output: process.stdout })
const answer = await ask.question('Go on? (y/N) ')
ask.close()
if (answer.trim().toLowerCase() !== 'y') stop('stopped by you.')

// What must hold before anything goes online: the same checks, and the website must build.
for (const script of ['lint', 'typecheck', 'test', 'build', 'build:site'])
  run('npm', ['run', script])

// A release: the version in package.json, one commit, one tag.
if (bump !== 'site') run('npm', ['version', bump, '-m', 'RELEASE %s'])

// `main` moves forward to `dev`, on GitHub and here. GitHub refuses the push if it is not a
// fast-forward, and nothing is lost.
run('git', ['push', '--follow-tags', '-u', 'origin', 'dev'])
run('git', ['push', 'origin', 'dev:main'])
git('branch', '-f', 'main', 'dev')

console.log('\nOnline in about a minute: https://rock-biter.github.io/force/')
if (bump !== 'site')
  console.log('The version and its tag are on GitHub. Last step, by hand:\n\n  npm publish\n')
