// Takes the pictures of the demos for the cards of the demos page: examples/public/shots/<id>.jpg,
// one for each demo of examples/demos/demos.json.
//
//   npm run dev            in one terminal
//   npm run shots          in another; or: npm run shots -- cloth-pile curtains, for those only
//
// It opens each demo in Chrome without a window, lets it run for a few seconds, hides the panel
// and the text over the canvas, and saves what the canvas shows. Chrome is driven through its
// debugging port (the Chrome DevTools Protocol), with what Node has built in. The examples are
// read from http://localhost:5173/, unless SHOTS_URL says otherwise.

import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SITE = process.env.SHOTS_URL ?? 'http://localhost:5173/'
const PORT = 9334
const SIZE = { width: 960, height: 600 } // the picture, twice the 16 to 10 of a card
const WAIT = 7000 // milliseconds a demo runs before its picture: a pile has fallen by then
const HIDE = '.tp-dfwv, .crumb, body > p, body > pre { display: none !important }'

const root = new URL('..', import.meta.url)
const all = JSON.parse(readFileSync(new URL('examples/demos/demos.json', root), 'utf8'))
const asked = process.argv.slice(2)
const demos = asked.length ? all.filter((demo) => asked.includes(demo.id)) : all

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const profile = mkdtempSync(join(tmpdir(), 'force-shots-'))
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${PORT}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

try {
  // Chrome lists its pages at /json once it is up.
  let page
  for (let tries = 0; tries < 40 && !page; tries++) {
    await sleep(250)
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      page = pages.find((each) => each.type === 'page')
    } catch {}
  }
  if (!page) throw new Error('Chrome did not start')
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((done) => socket.addEventListener('open', done))
  let last = 0
  const answers = new Map()
  socket.addEventListener('message', (message) => {
    const { id, result, error } = JSON.parse(message.data)
    if (id) answers.get(id)?.(error ? Promise.reject(new Error(error.message)) : result)
  })
  const send = (method, params = {}) =>
    new Promise((done) => {
      answers.set(++last, done)
      socket.send(JSON.stringify({ id: last, method, params }))
    })

  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { ...SIZE, deviceScaleFactor: 1, mobile: false })
  for (const { id } of demos) {
    await send('Page.navigate', { url: `${SITE}${id}/` })
    await sleep(WAIT)
    await send('Runtime.evaluate', {
      expression: `document.head.append(Object.assign(document.createElement('style'), { textContent: ${JSON.stringify(HIDE)} }))`,
    })
    await sleep(200)
    const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 72 })
    const file = new URL(`examples/public/shots/${id}.jpg`, root)
    writeFileSync(file, Buffer.from(data, 'base64'))
    console.log(`${id}: ${Math.round(Buffer.from(data, 'base64').length / 1024)} kB`)
  }
} finally {
  chrome.kill()
  await sleep(300)
  rmSync(profile, { recursive: true, force: true })
}
