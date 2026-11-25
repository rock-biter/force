# 032 · One buffer for the properties of a particle

*Accepted · November 25, 2026 · The user, after the page with sizes asked a device for a ninth storage buffer ([chapter 049](../logbook/049-a-radius-each.md))*

**Decision:** we will keep what a particle is, and does not change during a step, in one buffer of four numbers per particle, the radius first, and we will not ask a device for more than the 8 storage buffers a shader gets by default.

## Why

A shader can read 8 storage buffers unless the device is asked for more ([guide](../guides/adapter-and-device.md)). The shader that makes the lists already read 8, and the one of the rounds 7. A buffer for the radii, then one for each property to come (friction, bounce, material), would not fit. Springs and the rest of the engine will need buffers too. One buffer of four numbers holds four properties for the price of one.

## Not chosen

- **Asking the device for 9 or 10:** the first version of the page did. It works on our Mac, and stops on a device that has only 8. We do not know which ones do.
- **One buffer per property:** the simplest to read, and full after the first.
- **The radius next to the position:** a position is x, y, z and 1 / mass, with no room left.

## Consequences

- The three shaders with sizes read `properties[i].x`. The other three numbers are free.
- To make room in the shader of the lists, a particle's row of neighbours now begins with its count: 33 numbers, and no buffer of counts. With that, the lists read 8 buffers, the rounds 7, the levels 6.
- These shaders are copies, in [examples/mixed-sizes](https://github.com/rock-biter/force/blob/c983d82/examples/mixed-sizes/list-sized.wgsl): the benchmark page times the originals, which must stay as they are until the benchmarks are closed. Two copies of each to keep in step, for now.
- A property that changes at every step does not belong here.

## Still open

- The buffers of the cached lists of neighbours (the lists, the anchors, the counters): are they still worth their places, and can they be packed further? The user's question, the next study.
- Where the springs between particles go.
- What the three free numbers become, and what to do when four are not enough.

## Revisit if

A shader needs a ninth buffer again.
