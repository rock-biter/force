---
name: recap
description: >-
  Gives a short recap of the last things done together in the previous sessions, so the user can
  refresh them and fix them in memory before going on. Use it at the start of every session, before
  any other work, whenever the user comes back to the project (in any language: "let's continue",
  "let's go on", "where were we"), and whenever they ask for a recap or a refresher.
---

# Recap

The user learns WebGPU and physics through this project, a session at a time, often days apart. A
recap at the start brings the last ideas back before new ones pile on top: recalling something is
what makes it stick. It is a warm-up, not a summary of the project.

## When

Once per session, as the first thing, before the work the user asked for. Then go on with that work
in the same reply: the recap does not count as a step, and does not wait for an answer.

## Where to look

- `git log` for the last ten commits or so: what was done, and when.
- The last two chapters in `docs/logbook/`, above all **What we take away** and **Next step**.
- What came after the last chapter and has no chapter of its own: guides in `docs/guides/`,
  decisions in `docs/decisions/`, changes to the topic map.

Read them, do not recall them: the recap must say what the repo says.

## How to write it

In chat, in Italian, and short enough to read in half a minute: about ten lines.

1. **The last two or three things**, newest last, one bullet each. Not the list of what was made,
   but the idea to keep from it, in one sentence, with the concrete example or number that made it
   click the first time (the bounce to a quarter of the height, the 16 000 bytes). Link the chapter
   or guide for who wants to reread it.
2. **Where we stopped**: one line, with the next step as the repo states it.
3. **One question** to answer from memory, on the most important of those ideas. The user may skip
   it; if they answer, say whether it is right, briefly.

Leave out everything older, and everything about how we work (skills, the map, the logbook): only
what was learned or built. If a term appears that the user may have lost, say it again in five
words instead of assuming it.
