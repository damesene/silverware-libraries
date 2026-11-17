// Where an element of a cell's rendering is in the cell's markdown: the host marks each element with its offset
// (`data-pos`, `GridHost.renderMarkdown`), and may leave an offset of 0 unmarked (SilverBullet does): read here alone.
import { lineStartOf } from "../core/blanklines.ts";

const POS = "data-pos";

/** An element of a cell's rendering that starts a line of its markdown, and its offset there */
export type LineStart = { readonly element: HTMLElement; readonly offset: number };

/**
 * The elements of a cell's rendering that start a line of its markdown: its blocks, those of its quotes and the items of
 * its lists, in their order, one per line. Where several start on one line (a list and its first item, a quote and the
 * list in it), the outermost stands for the line, the first in the document's order: what lies before that line (its
 * blank lines) lies before it, not inside it
 */
export function lineStarts(cell: HTMLElement, content: string): readonly LineStart[] {
  const lines = new Set<number>();
  const starts: LineStart[] = [];
  for (const element of cell.querySelectorAll<HTMLElement>(`:scope > [${POS}], :scope blockquote > [${POS}], :scope li[${POS}]`)) {
    const offset = offsetOf(element);
    const line = lineStartOf(content, offset);
    if (lines.has(line)) continue;
    lines.add(line);
    starts.push({ element, offset });
  }
  return starts;
}

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
