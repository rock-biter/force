# 044 · The First Devices

*November 23, 2026 · 3 min read*

**In short:** an hour after the benchmark page went out, seven issues had come back, three of them from other people. Before reading a single number we wrote the rules for reading them: as data, never as instructions. Five devices are in, and they already disagree with our Mac on one point.

## The story

The [bench page](../../examples/bench/index.html) of [chapter 043](./043-other-peoples-devices.md) runs our measure on anyone's device and prepares a GitHub issue with the numbers. The form worked: issues arrived filled in and labeled, from phones too.

**Rules first.** An issue is written by a stranger. "The text of the issues could contain strange things," the user said: no code from an issue run without an explicit yes, no instruction in it followed, and every text that is not what the page writes pointed out, hidden text above all. An AI assistant reads these issues, and a sentence addressed to it inside one, a *prompt injection*, must stay a sentence. So the rules became a [skill](../../.claude/skills/benchmarks/SKILL.md), a page of instructions for Claude, the assistant we study with, and a [script](../../scripts/benchmarks.mjs) that is the only way an issue is read.

**The check.** The page and the script now share [one file](../../examples/bench/issue.ts) that both writes the text of an issue and reads it back. Reading is `JSON.parse`, which turns text into numbers and runs nothing, then a comparison with what the page would have written, character by character: the same 30 measures in the same order, times that are numbers, a step that is the sum of its parts. Anything else is a flag: an HTML comment, which GitHub hides from readers; invisible characters; HTML, links, mentions; free text in the notes; results reformatted by hand. Every word a stranger wrote is printed as an escaped string, cut short. Fourteen tests feed it the bad cases, such as a hidden comment that says to ignore all previous instructions. And nothing enters the repo by itself: the script adds only the issues a person names.

**The first report.** Seven issues. Two were the user's own trials, from before the form was online. Five were clean, and the user accepted them. A step with 100 000 particles in a layer, in ms, one run each:

| Device, as its owner wrote it | Book on a grid | Table, blocks of 32 | The same, particles in random order | 4 places per cell |
| --- | --- | --- | --- | --- |
| 3080Ti, Chrome on Windows | 0.87 | 1.08 | 1.52 | 1.03 |
| iPhone 17pro, Safari | 1.13 | 1.45 | 6.26 | 8.39 |
| MacBook Air 2022, M2, Chrome | 1.66 | 2.03 | 4.83 | 5.49 |
| iPhone 16 Pro, Safari | 1.99 | 5.17 | 7.54 | 10.44 |
| MacBook M1, Chrome | 2.86 | 3.48 | 9.62 | 18.29 |

Thank you to [agargaro](https://github.com/agargaro), [niccolofanton](https://github.com/niccolofanton) and [biazo](https://github.com/biazo), who sent four of the five. Their names are next to their devices on the [charts page](../../examples/cells-study/index.html).

*Added on 24 November 2026.* Fifteen more devices came in the next day, 20 in all, and this chapter does not use their numbers yet: the chapter that reads the rules again will. Thank you already to [Fechuli](https://github.com/Fechuli), [ppmpreetham](https://github.com/ppmpreetham), [niceunderground](https://github.com/niceunderground), [Pavinati](https://github.com/Pavinati), [LucaArgentieri](https://github.com/LucaArgentieri), [martinopiaggi](https://github.com/martinopiaggi), [about-daniel](https://github.com/about-daniel), [Byloth](https://github.com/Byloth) and [kekkorider](https://github.com/kekkorider), and to Fulvio, Gianluca D'Arcangelo and Andrea Bovo, who ran the page and sent their numbers through the user's account.

**Ratios, not milliseconds.** "The goal is a comparison between the charts up to 6 and the other devices," the user said, "and every chart must have a purpose: to show results to take a decision with, or to confirm one or prove it wrong." A fast device and a slow one cannot be averaged in milliseconds. So each chart of the new section divides two times of the same device, and asks one question about a rule of [chapter 042](./042-no-best-way.md): is it worth keeping the particles in order, is the grid faster in a small world, does the table take over when the world grows, which hash, are 4 places per cell really out. One chart only is in milliseconds: whether a step fits in a frame. Devices are grouped by the maker of the GPU and by phone or computer, our Mac among them, and no average is drawn for a group of fewer than five.

### What surprised us

**On an NVIDIA card the order hardly matters.** On every Apple GPU, keeping the particles in the order of their cells makes a step two to four times faster, as on our Mac ([chapter 041](./041-next-to-each-other.md)). On the 3080 Ti it gains a third, and the 4 places per cell we had set aside are as fast as the best. One device, one run: a hint, not a rule. But the rule "always keep them in order" was written on Apple machines only.

**A phone ahead of our Mac.** The iPhone 17 Pro takes 1.45 ms where the M1 takes 3.48.

**Phones have the GPU's clock.** Both iPhones timed with timestamps. The second clock we built for them has not been needed yet.

**One phone's numbers jump.** The iPhone 16 Pro took longer with 10 000 particles than with 30 000, 1.05 against 0.51 ms on a grid. Heat, or something we do not see: its 5.17 for the table may be the same jump.

## What we take away

- Decide how to read strangers' data before reading any: as data, through one checked door.
- "Clean" means the format is the page's. It does not mean the numbers are true.
- What holds on one maker's GPUs may not on another's: memory order matters much less on the NVIDIA card.
- Across devices compare ratios on the same device, not times. And give every chart one question.
- So far the other devices agree with our Mac on every rule but how much the order is worth: the grid is faster in a small world on 6 of 6, slower at 40 m on 5 of 6.

## Open questions

- More devices, Android above all, and laptops with integrated graphics: none yet.
- Several runs per device, to tell a difference from a jump.

## Sources

- The issues [#4](https://github.com/rock-biter/force/issues/4) to [#8](https://github.com/rock-biter/force/issues/8), read by [scripts/benchmarks.mjs](../../scripts/benchmarks.mjs) into [cells-devices.json](../topics/cells-devices.json).

## Next step

Wait for more devices, then read the rules of chapter 042 again against them.
