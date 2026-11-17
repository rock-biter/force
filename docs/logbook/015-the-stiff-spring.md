# 015 · The Stiff Spring

*November 17, 2026 · 4 min read*

**In short:** we opened Box2D to see what Erin Catto does today with the solver of his paper of 2005. It takes small steps instead of many rounds, and turns every rule into a stiff spring. In our tests a pendulum keeps its height and nothing blows up, but a chain sags under a heavy weight.

## The story

[Chapter 014](./014-the-mirror.md) read Catto's paper of 2005 and left the engines as the next stop. Its *solver*, the part of an engine that repairs broken rules such as "do not pass through the floor", goes round the rules several times in every step, finds how hard each one must push, and stores the pushes as a first guess for the next step. We started from Box2D, a 2D engine, because the same person wrote it. We read the code of its solver, and the post where Catto compares eight solvers and picks one. He later named it *Soft Step*. How it works is on a [theory page](../topics/soft-step.md), with a script behind every number of ours.

Three things changed in twenty years. First, the step of 1/60 s is cut into 4 *substeps*, and each goes round the rules once, instead of one step with ten rounds. To afford it, contact points are found once per step: each is kept as two anchors, one on each body, and a substep only measures how far they moved. Second, the nudge of 2005, "remove 5% of the error per step", became a spring with two knobs that mean something: how many times per second it would swing, and how fast the swing dies. This is a *soft constraint*. Third, after the bodies move, one more round runs with the spring switched off, to take back the speed the spring added: the *relax* round.

### What surprised us

**On the pendulum, the spring is not the reason.** Our pendulum of 1 m, let go from horizontal, kept 42% of its height after 30 s with the solver of 2005, and its stick was up to 3.6 cm too long. With Soft Step it keeps 99.7%, and the stick is off by 0.07 cm. Claude, the AI assistant we study with, expected the spring to be the reason. It is not: Box2D's spring removes 25% of the error per substep, and the old nudge with 4 substeps and that same 25% gives the same two numbers. With one rule, a soft rule is a stronger nudge with a nicer knob.

**On a chain, the old nudge blows up.** We hung a chain of 10 links with a weight at the end, and gave every method the same work: 8 passes over the links per step. The solver of 2005, with 8 rounds and the nudge of 20% that Catto's post uses, is perfect with 1 kg and explodes with 10 kg: the speed added by the nudge is stored with the push and comes back at the next step. Soft Step never blew up, up to 1000 kg. One term of its formula gives back part of what a rule has pushed. We set that term to zero, and it blew up with 1 kg.

**A soft rule sags.** With 100 kg the chain of 1 m ends about 13 cm too long, and 8 substeps instead of 4 change nothing. It is not the solver running out of rounds: the rule is a real spring of 60 swings per second, Box2D's default, and a spring stretches under a weight. A stiffer spring helps: 3.2 cm at 120 swings per second. But Box2D only allows a stiffer spring with more substeps, 8 here. So substeps do not stiffen a rule by themselves, they let us choose a stiffer one. A heavy body on light ones was the weak spot of the solver of 2005 ([chapter 014](./014-the-mirror.md)) and still is: it no longer falls apart, it sags.

**Two meanings of one word.** In [chapter 013](./013-the-hidden-brake.md) *relaxation* was going round the rules again. Catto's relax is one round with the correction off.

**Friction, at last from a source.** Box2D limits the sliding push of a contact to the friction coefficient times the push that keeps the bodies apart. Our ground ([decision 013](../decisions/013-a-flat-ground.md)) uses the same rule, written from memory in chapter 010 and never checked against a source until now. One difference: Box2D solves friction before it adds the bounce, and we count the push of the bounce too.

**The page failed its first reader.** Claude wrote the theory page in one go, and the user could not answer any of its three questions. So we went back through it in chat, one idea at a time, each with a question: a nudge that is a `lerp` on every frame, a spring that thinks in seconds like `MathUtils.damp`, a microphone in front of its own speaker for the pushes that come back, a drawer to close for the relax round. One question of the user's, whether the last term gives back a share or the exact amount that was added, led to something the page had missed: it gives back a share of everything, so the term that stops the blow-up is the same one that makes the chain sag. One link with 100 kg is 0.069 mm too long with it, and 0 mm without. The examples are now on the page.

**Colors, for the threads.** Each round still fixes one rule at a time. To use many CPU threads, Box2D gives every contact a color, so that rules of one color touch different bodies and can be solved together, one color after the other. This is *graph coloring*, met by name in [chapter 012](./012-the-family-tree.md).

## What we take away

- Soft Step is the solver of 2005 with three changes: substeps instead of rounds, a spring instead of a nudge, and a relax round.
- Substeps gave most of the gain on our pendulum. The spring matters with many rules: it does not blow up where the stored nudge does.
- A soft rule is a spring, so it sags under load. Substeps do not fix that directly: they allow a stiffer spring. The term that makes it sag is the one that keeps it from blowing up.
- A page is not an explanation. One idea at a time, with a question after each, is.
- The pushes are still stored from one step to the next, and the rules are still solved one after the other.

## Open questions

- On a GPU each color would be one dispatch, one run of a compute shader, three times per substep. With 8 colors, a number we made up, that is about a hundred dispatches per step: is that too many? And Box2D picks the colors on the CPU, one contact at a time.
- Catto lists "GPU friendly solvers" among the things still to try, and names two that solve all the rules at once: Jacobi and mass splitting. So he does not count Soft Step as one.
- Why the stored nudge blows up: we saw it, and found the term that prevents it. We did not do the math.
- Box2D is 2D and its bodies rotate. Our tests are still points that do not turn.

## Sources

- [Solver2D](https://box2d.org/posts/2024/02/solver2d/), Erin Catto, 2024: read in full.
- [Box2D](https://github.com/erincatto/box2d/tree/2b14ae3feebce864131e24799e3c1c5484b431bc), the code of November 17, 2026, read in parts: `solver.c`, `contact_solver.c`, `distance_joint.c`, `constraint_graph.c` and the guide `simulation.md`.
- Our [theory page](../topics/soft-step.md), and [the script](../topics/soft-step.mjs) behind every number of ours here.

## Next step

The other engines used in video games, PhysX, Jolt and Rapier: do they run the same idea?
