# 006 · The Decision Log

*November 11, 2026 · 2 min read*

**In short:** FORCE now keeps a log of its decisions: what we chose for the engine, why, and what we left out. It starts with six, all made by the user: four from the research with ChatGPT, two from today's study.

## The story

After the first two theory pages, a question: should we start writing down the decisions, such as the fixed timestep and semi-implicit Euler, or is it too early?

It is the best moment. Decisions are still few, and some have already been made without being written anywhere but in a chat. In 2011 Michael Nygard described what happens to a project that does not record them: whoever comes later can only accept a choice blindly, keeping it even when it no longer makes sense, or reverse it blindly, breaking what it was protecting. His answer is the **decision record**: a short page per decision, with its context, the decision, its status and its consequences.

We took his format and added two sections that suit a project still learning:

- **Still open:** the details a decision leaves for later. The fixed timestep is decided; the length of a step is not yet.
- **Revisit if:** the signal that should make us reopen it. Semi-implicit Euler holds until we choose a constraint solver, since position based methods bring their own scheme.

One rule matters more than the format: Claude proposes, the user decides. Only the user can turn a record into "Accepted". And an accepted decision is never deleted: when we change our mind, a new record supersedes it, and the old one stays as history.

The first six records:

| # | Decision |
| --- | --- |
| 001 | Physics on the GPU, with WebGPU |
| 002 | Real-time physics for games and immersive 3D |
| 003 | Desktop and mobile from the start |
| 004 | Rigid bodies and particles first |
| 005 | A fixed timestep |
| 006 | Semi-implicit Euler, with substeps |

Writing them down showed a gap right away: what a rigid body is inside FORCE, a true body or a cluster of particles, is still open. The theory pages now link to the decisions they led to.

## What we take away

- A decision without its reasons can only be obeyed or broken.
- Writing a decision down shows what is still undecided.
- Changing your mind is allowed, deleting the old reason is not.

## Sources

- [Michael Nygard, Documenting Architecture Decisions](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (2011)

## Next step

To decide: turn the theory into code, with the fixed-step loop and semi-implicit Euler in FORCE, or write the third page, on rigid bodies.
