# 011 · The Living Map

*November 14, 2026 · 4 min read*

**In short:** the topic map became a graph in 3D that you can turn, click, and replay day by day. To replay it, the map had to learn its own dates, and it lost a topic that was never a source.

## The story

The [topic map](../topics/README.md) answers one question: what have we really studied, and what have we only heard of? A table of 257 rows does not answer it at a glance. We wanted a picture.

It lives in [`examples/topic-map`](../../examples/topic-map/main.ts), and it does not use the engine: three.js draws it. Each topic is a point, each relation a line, 510 in all. Nobody places the points. A small simulation does, with three rules: a line is a spring that pulls its two topics to a set distance, every topic pushes every other away, and each topic is pulled to a shell around the center, chosen by its status. Studied in the middle, only heard of on the outside. This is a *force-directed layout*, and for now a library runs it, [d3-force-3d](https://github.com/vasturiano/d3-force-3d). FORCE will take its place when it has springs.

How far we went with a topic is drawn as fill, like the icons of the index: full, half, outline only. The color says the area: orange for physics, blue for GPU. A click on a topic keeps it and its neighbors in color and fades the rest, and its guide or theory page opens over the graph.

### Two things that looked wrong

**A fade that looked like a jump.** Colors moved toward their goal by a share of what was left, every frame. That is smooth on paper, but half of the change happens in the first 100 ms, and the eye sees a snap. A change you want to *see* needs a set time, 0.45 s, and a slow start. The camera kept the old rule, because a glide that can be interrupted at any moment suits it.

**One loose spring that moved everything.** Selecting a topic weakens its springs to 15% of their strength, so its neighbors drift to about 1.35 times the distance and the space around it opens. On the first try the whole graph slid by about a tenth of its radius, even for a topic with no links at all. The layout at rest was not fully settled, so every extra step let it slide a little more. Now only the topics up to two links away are free to move.

### The map learns its dates

A timeline needs dates, and the map had none. Git had 13 versions of it, but a commit says when we wrote something down, not when we studied it: 179 topics entered in 23 minutes on November 11, the day the map was born.

So every topic now carries `since`, the day it reached each status, and `npm run lint` fails if one is missing. The days before the map came from the first chapters and from the transcript of the ChatGPT session of [chapter 004](./004-the-detour.md). The transcript has no dates, only nine answers in order; the days came from memory, the first three on November 5 and the rest on November 8.

That chapter said "a conversation is a source like any other", and put the session on the map. We changed our mind. A source is something to read; that session was studying. It left the map, and the 162 topics it brought now cite the chapter that tells it.

### The story, replayed

The second view plays the map from its first day. Only the topics already on the map are simulated, so each newcomer brings its springs and the graph changes shape to make room. There the color is earned: grey when only mentioned, halfway when seen, full when studied. On November 5 a cloud of 151 topics appears, most of them grey; on November 11 the first full dots light up in its middle.

## What we take away

- A layout can be a simulation: springs for the links, a push between everybody, and one more force for whatever you want to see at a glance.
- "A share of what is left" suits a motion that can be interrupted. A change you want noticed needs a set time and a slow start.
- A simulation that has not settled moves everywhere when you wake it up: pin what must stay still.
- The day of the commit is not the day of the study. Write the date down when it happens.
- A study session is not a source: tell it in the logbook, and let its topics cite the chapter.

## Open questions

- November 5 enters as one burst: inside a day, the map does not know what came first.
- When FORCE has springs, can it lay out its own map?
- The graph runs only with `npm run dev`. Publishing it needs a reorganization of the examples.

## Sources

- [d3-force-3d](https://github.com/vasturiano/d3-force-3d): we opened its README and the code of its simulation step and of its link and radial forces.

## Next step

Back to the WebGPU guides: bind groups, how a shader finds its data.
