# 002 · The Toolbox

*November 5, 2026 · 2 min read*

**In short:** to stop repeating ourselves, we gave Claude project rules and four skills. And this logbook found a home.

## The story

The problem was simple: every new session with Claude starts without knowing how we want to work.

We split things in two. Rules that always apply live in `CLAUDE.md`, which Claude reads at every session: small steps, explanations from zero, short texts. Jobs that repeat became four **skills**, recipes Claude follows when they are needed:

| Skill | When to use it |
| --- | --- |
| `/explain X` | You did not understand a concept |
| `/study X` | You want to take a study step |
| `/logbook` | You want to record a step, or find out where we left off |
| `/guide X` | A WebGPU concept deserves its own mini guide |

We also looked for ready-made skills, but installed none: the two journal skills we found online have no license, and Anthropic's official one for documents is too heavy a process for our short steps. We did steal two ideas though: the question "where did we leave off?" and the **reader test**.

The test paid off right away. An agent with no context read chapter 001 pretending to know nothing about physics. The concept had landed, but it found about ten weak spots, such as never explaining why delta time is not enough. The chapter you can read is the corrected one.

Another surprise came from Biome again: it now formats Markdown too, and it would have broken the header of the skills. We limited it to code, then checked that it still blocks bad code.

Everything was first written in Italian. Then we moved the whole repo to English, so anyone can follow along.

The fourth skill came last. FORCE is also how we learn WebGPU, so each concept we meet in code gets a mini guide: one idea, real code, and a few notes for turning it into an article or a video. The logbook tells what happened to us; a guide tells what anyone needs to know.

## What we take away

- Rules that always apply go in `CLAUDE.md`, jobs that repeat go in skills.
- A skill is a set of instructions: read it before adopting it.
- Whoever writes a text cannot see where it is unclear: it takes a fresh reader.

## Next step

To decide: write the first WebGPU mini guide (adapter and device), or find the foundational papers.
