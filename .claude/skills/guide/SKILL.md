---
name: guide
description: >-
  Writes a WebGPU mini guide in docs/guides/, one concept per guide, built from code that really
  runs in this repo. Use it whenever code introduces a WebGPU or WGSL concept that has no guide yet,
  and whenever the user asks (in any language) for a guide, a tutorial, or material for an article
  or a video about WebGPU.
---

# Guide

A guide has three jobs: teach a concept, be quick to look up later, and be easy to turn into an
article or a YouTube video. One concept per guide is what makes all three possible.

A guide is not a logbook chapter. The logbook tells what happened to us; a guide tells what anyone
needs to know, even someone who lands on it from a search and has never heard of FORCE.

## When

In the same step where code uses a WebGPU or WGSL concept for the first time. Check
`docs/guides/README.md` first: if a guide already covers the concept, extend it instead.

## New guide

Create `docs/guides/topic.md`. Name it by topic, not by number, so the reading order can change
without breaking links. Follow this outline:

```markdown
# The question this guide answers

*WebGPU mini guide · N min read · Code: [path](link)*

**In short:** two lines at most.

## The idea

Plain words and an analogy, with the three.js or GLSL parallel when there is a true one.

## The code

The smallest piece of real code that shows the concept, with a line or two on each part.

## Common mistakes

Two or three errors, and what they look like when they happen.

## Where FORCE uses it

One or two lines, with a link to the code.

## Try it

One small change the reader can make to see the concept at work.

## Sources

The spec or MDN first.

## For an article or video

- **Hook:** the question or surprise that opens it.
- **Show:** what appears on screen.
- **Takeaway:** the one sentence to remember.

## Questions

*Asked while reading this guide, and answered after checking the sources.*

### The user's question, in English
The answer, checked like the rest of the guide.
```

Stay under 80 lines, about 4 minutes of reading, not counting the questions. If it does not fit, it
is two concepts: split it.

## The user's questions

The user always reads the guide, and asks what is not clear. Every question goes at the end, in the
**Questions** section, translated into English, with its answer: the next reader will probably ask
the same. Check the answer against the sources like the rest of the guide, and add any new source to
**Sources**. Keep each answer short; one that needs more than about 15 lines is a concept of its own,
so give it its own guide and link it.

## What makes a guide trustworthy

- **Real code.** Snippets come from code that runs in this repo, and link to it. Shorten them if
  needed, but do not invent them: readers will copy and paste what they find here.
- **Checked API.** WebGPU is young and memory goes stale, so check every API detail against the spec
  or MDN instead of writing it from recall.
- **Stands alone.** Explain or link anything the reader needs to know first.

## Before closing

- **Reader test.** Have an agent with no context read it, as a JavaScript developer new to WebGPU.
- **Index.** Update `docs/guides/README.md`.
- **Map.** Set the concept to `studied`, with this guide as its `page`, and add new sources (`topic`
  skill).
- **Logbook.** Link the guide from the chapter of the step that produced it.
