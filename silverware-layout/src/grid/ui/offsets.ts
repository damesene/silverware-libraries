// Where an element of a cell's rendering is in the cell's markdown: the host marks each element with its offset
// (`data-pos`, `GridHost.renderMarkdown`), and may leave an offset of 0 unmarked (SilverBullet does): read here alone.
import { lineIndexAt, type MarkedLine } from "../../../../shared/markdown/lines.ts";

const POS = "data-pos";

/** An element of a cell's rendering that starts a line of its markdown, and its offset there */
export type LineStart = { readonly element: HTMLElement; readonly offset: number };

/**
 * The elements of a cell's rendering that start a line of its markdown, in their order, one per line: of the elements
 * marked with their offsets where a line's own text starts (past its marks: a quote's, a list item's), the outermost,
 * the first in the document's order (a list rather than its first item, a quote rather than the list in it, an item
 * rather than its text); none past where a line's text starts (a link, emphasis further in). Whatever holds a block
 * (the cell, a quote, a list's item), what lies before that line (its blank lines) lies before that element, not
 * inside it. Every offset marked is the cell's (a page embedded is drawn unmarked: the host's `renderMarkdown`). Found
 * as they are asked for: what looks for one (a press) stops there
 */
export function* lineStarts(cell: HTMLElement, lines: readonly MarkedLine[]): Generator<LineStart> {
  const taken = new Set<number>();
  for (const element of cell.querySelectorAll<HTMLElement>(`[${POS}]`)) {
    const offset = offsetOf(element);
    const line = lines[lineIndexAt(lines, offset)]!;
    if (offset > line.content || taken.has(line.from)) continue;
    taken.add(line.from);
    yield { element, offset };
  }
}

/** The element marked with its offset that an element of a cell's rendering is in, itself or the nearest round it */
export const markedFrom = (element: Element): Element | null => element.closest(`[${POS}]`);

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
