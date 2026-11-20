# 035 · The Grid Stays Still

*November 20, 2026 · 3 min read*

**In short:** a new live page tilts the box of particles by up to 30 degrees. Our first way, turning gravity instead of the box, made piles explode in the corners. The user's rule fixed it: the grid of cells never turns, the box turns inside it.

## The story

With friction on the [live page](../../examples/force-plus/main.ts) ([chapter 034](./034-the-box-on-the-ramp.md)), the user asked for a second page to see a pile hold a slope and then slide: the same page, starting with µ = 0.3, the friction coefficient, and with a box that tilts by up to 30° around X and around Z. It is [force-tilt](../../examples/force-tilt/index.html), and it runs the very same code: its HTML only hands over other starting values. The first page went back to no friction.

**The shortcut.** Particles find their neighbours through a grid of cells 20 cm wide, laid along the axes x, y and z ([chapter 024](./024-twenty-seven-cells.md)). A box turned by 30° no longer fits cells laid that way. So Claude, the AI assistant we study with, left the box and the grid level in the simulation and turned gravity the other way: seen from inside the box it is the same thing. Only the drawing turned.

**The corner.** "Tilting the planes, the simulation goes crazy when the particles end up in the corners," the user said, and asked whether the grid was turning too. It was, with the box. In the lowest corner a column of particles shot up along the edge. Three runs at 30° and −20°, with 20 000 particles:

| Levels | Friction | The corner |
| --- | --- | --- |
| on, c = 1.5 | µ = 0.3 | explodes |
| on, c = 1.5 | none | explodes the same |
| off | µ = 0.3 | a pile at rest |

Neither friction nor the grid's four places per cell, which Claude had suspected first. It was the *levels*: FORCE+ counts each particle's level in its pile, and of two touching particles the lower one counts as heavier ([chapter 029](./029-heavy-on-light.md)). The shader takes "lower" along the y axis and "floor" as the plane that faces up along y. With gravity turned, down pointed into the corner while the levels still counted along y: the particles highest along y became very light, and the squeeze toward the corner threw them out.

**The rule.** Claude proposed to make the levels follow gravity. The user asked for something more general: "the grid must always stay fixed, the box can turn as it likes, and the particles stay inside. The important thing is that the grid always holds the box, even when it is turned." So gravity went back to straight down, and the floor and the four walls became what turns: five planes whose normals follow the box. The levels are right again without a change, and the corner holds its pile ([decision 021](../decisions/021-a-grid-fixed-in-the-world.md)).

### What surprised us

**The price of a still grid.** It must hold the box at every tilt, so it grew from 120 × 45 × 120 cells, 648 000, to 151 × 148 × 175, 3.9 million: about 78 MB of GPU memory instead of 13, almost all for empty cells. A grid pays for its whole volume, also where nothing is.

**A floor must not jump.** One degree of tilt moves the far corner of the floor, 17 m from the pivot, by 30 cm, three times a particle's radius, and [chapter 032](./032-two-kinds-of-bounce.md) showed what comes of going deeper than a radius in one step. So the box follows its sliders at 20° per second: 9.9 cm per step at that corner, just under a radius.

**Friction holds on to the world.** A contact measures a slide against the world, not against the floor. While the box turns, friction keeps particles where they are instead of carrying them along with the floor. At this speed it does not show; a fast platform would.

## What we take away

- Turning gravity instead of the box is not the same thing once some rule, like the levels, knows which way is up.
- Keep the grid and gravity fixed in the world, and let the solid things turn inside.
- A fixed grid must cover everywhere the box can go, and pays for it in empty cells.
- Anything that moves a wall must move it less than a radius per step.

## Open questions

- A grid that does not pay for empty space, and holds more than four particles per cell.
- Friction against a floor that moves.
- With the levels off, a thin line of particles still climbed the corner's edge. Not looked into.

## Sources

- Our pages, [examples/force-plus](../../examples/force-plus/main.ts) and [examples/force-tilt](../../examples/force-tilt/index.html): every number of this chapter, from single runs in Chrome without a window.

## Next step

A list instead of the grid's four places per cell, to find the neighbours.
