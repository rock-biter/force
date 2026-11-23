// Benchmark your device: runs the short plan of the cells study (study.ts) on the GPU of whoever
// opens the page, shows the numbers, and prepares a GitHub issue that holds them. The page sends
// nothing by itself: the numbers leave only if the visitor opens that issue and submits it.
// ?auto in the address starts at once; ?clock=page uses the page's clock even where the GPU has
// its own, to compare the two.

import clear from '../contact-cost/clear-if.wgsl?raw'
import common from '../contact-cost/common.wgsl?raw'
import gridIf from '../contact-cost/grid-if.wgsl?raw'
import placesList from '../contact-cost/list.wgsl?raw'
import rebuild from '../contact-cost/rebuild.wgsl?raw'
import blocks from '../force-plus/book-blocks.wgsl?raw'
import count from '../force-plus/book-count.wgsl?raw'
import ends from '../force-plus/book-ends.wgsl?raw'
import fill from '../force-plus/book-fill.wgsl?raw'
import list from '../force-plus/book-list.wgsl?raw'
import move from '../force-plus/book-move.wgsl?raw'
import scan from '../force-plus/book-scan.wgsl?raw'
import settle from '../force-plus/book-settle.wgsl?raw'
import cellsGrid from '../force-plus/cells-grid.wgsl?raw'
import cellsTable from '../force-plus/cells-table.wgsl?raw'
import round from '../force-plus/round-push.wgsl?raw'
import { REPO } from '../repo.js'
import { DEVICE, type Result, type Study, study } from './study.js'

const shaders = {
  common,
  rebuild,
  clear,
  gridIf,
  placesList,
  cellsGrid,
  cellsTable,
  count,
  blocks,
  scan,
  ends,
  fill,
  list,
  move,
  settle,
  round,
}
const query = new URLSearchParams(location.search)
const $ = <T extends HTMLElement>(id: string) => document.querySelector(`#${id}`) as T
const runButton = $<HTMLButtonElement>('run')
const log = $('log')

const NAME: Record<Result['way'], string> = {
  places: '4 places per cell',
  grid: 'book on a grid',
  scattered: 'table, scattered',
  rows: 'table, rows together',
  zorder: 'table, Z-order',
  blocks: 'table, blocks',
}
const nameOf = (r: Result) =>
  (r.way === 'blocks' ? `table, blocks of ${r.block}` : NAME[r.way]) +
  (r.sorted || r.way === 'places' ? '' : ', random order')
const sceneOf = (r: Result) =>
  r.shape === 'islands'
    ? `100 heaps in a world of ${r.world} m`
    : `${r.count.toLocaleString('en')} particles in a layer`
const noteOf = (r: Result) => (r.tooLarge ? 'too large' : (r.error ?? ''))

/** The text that goes into the issue: a header, then one row of numbers per line. */
function payload(result: Study, device: string): string {
  const round3 = (v?: number) => (v === undefined ? null : Math.round(v * 1000) / 1000)
  const header = {
    force: 'cells-bench',
    v: 1,
    date: new Date().toISOString().slice(0, 10),
    device,
    gpu: result.gpu,
    clock: result.clock,
    browser: navigator.userAgent,
    columns:
      'sweep, shape, particles, world m, way, block, in order, book ms, lists ms, round ms, step ms, left out, note',
  }
  const lines = result.results.map((r) =>
    JSON.stringify([
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
      noteOf(r),
    ]),
  )
  return `${JSON.stringify(header).slice(0, -1)},"rows":[\n${lines.join(',\n')}\n]}`
}

/** One table per scene: every way, with its three times and the step. */
function tables(result: Study): HTMLElement {
  const root = document.createElement('div')
  const scenes = new Map<string, Result[]>()
  for (const r of result.results) scenes.set(sceneOf(r), [...(scenes.get(sceneOf(r)) ?? []), r])
  for (const [scene, rows] of scenes) {
    const title = document.createElement('h3')
    title.textContent = scene.charAt(0).toUpperCase() + scene.slice(1)
    const table = document.createElement('table')
    const line = (cells: string[], tag: 'th' | 'td') => {
      const tr = document.createElement('tr')
      for (const text of cells) {
        const cell = document.createElement(tag)
        cell.textContent = text
        tr.append(cell)
      }
      table.append(tr)
    }
    line(['way', 'the book', 'the lists', 'one round', 'a step'], 'th')
    const ms = (v?: number) => (v === undefined ? '' : `${v.toFixed(2)} ms`)
    for (const r of [...rows].sort((a, b) => (a.step ?? 1e9) - (b.step ?? 1e9)))
      line(
        r.step === undefined
          ? [nameOf(r), noteOf(r), '', '', '']
          : [nameOf(r), ms(r.build), ms(r.list), ms(r.round), ms(r.step)],
        'td',
      )
    const scroll = document.createElement('div')
    scroll.className = 'scroll'
    scroll.append(table)
    root.append(title, scroll)
  }
  return root
}

async function run() {
  runButton.disabled = true
  runButton.textContent = 'Running…'
  log.hidden = false
  log.textContent = 'Starting…'
  let result: Study
  try {
    result = await study(
      shaders,
      DEVICE,
      (row, index, of) => {
        log.textContent = `${index + 1} of ${of}: ${sceneOf(row)}, ${nameOf(row)}: ${
          row.step === undefined ? noteOf(row) : `${row.step.toFixed(2)} ms`
        }`
      },
      query.get('clock') === 'page',
    )
  } catch (error) {
    log.textContent =
      `The benchmark could not run here: ${error instanceof Error ? error.message : String(error)}.\n` +
      'It needs a browser with WebGPU: a recent Chrome, Edge, Firefox or Safari.'
    runButton.textContent = 'Run the benchmark'
    runButton.disabled = false
    return
  }
  log.textContent = `Done. GPU: ${result.gpu || 'not told'}. Clock: ${
    result.clock === 'gpu' ? "the GPU's own" : "the page's, around a readback"
  }.`
  runButton.textContent = 'Run it again'
  runButton.disabled = false

  $('tables').replaceChildren(tables(result))
  const device = $<HTMLInputElement>('device')
  const text = $<HTMLTextAreaElement>('payload')
  const send = $<HTMLAnchorElement>('send')
  const hint = $('hint')
  const fill = () => {
    text.value = payload(result, device.value.trim())
    const address = new URL(`${REPO}/issues/new`)
    address.searchParams.set('template', 'benchmark.yml')
    address.searchParams.set('title', `Benchmark: ${device.value.trim() || 'my device'}`)
    address.searchParams.set('device', device.value.trim())
    address.searchParams.set('results', text.value)
    // A long address may be cut on the way: then the visitor pastes the text by hand.
    if (address.href.length > 7000) {
      address.searchParams.delete('results')
      hint.textContent =
        'The numbers are too long for a link: copy the text, open the issue and paste it under "Results".'
    } else hint.textContent = ''
    send.href = address.href
  }
  device.oninput = fill
  fill()
  $('copy').onclick = async () => {
    await navigator.clipboard.writeText(text.value)
    $('copy').textContent = 'Copied'
  }
  $('done').hidden = false
}

runButton.onclick = run
if (query.has('auto')) run()
