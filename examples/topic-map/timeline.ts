// The timeline: the story of the map, replayed. Every topic says in `since` the day it reached
// each status, so the map of any day can be rebuilt: which topics were there, and how far we had
// gone with each. Playing the timeline makes those changes happen one after the other. When the
// story is over the map stays as the timeline left it: going back to the usual view is a choice.

import type { Graph, Status } from './data.js'

/** One change of the map: a topic comes in, or goes one level deeper. */
interface Change {
  topic: number
  status: Status
  /** True when the topic enters the map with this change. */
  enters: boolean
  /** When it happens, in seconds from the start of the timeline. */
  time: number
}

interface Day {
  /** As written in the map: "2026-11-05". */
  date: string
  /** When the day starts, in seconds from the start of the timeline. */
  start: number
}

/** Seconds given to each change, and the shortest and longest a day can last. */
const PACE = 0.05
const SHORTEST_DAY = 2
const LONGEST_DAY = 8
/** The changes of a day fill this share of it: the rest is a pause before the next day. */
const BUSY_SHARE = 0.8

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short' })

export interface Timeline {
  /** Starts the story from the first day, playing. */
  start(): void
  /** Stops playing. The map on screen is left as it is. */
  stop(): void
}

/**
 * Sets the timeline bar up. `show` is called whenever the map to draw changes, with the status of
 * every topic at that moment: null for a topic not on the map yet.
 */
export function createTimeline(
  graph: Graph,
  show: (statuses: (Status | null)[]) => void,
): Timeline | undefined {
  const bar = document.querySelector<HTMLElement>('.timeline')
  const play = bar?.querySelector<HTMLButtonElement>('.play')
  const slider = bar?.querySelector<HTMLInputElement>('input')
  const dayLabel = bar?.querySelector<HTMLElement>('.day')
  const changeLabel = bar?.querySelector<HTMLElement>('.change')
  const ticks = bar?.querySelector<HTMLElement>('.days')
  if (!bar || !play || !slider || !dayLabel || !changeLabel || !ticks) return

  // Every change of every topic, day by day, in the order of the map.
  const dates = [...new Set(graph.topics.flatMap((topic) => Object.values(topic.since)))].sort()
  const days: Day[] = []
  const changes: Change[] = []
  let end = 0
  for (const date of dates) {
    const ofTheDay = graph.topics.flatMap((topic, index) =>
      Object.entries(topic.since)
        .filter(([, day]) => day === date)
        .map(([status]) => ({
          topic: index,
          status: status as Status,
          enters: Object.values(topic.since).every((day) => day >= date),
        })),
    )
    const length = Math.min(Math.max(ofTheDay.length * PACE, SHORTEST_DAY), LONGEST_DAY)
    days.push({ date, start: end })
    ofTheDay.forEach((change, index) => {
      const time = end + ((index + 0.5) / ofTheDay.length) * length * BUSY_SHARE
      changes.push({ ...change, time })
    })
    end += length
  }

  slider.max = String(end)
  for (const day of days) {
    const tick = document.createElement('span')
    tick.textContent = formatDay(day.date)
    tick.style.left = `${(day.start / end) * 100}%`
    ticks.append(tick)
  }

  let time = end
  let playing = false
  let shown = -1 // how many changes the map on screen includes
  let last = 0

  /** Redraws the bar, and the map if the changes that happened so far are not the ones shown. */
  const update = () => {
    slider.value = String(time)
    play.textContent = playing ? '❚❚ pause' : '▶ play'
    const day = days.filter((d) => d.start <= time).at(-1) ?? days[0]
    dayLabel.textContent = formatDay(day.date)

    const count = changes.filter((c) => c.time <= time).length
    if (count === shown) return
    shown = count
    const statuses: (Status | null)[] = graph.topics.map(() => null)
    for (const change of changes.slice(0, count)) statuses[change.topic] = change.status
    show(statuses)

    const change = changes[count - 1]
    const title = change ? graph.topics[change.topic].title : ''
    changeLabel.textContent = !change
      ? ''
      : change.enters
        ? `+ ${title}`
        : `${title} → ${change.status}`
  }

  const frame = (now: number) => {
    if (!playing) return
    time = Math.min(time + (now - last) / 1000, end)
    last = now
    if (time >= end) playing = false
    update()
    requestAnimationFrame(frame)
  }
  const run = () => {
    playing = true
    last = performance.now()
    requestAnimationFrame(frame)
    update()
  }

  play.addEventListener('click', () => {
    if (playing) {
      playing = false
      update()
    } else {
      if (time >= end) time = 0 // at the end, play starts the story again
      run()
    }
  })
  slider.addEventListener('input', () => {
    playing = false
    time = Number(slider.value)
    update()
  })

  return {
    start() {
      time = 0
      shown = -1 // whatever is on screen, draw the first day again
      run()
    },
    stop() {
      playing = false
      update()
    },
  }
}
