# 016 · The Same Road

*November 17, 2026 · 4 min read*

**In short:** do the other engines used in games run the idea of Box2D's Soft Step? Jolt keeps the many rounds of 2005, PhysX has both ways and is moving to small steps, and Rapier took Soft Step whole, down to its numbers.

## The story

[Chapter 015](./015-the-stiff-spring.md) ended with a lesson: a page is not an explanation. So this time the order changed. Claude, the AI assistant we study with, read the docs and the code of three engines, then explained them in chat, one engine at a time, each with a question. Only then did we write.

A reminder of the words. A *solver* repairs broken rules, such as "do not pass through the floor", by finding how hard each rule must push. A *round* is one pass over all the rules. In 2005 Erin Catto, who later wrote the engine Box2D, described the solver most engines started from: one step, and many rounds. A *substep* is a slice of the step. *Soft Step*, Box2D's solver today, cuts the step into 4 substeps. In each it runs one round that repairs, where a rule acts as a stiff spring, and one *relax* round, which takes back the speed the spring added.

| | Jolt | PhysX, new solver | Rapier | Box2D |
| --- | --- | --- | --- | --- |
| The step, by default | whole | 4 substeps | 4 substeps | 4 substeps |
| Rounds that repair | 10 on velocities, then 2 on positions | 1 per substep | 1 per substep | 1 per substep |
| Relax rounds | none: no speed was added | 1, at the end of the step | 1 per substep | 1 per substep |
| The overlap is removed by | moving the positions | speed added to the velocity | a spring of 30 Hz | a spring of 30 Hz |

**Jolt** runs *sequential impulses*, the name Catto later gave to the solver of his paper of 2005: its guide says so, citing a talk of his. It stops what moves the wrong way, with no correction added for the overlap, then moves the bodies by hand toward where they should be, 20% of the error per round. That second pass looks to us like the move of Jakobsen ([chapter 013](./013-the-hidden-brake.md)), used as a last touch. Catto's post on solvers calls it *NGS*, Nonlinear Gauss-Seidel, and says Box2D did the same before version 3.

**PhysX** has two solvers. The old one is the many rounds. The new one, *TGS* or Temporal Gauss-Seidel, cuts the step into substeps with one round each, 4 by default, then runs one round with no correction at the end of the step: a relax done once. Its guide says it "will become the default", and that it handles heavy bodies on light ones better.

**Rapier** got a new solver in January 2024 and removed the old one in September 2025. Its defaults are Box2D's: for contacts, springs that would swing 30 times per second (30 Hz: the higher, the stiffer), twice that against a body that cannot move, never pushing apart faster than 3 m/s, and friction solved only in the relax round. Rapier's file does not name Box2D: we put the two sets of numbers side by side.

### What surprised us

**The same word, two meanings, again.** In Jolt a "position step" moves positions. In PhysX a "position iteration" does not: it is a round on velocities that also asks for a little speed to remove the overlap, and in the new solver each one is a substep. Before comparing two engines, check what each word does.

**Something we had half right.** [Chapter 001](./001-the-flip-book.md) said that Rapier "does 4 rounds by default". The number is still 4, but in today's code the step is divided by it: they are 4 substeps, with one round each.

**Jolt's substeps are ours.** Jolt can split a step into "collision steps", which repeat everything, collision detection included. That is what FORCE does ([decision 011](../decisions/011-substeps-per-world.md)). The other three find the contacts once per step.

**One paper for the threads.** To solve a large group of touching bodies on many threads, Jolt sorts the rules into groups where no two touch the same body, and names a paper of 2007. Box2D calls such groups colors, and names the same paper ([chapter 015](./015-the-stiff-spring.md)).

**A contact is a spring too.** The user could explain why a chain sags under a weight, but not what happens to a heavy body resting on a light one. It is the same spring, squeezed instead of stretched: a suitcase on a mattress sinks a little and stays. A comment in Rapier's code says it: softer contacts "settle deeper under load". As we read it, that is the price of the spring, and it does not contradict PhysX's guide: the small steps keep such a pile from falling apart, the spring decides how far it sinks.

## What we take away

- Two engines out of three left the many rounds for the small steps, or are leaving. Rapier dropped the old way.
- There are two answers to "stopping a body does not put it back": correct the positions in a pass of their own, after the velocities, as Jolt does, or add speed and take it back, as the others do.
- Names do not travel between engines. "Iteration" and "step" must be checked in each one.
- PhysX says its new solver runs on the GPU as well as on the CPU.

## Open questions

- How does PhysX run a solver that fixes one rule at a time on a GPU? Its guide to GPU rigid bodies is on our map, unread.
- We did not check whether PhysX stores how hard each rule pushed, as a first guess for the next step. The other three do.
- We read guides, settings and a changelog, and little code: one file of Jolt's contacts, one of Rapier's solver. We did not open the discussion where Rapier's new solver was proposed.
- What each engine can do, beyond its solver, is still to see: the third stop of our [study route](../README.md) stays open.

## Sources

- Jolt at commit [444bd92](https://github.com/jrouwe/JoltPhysics/tree/444bd92a4a9130cfb52c52d1e9c1c3dcde9a88db): [Architecture.md](https://github.com/jrouwe/JoltPhysics/blob/444bd92a4a9130cfb52c52d1e9c1c3dcde9a88db/Docs/Architecture.md), the simulation step, [PhysicsSettings.h](https://github.com/jrouwe/JoltPhysics/blob/444bd92a4a9130cfb52c52d1e9c1c3dcde9a88db/Jolt/Physics/PhysicsSettings.h), the defaults, and [ContactConstraintManager.cpp](https://github.com/jrouwe/JoltPhysics/blob/444bd92a4a9130cfb52c52d1e9c1c3dcde9a88db/Jolt/Physics/Constraints/ContactConstraintManager.cpp), where the overlap is fixed.
- PhysX 5.6.1, [Rigid Body Dynamics](https://nvidia-omniverse.github.io/PhysX/physx/5.6.1/docs/RigidBodyDynamics.html): the section on the constraint solver.
- Rapier at commit [475caa3](https://github.com/dimforge/rapier/tree/475caa3ff4646fd9a796b67d14116256f4962bc7): [integration_parameters.rs](https://github.com/dimforge/rapier/blob/475caa3ff4646fd9a796b67d14116256f4962bc7/src/dynamics/integration_parameters.rs), the defaults, [CHANGELOG.md](https://github.com/dimforge/rapier/blob/475caa3ff4646fd9a796b67d14116256f4962bc7/CHANGELOG.md), the dates, and [staged_island_solver](https://github.com/dimforge/rapier/tree/475caa3ff4646fd9a796b67d14116256f4962bc7/src/dynamics/solver/staged_island_solver), where the step is divided.
- Box2D's column comes from our [theory page](../topics/soft-step.md).

## Next step

How PhysX runs its solver on the GPU.
