---
name: post
description: >-
  Writes social posts about FORCE (X threads, LinkedIn) in the user's own voice, consistent with what
  was already published and without repeating it, and keeps them in posts/, which git ignores. Use it
  whenever the user asks (in any language) for a post, a thread, an update or an announcement about
  the project, or says a post went out.
---

# Post

Posts tell people where FORCE is and invite them in. They live in `posts/`: local only, never
committed. `posts/README.md` is the index, with what each post told and the running jokes.

## Before writing

- **Read the index and the latest posts.** Start from the first step not told yet. Bring back an old
  step only with something new about it.
- **Take facts from the logbook and numbers from the topic map,** checked on the day of writing.
- **Ask for the platform** if it is not given.

## The voice

The user's own, as in the launch post (`posts/2026-11-04-launch.md`):

- Short lines and short paragraphs. Lists with `-`.
- Dry self-irony, understated jokes. Call back an old joke rather than retelling it.
- One concrete fact or number beats a general claim.
- Curiosity first: the approach and what we found out, not a report of everything.
- No filler and no AI tics: no arrow lists, no "here's the thing", no stacked lessons, no grand
  closing lines.
- In English.

## Formats

- **X thread:** a first post that hooks, one post per step, a last post with the ask and one link.
  Every post stays within 280 characters as X counts them: a link counts 23, an emoji 2. Hashtags
  only in the last post.
- **LinkedIn:** one short post, about 1000 characters. The approach, the first things learned, one
  ask, one link.

## Saving

- A new post goes in `posts/YYYY-MM-DD-slug-platform.md`, as a draft, with a row in the index. The
  file holds the text exactly as it will be pasted.
- When the user says it is out, mark it published with the real date, and add the link if they give
  one. Add any new joke to the running jokes.
- Never publish anything yourself.
