# What a browser's compiler does not take

*Theory · 5 min read · Updated November 26, 2026 · [Topic map](./README.md)*

**In short:** a WGSL shader that is right can still fail to compile in one browser and pass in another. We met three such walls in one day, all in Safari. One is a bug already fixed, one is a limit of Apple's own compiler, one is a rule of the web.

## The idea

In GLSL you learn it early: a shader that works on your card may not compile on another. WebGPU was meant to end that, with one language, WGSL, and a [specification](https://www.w3.org/TR/WGSL/#limits) that lists what every browser must take: 1023 members in a struct, 127 levels of braces, 255 parameters. But the list is short. It says nothing of how long an expression may be. There each browser has its own answer, and not always an error to tell it.

A browser does not hand WGSL to the GPU. It translates it: Chrome with a compiler called Tint, Safari with WebKit's own, both on Apple devices into Metal Shading Language, which Apple's Metal compiler then compiles again. Two programs in a row, each with its own limits.

## What we met

Our shader checks whether two of the 27 cells around a particle share a slot: 351 comparisons, `s0 == s1 || s0 == s2 || ...` ([chapter 068](../logbook/068-one-page-for-the-demos.md)).

| Where | What we wrote | What happened |
| --- | --- | --- |
| Chrome 158, Mac | 351 comparisons joined by `||` | compiles |
| Safari 26.3.1, Mac | the same | `GPUPipelineError`, at once |
| Safari 26.3.1, Mac | 26 joined by `||` in a line | compiles |
| Safari 27.2, iPhone 16 Pro | 26 joined by `||` in a line | never finishes, no error |
| Safari 27.2, iPhone 16 Pro | 26 joined by `|`, or 4 by `||` | compiles in 3 ms |

### Wall 1: more than 256 in one expression (Safari on the Mac)

**Measured.** A test shader with a chain of `a == 0u || a == 1u || ...`: 256 terms compile, 258 fail with "Failed to compile the shader source, generated metal". The failure is in the second compiler, Metal's.

**Read, not seen by us.** A [post that hunts for such limits](https://hugodaniel.com/posts/webgpu-shader-unknown-limits/) reports Metal's own words from Chrome, for another shader: "bracket nesting level exceeded maximum of 256".

**Our guess.** WebKit writes a chain of N operators as N brackets one inside the other, and Metal stops at 256. Tint must write `||` another way, since Chrome took our 351.

### Wall 2: time that doubles with every `||` (Safari on the iPhone)

**Read in WebKit's code.** Its type checker, the part that works out the type of every expression ([TypeCheck.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebGPU/WGSL/TypeCheck.cpp)), got special handling for `&&` and `||` on May 19, 2026 ([313467@main](https://commits.webkit.org/313467@main)). It worked out the type of the left side, then asked for it again. In `a || b || c || d` the left side of the last `||` is `a || b || c`, whose left side is `a || b`: each `||` doubled the work of the one before. On November 17, 2026 a fix went in, titled as a regression of that change: "Convert O(2^N) algorithm to O(N)" ([327051@main](https://commits.webkit.org/327051@main)). The code now carries the note: "Inferring it again [...] would make checking a chain of N short-circuiting operators take O(2^N) time."

**Measured on the phone.** 4 in a chain: 3 ms. 26: still compiling after 8 seconds. 26 joined by `|`, which is not one of the two operators: 3 ms. With doubling, 4 costs 16 times one and 26 costs 67 million times one.

**Our guess, well supported.** The phone's Safari 27.2 was built from WebKit between those two days. The Mac's Safari 26.3.1 is older than the first, which is why the newer browser was the one that failed. We cannot see which WebKit a Safari holds.

### Wall 3: after a hang, no GPU at all (the iPhone)

**Seen.** Once a compile hung, `requestAdapter()` gave nothing to any page, until the phone was restarted. **Not explained:** we found no source. Our guess is that the browser's process that talks to the GPU was still busy with the shader.

### Not a wall: http

**Read in the specification.** `navigator.gpu` is marked `[SecureContext]` in the [WebGPU specification](https://www.w3.org/TR/webgpu/#navigator-gpu): it exists only on pages on https, or on localhost. At `http://192.168.1.65:5173` a phone has no WebGPU, whatever the phone. This is how it is meant to be.

## Will it pass?

| Wall | Kind | What to expect |
| --- | --- | --- |
| 2, the doubling | a bug of some versions of Safari | fixed in WebKit's code since November 17, 2026: a later Safari will have it. When, we do not know |
| 1, the 256 | a limit of Apple's Metal compiler, and how WebKit writes for it | nothing says it will change |
| 3, no GPU after a hang | not known | not known |
| http | a rule | stays |

None is about the iPhone 16 Pro itself, or the M1. They are about the version of the browser: the same Safari on another device should do the same. On an iPhone every browser is built on WebKit, so Chrome there has Safari's walls: widely known, and our own numbers from the phone agreed, but we did not check it again today.

## Checked so far

The walls move with the browsers. At every new version of Safari, open [compile-probe](../../examples/compile-probe/index.html) on the phone and on the Mac, and add a row. The ways: `fours` is ours; `ifs` and `lets` have 26 `||` in a line; `one` has 351 in one expression.

| Day | Browser | Device | `fours` | `ifs`, `lets` | `one` |
| --- | --- | --- | --- | --- | --- |
| November 26, 2026 | Chrome 158 | Mac M1 | passes | pass | passes |
| November 26, 2026 | Safari 26.3.1 | Mac M1 | passes | pass | fails, with an error |
| November 26, 2026 | Safari 27.2 | iPhone 16 Pro | passes | `ifs` hangs; `lets` not run after it | not run after it |

When a Safari passes `ifs` and `lets`, wall 2 is gone from that version. `one` passing would mean wall 1 is gone too.

## In FORCE

- The check is written four comparisons at a time, each four with a name ([main.ts](../../examples/heap-simulation/main.ts), `byFours`): it compiles everywhere we tried, and in Chrome costs what the one expression cost.
- [compile-probe](../../examples/compile-probe/index.html) tries eight ways on whatever device opens it. [startup-probe.ts](../../examples/debug/startup-probe.ts), `?probe`, writes each step of a page's start on the page.
- `npm run dev:phone` serves the examples on https, for a phone on the same Wi-Fi.
- The rule, for now: no more than four terms joined by `&&` or `||` in an expression ([decision 042](../decisions/042-short-chains-in-shaders.md)).

## Check yourself

1. Why did the newer Safari fail where the older one passed?
2. Why did `|` compile where `||` did not, with the same 26 comparisons?
3. Which of the walls would a faster phone not help with?
