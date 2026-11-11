# 009 · Meters, seconds, and Y up

*Accepted · November 11, 2026 · The user, when the engine needed a default gravity (step 008)*

**Decision:** we will measure in meters and seconds, with the Y axis pointing up, so the default gravity is (0, −9.81, 0) m/s². Gravity can be changed.

## Why

Engines tune their tolerances for one scale. [Box2D](https://github.com/erincatto/box2d/blob/main/docs/overview.md#units) is tuned for meters, kilograms and seconds, and for moving objects between 0.1 and 10 meters, "between soup cans and buses". Y up is the three.js convention, so a FORCE position can go straight onto a three.js object.

## Not chosen

- **Z up:** the convention of Unreal and Blender, but not of the web 3D our users know.
- **Pixels or arbitrary units:** every tolerance would depend on the scene.

## Consequences

- Scenes built at another scale, such as one unit per centimeter, have to be scaled before they reach the engine.
- Every tolerance and default we add later assumes objects of everyday size.
