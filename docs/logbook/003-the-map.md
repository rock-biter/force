# 003 · The Map

*November 11, 2026 · 3 min read*

**In short:** we started a map of everything we meet, concepts and sources, with where we met each one and how far we went. The first count: 41 concepts and 15 sources, and none of them studied in depth yet.

## The story

After three chapters, a question came up: of everything we have talked about, what do I really know, and what have I only heard of? The logbook tells the story but does not answer that. The glossary listed the terms, and the list of sources listed what to read, but neither said how deep we went.

So we drew a map. Everything we meet becomes a point, in one of three states:

| | Status | A concept | A source |
| --- | --- | --- | --- |
| ○ | Mentioned | We met the name | We know it exists |
| ◐ | Seen | We know what it is and why it matters | We opened it and checked what we cite |
| ● | Studied | We studied it, and it has its own page | We read it in full, and took notes |

A point is either a **concept**, such as the broad phase, or a **source**: a paper, an article, a talk, a video, an engine's code, or a PDF saved on disk. They live together because they explain each other: a source says which concepts it is *about*, and those are its categories.

Every point must also say where we met it: a chapter of this logbook, a file of the repo, or another point. Ten Minute Physics, for example, is the source that brought cloth and fluids onto the map. Following these links backwards, you can always find out why something is there.

One day the map will become an interactive 3D graph, where points can be regrouped by area, kind, status or family, and clicked to read about them. For now it is a single file, `topics.json`, that a 3D viewer can load as it is. A script turns it into a [readable index](../topics/README.md). The glossary and the list of sources merged into it.

A point that reaches "studied" gets its own page: a **theory page** for a concept, **reading notes** for a source. Not the story of how we found something out, which is the logbook's job, but what is true, written for anyone. For WebGPU concepts, the guide plays that role.

### Three surprises

**The gap in the code.** All the WebGPU pieces that make `hello-compute` work, such as buffers, pipelines and bind groups, are only "mentioned": we use them in code, but we have never explained them. The map shows the gap at a glance.

**The forgotten origins.** Some sources were only listed, and no chapter named them. We traced them through git: each one was added in the same commit as chapter 001 or 002, so that is the chapter they cite now.

**The sources open new doors.** We opened the index of two sources we had never read, to know which concepts they are about. Out came eight new concepts, such as position based dynamics, a way of simulating cloth and soft bodies that Ten Minute Physics uses all the time. They went onto the map as "mentioned": material for future steps.

Then, as in chapter 000, we broke the map on purpose: a link to a missing point, a source with no categories, a point that came from nowhere, a family that goes round in a circle. The check caught every one, and now `npm run lint` fails whenever the map is broken or its index is out of date.

Saved PDFs live in a `library/` folder that git ignores: papers are usually copyrighted, and the repo is public. The map keeps the link to the original, so anyone can find it.

## What we take away

- Knowing what you do not know is half of a study plan.
- Everything on the map says where it came from: no orphan knowledge.
- One source of truth, many views: the same file feeds the index today and the 3D graph tomorrow.
- "Studied" is a promise, and a promise is worth more when a script checks it.

## Sources

- [Witkin and Baraff, Physically Based Modeling](https://www.cs.cmu.edu/~baraff/sigcourse/): its table of contents
- [Matthias Müller, Ten Minute Physics](https://matthias-research.github.io/pages/tenMinutePhysics/index.html): its list of videos

## Next step

To decide: the first WebGPU guide (adapter and device), the foundational papers, or a first sketch of the 3D map.
