// Where an element of a cell's rendering is in the cell's markdown: the host marks each element with its offset
// (`data-pos`, `GridHost.renderMarkdown`), and may leave an offset of 0 unmarked (SilverBullet does): read here alone.

const POS = "data-pos";

/** An element's offset in its cell's markdown (unmarked: 0) */
export const offsetOf = (element: Element): number => Number(element.getAttribute(POS)) || 0;

/** Whether an element is marked with its offset */
export const isMarked = (element: Element): boolean => element.hasAttribute(POS);

/**
 * The offsets of an element of a cell's rendering and of those marked in it moved by `by` (a block taken into a
 * drawing where its markdown starts elsewhere); the element itself marked so, where it was at 0 unmarked
 */
export function shiftOffsets(element: Element, by: number): void {
  if (!by) return;
  const own = offsetOf(element);
  for (const one of element.querySelectorAll(`[${POS}]`)) one.setAttribute(POS, String(offsetOf(one) + by));
  element.setAttribute(POS, String(own + by));
}
