# 007 · A step of 1/60 s, at most 4 per frame

*Accepted · November 11, 2026 · The user, when the fixed-step loop went into code (step 008)*

**Decision:** we will advance the physics by 1/60 s per step, run at most 4 steps per frame, and throw away the time beyond that limit. Both numbers can be changed.

## Why

[Decision 005](./005-fixed-timestep.md) chose a fixed step but left its length and its limit open, and code needs both. 1/60 s is the step Box2D suggests, and one step per frame on a 60 Hz screen. A limit on steps is the tighter defence against the [spiral of death](../topics/fixed-timestep.md#the-spiral-of-death): with 4, the simulation keeps real time down to 15 FPS, and below that it slows down instead of freezing.

## Not chosen

- **Clamping the frame time to 0.25 s, as in Fiedler's code:** it still allows 15 steps in one frame.
- **No limit:** one slow frame can start the spiral.

## Consequences

- Below 15 FPS, the game sees slow motion.
- After a long pause, such as a tab left in the background, the engine runs 4 steps and moves on.

## Still open

- The limit of 4 is our guess, not taken from a source: we will tune it once we measure real frames on phones.
