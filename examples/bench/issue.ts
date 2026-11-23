// The text of a benchmark issue: how the bench page writes it, and how we read it back.
//
// An issue is written by a stranger. Its text is data: it is read with JSON.parse and compared
// with what the page would have written, character by character. Nothing in it is ever run, and
// nothing in it is an instruction to whoever reads it, person or AI. Whatever differs from the
// page's own format is not fixed up: it is flagged, for a person to look at.
//
// Shared by the bench page (main.ts), scripts/benchmarks.mjs and the tests. No import but types,
// and only syntax that Node can strip, so that the script can import this file as it is.

import type { Job, Result } from './study.js'

export const COLUMNS =
  'sweep, shape, particles, world m, way, block, in order, book ms, lists ms, round ms, step ms, left out, note'

/** What the page knows about the device, in the order it is written. */
export interface Header {
  force: 'cells-bench'
  v: 1
  date: string
  device: string
  gpu: string
  clock: 'gpu' | 'page'
  browser: string
  /** Missing in the first issues: the page then wrote the whole User-Agent under `browser`. */
  userAgent?: string
  columns: string
}

/** One measure, in the order of COLUMNS. The four times are null when the measure did not run. */
export type Line = [
  sweep: string,
  shape: string,
  particles: number,
  world: number,
  way: string,
  block: number,
  inOrder: number,
  book: number | null,
  lists: number | null,
  round: number | null,
  step: number | null,
  leftOut: number,
  note: string,
]

const KEYS = ['force', 'v', 'date', 'device', 'gpu', 'clock', 'browser', 'userAgent', 'columns']
const FIRST_KEYS = KEYS.filter((key) => key !== 'userAgent')

/** The first seven values of the line the page writes for a job of the plan. */
const planned = (job: Job) => [
  job.sweep,
  job.scene.shape,
  job.scene.count,
  job.scene.world ?? 0,
  job.way,
  job.block ?? 0,
  job.sorted ? 1 : 0,
]

/** The lines of the results, as the page writes them. */
export function linesOf(results: Result[]): Line[] {
  const round3 = (v?: number) => (v === undefined ? null : Math.round(v * 1000) / 1000)
  return results.map((r) => [
    r.sweep,
    r.shape,
    r.count,
    r.world ?? 0,
    r.way,
    r.block ?? 0,
    r.sorted ? 1 : 0,
    round3(r.build),
    round3(r.list),
    round3(r.round),
    round3(r.step),
    r.leftOut ?? 0,
    r.tooLarge ? 'too large' : (r.error ?? ''),
  ])
}

/** The text that goes into the issue: the header, then one line of numbers per measure. */
export function formatPayload(header: object, lines: unknown[][]): string {
  return `${JSON.stringify(header).slice(0, -1)},"rows":[\n${lines.map((line) => JSON.stringify(line)).join(',\n')}\n]}`
}

