// The colors of the graph. Shape and fill say how far we went with a topic; the color says which
// area it belongs to.

export const PAPER = 0xf2f1ec
export const INK = 0x16161a

/**
 * One color per area of the map. Checked with a palette validator on the paper background: every
 * pair stays apart for the common kinds of color blindness too, and every color has a contrast of
 * at least 3:1 against the paper.
 */
const AREA_COLOR: Record<string, number> = {
  gpu: 0x0031f5, // the blue of the cover in the README
  physics: 0xe8552d,
  math: 0x199e70,
  engine: 0xb0347a,
  method: 0x7b2fbe,
}

/** The color of an area. An area added to the map later is grey until it gets a color here. */
export const areaColor = (area: string): number => AREA_COLOR[area] ?? 0x85857f

/** A color as CSS wants it: 0x0031f5 becomes "#0031f5". */
export const cssColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`
