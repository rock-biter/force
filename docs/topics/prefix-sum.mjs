// How long does FORCE's prefix sum take? Times its three shaders (book-blocks, book-scan and
// book-ends of examples/force-plus) and clear-if, each one alone, on buffers as large as our pages
// use: the numbers of logbook chapter 037.
//
//   node docs/topics/prefix-sum.mjs
//
// It serves a page on localhost, opens it in Chrome without a window, and prints what the page
// measured. It needs Google Chrome on a Mac; set CHROME to its path elsewhere. Each time is the
// median of 30 runs, and a run is 10 repeats in one compute pass between two timestamps.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 8791

// [name, slots that count particles, particles]
const CASES = [
  ['grid of the page that tilts, 151 x 148 x 175 cells', 151 * 148 * 175, 50_000],
  ['table for 100 000 particles', 262_144, 100_000],
  ['table for 50 000 particles', 131_072, 50_000],
]

const examples = new URL('../../examples/', import.meta.url)
const read = (path) => readFileSync(new URL(path, examples), 'utf8')
const shared = read('contact-cost/common.wgsl') + read('contact-cost/rebuild.wgsl')
const shaders = {
  blocks: shared + read('force-plus/book-blocks.wgsl'),
  scan: shared + read('force-plus/book-scan.wgsl'),
  ends: shared + read('force-plus/book-ends.wgsl'),
  clear: shared + read('contact-cost/clear-if.wgsl'),
}

/** Runs in the page: `shaders` and `cases` are the values above. */
async function measure(shaders, cases) {
  const BLOCK = 512 // as in book-blocks.wgsl
  const REPEAT = 10
  const RUNS = 30
  const adapter = await navigator.gpu.requestAdapter()
  const device = await adapter.requestDevice({ requiredFeatures: ['timestamp-query'] })
  const pipelines = {}
  for (const [key, code] of Object.entries(shaders))
    pipelines[key] = await device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: device.createShaderModule({ code }) },
    })
  const stamps = device.createQuerySet({ type: 'timestamp', count: 2 })
  const resolved = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  })
  const STORAGE = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  const READ = GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
  const buffer = (size, usage = STORAGE) => device.createBuffer({ size, usage })
  const rows = []

  for (const [name, slots, particles] of cases) {
    const blockCount = Math.ceil(slots / BLOCK)
    const params = buffer(80, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST)
    const control = buffer(32)
    const counts = buffer(slots * 4)
    const blocks = buffer(blockCount * 4)
    const ends = buffer(slots * 4)
    // control[0] = 1: the list must be made again, so no shader returns early (rebuild.wgsl)
    device.queue.writeBuffer(control, 0, new Uint32Array([1, 1, 0, 0, 0]))
    const filled = new Uint32Array(slots)
    for (let i = 0; i < particles; i++) filled[Math.floor(Math.random() * slots)]++
    device.queue.writeBuffer(counts, 0, filled)

    const group = (pipeline, buffers) =>
      device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: buffers.map((b, binding) => ({ binding, resource: { buffer: b } })),
      })
    const groups = {
      blocks: group(pipelines.blocks, [params, control, counts, blocks]),
      scan: group(pipelines.scan, [params, control, blocks]),
      ends: group(pipelines.ends, [params, control, counts, blocks, ends]),
      clear: group(pipelines.clear, [params, control, ends]), // `ends` is as large as `counts`
    }
    const workgroups = {
      blocks: Math.ceil(blockCount / 64),
      scan: 1,
      ends: Math.ceil(blockCount / 64),
      clear: Math.ceil(slots / 64),
    }
    const run = (pass, keys) => {
      for (const key of keys) {
        pass.setPipeline(pipelines[key])
        pass.setBindGroup(0, groups[key])
        pass.dispatchWorkgroups(workgroups[key])
      }
    }

    /** The median, in ms, of RUNS timings of these shaders one after the other. */
    async function time(keys) {
      const times = []
      for (let i = 0; i < RUNS; i++) {
        const encoder = device.createCommandEncoder()
        const pass = encoder.beginComputePass({
          timestampWrites: {
            querySet: stamps,
            beginningOfPassWriteIndex: 0,
            endOfPassWriteIndex: 1,
          },
        })
        for (let r = 0; r < REPEAT; r++) run(pass, keys)
        pass.end()
        const back = buffer(16, READ)
        encoder.resolveQuerySet(stamps, 0, 2, resolved, 0)
        encoder.copyBufferToBuffer(resolved, 0, back, 0, 16)
        device.queue.submit([encoder.finish()])
        await back.mapAsync(GPUMapMode.READ)
        const [begin, end] = new BigUint64Array(back.getMappedRange())
        back.destroy()
        times.push(Number(end - begin) / 1e6 / REPEAT)
      }
      return times.sort((a, b) => a - b)[RUNS >> 1]
    }

    const row = { name, slots, blocks: blockCount }
    row['whole sum, ms'] = await time(['blocks', 'scan', 'ends'])
    row['1 block sums'] = await time(['blocks'])
    row['2 one thread'] = await time(['scan'])
    row['3 walk blocks'] = await time(['ends'])
    row.clear = await time(['clear'])
    row['whole sum again'] = await time(['blocks', 'scan', 'ends'])

    // Is the sum right? After one clean run the last row of `ends` is the number of particles.
    const encoder = device.createCommandEncoder()
    const pass = encoder.beginComputePass()
    run(pass, ['blocks', 'scan', 'ends'])
    pass.end()
    const back = buffer(4, READ)
    encoder.copyBufferToBuffer(ends, (slots - 1) * 4, back, 0, 4)
    device.queue.submit([encoder.finish()])
    await back.mapAsync(GPUMapMode.READ)
    row['sum right'] = new Uint32Array(back.getMappedRange())[0] === particles
    rows.push(row)
    for (const b of [params, control, counts, blocks, ends, back]) b.destroy()
  }
  return { gpu: adapter.info?.description || adapter.info?.vendor, rows }
}

const page = `<!doctype html><meta charset="utf-8"><script type="module">
${measure}
const post = (result) => fetch('/result', { method: 'POST', body: JSON.stringify(result) })
measure(${JSON.stringify(shaders)}, ${JSON.stringify(CASES)})
  .then(post, (error) => post({ error: String(error?.stack ?? error) }))
</script>`

const profile = mkdtempSync(join(tmpdir(), 'force-prefix-sum-'))
let chrome
const close = (code) => {
  chrome?.kill()
  server.close()
  setTimeout(() => {
    rmSync(profile, { recursive: true, force: true })
    process.exit(code)
  }, 500)
}

const server = http.createServer((request, response) => {
  if (request.url === '/') {
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end(page)
  } else if (request.url === '/result') {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      response.end('ok')
      const result = JSON.parse(body)
      if (result.error) {
        console.error(result.error)
        close(1)
        return
      }
      console.log(`GPU: ${result.gpu}`)
      console.table(
        result.rows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value,
            ]),
          ),
        ),
      )
      close(0)
    })
  } else {
    response.writeHead(404) // the favicon
    response.end()
  }
})

server.listen(PORT, () => {
  chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--enable-unsafe-webgpu',
      '--enable-webgpu-developer-features', // exact timestamps, not rounded to 0.1 ms
      '--no-first-run',
      `--user-data-dir=${profile}`,
      `http://localhost:${PORT}/`,
    ],
    { stdio: 'ignore' },
  )
})
setTimeout(() => {
  console.error('No answer from Chrome after two minutes.')
  close(1)
}, 120_000)
