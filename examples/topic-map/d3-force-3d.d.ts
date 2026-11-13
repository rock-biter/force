// d3-force-3d ships no types: these cover only what the topic map uses.

declare module 'd3-force-3d' {
  type Value<T> = number | ((item: T) => number)

  interface Simulation<N> {
    force(name: string, force: unknown): this
    /** Stops the timer that would run the simulation one tick per frame. */
    stop(): this
    /** Runs the simulation by hand, for a number of steps. */
    tick(iterations?: number): this
    /** Sets how far a step may move the nodes: 1 at the start, cooling toward 0. */
    alpha(alpha: number): this
  }

  interface LinkForce<L> {
    distance(distance: Value<L>): this
    strength(strength: Value<L>): this
  }

  interface ManyBodyForce {
    strength(strength: number): this
  }

  interface RadialForce<N> {
    strength(strength: Value<N>): this
  }

  export function forceSimulation<N>(nodes: N[], dimensions?: 1 | 2 | 3): Simulation<N>
  export function forceLink<L>(links: L[]): LinkForce<L>
  export function forceManyBody(): ManyBodyForce
  export function forceRadial<N>(radius: Value<N>): RadialForce<N>
}
