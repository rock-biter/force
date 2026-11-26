# 042 · Short chains of && and || in our shaders

*Accepted, for now · November 26, 2026 · The user, on Claude's proposal after a day of demos that did not start in Safari ([chapters 068](../logbook/068-one-page-for-the-demos.md) and [069](../logbook/069-three-walls.md))*

**Decision:** we will write no expression with more than four terms joined by `&&` or `||` in a shader, written by hand or by code: a longer check is cut into lines of four, each with a name, and the names joined in the same way.

## Why

One check of 351 comparisons joined by `||` stopped every demo in Safari, in two ways ([What a browser's compiler does not take](../topics/shader-compiler-limits.md)). In the Safari of today's iPhones, 27.2, a bug makes the compiler double its work at every `&&` or `||` of a chain: 26 in a line never finish, with no error, and the phone then gives no GPU to any page. In Safari on a Mac, 26.3.1, a chain of more than 256 fails in Apple's Metal compiler. Four at a time compiles in 3 ms on the phone, and in Chrome the shader runs as fast as with the one expression: 1.75 ms for the levels of 100 000 particles, either way.

## Not chosen

- **One way for Safari and another for the rest:** two shaders to keep and to test, to save nothing: the short chains cost Chrome no time.
- **`|` and `&` in place of `||` and `&&`:** Safari takes 26 of them, but in Chrome the levels took about 8% longer, and 256 would still be the limit.
- **Loops:** no long line at all, and the phone takes them, but each slot is worked out again at every turn; not timed.
- **Wait for the fix:** it is in WebKit's code since November 17, 2026, but not in the Safari people have.

## Consequences

- Code that writes shaders needs a helper that cuts a chain (`byFours` in [main.ts](../../examples/heap-simulation/main.ts)); it belongs in the engine when shaders are written there.
- A shader is longer and harder to read: 139 short lines for the 351 comparisons.
- "Four" is what we tried, not a known edge: 4 passed and 26 did not. Nothing between was tried.
- Nothing checks the rule: a long chain written tomorrow breaks Safari again, silently in Chrome.

## Still open

- A check, in `npm run lint` or in a test, that no shader has a longer chain.
- Other shapes of long expression, such as sums: not tried on the phone.

## Revisit if

Safari on the phone takes the ways `ifs`, `lets` and `one` of [compile-probe](../../examples/compile-probe/index.html). To look again at every new version of Safari, on the phone and on the Mac, and write the result in the table "Checked so far" of the [page](../topics/shader-compiler-limits.md#checked-so-far). The rule can go, but for Metal's 256, when the versions people still have all pass.
