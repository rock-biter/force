---
name: decision
description: >-
  Records a design decision about the FORCE engine in docs/decisions/, as a short decision record:
  what we chose, why, what we left out, what is still open. Use it whenever a step settles a choice
  about how the engine works, whenever code needs a choice that nobody has made yet, and whenever the
  user asks (in any language) to decide, to record or review decisions, or why something is the way
  it is.
---

# Decision

A decision record answers the question a future reader will ask: why is it like this? Without it,
they can only accept a choice blindly, or change it blindly and break what it was protecting.

## Who decides

Claude proposes, the user decides. A record written by Claude starts as **Proposed**, and only the
user's answer turns it into **Accepted**. When code needs a choice that is not in the log, stop and
ask before building on it.

## New record

Create `docs/decisions/NNN-short-title.md` with the next number, following this outline:

```markdown
# NNN · The decision, in a few words

*Status · date · Who decided, and after what (link to the theory page or logbook chapter)*

**Decision:** one sentence, starting with "we will".

## Why
The problem and the forces at play, with links to the theory pages.

## Not chosen
The alternatives, each with the reason it lost.

## Consequences
What becomes easier, what becomes harder, what we now have to do. The bad ones too.

## Still open
Details the decision leaves for later. Only if there are any.

## Revisit if
The signal that should make us reopen it. Only if there is one.
```

Stay under 40 lines. A record that needs more is two decisions.

## Changing your mind

- An accepted decision is never edited away. A new record supersedes it, and the old one gets the
  status **Superseded by NNN**, with a link. Both stay: the history is part of the reasoning.
- Settling a "Still open" point is a decision too: record it, and link it from the old record.
- Numbers are never reused.

## Before closing

- **Index.** Add the record to `docs/decisions/README.md`.
- **Theory.** Link it from the "In FORCE" section of the theory pages it relies on.
- **Logbook.** Name the decision in the chapter of the step.
