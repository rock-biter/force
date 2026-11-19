# FORCE documentation

This is where we tell how FORCE gets built, one step at a time. If you are new here, start with the logbook.

## Logbook

| # | Chapter | In one line |
| --- | --- | --- |
| 000 | [The Launch](./logbook/000-the-launch.md) | From an empty folder to the first 1000 particles on the GPU |
| 001 | [The Flip Book](./logbook/001-the-flip-book.md) | What a physics engine does, in five questions |
| 002 | [The Toolbox](./logbook/002-the-toolbox.md) | The rules and skills for working with Claude |
| 003 | [The Map](./logbook/003-the-map.md) | Keeping track of what we studied and what we only heard of |
| 004 | [The Detour](./logbook/004-the-detour.md) | A few days of study with ChatGPT, brought home and checked |
| 005 | [The First Pages](./logbook/005-the-first-pages.md) | What "studied" means, and our first two theory pages |
| 006 | [The Decision Log](./logbook/006-the-decision-log.md) | Writing down what we chose for the engine, and why |
| 007 | [The Open Door](./logbook/007-the-open-door.md) | How anyone can suggest what to study, and how we check it |
| 008 | [The First Loop](./logbook/008-the-first-loop.md) | The fixed-step loop and semi-implicit Euler, running on the GPU |
| 009 | [The First Picture](./logbook/009-the-first-picture.md) | A debug viewer on three.js, drawing straight from the engine's GPU buffer |
| 010 | [The Ground](./logbook/010-the-ground.md) | Particles bounce on a flat ground, the simplest way |
| 011 | [The Living Map](./logbook/011-the-living-map.md) | The topic map as a graph in 3D, with its dates and a timeline to replay it |
| 012 | [The Family Tree](./logbook/012-the-family-tree.md) | The papers behind particles and rigid bodies: two branches, a newcomer, and a warning about floats |
| 013 | [The Hidden Brake](./logbook/013-the-hidden-brake.md) | Our first paper read in full: Jakobsen's Verlet is our integrator, and projection hides a brake |
| 014 | [The Mirror](./logbook/014-the-mirror.md) | Catto's paper of 2005: the same loop on velocities, a memory to build, and a smaller brake |
| 015 | [The Stiff Spring](./logbook/015-the-stiff-spring.md) | Box2D's Soft Step: small steps instead of rounds, rules as stiff springs, and a chain that sags |
| 016 | [The Same Road](./logbook/016-the-same-road.md) | Jolt, PhysX and Rapier: the many rounds of 2005, a move to small steps, and Soft Step taken whole |
| 017 | [Taking Turns](./logbook/017-taking-turns.md) | PhysX on the GPU: rules take turns picked on the CPU, copies past a ceiling, and an explanation left halfway |
| 018 | [Half a Box](./logbook/018-half-a-box.md) | The copies again, one idea at a time: an average, one box per round, and a share of the mass so no push is lost |
| 019 | [The Price of Copies](./logbook/019-the-price-of-copies.md) | Turns and copies on a hanging chain: copies need four times the rounds, and springs sag twice as much |
| 020 | [A Cheap Launch](./logbook/020-a-cheap-launch.md) | What one more dispatch costs in WebGPU: almost nothing to launch, the work inside, and twenty times more when sent alone |
| 021 | [A Short Trip](./logbook/021-a-short-trip.md) | Data read back from the GPU to JavaScript: a quarter of a millisecond on our Mac, back before the next frame, and a step that becomes asynchronous |
| 022 | [The Bell That Rang Early](./logbook/022-the-bell-that-rang-early.md) | The same measures on an iPhone 16 Pro: launches and trips stay cheap, and a stopwatch that rang before the work was over |
| 023 | [The First Free Turn](./logbook/023-the-first-free-turn.md) | Sorting contacts into turns in JavaScript, the way Box2D does: cheap up to 100 000, cheaper with memory, and a ceiling |
| 024 | [Twenty-Seven Cells](./logbook/024-twenty-seven-cells.md) | How particles find the ones they touch on a GPU: a grid, two ways to fill it, and the test between two spheres |
| 025 | [The Pillow](./logbook/025-the-pillow.md) | Pushing particles apart with a spring: no turns on a GPU, but too soft it sinks and too stiff it blows up |
| 026 | [The Marble in the Pocket](./logbook/026-the-marble-in-the-pocket.md) | Pushing particles apart by moving them: the sum goes too far, the average sinks, and eight ideas of the user tried in 3D |
| 027 | [The Stored Nudge](./logbook/027-the-stored-nudge.md) | Pushing particles apart by changing velocities: Catto's two pieces, a nudge that keeps coming back, and Box2D's relax rounds at twice the price |
| 028 | [The Ranking](./logbook/028-the-ranking.md) | Every way at the same low price: a tuned spring first, half and half on positions next, velocities out |
| 029 | [Heavy on Light](./logbook/029-heavy-on-light.md) | Particles of different masses: a light one under a heavy one sinks, and two ideas of the user fix it, compressed masses and levels in the pile |

## For reference

- [Decisions](./decisions/README.md): the choices that shape the engine, and why we made them
- [Topic map](./topics/README.md): every concept and source we have met, and how far we went with each one
- [WebGPU mini guides](./guides/README.md): one concept each, built from our code
- [How to contribute](../CONTRIBUTING.md): suggest something to study, or report a mistake

## Study route

- [x] 1. What a physics engine is
- [x] 2. The foundational papers: which ones matter and why
- [ ] 3. The engines used in video games and what they can do
- [ ] 4. Web projects, on CPU and on GPU
- [ ] 5. How FORCE's features are built: rigid bodies, springs, cloth, fluids and farts
