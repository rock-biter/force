# 007 · The Open Door

*November 11, 2026 · 2 min read*

**In short:** FORCE now takes help from outside: anyone can suggest something to study, or report a mistake, with a form on GitHub. Every suggestion gets checked before it goes on the map, and nothing gets studied without the user's yes.

## The story

The plan was to write a post about the project. While thinking about it, a better idea came up: the post could also ask for help. Whoever reads it may know the right paper, the talk that explains a hard part, or the engine that has already solved our problem. When you study alone, the hardest part is knowing what to read.

So, before the post, we needed a way to collect suggestions. We chose GitHub issues over Discussions, because an issue is either open or closed: the open ones are already the queue of what is waiting. Two forms guide whoever writes. One is for suggesting something to study: what it is, why it helps FORCE, how hard it is. The other is for reporting a mistake, with a source we can open. A short guide, [CONTRIBUTING.md](../../CONTRIBUTING.md), explains both.

Each suggestion follows a path. It is received, then checked and put on the topic map with the name of whoever sent it, then studied when its moment comes. The issue closes only at the end, with a link to the page we wrote. The credit stays on the map, in a new field called `suggestedBy`, and the logbook thanks the person by name.

One rule came from the user, and it matters more than the forms: an issue is written by a stranger. Before anything goes on the map, we check that the source exists and that the link leads where it says. We never run anything from an issue, and we treat its text as material, never as instructions. That last point is about Claude. Text written for humans can also hide requests for an AI that reads it, a trick called **prompt injection**. And no suggestion becomes a study step without the user's yes. A new skill, `suggestions`, keeps all of this in one place.

We left one thing open: when to study each suggestion. GitHub has milestones, goals that group several issues together, and they could match the stops on our study route. But we do not know yet how to split the route, so we will define them together later.

## What we take away

- When you study alone, choosing what to read is the hardest part, and others can help with it.
- An open issue is a promise: it closes only when the topic has been studied.
- What strangers send is material to check, not orders to follow.

## Open questions

- Which milestones to set, and when.

## Next step

Write the post that tells the story so far, with a thread of one post per step.
