# 069 · Three Walls

*November 26, 2026 · 3 min read*

**In short:** why Safari stopped our shader, looked up. One wall is a bug in WebKit that doubled the work at every `||`, fixed nine days ago and not yet in the phone. One is a limit of Apple's Metal compiler, 256. One is a rule of the web. None is about the device.

## The story

**The question.** In [chapter 068](./068-one-page-for-the-demos.md) a check of 351 comparisons joined by `||` broke every demo in Safari, in two different ways on the Mac and on the phone, and we got around it without knowing why. Are these limits that will pass, or the limits of these devices?

**Where we looked.** In the two specifications, in a post by someone who hunted for such limits by trying, and in the code of WebKit, the engine of Safari, which is open. And we tried once more on the Mac.

**The specification says little.** [WGSL lists](https://www.w3.org/TR/WGSL/#limits) what every browser must take: 127 levels of braces, 255 parameters, 1023 members. Nothing on how long an expression may be. It adds that a browser *should* give an error when it does not take a shader. Ours got an error with no words on the Mac, and none at all on the phone.

**The phone: a bug, with a date of birth and one of death.** WebKit's type checker, the part that works out the type of each expression, was changed on May 19, 2026 to handle `&&` and `||`. It then worked out the left side of each `||` twice. In a chain, the left side of the last one is all the rest: every `||` doubled the work. 4 in a line cost 16 times one, 26 cost 67 million times one. On November 17 a fix went in, named for what it does: "Convert O(2^N) algorithm to O(N)". It fits what the phone told us through [compile-probe](../../examples/compile-probe/index.html): 4 in 3 ms, 26 never, and 26 joined by `|`, which that code does not touch, in 3 ms.

**The newer browser was the broken one.** The phone has Safari 27.2, the Mac 26.3.1. The Mac's is older than the bug. That is why the Mac compiled what the phone could not, and why trying on the Mac's Safari had told us all was well.

**The Mac: 256.** A test shader with a chain of `||`: 256 comparisons compile, 258 fail, with "Failed to compile the shader source, generated metal". Safari first turns WGSL into Metal's language, and Apple's Metal compiler then refuses it. The post reports Metal's own words, seen from Chrome on another shader: brackets nested more than 256 deep. Our 351 were over.

**The rule.** `navigator.gpu` exists only on pages on https or localhost: it is written in the WebGPU specification. The phone on `http://192.168…` had no WebGPU by design.

**One thing we could not explain.** After a compile hung, the phone gave no GPU to any page until restarted. No source for it.

**A rule, for now.** No more than four terms joined by `&&` or `||` in an expression of a shader of ours ([decision 042](../decisions/042-short-chains-in-shaders.md)). And a table to fill at every new Safari, on the [page](../topics/shader-compiler-limits.md#checked-so-far), to see the day the rule can go.

## What we take away

- A newer browser can be the one that fails: test the versions people have, not "Safari".
- Open source answers "will it pass?": the fix is in WebKit's code, with its date.
- Two compilers in a row, two sets of limits: the browser's, then Metal's.
- A specification says what must work, not what will fail.

## Open questions

- When the fix reaches a Safari people have: not known. Until then, short chains.
- Nothing checks the rule below: a long chain written tomorrow breaks Safari again.
- Why a hung compile takes the GPU away from every page.
- Does Chrome on an iPhone, built on WebKit too, do the same? Not tried today.

## Sources

- The page: [What a browser's compiler does not take](../topics/shader-compiler-limits.md), with what is measured, what is read and what is a guess.
- WebKit: [TypeCheck.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebGPU/WGSL/TypeCheck.cpp), the change of May 19, [313467@main](https://commits.webkit.org/313467@main), and the fix of November 17, [327051@main](https://commits.webkit.org/327051@main). Read: the two commit messages and the function `binaryExpression`.
- [WGSL limits you won't find in the spec](https://hugodaniel.com/posts/webgpu-shader-unknown-limits/), September 2025. Read through a summary, for its table of limits and Metal's message.
- The [WGSL](https://www.w3.org/TR/WGSL/#limits) and [WebGPU](https://www.w3.org/TR/webgpu/#navigator-gpu) specifications: the section on limits, and `navigator.gpu`.

## Next step

Back to the engine, the user's choice: what of the hand, the drift and the patches goes into it.
