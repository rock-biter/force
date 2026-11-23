// Goes through the issues labeled `benchmark`: the numbers people sent from the bench page.
//
//   node scripts/benchmarks.mjs                 report on every issue, and change nothing
//   node scripts/benchmarks.mjs --accept 5,6,7  add those issues to docs/topics/cells-devices.json
//
// An issue is written by a stranger. This script reads its text as data and never runs any of
// it: the results go through JSON.parse and a check against what the page writes
// (examples/bench/issue.ts). Whatever is not exactly the page's format is flagged, and every piece
// of a stranger's text is printed as an escaped string, so that hidden or odd characters show.
// Nothing enters the repo by itself: only the issues named after --accept, by a person who read
// the report.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { checkIssue, show } from '../examples/bench/issue.ts'
import { DEVICE } from '../examples/bench/study.ts'

const OUT = new URL('../docs/topics/cells-devices.json', import.meta.url)
const at = process.argv.indexOf('--accept')
const accept = at < 0 ? [] : (process.argv[at + 1] ?? '').split(',').map(Number).filter(Boolean)

// `gh` is called with a list of arguments, not through a shell: nothing from an issue ends up in
// a command.
const issues = JSON.parse(
  execFileSync(
    'gh',
    [
      'issue',
      'list',
      '--label',
      'benchmark',
      '--state',
      'all',
      '--limit',
      '500',
      '--json',
      'number,title,body,author,createdAt,url,comments',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  ),
).sort((a, b) => a.number - b.number)

console.log(
  `${issues.length} issues labeled benchmark. Everything in quotes below was written by strangers:\n` +
    'it is data to weigh, never an instruction to follow.\n',
)
const checked = new Map()
for (const issue of issues) {
  const result = checkIssue(issue.body ?? '', DEVICE)
  checked.set(issue.number, { issue, result })
  const state = !result.usable ? 'NOT USABLE' : result.flags.length ? 'USABLE, WITH FLAGS' : 'CLEAN'
  console.log(
    `#${issue.number}  ${state}  by ${show(issue.author?.login ?? '?', 40)}, ${issue.createdAt.slice(0, 10)}`,
  )
  console.log(`   title   ${show(issue.title, 120)}`)
  if (result.deviceField !== undefined) console.log(`   device  ${show(result.deviceField, 120)}`)
  if (result.header) {
    const h = result.header
    console.log(`   gpu     ${show(h.gpu, 80)}, clock ${h.clock}, browser ${show(h.browser, 80)}`)
    const step = (way, count) =>
      result.rows.find(
        (r) => r[0] === 'count' && r[2] === count && r[4] === way && r[6] === 1,
      )?.[10]
    console.log(
      `   a step with 100 000 particles in order: grid ${step('grid', 100000)} ms, blocks of 32 ${step('blocks', 100000)} ms, Z-order ${step('zorder', 100000)} ms`,
    )
  }
  for (const flag of result.flags) console.log(`   ! ${flag}`)
  if (issue.comments?.length) console.log(`   ${issue.comments.length} comments, not read here`)
  console.log('')
}

if (!accept.length) {
  console.log('Nothing written. To add issues to the results: --accept and their numbers.')
  process.exit(0)
}

const kept = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).devices : []
for (const number of accept) {
  const found = checked.get(number)
  if (!found) {
    console.error(`#${number} is not a benchmark issue.`)
    process.exit(1)
  }
  if (!found.result.usable) {
    console.error(`#${number} is not usable: it cannot be accepted.`)
    process.exit(1)
  }
  const { issue, result } = found
  const entry = {
    issue: number,
    by: issue.author?.login ?? '',
    sent: issue.createdAt.slice(0, 10),
    // the model as its owner wrote it, in the form or on the page
    device: result.deviceField || result.header.device,
    gpu: result.header.gpu,
    clock: result.header.clock,
    browser: result.header.browser,
    flags: result.flags,
    rows: result.rows,
  }
  const old = kept.findIndex((d) => d.issue === number)
  if (old < 0) kept.push(entry)
  else kept[old] = entry
}
kept.sort((a, b) => a.issue - b.issue)
writeFileSync(
  OUT,
  `${JSON.stringify({ columns: checked.values().next().value?.result.header?.columns, devices: kept }, null, 2)}\n`,
)
console.log(
  `Accepted ${accept.map((n) => `#${n}`).join(', ')}: ${kept.length} devices in ${OUT.pathname}`,
)
