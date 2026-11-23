// Which way to keep the cells? The charts of docs/topics/cells-study.json, the numbers measured by
// docs/topics/cells-study.mjs: how long a step takes with each way of finding the neighbours of a
// particle, as the number of particles, the size of the world, the hash, its blocks, the slots and
// the width of a cell change. Nothing is measured here: the page only draws.

import raw from '../../docs/topics/cells-study.json?raw'

interface Row {
  sweep: string
  way: 'places' | 'grid' | 'scattered' | 'rows' | 'zorder' | 'blocks'
  sorted: boolean
  block?: number
  shape: string
  count: number
  world?: number
  axis?: string
  perParticle: number
  cell: number
  cellsMB: number
  tooLarge?: boolean
  sharing?: number
  build: number
  list: number
  round: number
  step: number
  stepLow?: number
  stepHigh?: number
}
const rows: Row[] = JSON.parse(raw).results

// One colour for each way, the same in every chart. Names are always written next to them.
const COLOR: Record<Row['way'], string> = {
  grid: '#2a78d6',
  rows: '#eb6834',
  zorder: '#1baf7a',
  blocks: '#eda100',
  scattered: '#e87ba4',
  places: '#008300',
}
const NAME: Record<Row['way'], string> = {
  grid: 'book on a grid',
  rows: 'table, rows together',
  zorder: 'table, Z-order',
  blocks: 'table, blocks',
  scattered: 'table, scattered',
  places: '4 places per cell',
}
const nameOf = (r: Row) => (r.way === 'blocks' ? `table, blocks of ${r.block}` : NAME[r.way])
const sceneOf = (r: Row) =>
  r.shape === 'islands'
    ? `100 heaps in a world of ${r.world} m`
    : r.shape === 'beam'
      ? `a beam of ${r.count.toLocaleString('en')} along ${r.axis}`
      : r.shape === 'cube'
        ? 'a cube'
        : `a layer of ${r.count.toLocaleString('en')} on a floor of 24 m`
const ms = (v: number) => `${v.toFixed(v < 100 ? 1 : 0)} ms`

const SVG = 'http://www.w3.org/2000/svg'
type Attrs = Record<string, string | number>
function svg(name: string, attrs: Attrs = {}, text?: string): SVGElement {
  const node = document.createElementNS(SVG, name)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  if (text !== undefined) node.textContent = text
  return node
}
function html(name: string, text = '', className = ''): HTMLElement {
  const node = document.createElement(name)
  node.textContent = text
  if (className) node.className = className
  return node
}

const tip = html('div', '', 'tip')
tip.hidden = true
document.body.append(tip)
function showTip(event: PointerEvent, text: string) {
  tip.textContent = text
  tip.hidden = false
  const wide = tip.offsetWidth
  tip.style.left = `${Math.min(event.clientX + 12, window.innerWidth - wide - 8)}px`
  tip.style.top = `${event.clientY + 12}px`
}

interface Series {
  name: string
  color: string
  dashed?: boolean
  points: [x: number, y: number][]
}
interface Axis {
  label: string
  log?: boolean
  ticks: number[]
  format?: (v: number) => string
}

