# 038 · A particle's name is its second property

*Accepted · November 25, 2026 · The user, on Claude's proposal while writing the first springs ([chapter 062](../logbook/062-the-first-ropes.md)). Settles a point left open by [036](./036-names-and-a-register.md)*

**Decision:** we will keep a particle's name as the second of its four properties, after the radius, as a whole number stored in a float.

## Why

Decision 036 gave every particle a name and left open where it lives. The properties are four numbers per particle that already move with it when it changes row ([decision 032](./032-a-buffer-of-particle-properties.md), [chapter 052](../logbook/052-what-follows-a-particle.md)), and three of them were free. A name there costs no buffer and no new pass to move it.

## Not chosen

- **A buffer of names of its own:** one more buffer to move with the particles, and one more of a shader's 8.
- **The bits of a whole number in the float's place:** exact for any name, but nothing promises that a shader copies a float's bits untouched when they are not a proper number.

## Consequences

- A float holds whole numbers exactly up to 16 777 216: that is the most particles a world can have with names kept this way. Today's largest is a million.
- A world needs the properties buffer as soon as it has springs, also with particles of one size.
- Two properties are left free.

## Revisit if

A world needs more than 16 million particles, or the two free properties run out.
