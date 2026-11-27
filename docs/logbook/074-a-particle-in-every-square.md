# 074 · A Particle in Every Square

*November 27, 2026 · 4 min read*

**In short:** The user's idea, a particle that only collides at the middle of every square of a cloth, held in a script what nothing else did, and was dropped on the GPU: too stiff, too heavy. What stays is plainer: 3 substeps for cloths, and a hand that gives way.

## The story

**The idea.** After the eight ways of [chapter 073](./073-eight-ways-to-close-a-net.md), the user proposed a ninth. Our cloth is a net of spheres of radius r, 0.1 m, joined by springs as rigid as rods. A sphere coming down on the middle of four first touches them when its center is 1.41 r above the cloth: the *gate*. Put one more sphere there, a *middle*. It is not simulated: it is always at the average of its 4 corners, it ignores them, and collides with everything else. A push on a middle goes to its corners. Wu and others (2020) add such points inside stretched triangles.

**The script.** [A copy of our step in JavaScript](../topics/self-collision-middles.mjs), in 3D, with a *substep* being one of the slices a step of 1/60 s is cut into, 2 on our pages. With middles the gate goes from 1.41 r to 1.73 r, and still holds when the cloth is stretched by 60%. Two cloths flying at each other stopped passing up to 9 m/s each, against 6. Grains dropped on a cloth stretched by 45% all passed without middles, and none with them. The user's variant, middles of 0.9 r that touch each other only in a fold, let more through than those of 1.0 r, and a fold met a hard stop, at 57 degrees between one row and the next, not a gentle resistance.

**The first surprise: substeps.** All this was at 2 substeps, and the user asked for 3 or 4. A curtain dropped on a floor from a few meters folds into a pile. With 2 substeps its surface passed through itself for 251 steps in all, over 4 falls from 6 m. With 3, never, and without middles. Going over the springs 8 times in a substep, not 4, left 71: less, not none. What counts for two cloths is how far they come closer in one substep.

**The second: the hand.** On the real page the user pulled a cloth hard from under the others: it passed through, even at 4 substeps. The script said why. A hand pulls a cloth up through one held by its border, which asks for the impossible: either a link stretches by 69% or something crosses. Our hand covers half the way to the pointer at every substep, whatever is in between. Three hands that give way were tried: the one that worked moves no particle more than a radius in a substep, but in the script only together with the middles.

**On the GPU.** So the middles went on the page of the pile: extra rows among the particles, and two small shaders run after each *round*, one run over all the pushes between touching particles. They ran, and the user dropped them: the cloths were too stiff, with middles of 1.0, 0.9 and 0.6 r, and the step too heavy. The script had counted 3.4 times the pairs to look at.

**What we kept.** Three decisions by the user: cloths run at 3 substeps at least ([decision 043](../decisions/043-three-substeps-for-cloths.md)), and the hand gives way ([decision 044](../decisions/044-a-hand-that-gives-way.md)): without middles it does not stop a cloth pulled through another, but on the page it helped, and the user kept it. And from 3 substeps on the speed limit is three quarters of a radius per substep, not one ([decision 045](../decisions/045-a-tighter-limit-from-three-substeps.md)). The page with the middles is gone; the script stays, as the proof.

**Mistakes of ours.** Three in the script, each found by a number that looked odd. Grains aimed at where the squares of a stretched cloth should be, not where they were: held by its border, with rigid springs, a cloth of ours stretches more at the edge than in the middle. A count of crossings that saw false ones once two cloths had bounced apart and wrinkled. And a test at 4 substeps that ran twice as many substeps as the one at 2.

### What is proven, and what is not

Proven, by the script: every number above, on scenes with no friction and without *levels*, our rule that makes the lower particle of a pile count as heavier, a few starts each. Seen by the user on the page, not measured: that middles stiffen a cloth, and that the hand that gives way helps. Guesses: that more passes do not help because the pushes come after the springs; that the stiffness comes from middles meeting in the folds.

## What we take away

- For two cloths, speed matters as distance per substep: more substeps, same safety at more speed.
- A pull through a cloth that cannot move aside has no right answer: the hand must give way.
- An idea can win every test in a script and lose on the page, for what the script did not measure.
- Test what you count: a number that looks odd is often the count, not the cloth.

## Open questions

- A cap on stretch, as the last thing in a substep: does it close a pulled cloth, or lock it?
- Why are cloths with middles stiff, when in the script a strip held by one end hung as it did without them?

## Sources

- [Self-collision](../topics/self-collision.md), with the numbers of the middles.
- [A Safe and Fast Repulsion Method for GPU-based Cloth Self Collisions](https://wanghmin.github.io/publication/wu-2020-sfr/), Wu and others, 2020, section 6.2: points added inside triangles.

## Next step

A cap on stretch, tried in the script after the pushes.