/** Lines over a number: 2 px lines, a dot at every measure, the name at the end of each line. */
function lines(series: Series[], x: Axis, y: Axis): HTMLElement {
  const W = 720
  const H = 300
  const box = { left: 48, right: W - 236, top: 28, bottom: H - 40 }
  const scale = (axis: Axis, from: number, to: number) => {
    const f = (v: number) => (axis.log ? Math.log(v) : v)
    const low = f(axis.ticks[0])
    const high = f(axis.ticks[axis.ticks.length - 1])
    return (v: number) => from + ((f(v) - low) / (high - low)) * (to - from)
  }
  const sx = scale(x, box.left, box.right)
  const sy = scale(y, box.bottom, box.top)
  const figure = html('div', '', 'chart')
  const legend = html('div', '', 'legend')
  for (const s of series) {
    const item = html('span')
    const swatch = html('i', '', s.dashed ? 'dashed' : '')
    swatch.style.borderColor = s.color
    item.append(swatch, s.name)
    legend.append(item)
  }
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' })
  for (const t of y.ticks) {
    root.append(svg('line', { class: 'rule', x1: box.left, x2: box.right, y1: sy(t), y2: sy(t) }))
    root.append(
      svg(
        'text',
        { class: 'quiet', x: box.left - 8, y: sy(t) + 4, 'text-anchor': 'end' },
        String(t),
      ),
    )
  }
  for (const t of x.ticks)
    root.append(
      svg(
        'text',
        { class: 'quiet', x: sx(t), y: box.bottom + 16, 'text-anchor': 'middle' },
        (x.format ?? String)(t),
      ),
    )
  root.append(svg('text', { class: 'quiet', x: box.left, y: H - 4 }, x.label))
  root.append(svg('text', { class: 'quiet', x: 0, y: 10 }, y.label))

  // The names at the end of the lines, pushed apart where they would overlap.
  const ends = series
    .map((s) => ({ s, y: sy(s.points[s.points.length - 1][1]) }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 13)
  for (const s of series) {
    const path = s.points.map(([px, py], i) => `${i ? 'L' : 'M'}${sx(px)} ${sy(py)}`).join(' ')
    root.append(
      svg('path', {
        d: path,
        fill: 'none',
        stroke: s.color,
        'stroke-width': 2,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
        ...(s.dashed ? { 'stroke-dasharray': '6 5' } : {}),
      }),
    )
    for (const [px, py] of s.points)
      root.append(
        svg('circle', {
          cx: sx(px),
          cy: sy(py),
          r: 4,
          fill: s.color,
          stroke: 'var(--paper)',
          'stroke-width': 2,
        }),
      )
  }
  for (const { s, y: at } of ends) {
    const [px, py] = s.points[s.points.length - 1]
    root.append(svg('text', { x: sx(px) + 10, y: at + 4 }, `${s.name}, ${ms(py)}`))
  }

  // Hover: a hairline at the nearest measure, and every way's value there.
  const hair = svg('line', { class: 'rule', y1: box.top, y2: box.bottom, stroke: 'var(--ink)' })
  hair.style.display = 'none'
  root.append(hair)
  const all = [...new Set(series.flatMap((s) => s.points.map((p) => p[0])))].sort((a, b) => a - b)
  root.addEventListener('pointermove', (event) => {
    const bounds = root.getBoundingClientRect()
    const at = ((event.clientX - bounds.left) / bounds.width) * W
    const near = all.reduce((a, b) => (Math.abs(sx(b) - at) < Math.abs(sx(a) - at) ? b : a))
    hair.setAttribute('x1', String(sx(near)))
    hair.setAttribute('x2', String(sx(near)))
    hair.style.display = ''
    const found = series
      .map((s) => ({ s, p: s.points.find((p) => p[0] === near) }))
      .filter((f) => f.p)
      .sort((a, b) => (b.p as number[])[1] - (a.p as number[])[1])
    showTip(
      event,
      [
        `${x.label}: ${(x.format ?? String)(near)}`,
        ...found.map((f) => `${ms((f.p as number[])[1]).padStart(8)}  ${f.s.name}`),
      ].join('\n'),
    )
  })
  root.addEventListener('pointerleave', () => {
    hair.style.display = 'none'
    tip.hidden = true
  })
  figure.append(legend, root)
  return figure
}

interface Mark {
  name: string
  color: string
  value?: number
  low?: number
  high?: number
  note?: string
}

/** One row per way: a dot at its time, and a line from its lowest to its highest run. */
function dots(marks: Mark[], most: number, label: string): HTMLElement {
  const W = 720
  const ROW = 20
  const box = { left: 200, right: W - 110, top: 4 }
  const H = box.top + marks.length * ROW + 24
  const sx = (v: number) => box.left + (v / most) * (box.right - box.left)
  const figure = html('div', '', 'chart')
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' })
  const step = most > 20 ? 10 : most > 10 ? 5 : 1
  for (let t = 0; t <= most; t += step) {
    root.append(
      svg('line', { class: 'rule', x1: sx(t), x2: sx(t), y1: box.top, y2: H - 22 }),
      svg('text', { class: 'quiet', x: sx(t), y: H - 6, 'text-anchor': 'middle' }, String(t)),
    )
  }
  root.append(svg('text', { class: 'quiet', x: box.right + 24, y: H - 6 }, label))
  marks.forEach((m, i) => {
    const y = box.top + i * ROW + ROW / 2
    root.append(svg('text', { x: box.left - 10, y: y + 4, 'text-anchor': 'end' }, m.name))
    if (m.value === undefined) {
      root.append(svg('text', { class: 'quiet', x: box.left + 6, y: y + 4 }, m.note ?? ''))
      return
    }
    const group = svg('g')
    if (m.low !== undefined && m.high !== undefined)
      group.append(
        svg('line', {
          x1: sx(m.low),
          x2: sx(m.high),
          y1: y,
          y2: y,
          stroke: m.color,
          'stroke-width': 2,
          'stroke-linecap': 'round',
        }),
      )
    group.append(
      svg('circle', {
        cx: sx(m.value),
        cy: y,
        r: 5,
        fill: m.color,
        stroke: 'var(--paper)',
        'stroke-width': 2,
      }),
      // a wider target than the dot, for the pointer
      svg('rect', {
        x: box.left,
        y: y - ROW / 2,
        width: W - box.left,
        height: ROW,
        fill: 'transparent',
      }),
    )
    const range =
      m.low !== undefined && m.high !== undefined
        ? `\nfrom ${ms(m.low)} to ${ms(m.high)} in three runs`
        : ''
    group.addEventListener('pointermove', (event) =>
      showTip(event as PointerEvent, `${m.name}\n${ms(m.value as number)}${range}`),
    )
    group.addEventListener('pointerleave', () => {
      tip.hidden = true
    })
    root.append(group)
    root.append(svg('text', { x: sx(m.high ?? m.value) + 10, y: y + 4 }, ms(m.value)))
  })
  figure.append(root)
  return figure
}

/** The numbers of a chart, to read or to copy. */
function table(head: string[], body: (string | number)[][]): HTMLElement {
  const details = html('details')
  details.append(html('summary', 'the numbers'))
  const scroll = html('div', '', 'scroll')
  const grid = html('table')
  const top = html('tr')
  for (const h of head) top.append(html('th', h))
  grid.append(top)
  for (const line of body) {
    const tr = html('tr')
    for (const value of line)
      tr.append(html('td', typeof value === 'number' ? value.toFixed(2) : value))
    grid.append(tr)
  }
  scroll.append(grid)
  details.append(scroll)
  return details
}
const numbers = (list: Row[], first: (r: Row) => string) =>
  table(
    ['', 'way', 'make the book, ms', 'the lists, ms', 'one round, ms', 'a step, ms', 'cells, MB'],
    list.map((r) =>
      r.tooLarge
        ? [first(r), nameOf(r), 'too large', '', '', '', r.cellsMB]
        : [
            first(r),
            nameOf(r) + (r.sorted || r.way === 'places' ? '' : ', random order'),
            r.build,
            r.list,
            r.round,
            r.step,
            r.cellsMB,
          ],
    ),
  )

const of = (sweep: string) => rows.filter((r) => r.sweep === sweep)
const by = <T>(list: Row[], key: (r: Row) => T) => {
  const groups = new Map<T, Row[]>()
  for (const r of list) groups.set(key(r), [...(groups.get(key(r)) ?? []), r])
  return groups
}
const page = document.querySelector('#study') as HTMLElement
page.textContent = ''
const say = (tag: string, text: string) => page.append(html(tag, text))
const thousands = (v: number) => `${v / 1000}K`

say('h1', 'Which way to keep the cells')
say(
  'p',
  'To find which particles touch, FORCE cuts space into cells and keeps, for each cell, the particles in it. There are several ways to keep them, and none is the best everywhere. These charts show how each one changes with the project: how many particles, how large the world, what shape. A step here is what a step of 1/60 s spends on its neighbours: making the book of the cells, making the lists of neighbours and six rounds of pushes, on particles 20 cm wide that stand still, on a Mac M1. Lower is better.',
)
say(
  'p',
  'The ways: 4 places per cell; an address book, one list of all the particles sorted by cell, with a row of memory for every cell of a grid; and the same book in a hashed table, a few rows shared by all the cells, where a formula, the hash, says which row a cell uses. The hashes differ in which cells they keep next to each other in memory: none (scattered), the cells of a row along x, the cells of a block of space, or all of them along the Z-order curve.',
)

// 1. The number of particles
{
  const list = of('count')
  say('h2', '1. More particles: keep them in the order of their cells')
  say(
    'p',
    'With the particles moved into the order of the book, a step grows in line with their number. Left in random order, the worst case, it grows much faster: five times slower at 300 000. Both axes are logarithmic.',
  )
  const pick = (way: Row['way'], sorted: boolean) =>
    list
      .filter((r) => r.way === way && r.sorted === sorted)
      .map((r) => [r.count, r.step] as [number, number])
  page.append(
    lines(
      [
        { name: '4 places per cell', color: COLOR.places, points: pick('places', false) },
        {
          name: 'Z-order, random order',
          color: COLOR.zorder,
          dashed: true,
          points: pick('zorder', false),
        },
        {
          name: 'grid, random order',
          color: COLOR.grid,
          dashed: true,
          points: pick('grid', false),
        },
        { name: 'Z-order, in order', color: COLOR.zorder, points: pick('zorder', true) },
        { name: 'grid, in order', color: COLOR.grid, points: pick('grid', true) },
      ],
      { label: 'particles', log: true, ticks: [10000, 30000, 100000, 300000], format: thousands },
      { label: 'ms per step', log: true, ticks: [0.3, 1, 3, 10, 30, 100] },
    ),
    numbers(list, (r) => r.count.toLocaleString('en')),
  )
}

// 2. The size of the world
{
  const list = of('world')
  say('h2', '2. A larger world: the table does not notice, the grid cannot follow')
  say(
    'p',
    '100 000 particles in 100 heaps, scattered in a cube of growing side. A grid pays for every cell of the world, full or empty: at 40 m it takes 32 MB and three times the time, at 80 m it would take 252 MB and does not fit our shaders. A table takes 2 MB at every size.',
  )
  const ways: Row['way'][] = ['grid', 'scattered', 'rows', 'blocks', 'zorder']
  page.append(
    lines(
      ways.map((way) => ({
        name:
          way === 'grid'
            ? 'grid, too large from 80 m'
            : way === 'blocks'
              ? 'table, blocks of 8'
              : NAME[way],
        color: COLOR[way],
        points: list
          .filter((r) => r.way === way && !r.tooLarge)
          .map((r) => [r.world, r.step] as [number, number]),
      })),
      { label: 'side of the world, m', log: true, ticks: [20, 40, 80, 320, 1280] },
      { label: 'ms per step', ticks: [0, 2, 4, 6, 8, 10, 12] },
    ),
    numbers(list, (r) => `${r.world} m`),
  )
}

// 3. The hash and its blocks
{
  const list = of('blocks')
  say('h2', '3. Which hash: the larger the block kept together, the better')
  say(
    'p',
    'Five scenes, each run three times: the dot is the middle run, the line goes from the fastest to the slowest. Keeping rows together is the slowest hash, blocks of 32 cells the fastest, on every scene. Z-order is as fast as large blocks, except on the beam, which is longer than the stretch of space Z-order keeps in order before it repeats. The grid is faster still where the world is small enough to have one.',
  )
  for (const [scene, group] of by(list, sceneOf)) {
    say('h3', scene.charAt(0).toUpperCase() + scene.slice(1))
    page.append(
      dots(
        group.map((r) => ({
          name: nameOf(r),
          color: COLOR[r.way],
          value: r.tooLarge ? undefined : r.step,
          low: r.stepLow,
          high: r.stepHigh,
          note: 'too large: the world does not fit a grid',
        })),
        group[0].count > 100000 ? 20 : 6,
        'ms per step',
      ),
    )
  }
  page.append(numbers(list, sceneOf))

  const large = of('large')
  say('h3', 'Blocks larger than 32')
  say(
    'p',
    'A block of 64 cells a side is 262 144 slots, a whole table of 100 000 particles, so larger blocks need larger scenes. They bring nothing more: 32 and 64 are level on the layers, and a block of 128 is as large as these tables, which makes it the Z-order curve. On the beam, 234 m long, the table holds only 4 blocks of 64 and the beam crosses 15: they pile onto the same slots, and making the lists takes longer. A block must stay small enough for the table to hold many.',
  )
  for (const [scene, group] of by(large, sceneOf)) {
    say('h3', scene.charAt(0).toUpperCase() + scene.slice(1))
    page.append(
      dots(
        group.map((r) => ({
          name: nameOf(r),
          color: COLOR[r.way],
          value: r.step,
          low: r.stepLow,
          high: r.stepHigh,
        })),
        group[0].count > 300000 ? 40 : 15,
        'ms per step',
      ),
    )
  }
  page.append(numbers(large, sceneOf))
}

// 4. The shape
{
  const list = of('axis')
  say('h2', '4. The shape: the axis a scene lies along does not matter')
  say(
    'p',
    'A beam of 100 000 particles lying along x, then y, then z. The hash that keeps rows along x together is no faster along x. One run each: differences of a few tenths mean nothing.',
  )
  page.append(
    dots(
      list.map((r) => ({
        name: `${nameOf(r)}, along ${r.axis}`,
        color: COLOR[r.way],
        value: r.step,
      })),
      8,
      'ms per step',
    ),
    numbers(list, (r) => `along ${r.axis}`),
  )
}

// 5. Slots per particle
{
  const list = of('slots')
  say('h2', '5. More slots in the table: no faster')
  say(
    'p',
    'From 1 to 8 slots per particle, fewer cells share a slot, but a step does not get faster: a larger table takes longer to empty and to add up. The scattered hash gets slower, because its cells are spread over more memory.',
  )
  for (const [scene, group] of by(list, sceneOf)) {
    say('h3', scene.charAt(0).toUpperCase() + scene.slice(1))
    const ways: Row['way'][] = ['scattered', 'rows', 'blocks', 'zorder']
    page.append(
      lines(
        ways.map((way) => ({
          name: way === 'blocks' ? 'table, blocks of 8' : NAME[way],
          color: COLOR[way],
          points: group
            .filter((r) => r.way === way)
            .map((r) => [r.perParticle, r.step] as [number, number]),
        })),
        { label: 'slots per particle', log: true, ticks: [1, 2, 4, 8] },
        { label: 'ms per step', ticks: [0, 2, 4, 6, 8, 10] },
      ),
    )
  }
  page.append(numbers(list, (r) => `${sceneOf(r)}, ${r.perParticle} per particle`))
}

// 6. The width of a cell
{
  const list = of('cell')
  say('h2', '6. Wider cells: fine up to one and a half times the reach')
  say(
    'p',
    'The lists look 25 cm away, so a cell must be at least that wide. Up to 37.5 cm little changes; at 50 cm every cell holds so many particles that making the lists takes twice as long. One run each.',
  )
  const ways: Row['way'][] = ['blocks', 'grid']
  page.append(
    lines(
      ways.map((way) => ({
        name: way === 'blocks' ? 'table, blocks of 8' : NAME[way],
        color: COLOR[way],
        points: list.filter((r) => r.way === way).map((r) => [r.cell, r.step] as [number, number]),
      })),
      { label: 'width of a cell, m', ticks: [0.25, 0.3, 0.375, 0.5] },
      { label: 'ms per step', ticks: [0, 1, 2, 3, 4, 5, 6] },
    ),
    numbers(list, (r) => `${r.cell} m`),
  )
}

say('h2', 'What a project should look at')
const rules = html('ul')
for (const rule of [
  'Always keep the particles in the order of their cells: it costs a few tenths of a millisecond and saves more the more particles there are.',
  'Is the world small and known, with about as many cells as particles? A grid is the fastest, by a fifth.',
  'Is the world large, or without a border? A table: its time and its memory follow the particles, not the world.',
  'In a table, keep large blocks of cells together, up to 32 cells a side: larger ones bring nothing, and must leave room in the table for many blocks. One or two slots per particle are enough.',
  'A cell as wide as the lists look, a particle and a margin, or a little more. Not twice.',
])
  rules.append(html('li', rule))
page.append(rules)
say(
  'p',
  'These are readings of one machine, a Mac M1, on particles that stand still. A phone, and scenes that move, may shift where one way overtakes another.',
)
