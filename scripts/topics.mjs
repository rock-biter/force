// Checks the topic map (docs/topics/topics.json) and writes its readable index (docs/topics/README.md).
//
//   node scripts/topics.mjs          check the map, then write the index
//   node scripts/topics.mjs --check  check the map, and fail if the index is out of date

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MAP_PATH = 'docs/topics/topics.json'
const INDEX_PATH = 'docs/topics/README.md'
// Where suggestions live: "https://github.com/<owner>/<repo>/issues".
const ISSUES_URL = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).bugs
const GITHUB_USER = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i

const ICONS = { studied: '●', seen: '◐', mentioned: '○' }
const COMMON_FIELDS = [
  'id',
  'kind',
  'title',
  'summary',
  'area',
  'status',
  'since',
  'partOf',
  'related',
]
const COMMON_FIELDS_END = ['citedIn', 'suggestedBy', 'page']
const CONCEPT_FIELDS = [...COMMON_FIELDS, ...COMMON_FIELDS_END, 'code']
const SOURCE_FIELDS = [
  ...COMMON_FIELDS,
  'about',
  ...COMMON_FIELDS_END,
  'url',
  'file',
  'authors',
  'year',
  'claudeRead',
]

const isConcept = (topic) => topic.kind === 'concept'

/** True for a real calendar day written as YYYY-MM-DD. */
const isDay = (text) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(`${text}T00:00:00Z`)
  // "2026-02-30" parses to no date at all, or rolls over to March: neither is the day written.
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text)
}

function check(map) {
  const errors = []
  const warnings = []
  const byId = new Map()

  for (const topic of map.topics) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(topic.id ?? '')) {
      errors.push(`"${topic.id}": the id must be kebab-case`)
    }
    if (byId.has(topic.id)) {
      errors.push(`"${topic.id}": the id is used twice`)
    }
    byId.set(topic.id, topic)
  }

  for (const topic of map.topics) {
    const fail = (message) => errors.push(`"${topic.id}": ${message}`)
    const fileExists = (file) => existsSync(join(ROOT, file))

    if (!Object.hasOwn(map.kinds, topic.kind)) {
      fail(`unknown kind "${topic.kind}"`)
      continue
    }
    const fields = isConcept(topic) ? CONCEPT_FIELDS : SOURCE_FIELDS
    for (const field of Object.keys(topic)) {
      if (!fields.includes(field))
        fail(`"${field}" is not a field of a ${isConcept(topic) ? 'concept' : 'source'}`)
    }
    for (const field of ['title', 'summary']) {
      if (typeof topic[field] !== 'string' || topic[field].trim() === '')
        fail(`"${field}" is missing`)
    }
    if (!Object.hasOwn(map.areas, topic.area)) fail(`unknown area "${topic.area}"`)
    if (!Object.hasOwn(map.statuses, topic.status)) fail(`unknown status "${topic.status}"`)

    // Links between topics: a concept belongs to a concept, a source to a source.
    const links = [...(topic.partOf ? [topic.partOf] : []), ...(topic.related ?? [])]
    for (const id of links) {
      if (id === topic.id) fail('it links to itself')
      else if (!byId.has(id)) fail(`it links to "${id}", which is not on the map`)
    }
    const parent = byId.get(topic.partOf)
    if (parent && isConcept(parent) !== isConcept(topic)) {
      fail(`"partOf" must point to a ${isConcept(topic) ? 'concept' : 'source'}`)
    }

    // Provenance: every topic says where we met it, in a file of the repo or in another topic.
    if (!topic.citedIn?.length) fail('"citedIn" is empty: where did we meet it?')
    for (const ref of topic.citedIn ?? []) {
      if (ref === topic.id) fail('it cites itself')
      else if (!byId.has(ref) && !fileExists(ref))
        fail(`"citedIn": "${ref}" is neither a topic nor a file`)
    }

    // Credit: who suggested it, and in which issue of the repo.
    const credits = topic.suggestedBy ?? []
    if (!Array.isArray(credits)) fail('"suggestedBy" must be a list')
    else {
      for (const credit of credits) {
        const valid = GITHUB_USER.test(credit?.user ?? '') && Number.isInteger(credit.issue)
        if (!valid || credit.issue < 1 || Object.keys(credit).length !== 2)
          fail('"suggestedBy" takes a GitHub user and an issue: { "user": "octocat", "issue": 12 }')
      }
    }

    // Categories: a source says which concepts it is about.
    if (!isConcept(topic)) {
      if (!topic.about?.length) fail('"about" is empty: which concepts is it about?')
      for (const id of topic.about ?? []) {
        if (!isConcept(byId.get(id) ?? {})) fail(`"about": "${id}" is not a concept on the map`)
      }
      // What Claude has read of it, which is not what the user has read: that is the status.
      if (topic.claudeRead !== undefined && !Object.hasOwn(map.claudeReadings, topic.claudeRead))
        fail(`unknown "claudeRead" "${topic.claudeRead}"`)
      if (!topic.url && !topic.file) fail('a source needs a "url" or a "file"')
      if (topic.url && !/^https?:\/\//.test(topic.url))
        fail(`"url" is not a web address: ${topic.url}`)
      // Local copies are not versioned, so a missing one is only worth a warning.
      if (topic.file && !fileExists(topic.file)) {
        warnings.push(`"${topic.id}": no local copy at ${topic.file}`)
      }
    }

    for (const file of topic.code ?? []) {
      if (!fileExists(file)) fail(`file not found: ${file}`)
    }

    // A page can be a whole file, or one section of it: "docs/topics/integration.md#substeps".
    if (topic.page) {
      const [file, anchor] = topic.page.split('#')
      if (!fileExists(file)) fail(`page not found: ${file}`)
      else if (anchor && !headingAnchors(join(ROOT, file)).has(anchor)) {
        fail(`no heading "#${anchor}" in ${file}`)
      }
    }

    // "since" tells the story of the topic: the day it reached each status, oldest first. The
    // timeline of the 3D graph is built from it.
    const statuses = Object.keys(map.statuses)
    const reached = Object.entries(topic.since ?? {})
    if (!topic.since?.[topic.status]) {
      fail(`"since" must say when it became "${topic.status}"`)
    }
    for (const [status, day] of reached) {
      if (!statuses.includes(status)) fail(`"since" has an unknown status "${status}"`)
      else if (statuses.indexOf(status) > statuses.indexOf(topic.status))
        fail(`"since" has "${status}", but the topic is only "${topic.status}"`)
      if (!isDay(day)) fail(`"since.${status}" must be a day, like "2026-11-13"`)
    }
    const inOrder = reached.every(
      ([status, day], i) =>
        i === 0 ||
        (statuses.indexOf(status) > statuses.indexOf(reached[i - 1][0]) && day > reached[i - 1][1]),
    )
    if (!inOrder) fail('"since" must go from the lowest status to the highest, each on a later day')

    // The one promise the map makes: "studied" always comes with a page to read.
    if ((topic.status === 'studied') !== Boolean(topic.page)) {
      fail('a topic is "studied" if and only if it has a "page"')
    }
  }

  // "partOf" must form a tree: following it upwards can never come back to the start.
  for (const topic of map.topics) {
    const seen = new Set()
    for (let id = topic.partOf; id && !seen.has(id); id = byId.get(id)?.partOf) {
      if (id === topic.id) {
        errors.push(`"${topic.id}": "partOf" goes round in a circle`)
        break
      }
      seen.add(id)
    }
  }

  return { errors, warnings }
}

