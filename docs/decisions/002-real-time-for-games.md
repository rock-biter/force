# 002 · Real-time physics for games and immersive 3D

*Accepted · before November 11, 2026 · The user, during the [research with ChatGPT](../logbook/004-the-detour.md)*

**Decision:** we will aim for physics that looks right and stays stable within the time of a frame, not for scientific accuracy.

## Why

FORCE is for video games and immersive 3D experiences on the web. There, the simulation must keep up with 60 frames per second or more and never explode, while being exactly right matters less than looking right.

## Not chosen

- **A scientific simulator**, where precision comes first, like the engines for robotics and engineering such as MuJoCo or Project Chrono.

## Consequences

- We judge a method by how stable and believable it is for each millisecond it costs, not by precision alone.
- Approximations are welcome, as long as they are stable and cheap.
- The physics gets only a slice of each frame. How big a slice is still to measure.
