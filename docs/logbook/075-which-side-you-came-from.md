# 075 · Which Side You Came From

*November 27, 2026 · 3 min read*

**In short:** A limit to how far a cloth stretches did not stop one cloth from being pulled through another. A push that remembers which side each particle came from did, for a few lines of shader. It is now on between two bodies, and off inside one.

## The story

**Where we were.** After [chapter 074](./074-a-particle-in-every-square.md) a falling cloth no longer passed through itself, but a cloth dragged hard by the pointer still went through the ones lying on it. Our cloth is a net of spheres joined by springs as rigid as rods, and two spheres that overlap push each other apart. The test, in [our script](../topics/self-collision-middles.mjs), a copy of our step in JavaScript: a hand pulls a cloth up through another held by its border.

**The cap on stretch.** We believed the cloth got through because it stretched, and its holes opened. So, as the last thing of every *substep*, one of the 3 slices our step of 1/60 s is now cut into, every spring more than 10% longer than at rest is pulled back to that (Provot, 1995). It worked on the springs: the most stretched one went from 69% to 17%. And the cloth passed all the same. It did not turn stiff either: a strip held by one end hung as before.

**So it was not the holes.** The other cause was on our page since [chapter 071](./071-the-gate.md): a push has no side. It goes along the line between two centers. Once a sphere is past another, that line has turned around, and the push helps it out of the far side.

**The side kept.** Chris Lewin's idea, from [chapter 073](./073-eight-ways-to-close-a-net.md): push along the line the two had when the substep began. A sphere that got past is sent back where it came from. We tried two forms. In the full one a contact is made before two spheres touch, which needs a wider search for neighbours. In the plain one a contact is made as today, when they overlap, and only its direction changes. The plain one did as well or better:

| 3 substeps | Push as it was | Side kept |
| --- | --- | --- |
| Two cloths head on at the speed limit, particles that pass | 38% | 0% |
| A cloth pulled through a held one, steps with a crossing | 79 | 0 |
| The hand, asked to go up 1.5 m | goes all the way | stops at 0.5 m |

With 2 substeps it is worse than before: the pulled cloth ends stuck halfway through the other. That is the weak spot the user had named in chapter 073: what does get past is kept on the wrong side.

**On the GPU.** A few lines in the shader of the pushes, which already read where every particle began the substep, for friction. The user pulled hard on the page of the pile, and the cloths held. The pushes take 5 to 7% longer, about 0.1 ms of a step of 4. We turned it on for every pair of particles.

**And then off, inside a cloth.** On the page where a ball pushes a hanging cloth, the user saw the free edge pass through itself more than before. The side kept does not know which side is right: it stops a crossing both ways. A fold that has crossed cannot cross back, though its springs pull it, where before it came loose by itself. So every particle now says which *body* it is part of, a cloth or a rope, and the side is kept only between two bodies ([decision 046](../decisions/046-the-side-kept.md)). The user wanted that number anyway: an engine has to know what belongs to what.

### What is proven, and what is not

Proven, by the script: the numbers above, on scenes with no friction, a few starts each. Measured on this Mac, 4 runs each: the cost. Seen by the user, not measured: that the cloths hold on the page, and that a cloth alone is as it was with the side kept only between bodies. Not looked at: how a pile of loose particles rolls and settles with the new direction.

## What we take away

- Fixing the thing we believed was the cause, and seeing nothing change, told us the cause.
- A push needs a side, and the start of the substep has it for free.
- The simple form of an idea can be enough: here the costly half added nothing.
- The side kept stops a crossing both ways: what gets past stays past. Good between two things, bad inside one.

## Open questions

- Do piles of loose particles behave the same with the side kept?
- A cloth stuck through another: can it happen on the pages, and how would it get out?

## Sources

- [Cloth Self Collision with Predictive Contacts](https://media.contentapi.ea.com/content/dam/eacom/frostbite/files/gdc2018-chrislewin-clothselfcollisionwithpredictivecontacts.pdf), Chris Lewin, 2018: the side kept.
- Provot, 1995, as read in chapter 072: the cap on stretch.
- [Self-collision](../topics/self-collision.md).

## Next step

Open the pages in Safari and on the phone, then springs for any net.
