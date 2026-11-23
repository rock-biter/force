// What makes one way of keeping the cells better than another? Runs the shaders of
// examples/force-plus on fixed scenes, changing one thing at a time: how many particles, the shape
// and the size of the world, the way the cells are kept, the hash, the size of its blocks, the
// slots per particle, the width of a cell. The numbers of logbook chapter 042.
//
//   node docs/topics/cells-study.mjs            every sweep, about ten minutes
//   node docs/topics/cells-study.mjs blocks     only the sweeps whose name starts with "blocks":
//                                               their rows replace the old ones in the results
//
// It serves a page on localhost, opens it in Chrome without a window, and writes what the page
// measured to docs/topics/cells-study.json. It needs Google Chrome on a Mac; set CHROME to its
// path elsewhere.
//
// A scene is a set of particles at rest, 20 cm wide, on a lattice with a little noise, numbered
// in random order. Nothing moves: the shaders that find the neighbours and one round of pushes are
// timed on it, each time the median of 7 runs of several repeats. With PASSES=3 before the command
// the whole plan is run three times over, and each number is the median of the three, with the
// lowest and the highest step next to it: two ways closer than that are not told apart.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// The measure itself, shared with the bench page of the site. Node strips its types.
import { FULL, study } from '../../examples/bench/study.ts'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 8792
const only = process.argv[2] ?? ''

// ---- the shaders -----------------------------------------------------------------------------
const examples = new URL('../../examples/', import.meta.url)
const read = (path) => readFileSync(new URL(path, examples), 'utf8')
const shaders = {
  common: read('contact-cost/common.wgsl'),
  rebuild: read('contact-cost/rebuild.wgsl'),
  clear: read('contact-cost/clear-if.wgsl'),
  gridIf: read('contact-cost/grid-if.wgsl'),
  placesList: read('contact-cost/list.wgsl'),
  cellsGrid: read('force-plus/cells-grid.wgsl'),
  cellsTable: read('force-plus/cells-table.wgsl'),
  count: read('force-plus/book-count.wgsl'),
  blocks: read('force-plus/book-blocks.wgsl'),
  scan: read('force-plus/book-scan.wgsl'),
  ends: read('force-plus/book-ends.wgsl'),
  fill: read('force-plus/book-fill.wgsl'),
  list: read('force-plus/book-list.wgsl'),
  move: read('force-plus/book-move.wgsl'),
  settle: read('force-plus/book-settle.wgsl'),
  round: read('force-plus/round-push.wgsl'),
}

// ---- the server ------------------------------------------------------------------------------
const PASSES = Number(process.env.PASSES) || 1
const chosen = FULL.filter((job) => job.sweep.startsWith(only))
const jobs = Array.from({ length: PASSES }, () => chosen).flat()
const page = `<!doctype html><meta charset="utf-8"><script type="module">
${study}
const post = (path, body) => fetch(path, { method: 'POST', body: JSON.stringify(body) })
study(${JSON.stringify(shaders)}, ${JSON.stringify(jobs)}, (row, index, of) => post('/progress', { ...row, index, of }), ${process.env.CLOCK === 'page'})
  .then((result) => post('/result', result), (error) => post('/result', { error: String(error?.stack ?? error) }))
</script>`

const profile = mkdtempSync(join(tmpdir(), 'force-cells-study-'))
let chrome
const close = (code) => {
  chrome?.kill()
  server.close()
  setTimeout(() => {
    rmSync(profile, { recursive: true, force: true })
    process.exit(code)
  }, 500)
}
const ms = (v) => (v === undefined ? '' : v.toFixed(2).padStart(7))
const body = (request) =>
  new Promise((resolve) => {
    let text = ''
    request.on('data', (chunk) => {
      text += chunk
    })
    request.on('end', () => resolve(JSON.parse(text)))
  })

const server = http.createServer(async (request, response) => {
  if (request.url === '/') {
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end(page)
  } else if (request.url === '/progress') {
    const r = await body(request)
    response.end('ok')
    const scene = [r.shape, r.count, r.world ?? r.axis ?? ''].join(' ').trim()
    const how = [
      r.way,
      r.block ?? '',
      r.sorted ? '' : 'unsorted',
      `${r.perParticle}/p`,
      `${r.cell}m`,
    ]
    console.log(
      `${String(r.index + 1).padStart(3)}/${r.of} ${r.sweep.padEnd(6)} ${scene.padEnd(20)} ${how.join(' ').padEnd(30)}` +
        (r.tooLarge
          ? ` too large: ${r.worldCells} cells, ${r.cellsMB.toFixed(0)} MB`
          : ` build${ms(r.build)} list${ms(r.list)} round${ms(r.round)} step${ms(r.step)}  ${r.cellsMB.toFixed(1)} MB` +
            `  n=${r.neighbours}${r.leftOut ? ` out=${r.leftOut}` : ''}${r.sharing === undefined ? '' : ` share=${(100 * r.sharing).toFixed(0)}%`}${r.error ? ` ERROR ${r.error}` : ''}`),
    )
  } else if (request.url === '/result') {
    const result = await body(request)
    response.end('ok')
    if (result.error) {
      console.error(result.error)
      close(1)
      return
    }
    // One row per job of the plan: the median of its passes, and its lowest and highest step.
    const middle = (values) => values.sort((a, b) => a - b)[values.length >> 1]
    const rows = chosen.map((_, k) => {
      const passes = result.results.filter((_, i) => i % chosen.length === k)
      const row = { ...passes[0] }
      if (row.tooLarge) return row
      for (const key of ['build', 'list', 'round', 'step'])
        row[key] = middle(passes.map((r) => r[key]))
      row.stepLow = Math.min(...passes.map((r) => r.step))
      row.stepHigh = Math.max(...passes.map((r) => r.step))
      row.passes = PASSES
      return row
    })
    // CLOCK=page tries the page's clock, the one of devices with no GPU clock, and DRY=1 only
    // prints: neither touches the results.
    if (process.env.DRY || process.env.CLOCK) {
      console.log(`GPU: ${result.gpu}, clock: ${result.clock}. Nothing written.`)
      close(0)
      return
    }
    const out = new URL('./cells-study.json', import.meta.url)
    // A run of some sweeps only keeps the rows of the others.
    const kept = only
      ? JSON.parse(readFileSync(out, 'utf8')).results.filter((r) => !r.sweep.startsWith(only))
      : []
    writeFileSync(
      out,
      `${JSON.stringify({ gpu: result.gpu, results: [...kept, ...rows] }, null, 2)}\n`,
    )
    console.log(`GPU: ${result.gpu}. Written to ${out.pathname}`)
    close(0)
  } else {
    response.writeHead(404) // the favicon
    response.end()
  }
})

// Only this computer can reach the page: nothing else on the network can talk to this server.
server.listen(PORT, '127.0.0.1', () => {
  chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--enable-unsafe-webgpu',
      '--enable-webgpu-developer-features', // exact timestamps, not rounded to 0.1 ms
      '--no-first-run',
      `--user-data-dir=${profile}`,
      `http://127.0.0.1:${PORT}/`,
    ],
    { stdio: 'ignore' },
  )
})
setTimeout(() => {
  console.error('No answer from Chrome after thirty minutes.')
  close(1)
}, 1_800_000)
