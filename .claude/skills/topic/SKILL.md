---
name: topic
description: >-
  Keeps the FORCE topic map in docs/topics/topics.json, where every concept and every source we meet
  (papers, web pages, talks, videos, code, local PDFs) is tracked, and writes theory pages and
  reading notes in docs/topics/. Use it whenever a physics, math or GPU concept or a source comes up
  for the first time or goes one level deeper, at the end of every step, and whenever the user asks
  (in any language) for theory, technical docs, a deep dive, what to read, what we have already seen,
  or what is left to explore.
---

# Topic

The map answers one question at a glance: what have we really studied, and what have we only heard
of? Later it will also feed an interactive 3D graph, so keep it accurate and its ids stable.

## The map

`docs/topics/topics.json` holds one entry per topic. A topic is either a **concept** (an idea, such
as the broad phase) or a **source** (something to read or watch, such as a paper or an engine's
code). Both live in the same list, so the graph can link them.

```json
{
  "id": "broad-phase",
  "kind": "concept",
  "title": "Broad phase",
  "summary": "A rough check that discards pairs of objects too far apart to touch",
  "area": "physics",
  "status": "seen",
  "partOf": "collision-detection",
  "related": ["bounding-box"],
  "citedIn": ["docs/logbook/001-the-flip-book.md", "ten-minute-physics"],
  "page": "docs/topics/broad-phase.md",
  "code": ["src/collision/broad-phase.ts"]
}
```

```json
{
  "id": "fix-your-timestep",
  "kind": "article",
  "title": "Fix Your Timestep!",
  "summary": "Why the step must be fixed, and how to separate it from frames",
  "area": "physics",
  "status": "seen",
  "about": ["fixed-timestep", "timestep"],
  "citedIn": ["docs/logbook/001-the-flip-book.md"],
  "url": "https://gafferongames.com/post/fix_your_timestep/",
  "file": "library/fix-your-timestep.pdf",
  "authors": "Glenn Fiedler"
}
```

Every topic:

- `id`: kebab-case, and never renamed: links and the 3D graph rely on it.
- `kind`: `concept`, or one of the source kinds listed under `kinds` at the top of the file.
- `summary`: one line in plain words. For a concept it is our glossary; for a source, what it gives us.
- `area`: one of the `areas` at the top of the file. Add an area only when a topic needs it.
- `citedIn`: **required.** Where we met it, first appearance first: a file of the repo (path from the
  root), or the id of another topic, such as the paper that cited this one.
- `partOf`: the bigger topic it belongs to, one at most: a concept inside a concept, a source inside a
  source (a file inside an engine's repo).
- `related`: the few topics worth visiting next from here. Once per pair is enough.
- `page`: the theory page, reading notes or WebGPU guide that covers it in depth. It can be a whole
  file or one section of it (`docs/topics/integration.md#substeps`), so several topics can share a
  page. The check makes sure the section exists.
- `suggestedBy`: who pointed us to it in a GitHub issue, and which one:
  `[{ "user": "octocat", "issue": 12 }]`. It goes on only after the check in the `suggestions` skill,
  and stays as the topic grows. The index shows the name next to the topic.

Only for concepts: `code`, the files where FORCE uses it.

Only for sources:

- `about`: **required.** The concepts it talks about: its categories. A concept it covers that matters
  for FORCE and is not on the map yet goes on as `mentioned`, citing this source.
- `url`, `file`: at least one. `file` is a local copy under `library/`, which git ignores: papers are
  usually copyrighted, so they must not end up in this public repo. Always add the `url` too when the
  source is online, so others can find it.
- `authors`, `year`: when known and checked.

### Status

The status says what the user knows, not what the docs contain. Each level is a question to ask:

| Status | The test, for a concept | For a source |
| --- | --- | --- |
| `mentioned` | "I have heard the name." | We know it exists, or read only its index |
| `seen` | "I can say in two sentences what it is and why it exists." | We opened it and checked what we cite |
| `studied` | "I can explain how it works, with an example, and when it fails." | We read it in full |

`studied` also needs a page of ours, written together: writing it is the last step of studying, and
it makes the status checkable. A studied source points to the page where we digest it: its reading
notes, or the theory page built on it.

Be honest: the map is only useful if the statuses mean what they say. A status never goes down, and
`studied` always comes with a `page`: the check enforces it.

### Keeping it up to date

- **Something new comes up** in chat, code, docs or a source: add it as `mentioned`. If it came up
  only in chat, name it in the logbook chapter of the step and cite that chapter.
- **It goes one level deeper:** raise its status, and add the new place to `citedIn`.

### When a studied topic grows

Studying never really ends, so pages stay alive:

- **A new detail or a better explanation:** update the page and its "Updated" date, and add the source
  to the page and to the map, with the topic in its `about`.
- **A new idea that needs its own explanation:** a new topic on the map, `partOf` the studied one,
  starting as `mentioned` or `seen`, linked from the page. The parent stays `studied`: depth grows as
  new branches, not as a higher status.
- **Something we had wrong:** fix the page, and tell it in the logbook: that is where the learning is.
- **The page outgrows 100 lines:** split it, one topic per page.

What goes on the map: concepts of physics, math, GPU programming and our method, and everything worth
reading or watching about them. Project tooling stays out.

Then run `npm run topics`: it formats the map, checks it and rewrites `docs/topics/README.md`, the
readable index.
Never edit that file by hand: `npm run lint` fails if it is out of date. A missing local copy is only a
warning, since `library/` is not in git.

## Theory page

The logbook tells how we found something out; a theory page tells what is true, for anyone. It is
usually the outcome of a study step. For WebGPU concepts the guide is the page: do not write both.

Create `docs/topics/<id>.md`, with the same id as the map:

```markdown
# Title

*Theory · N min read · Updated <date> · [Topic map](./README.md)*

**In short:** two lines at most.

## The idea
Plain words and a concrete example, with the three.js or GLSL parallel when there is a true one.

## How it works
The mechanism step by step. Formulas only when needed, each term explained in words.

## Choices and trade-offs
The main ways of doing it, how known engines choose, and what each choice costs.

## On the GPU
What parallelizes well, what does not, and why.

## In FORCE
What we do or plan to do, with links to the code. "Not yet" is a fine answer.

## Check yourself
Three questions that match the `studied` test: how it works, an example, when it fails.

## Sources
Only sources we opened, with what each one gave us.
```

When a page shows numbers, keep the script that produces them next to it (`docs/topics/<id>.mjs`, run
with `node`), so anyone can check them and play with the constants.

## Reading notes

When a source is read in full, its page is a set of reading notes, `docs/topics/<id>.md`:

```markdown
# Title

*Reading notes · Authors, year · [Link](url) · [Topic map](./README.md)*

**In short:** what it says, in two lines.

## The question it answers
## The key idea
## What it means for FORCE
## What we did not understand
```

Either page stays under 100 lines, about 5 minutes of reading. If it does not fit, split it.

## Before closing

- **Trust.** Open every source before citing it, and mark what is our own guess.
- **Reader test.** Have an agent with no context read the page, as a JavaScript developer new to
  physics.
- **Map.** Update the topic and its neighbours, then run `npm run topics`.
- **Logbook.** Link the page from the chapter of the step that produced it.