// The anchors GitHub gives to the headings of a Markdown file: "## When it fails: stability"
// becomes "#when-it-fails-stability".
function headingAnchors(path) {
  const headings = readFileSync(path, 'utf8').match(/^#{1,6} .+$/gm) ?? []
  return new Set(
    headings.map((heading) =>
      heading
        .replace(/^#+ /, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N} _-]/gu, '')
        .replaceAll(' ', '-'),
    ),
  )
}

function href(file) {
  return posix.relative(posix.dirname(INDEX_PATH), file)
}

// A "|" inside a cell would end it early.
function cell(text) {
  return String(text).replaceAll('|', '\\|')
}

function renderIndex(map) {
  const byId = new Map(map.topics.map((topic) => [topic.id, topic]))
  const statusIds = Object.keys(map.statuses).toReversed()

  // The text for a reference: a logbook chapter number, a topic name, or a file name.
  const reference = (ref) => {
    const topic = byId.get(ref)
    if (topic) return topic.url ? `[${cell(topic.title)}](${topic.url})` : cell(topic.title)
    const chapter = ref.match(/^docs\/logbook\/(\d+)-/)?.[1]
    const dir = posix.basename(posix.dirname(ref))
    const name = posix.basename(ref, posix.extname(ref))
    const labels = { README: `${dir} index`, SKILL: `${dir} skill` }
    const text = chapter ?? ((dir !== '.' && labels[name]) || name)
    return `[${text}](${href(ref)})`
  }
  const name = (topic) => {
    const title = cell(topic.title)
    if (topic.page) return `**[${title}](${href(topic.page)})**`
    if (topic.url) return `[${title}](${topic.url})`
    return topic.file ? `[${title}](${href(topic.file)})` : title
  }
  // Whoever pointed us to it gets their name next to it.
  const credit = (topic) => {
    if (!topic.suggestedBy?.length) return ''
    const issue = (n) => `[#${n}](${ISSUES_URL}/${n})`
    const who = topic.suggestedBy.map((by) => `${by.user} in ${issue(by.issue)}`)
    return `<br>*suggested by ${who.join(', ')}*`
  }

  const sources = map.topics.filter((topic) => !isConcept(topic))
  const count = (list, status) => list.filter((topic) => topic.status === status).length
  const totals = (list) => statusIds.map((s) => `${ICONS[s]} ${count(list, s)} ${s}`).join(' · ')
  const concepts = map.topics.filter(isConcept)
  const readings = Object.entries(map.claudeReadings)
  const claudeRead = (topic) => (topic.claudeRead ? map.claudeReadings[topic.claudeRead].title : '')
  const readTotals = readings
    .map(
      ([id, { title }]) =>
        `${sources.filter((s) => s.claudeRead === id).length} ${title.toLowerCase()}`,
    )
    .join(', ')

  const lines = [
    '# Topic map',
    '',
    `*Generated from [topics.json](./topics.json) by \`npm run topics\`: do not edit by hand.*`,
    '',
    'Everything we have met while building FORCE, concepts and sources, and how far we went with each',
    'one. Use it to look up a term, to find what to read, or to pick what to explore next.',
    '',
    `- **${concepts.length} concepts:** ${totals(concepts)}`,
    `- **${sources.length} sources:** ${totals(sources)} · read by Claude: ${readTotals}`,
    '',
    '| | Status | What it means |',
    '| --- | --- | --- |',
    ...statusIds.map((status) => {
      const { title, description } = map.statuses[status]
      return `| ${ICONS[status]} | ${title} | ${description} |`
    }),
    '',
    'The status is what the user knows. For sources, a separate column says what Claude has read:',
    '',
    '| Claude read | What it means |',
    '| --- | --- |',
    ...readings.map(([, { title, description }]) => `| ${title} | ${description} |`),
    '| *(empty)* | Not opened by Claude, or not recorded |',
  ]

  const byTitle = (a, b) => a.title.localeCompare(b.title)
  for (const [area, { title, description }] of Object.entries(map.areas)) {
    const inArea = map.topics.filter((topic) => topic.area === area).toSorted(byTitle)
    if (inArea.length === 0) continue
    lines.push('', `## ${title}`, '', `${description}.`)

    const areaConcepts = inArea.filter(isConcept)
    if (areaConcepts.length > 0) {
      lines.push(
        '',
        '| | Concept | In short | Part of | First cited in |',
        '| --- | --- | --- | --- | --- |',
      )
      for (const topic of areaConcepts) {
        const parent = topic.partOf ? cell(byId.get(topic.partOf).title) : ''
        const title = `${name(topic)}${credit(topic)}`
        const row = [title, cell(topic.summary), parent, reference(topic.citedIn[0])]
        lines.push(`| ${ICONS[topic.status]} | ${row.join(' | ')} |`)
      }
    }

    const areaSources = inArea.filter((topic) => !isConcept(topic))
    if (areaSources.length > 0) {
      lines.push(
        '',
        '| | Source | Kind | What it gives us | About | First cited in | Claude read |',
        '| --- | --- | --- | --- | --- | --- | --- |',
      )
      for (const topic of areaSources) {
        const by = [topic.authors, topic.year].filter(Boolean).join(', ')
        // A source keeps the link to the original; our page, when there is one, comes after.
        const title = name({ ...topic, page: undefined })
        const ours = topic.page ? ` · **[our page](${href(topic.page)})**` : ''
        const source = `${title}${ours}${by ? `<br>*${cell(by)}*` : ''}${credit(topic)}`
        const about = topic.about.map((id) => cell(byId.get(id).title)).join(', ')
        const kind = map.kinds[topic.kind].title
        const firstCited = reference(topic.citedIn[0])
        const row = [source, kind, cell(topic.summary), about, firstCited, claudeRead(topic)]
        lines.push(`| ${ICONS[topic.status]} | ${row.join(' | ')} |`)
      }
    }
  }

  return `${lines.join('\n')}\n`
}

const map = JSON.parse(readFileSync(join(ROOT, MAP_PATH), 'utf8'))
const { errors, warnings } = check(map)
for (const warning of warnings) console.warn(`warning: ${warning}`)
if (errors.length > 0) {
  console.error(`${MAP_PATH} has ${errors.length} problem(s):\n- ${errors.join('\n- ')}`)
  process.exit(1)
}

const index = renderIndex(map)
const indexFile = join(ROOT, INDEX_PATH)
if (process.argv.includes('--check')) {
  const current = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : ''
  if (current !== index) {
    console.error(`${INDEX_PATH} is out of date: run \`npm run topics\`.`)
    process.exit(1)
  }
  console.log(`${MAP_PATH}: ${map.topics.length} topics, all good.`)
} else {
  writeFileSync(indexFile, index)
  console.log(`${MAP_PATH}: ${map.topics.length} topics checked, ${INDEX_PATH} written.`)
}
