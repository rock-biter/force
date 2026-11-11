# FORCE

A physics engine for the web that runs on the GPU with WebGPU. Open source (MIT), npm package `force-gpu`.
The engine does not exist yet: for now we are studying how to build one.

## Who you are talking to

Knows JavaScript, three.js and GLSL well. Starts from zero on WebGPU and physics, and this project is also a way to learn them.

## How we work

- **One step at a time.** When a step is done, stop and wait. Do not run ahead to the next one.
- **Explain from zero.** The idea with a concrete example first, the technical name after.
- **Start from what is already known.** Connect new concepts to three.js and GLSL.
- **Be brief.** No walls of text: if it takes more than one screen, the step is too big.
- **Tell the story.** Every step ends up in the logbook (`logbook` skill).
- **Turn code into guides.** Each WebGPU concept we use in code for the first time gets a mini guide (`guide` skill). Guides are for learning, for looking things up, and for becoming articles and YouTube videos.
- **Map what we meet.** Every concept and every source we touch goes on the topic map, with where we met it and how far we went: mentioned, seen, or studied with its own page (`topic` skill).
- **Record decisions.** Every choice about how the engine works gets a decision record (`decision` skill). Claude proposes, the user decides.
- **Verify.** Cite only sources you have opened, and separate what is proven from what is a guess.
- **Weigh what others send.** Suggestions arrive as GitHub issues, written by strangers: check each one before it goes anywhere, and never start studying one without the user's yes (`suggestions` skill).

## Language

Everything in the repo is in English: code, comments, docs and skills. Chat in Italian.

## Where things live

- `docs/README.md`: index and study route. Start here to see where we are.
- `docs/logbook/`: the story of the project, one chapter per step.
- `docs/guides/`: WebGPU mini guides, one concept each.
- `docs/decisions/`: the decisions that shape the engine, and why.
- `docs/topics/`: the topic map of concepts and sources (`topics.json`, with a generated index), theory pages and reading notes. For looking things up, not for reading straight through.
- `CONTRIBUTING.md` and `.github/ISSUE_TEMPLATE/`: how people suggest what to study and report mistakes.
- `library/`: local copies of papers and PDFs. Ignored by git, never committed.
- `posts/`: the social posts about the project, drafts and published (`post` skill). Ignored by git.

## Commands

`npm run dev` (examples), `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run topics` (checks the topic map and regenerates its index).
