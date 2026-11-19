# 026 · The Marble in the Pocket

*November 19, 2026 · 4 min read*

**In short:** the second way to push particles apart is to move them. On a GPU each one adds up what its contacts ask, and the sum can go too far, so Macklin divides it by the number of contacts. The user proposed eight other rules, Claude one more, and we tried them all in 3D. The last one, half sum and half average, was the only one to settle in every scene.

## The story

[Chapter 025](./025-the-pillow.md) pushed particles apart with a spring. The other way is to move them back, as Jakobsen does ([chapter 013](./013-the-hidden-brake.md)). On a GPU we followed Macklin and others, in the paper behind NVIDIA FleX, a particle engine (2014). Every particle first moves by its velocity to a *predicted position*. The contacts are measured there and repaired in a few *rounds*, passes over all of them. At the end the velocity is taken back from how far each particle moved. Our ground already works in that order: it moves a particle, then puts it back on top if it went under ([integrate.wgsl](../../src/shaders/integrate.wgsl)). As with the spring, each particle's thread reads its neighbours and writes only itself, so no *turns* are needed: contacts that share a particle can run at the same time.

**Twice the repair.** Each contact computes its correction as if it were the only one, and asks for the whole repair. A marble B sits on two neighbours that do not move, A and C, almost right below it, 1 cm deep in each:

```
      (B)
    (A) (C)
```

A says "rise 1 cm", and so does C, both measured from where B was. Added up, B rises 2 cm, while 1 cm frees it from both. So Macklin divides each particle's sum by the number of its contacts: *constraint averaging*. He cites the paper on mass splitting, the copies of [chapter 018](./018-half-a-box.md), and admits the same flaw we found there: some push is lost.

**Ten rules, one script.** The user did not like dividing, and proposed other ways. Claude, the AI assistant we study with, tried each one in [a script](../topics/constraint-averaging.mjs), in 3D, "our main use case", the user said. Spheres have a radius of 10 cm. In the *pocket*, a marble rests on three fixed spheres, 1 cm deep in each, and must rise 12.4 mm: more than 1 cm, since the pushes come in slanted. In the *squeeze*, a marble sits between two fixed spheres, 1 cm deep in the one below and 0.8 cm in the one above, and belongs in the middle, 1 mm up. In the *box*, 216 particles fall from a loose grid, with the box set straight in the world or turned by 45°. The box columns count the particles, out of 216, still faster than 0.1 m/s after 8 s, straight / turned:

| Rule | Pocket: B rises (mm), round 1 → 20 | Squeeze: B at (mm), round after round | Box, 4 rounds | Box, 10 rounds |
| --- | --- | --- | --- | --- |
| sum | 23.8 → 23.8 | 2, 0, 2, 0… | 18 / 23 | 0 / 0 |
| average (Macklin) | 7.9 → 12.4 | 1, 1, 1… | 26 / 6 | 0 / 5 |
| largest push per axis | 7.9 → 13.2, and 2.3 sideways | 2, 0, 2, 0… | 0 / 96 | 0 / 196 |
| sum, capped at one diameter | 23.8 → 23.8 | 2, 0, 2, 0… | 18 / 23 | 0 / 0 |
| sum, capped at the longest push (Claude's) | 10.0 → 12.4 | 2, 0, 2, 0… | 177 / 186 | 0 / 0 |
| direction of the sum, longest length | 10.0 → 12.4 | 10, −8, 10, −8… | 214 / 214 | 148 / 212 |
| direction of the average, mean length | 9.0 → 12.4 | 5.5, −3.5, 5.5… | 145 / 112 | 1 / 20 |
| direction of the average, length 35% toward the longest | 8.7 → 12.4 | 4.2, −2.2, 4.2… | 56 / 71 | 4 / 75 |
| half sum, half average | 15.9 → 15.9 | 1.5, 0.8, 1.1, 0.9, 1.0 | 0 / 0 | 0 / 0 |
| contacts one after the other | 14.6 → 14.6, and 4.2 sideways | −8, −8, −8… | 216 / 216 | 216 / 216 |

The squeeze is Macklin's own example, a point held by two rules, in our particles: the sum swings forever, the average goes straight to the middle. Once a box is still, its deepest pair says how much the heap sank: 3.8 mm with the sum, 12 mm with half and half, 27 mm with the average.

### What surprised us

**The axes are ours.** The largest push per axis was the best rule in the straight box, and much worse in the turned one. It is why a three.js `Box3` changes size when the mesh turns: it too takes the largest value on each axis. "But the axes never turn," the user said. True: things do. A crate set at an angle would get other physics.

**Pushes that cancel.** Another idea of the user was to apply the contacts one after the other, each measured from the position already moved. "Can they cancel out?" they asked. Yes. In a column of three on the floor, the floor lifts the bottom particle 1 cm. The particle above, still where it was, now finds it 2 cm deep, and asks for half of that, its share of the pair: back 1 cm. The order decides. In a column of 10 one order threw a particle to 60 m and the reversed one was among the best, while in the box neither held. Half this rule and half the average, the user's next idea, was no better.

**Half and half.** The user's last rule is the sum times (1 + 1/n) / 2, where n is the number of contacts: all of it with one contact, 3/4 with two, 2/3 with three, about half with many. In the squeeze, 3/4 of the sum makes each swing smaller than the one before. In the pocket, 2/3 of 23.8 is 15.9: 3.5 mm too high, its one flaw here.

**A cap that never cuts.** A cap on the sum at one diameter cut 0 moves out of 414 720, one per particle per round: corrections are millimeters, the diameter is 200 mm. Claude's tighter cap, the longest single push, fixed the pocket but shook the box with 4 rounds.

**Two explanations that failed.** Claude first explained the doubling with a point held by two rules, then with two three.js scripts that correct the same mesh. "But here each particle writes only itself," the user objected, rightly. What worked: the doubling happens inside one thread, which cannot tell two contacts that ask the same thing from two that ask different things.

## What we take away

- Moving particles needs no turns either, but one particle's corrections must be combined, and how matters.
- The sum is the most precise in a heap, and swings when a particle is squeezed between fixed ones. The average never goes too far, but is slow, and sinks the most.
- A rule that looks at x, y and z gives different physics to the same scene turned.
- Every rule trades one failure for another: those that use the longest push swing when a particle is squeezed. Half sum, half average settled in every scene, with 4 rounds too, and overshot only next to fixed spheres.

## Open questions

- Which rule for FORCE: half and half is the candidate, to try again with masses, friction and on the GPU, where the price of a round can be measured.
- Macklin's knob, the average times a number between 1 and 2: at 1.5 it was among the best in the column and in between in the box. When does it pay?
- A light particle on heavy ones takes almost the whole correction, like the marble on fixed ones. A guess, to test with masses.

## Sources

- Miles Macklin, Matthias Müller, Nuttapong Chentanez and Tae-Yong Kim, [Unified Particle Physics for Real-Time Applications](https://doi.org/10.1145/2601097.2601152), 2014: sections 4.2 and 4.3 (averaging and the knob), Algorithm 1 (the step), section 6.1 (contacts and friction).
- Our script, [constraint-averaging.mjs](../topics/constraint-averaging.mjs): every number of this chapter.

## Next step

The third way: changing velocities, as Catto does, on a GPU. Then we choose, and write the code.
