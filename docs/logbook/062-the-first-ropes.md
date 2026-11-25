# 062 · The First Ropes

*November 25, 2026 · 3 min read*

**In short:** springs on the GPU, on a live page: 100 ropes of 30 particles hang, swing and hold together while their particles change row at every substep. The stretch the page reads is the one the script had foretold, and the springs take 4% of a step.

## The story

**Three pieces.** The study chose them one by one: a name for each particle and a register of where it is ([decision 036](../decisions/036-names-and-a-register.md)), one list of springs sorted into groups that share no particle, and passes of their own for the springs, before the contacts ([decision 037](../decisions/037-springs-one-by-one-in-groups.md)). Now they are code, on a new page, [ropes](../../examples/ropes/index.html).

**The name.** It is the second number of a particle's properties, after the radius ([decision 032](../decisions/032-a-buffer-of-particle-properties.md)): the properties already move with the particle when it changes row ([chapter 052](./052-what-follows-a-particle.md)), so the name follows for free. A small pass, [register.wgsl](../../examples/ropes/register.wgsl), then writes for every name the row it is in now.

**The springs.** A rope of 30 particles has 29 links. Along a rope they alternate: the first, third, fifth share no particle, nor do the second, fourth, sixth. Two groups, two dispatches. In [springs.wgsl](../../examples/ropes/springs.wgsl) a thread per spring looks up its two names in the register, reads the two positions, and moves them where they are, the lighter end more. The first particle of each rope has a 1 / mass of 0: it never moves, and the rope hangs from it.

**A substep now.** Predict, make the address book, move the particles into its order with their properties, write the register, three passes over the springs, then the levels and the three rounds of the contacts, finish.

**Does it hold?** If a spring found the wrong particles after a reordering, the ropes would fly apart at the first substep. They start leaning by 30 degrees, swing to the other side and back, and after 25 seconds are still 100 straight ropes.

**Spaghetti.** The user asked for two changes to the page: the ropes in yellow, "they must look like spaghetti", and the ball of the pointer, which rolled on the floor under them and touched nothing, lifted to 4 m and drawn whole. It now goes through the ropes and parts them.

**The same number as the script.** The page reads the positions and the names back and measures every spring. With rods, which should not stretch:

| | Mean stretch | Worst spring | A step, 3 000 particles |
| --- | --- | --- | --- |
| 3 passes over the springs, 2 substeps | 1.9% | 6.9% | 1.9 ms |
| 6 passes | 0.97% | 3.5% | 1.9 ms |
| 10 passes | 0.57% | 2.0% | 2.1 ms |
| 3 passes, 4 substeps | 0.50% | 1.8% | 4.3 ms |

The script of [chapter 060](./060-one-by-one-or-all-at-once.md) said 1.6% for a chain of 30 with 3 passes, and 0.5% with 10. Here the ropes swing, which pulls more.

**What it costs.** With 30 000 particles, a thousand ropes: the register 0.02 ms, the springs 0.23 ms, of a step of 4.1 ms. Six passes: 0.42 ms. More passes over the springs are the cheap way to a tighter rope; more substeps cost twice the whole step.

### What surprised us

**A shader with nothing to say to the others.** The register would not compile: every shader of the page starts with a shared piece whose functions read `params`, and the register has no `params`. It is compiled alone.

## What we take away

- Names, a register, groups: three ideas studied apart, and they fit together at the first try.
- A script that foretells the number a page will read is worth the time it takes.
- Springs are cheap next to contacts: tighten them with their own passes.

## Open questions

- How much a spring gives, the compliance, is in the panel but without the running total XPBD asks for: a soft spring is softer than asked (chapter 060). Not settled.
- Left alone the ropes all swing together and never touch. Pushed by the ball they bend and hit each other, and hold: seen by eye, not measured. A rope lying on a pile was not looked at.
- Nothing draws the springs: a rope is a row of spheres.

## Sources

- The page's code: [main.ts](../../examples/heap-simulation/main.ts), `ropes`, `springGroups` and `readStretch`, and the two shaders in [examples/ropes](../../examples/ropes/springs.wgsl).

## Next step

The fifth stop: what to build with springs. A cloth is the next thing, and needs groups for a net.
