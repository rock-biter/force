# 004 · The Detour

*November 11, 2026 · 3 min read*

**In short:** between two chapters, the study went on elsewhere: a few days with ChatGPT. We brought it home onto the map, as 74 new concepts and 49 new sources. The bibliography held up; some of the links did not.

## The story

The conversation started big: every engine worth knowing, from Unity and Unreal to PhysX, Jolt and FleX, a first list of papers, a roadmap, even an architecture.

Then it stalled. Too many acronyms, such as PBD, XPBD, BVH and GJK, and none of them explained. So it started again from zero, the same rule this project follows: the problem first, the name after. Three real lessons came out of it:

1. **Time.** Derivatives and integrals seen through `deltaTime`, explicit and semi-implicit Euler, the fixed timestep with its accumulator, and the "spiral of death" of a device that cannot keep up.
2. **Stability.** A mass on a spring shows why a simulation can explode even when the formulas are right: explicit Euler creates energy out of nothing, and a stiff spring needs smaller steps, or substeps.
3. **Rigid bodies.** Torque, moment of inertia, inertia tensor, angular velocity and quaternions: what turns a point into a box that can spin.

### Bringing it home

We read the whole conversation and turned it into points on the [topic map](../topics/README.md). Every point that came from it cites the conversation, which is now a source on the map itself, with a local copy in `library/`.

The three lessons became 23 concepts marked "seen", and four old ones, such as springs and rigid bodies, went up to "seen" too. The big overview at the start became 51 concepts only "mentioned": names we know, with a line on what they are, still to explore.

The 49 new sources are 13 papers, a book with two of its chapters, an article, 11 documentation pages, 20 engines and libraries, and the conversation itself.

### What held up, and what did not

Before trusting the bibliography, we checked it. All 13 papers exist, with the right authors and years: Crossref, the public index of scientific papers, confirmed eleven of them, and for the other two we opened the PDF.

The links were less solid. Four led to a missing page: the FleX documentation and a Box2D guide had moved, and we found their new addresses; a set of course notes has simply disappeared.

### Decisions made along the way

The conversation also settled three things about FORCE:

- **Goal:** real-time physics for video games and immersive 3D, fast and believable rather than scientifically exact.
- **Devices:** desktop and mobile from the start, with quality tiers: fewer particles, substeps and solver rounds on weaker devices.
- **Order:** rigid bodies and particles first, then cloth, fluids and soft bodies.

ChatGPT also proposed an architecture: separate solvers for different materials, sharing their GPU infrastructure, and rigid bodies as real bodies rather than clouds of particles. It stays a proposal until we test it.

## What we take away

- A conversation is a source like any other: it goes on the map, and what it claims gets checked.
- Titles age better than links: check every link, not only every title.
- "Seen" is not "studied": the three lessons are explained, but none has a page of our own yet.
- Learning starts from the problem, not from the acronym.

## Open questions

- Once the repo is pushed, the link to the conversation becomes public. Keep it, or keep only the local copy?

## Sources

- [Research with ChatGPT](https://chatgpt.com/share/6af42854-7e34-83ed-b697-494a23d0345a): the whole conversation
- [Crossref REST API](https://api.crossref.org/): to check titles, authors and years of the papers

## Next step

Turn the three lessons into our first theory pages, checked against their sources: the first topics to become "studied".