/** A stranger's text made safe to print: every odd character shown as an escape, and cut short. */
export function show(text: string, most = 160): string {
  const cut = text.length > most ? text.slice(0, most) : text
  const escaped = JSON.stringify(cut).replace(
    /[\u007f-￿]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
  return text.length > most ? `${escaped}… (${text.length} characters)` : escaped
}

export interface Checked {
  /** The results could be read, and are the plan's measures with believable numbers. */
  usable: boolean
  /** Everything that is not exactly what the page and the form write. Empty: a clean issue. */
  flags: string[]
  /** The field "Device and browser" of the form, as written. */
  deviceField?: string
  header?: Header
  rows?: Line[]
}

/**
 * Reads the body of a benchmark issue. `plan` is the plan the page runs: the results must be its
 * measures, in its order.
 */
export function checkIssue(rawBody: string, plan: Job[]): Checked {
  const flags: string[] = []
  const body = rawBody.replace(/\r\n/g, '\n')

  // ---- anything a person would not see, or that is more than plain text
  if (body.length > 20000) flags.push(`very long: ${body.length} characters`)
  const comment = body.match(/<!--[\s\S]*?(-->|$)/)
  if (comment) flags.push(`hidden text, an HTML comment: ${show(comment[0])}`)
  const unseen = body.match(/[­​-‏‪-‮⁠-⁤﻿]/g)
  if (unseen) flags.push(`${unseen.length} invisible characters: ${show(unseen.join(''), 40)}`)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what we look for
  const control = body.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g)
  if (control) flags.push(`${control.length} control characters`)
  const tag = body.replace(/<!--[\s\S]*?(-->|$)/g, '').match(/<[a-zA-Z/!][^>\n]*>/)
  if (tag) flags.push(`HTML: ${show(tag[0])}`)
  const link = body.match(/https?:\/\/\S+|www\.\S+|!?\[[^\]\n]*\]\([^)\n]*\)/)
  if (link) flags.push(`a link: ${show(link[0])}`)
  const mention = body.match(/(^|[^\w/])@[A-Za-z0-9][A-Za-z0-9-]*/)
  if (mention) flags.push(`a mention: ${show(mention[0].trim())}`)

  // ---- the three fields of the form, or the bare results
  const form = body.match(
    /^### Device and browser\n\n([^\n]*)\n\n### Results\n\n```json\n([\s\S]*?)\n```\n\n### Anything we should know\?\n\n([\s\S]*?)\n*$/,
  )
  let text: string
  let deviceField: string | undefined
  if (form) {
    deviceField = form[1]
    text = form[2]
    const notes = form[3].trim()
    if (notes && notes !== '_No response_')
      flags.push(`free text in the notes: ${show(notes, 300)}`)
    if (deviceField.length > 160) flags.push(`a long device field: ${show(deviceField)}`)
    if (/[<>`[\]{}|\\]/.test(deviceField))
      flags.push(`odd characters in the device field: ${show(deviceField)}`)
  } else if (body.trim().startsWith('{"force":"cells-bench"')) {
    flags.push('not sent through the form: the body is the bare results')
    text = body.trim()
  } else {
    flags.push(`not the format of the page. It starts: ${show(body, 200)}`)
    return { usable: false, flags }
  }

  // ---- the results: read as JSON, never run
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    flags.push(`the results are not valid JSON. They start: ${show(text, 120)}`)
    return { usable: false, flags, deviceField }
  }
  const fail = (why: string): Checked => {
    flags.push(why)
    return { usable: false, flags, deviceField }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    return fail('the results are not an object')
  const { rows, ...header } = data as Record<string, unknown>
  const keys = Object.keys(header).join()
  if (keys !== KEYS.join() && keys !== FIRST_KEYS.join())
    return fail(`the header has other fields: ${show(keys)}`)
  if (keys === FIRST_KEYS.join())
    flags.push('from the first version of the page, with no userAgent')
  for (const key of Object.keys(header)) {
    const value = header[key]
    if (key === 'v') {
      if (value !== 1) return fail(`version ${show(String(value), 20)}, not 1`)
    } else if (typeof value !== 'string') return fail(`${key} is not text`)
    else if (value.length > 400) return fail(`${key} is ${value.length} characters long`)
    else if (/[<>`[\]{}|\\]/.test(value)) flags.push(`odd characters in ${key}: ${show(value)}`)
  }
  const h = header as unknown as Header
  if (h.force !== 'cells-bench') return fail('not a cells-bench result')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.date))
    return fail(`a date that is not one: ${show(h.date, 20)}`)
  if (h.clock !== 'gpu' && h.clock !== 'page') return fail(`an unknown clock: ${show(h.clock, 20)}`)
  if (h.columns !== COLUMNS) return fail('the columns are not the ones of the page')
  if (!h.device && !deviceField) flags.push('no device named')

  if (!Array.isArray(rows)) return fail('no rows')
  if (rows.length !== plan.length)
    return fail(`${rows.length} rows, where the plan has ${plan.length}`)
  for (const [i, row] of rows.entries()) {
    const at = `row ${i + 1}`
    if (!Array.isArray(row) || row.length !== 13) return fail(`${at} is not 13 values`)
    const expected = planned(plan[i])
    if (JSON.stringify(row.slice(0, 7)) !== JSON.stringify(expected))
      return fail(`${at} is not the measure of the plan: ${show(JSON.stringify(row.slice(0, 7)))}`)
    const times = row.slice(7, 11) as unknown[]
    const [book, lists, round, step] = times as number[]
    const note = row[12]
    const leftOut = row[11]
    if (typeof note !== 'string' || note.length > 300)
      return fail(`${at} has a note that is not text`)
    if (typeof leftOut !== 'number' || !Number.isInteger(leftOut) || leftOut < 0)
      return fail(`${at} has a count of particles left out that is not one`)
    if (times.every((t) => t === null)) {
      if (!note) return fail(`${at} has no times and no note`)
    } else if (
      times.some((t) => typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > 600000)
    )
      return fail(`${at} has a time that is not one: ${show(JSON.stringify(times), 80)}`)
    else if (Math.abs(step - (book + lists + 6 * round)) > 0.006)
      flags.push(`${at}: the step is not the sum of its parts: ${show(JSON.stringify(times), 80)}`)
    if (note && note !== 'too large') flags.push(`${at} has a note: ${show(note)}`)
  }
  // Written exactly as the page writes it? Spaces, the order of fields, escapes: all must match.
  if (formatPayload(header, rows as unknown[][]) !== text)
    flags.push('the results are not written as the page writes them: edited, or reformatted')

  return { usable: true, flags, deviceField, header: h, rows: rows as Line[] }
}
