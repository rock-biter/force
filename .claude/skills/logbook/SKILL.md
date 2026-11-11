---
name: logbook
description: >-
  Writes a chapter of the FORCE logbook in docs/logbook/, as a short story of what we did and
  learned. Use it at the end of every step, and whenever the user asks (in any language) to write
  something down, to sum up what we did, or where we left off.
---

# Logbook

A chapter is a short story worth rereading a year from now, not meeting minutes. Include mistakes and
surprises: that is often where most of the learning is.

## New chapter

Create `docs/logbook/NNN-short-title.md`, with the next number, following this outline:

```markdown
# NNN · Title

*date · N min read*

**In short:** two lines at most.

## The story

What we wanted, what happened, what surprised us.

## What we take away

3-5 points.

## Open questions

Only if there are any.

## Sources

Only those used in the chapter, with links.

## Next step

One line.
```

Stay under 70 lines, about 3-4 minutes of reading. If that is not enough, the step was too big: split
it into two chapters.

## Before closing

- **Reader test.** Reread it as someone who knows nothing: is every technical term explained the
  first time it appears? For a study chapter, have an agent with no context read it.
- **Index.** Update `docs/README.md`: the new chapter and the stop on the route.
- **Map.** Add every concept and source the step touched to the topic map, or raise its status
  (`topic` skill).

## "Where did we leave off?"

Read `docs/README.md` and the latest chapter, then answer in three lines: where we are, what is still
open, what the next step is.
