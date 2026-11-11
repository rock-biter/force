# Contributing to FORCE

FORCE is built in the open, one step at a time, by someone learning physics and WebGPU along the
way. There is no engine to patch yet: the most useful help today is pointing us to the right things
to study, and telling us when we got something wrong.

## Suggest something to study

A paper, a book, a talk, an engine's source code, an article, or a concept we should not miss.

**[Open a suggestion](https://github.com/rock-biter/force/issues/new?template=suggest.yml)**

Before you send it:

- **Check the [topic map](./docs/topics/README.md).** It may already be there. If it is, a suggestion
  still helps: tell us why it deserves a closer look.
- **Open the link yourself.** We check every source before studying it, and references made up by AI
  tools look real more often than you would think.
- **Say why it matters for FORCE.** "Great paper" helps less than "this is how Box2D keeps stacks of
  boxes stable".

The best suggestions match where FORCE is going: real-time physics for games, on the GPU with WebGPU,
on desktop and mobile, starting with rigid bodies and particles (see the
[decisions](./docs/decisions/README.md)). Anything further out is still welcome: it goes on the map
for later.

## Report a mistake

The theory pages are written while learning, so some of them will be wrong or unclear.

**[Report a mistake](https://github.com/rock-biter/force/issues/new?template=mistake.yml)**, with a
source we can open. It gets fixed, and the logbook tells what we had wrong.

## What happens next

| On GitHub | What it means |
| --- | --- |
| Label `suggestion` or `correction` | Received, not checked yet |
| Label `on the map` | Checked, and on the topic map with your name. Waiting for its moment |
| Closed as completed | Studied, or fixed: the issue links to the page we wrote |
| Closed as not planned | Not for FORCE, with the reason |

We go through new issues at the end of each step, and study a suggestion when the
[study route](./docs/README.md#study-route) gets to it. That can take a while, because we study one
thing at a time. Whoever suggested something is credited on the topic map, and thanked in the logbook
chapter that studies it.

## Code

The engine is not there yet, so code contributions will come later. This guide will say how.
