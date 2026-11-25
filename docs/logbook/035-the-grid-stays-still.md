# 035 · The Grid Stays Still

*November 20, 2026 · 3 min read*

**In short:** a new live page tilts the box of particles by up to 30 degrees. Our first way, turning gravity instead of the box, made piles explode in the corners. The user's rule fixed it: gravity and the grid of cells that finds neighbours stay still, and the box turns inside them.

## The story

With friction on the [live page](../../examples/heap-simulation/main.ts) ([chapter 034](./034-the-box-on-the-ramp.md)), the user asked for a second page to see a pile hold a slope and then slide: the same page, starting with µ = 0.3, the friction coefficient, and with a box that tilts by up to 30° around X and around Z. It is [tilted-box](../../examples/tilted-box/index.html), and it runs the code of the first page, heap-simulation: its HTML only hands over other starting values. Force-plus starts without friction again, as the user asked.

**The shortcut.** Particles find their neighbours through a grid of cells 20 cm wide, laid along the axes x, y and z ([chapter 024](./024-twenty-seven-cells.md)). A box turned by 30° no longer fits cells laid that way. So Claude, the AI assistant we study with, left the box and the grid level in the simulation and turned gravity the other way: seen from inside the box it is the same thing. Only the drawing turned.

**The corner.** "Tilting the planes, the simulation goes crazy when the particles end up in the corners," the user said, and asked whether the grid was turning too. It was: seen from outside, the grid turned with the box. In the lowest corner a column of particles shot up along the edge. Three runs with the box tilted by 30° around Z and −20° around X, and 20 000 particles, with the *levels* of the pile, explained below, at their strength c = 1.5 or off:

| Levels | Friction | The corner |
| --- | --- | --- |
| on, c = 1.5 | µ = 0.3 | explodes |
| on, c = 1.5 | none | explodes the same |
| off | µ = 0.3 | a pile at rest, but for a thin line of particles up the edge |

So it was not friction. Nor was it the grid's limit of four particles per cell, which Claude had suspected first and did not test here. It was the levels. FORCE+, our way of pushing touching particles apart, counts each particle's level in its pile, 0 on the floor and one more than what it rests on, and of two touching particles the lower one counts as heavier ([chapter 029](./029-heavy-on-light.md)). The shader takes "lower" along the y axis and "floor" as the plane that faces up along y. With gravity turned, down pointed into the corner while the levels still counted along y. The particles highest along y counted as very light, and a light particle takes almost the whole push of every contact: the weight of the pile pressing into the corner threw them out.

**The rule.** Claude proposed to make the levels follow gravity. The user asked for something more general: "the grid must always stay fixed, the box can turn as it likes, and the particles stay inside. The important thing is that the grid always holds the box, even when it is turned." So gravity went back to straight down, and the floor and the four walls became what turns: five planes whose normals follow the box. The levels are right again without a change. In the same corner, with the levels on and µ = 0.3, the 20 000 particles now gather and stay, with a few loose ones on top ([decision 021](../decisions/021-a-grid-fixed-in-the-world.md)).

### What surprised us

**The price of a still grid.** It must hold the box at every tilt, so it grew from 120 × 45 × 120 cells, 648 000, to 151 × 148 × 175, 3.9 million: about 78 MB of GPU memory instead of 13, almost all for empty cells. A grid pays for its whole volume, also where nothing is.

**A floor must not jump.** The box turns around the middle of its floor. One degree of tilt moves the far corner of the floor, 17 m from there, by 30 cm, three times a particle's radius, and a particle that ends up deeper than its radius inside something is pushed out fast, on whichever side ([chapter 032](./032-two-kinds-of-bounce.md)). So the box follows its sliders at 20° per second: 9.9 cm at that corner per step of 1/60 s, just under a radius. We did not try faster.

**Friction holds on to the world.** Friction looks at how far a particle has slid, and measures that in the world, not along the floor. While the box turns, friction keeps particles where they are instead of carrying them along with the floor. At this speed it does not show; a fast platform would.

## What we take away

- Turning gravity instead of the box is not the same thing once some rule, like the levels, knows which way is up.
- Keep the grid and gravity fixed in the world, and let the box turn inside.
- A fixed grid must cover everywhere the box can go, and pays for it in empty cells.
- A wall that moves should move less than a radius per step: ours does, by a rule we took from chapter 032 and did not test here.

## Open questions

- A grid that does not pay for empty space, and holds more than four particles per cell.
- Friction against a floor that moves.
- With the levels off, a thin line of particles still climbed the corner's edge. Not looked into.

## Sources

- Our pages, [examples/heap-simulation](../../examples/heap-simulation/main.ts) and [examples/tilted-box](../../examples/tilted-box/index.html): every number of this chapter, from single runs in Chrome without a window.

## Next step

How particles find their neighbours: today a grid of cells with four places each, to replace with a list.
