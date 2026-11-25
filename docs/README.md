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
| 030 | [The Lazy List](./logbook/030-the-lazy-list.md) | Both finalists on the GPU: the same cost, a list of neighbours made only when needed, and half and half chosen |
| 031 | [The Yellow Ball](./logbook/031-the-yellow-ball.md) | FORCE+ live on the GPU: up to 100 000 particles, a ball under the pointer, and bounces left to fix |
| 032 | [Two Kinds of Bounce](./logbook/032-two-kinds-of-bounce.md) | Why landing particles bounce: too far in one step, or skating with no friction, and not the pop we suspected |
| 033 | [The Speed Limit](./logbook/033-the-speed-limit.md) | No particle faster than one radius per substep: 2 substeps and 12 m/s stop the splashes at almost no cost |
| 034 | [The Box on the Ramp](./logbook/034-the-box-on-the-ramp.md) | Friction by moving positions: exact on a slope, piles stand and the skating stops, but the slope of a pile changes with the substeps |
| 035 | [The Grid Stays Still](./logbook/035-the-grid-stays-still.md) | A box that tilts: turning gravity instead made the corners explode, so the grid stays fixed and the box turns inside it |
| 036 | [The Address Book](./logbook/036-the-address-book.md) | Four places per cell lose particles under pressure; a list sorted by cell loses none, and a hashed table gives it 1 MB instead of 78, read slower |
| 037 | [The Lonely Thread](./logbook/037-the-lonely-thread.md) | The first suggestion from a reader, on how GPU threads share a running sum: ours costs 0.2 ms with the table and 9 ms with a slot per cell, and not where we expected |
| 038 | [One Hundred Twenty-Five Cells](./logbook/038-one-hundred-twenty-five-cells.md) | A clock for every shader of a step: the lists of neighbours read 125 cells, not 27, and cells as wide as the lists look halve a step |
| 039 | [Far Apart in Memory](./logbook/039-far-apart-in-memory.md) | Why the hashed table was the slowest: its neighbouring cells are scattered in memory. With wide cells the gap almost closes, and 4 places per cell lose particles |
| 040 | [The Table](./logbook/040-the-table.md) | A hash that keeps rows of cells together makes the hashed table as fast as the grid at 100 000 particles: chosen for the engine, and now what the pages run |
| 041 | [Next to Each Other](./logbook/041-next-to-each-other.md) | Particles moved into the order of their cells, as Green and FleX do: the lists take a third of the time, and on a grid the pushes take half, which the table does not get |
| 042 | [No Best Way](./logbook/042-no-best-way.md) | The Z-order curve, then a study: what in a project makes one way to keep the cells better than another, measured on fixed scenes and drawn as charts |
| 043 | [Other People's Devices](./logbook/043-other-peoples-devices.md) | A public page runs the benchmark in anyone's browser, a phone too, and prepares a GitHub issue with the numbers; a second clock for devices whose GPU has none |
| 044 | [The First Devices](./logbook/044-the-first-devices.md) | Rules for reading strangers' results as data, a check that flags whatever is not the page's own format, and the first five devices: on an NVIDIA card memory order hardly matters |
| 045 | [A Million, and One Pass](./logbook/045-a-million-and-one-pass.md) | A million particles in a box that grows, friction that read every neighbour twice and now reads it once, and 3 rounds in each of 2 substeps in place of 6 rounds in one |
| 046 | [A Promise Not Yet Kept](./logbook/046-a-promise-not-yet-kept.md) | Soft shadows for the debug viewer: the depth promise that browsers do not take yet, and the choice to shade once per pixel |
| 047 | [Once per Pixel](./logbook/047-once-per-pixel.md) | The shadows built and every way of drawing timed, up to a million particles: with shadows, light worked out once per pixel always wins |
| 048 | [Big and Small](./logbook/048-big-and-small.md) | Particles of different sizes, tried by script in 3D: fine up to 2 to 1, then the lists of neighbours overflow and a heavy sphere on light ones is too much |
| 049 | [A Radius Each](./logbook/049-a-radius-each.md) | A page with particles of different sizes, of one material or several: one more buffer on the GPU, and the limit of 8 storage buffers per shader |
| 050 | [The Price of Remembering](./logbook/050-the-price-of-remembering.md) | Are the lists of neighbours still worth their buffers? In random order yes; with the particles in the order of their cells, a step without lists takes about the same |
| 051 | [Read Once](./logbook/051-read-once.md) | A step with no lists in the hashed table too: read each shared slot once, and check the rare case first. In order, faster than with the lists |
| 052 | [What Follows a Particle](./logbook/052-what-follows-a-particle.md) | The properties move with the particles kept in order: sizes and order go together, and a step with sizes takes half the time |
| 053 | [In Order by Default](./logbook/053-in-order-by-default.md) | Particles kept in the order of their cells on every page, and a step with no lists for particles of different sizes too |
| 054 | [Without the Lists](./logbook/054-without-the-lists.md) | The lists of neighbours leave the live pages: every round reads the cells, two buffers are free, and a step takes about the same |
| 055 | [Further Apart](./logbook/055-further-apart.md) | Sizes beyond 2 to 1 on the GPU: cheap and clean enough when spread evenly, slow and deep with two sizes only. The limit goes to 4 to 1 |
| 056 | [What a Spring Is](./logbook/056-what-a-spring-is.md) | The first stop of a study on springs: force and stretch, the pace of a swing, the damper, and the damping ratio |
| 057 | [Three Ways Around](./logbook/057-three-ways-around.md) | The second stop on springs: why a stiff one blows up, and the three ways around it, on one hanging chain simulated in four ways |
| 058 | [How Engines Set a Spring](./logbook/058-how-engines-set-a-spring.md) | The third stop on springs: six engines read in their code. Joints and links, four ways to say how stiff, and the same four numbers in memory |
| 059 | [A Name, or a Corrected List](./logbook/059-a-name-or-a-corrected-list.md) | Particles change row at every substep: two ways for a spring to find its ends, timed. Neither wins everywhere |
| 060 | [One by One, or All at Once](./logbook/060-one-by-one-or-all-at-once.md) | How several springs on a particle combine, by script in 3D: half and half blows up on a cloth, the average is soft, one by one is far tighter |
| 061 | [A Dispatch per Group](./logbook/061-a-dispatch-per-group.md) | Springs solved one by one on the GPU, a dispatch per group that shares no particle: a round costs the same, the same tightness ten times less |

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
