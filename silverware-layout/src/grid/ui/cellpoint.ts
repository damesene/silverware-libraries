// Where a point of a cell's rendering is in the cell's markdown (a click, a drop, a selection): the element marked with
// its place there (`data-pos`, the host's rendering), the text before the point in it, a blank line found by height.
import { blankLineStarts } from "../core/blanklines.ts";
import { lineStarts, markedFrom, offsetOf } from "./offsets.ts";
import { cellLines, drawnBlocks, spaceBefore } from "./view.ts";
import { positionInCell } from "../core/position.ts";

/** A caret's place in the rendering: a node and an offset in it */
export type Caret = { readonly node: Node; readonly offset: number };
/** Where a click was in a cell's rendering: the element, the caret there, and the text selected in the cell, where some was */
export type CellPoint = { readonly target: Element; readonly caret: Caret | undefined; readonly y?: number; readonly selected?: { readonly anchor: Caret; readonly focus: Caret } };

/** A selection in a cell's rendering as one of its markdown: each end where it is there, its direction kept */
export function selectionInCell(content: string, cellElement: HTMLElement, selected: { readonly anchor: Caret; readonly focus: Caret }): { readonly from: number; readonly to: number; readonly backward: boolean } {
  const end = (caret: Caret) => offsetInCell(content, cellElement, caret.node instanceof Element ? caret.node : (caret.node.parentElement ?? cellElement), caret);
  const anchor = end(selected.anchor);
  const focus = end(selected.focus);
  return { from: Math.min(anchor, focus), to: Math.max(anchor, focus), backward: focus < anchor };
}

/**
 * Where a point of a cell's rendering is in its markdown: the element it is in that is marked with its place
 * (`data-pos`; SilverBullet leaves 0 out: the cell's first block, unmarked, is at 0), and how far into that element's
 * text the point is, followed through the markdown from there (core/position.ts)
 */
export function offsetInCell(content: string, cellElement: HTMLElement, target: Element, caret: Caret | undefined): number {
  const from = caret ? (caret.node instanceof Element ? caret.node : caret.node.parentElement) ?? target : target;
  const marked = markedFrom(from);
  const element = marked && cellElement.contains(marked) ? marked : ([...cellElement.children].find((child) => child.contains(from)) ?? cellElement);
  const elementPos = element === marked ? offsetOf(marked) : 0;
  if (!caret || !element.contains(caret.node)) return positionInCell(content, elementPos, "", 0);
  // The element's text before the point
  const range = cellElement.ownerDocument.createRange();
  range.setStart(element, 0);
  range.setEnd(caret.node, caret.offset);
  return positionInCell(content, elementPos, element.textContent ?? "", range.toString().length);
}

/**
 * The end of a cell's markdown, where a point is under all of its rendering (a cell shorter than its row, clicked
 * under its text: the caret after its last character); none where it is not
 */
export function endAt(content: string, cellElement: HTMLElement, y: number): number | undefined {
  const last = drawnBlocks(cellElement).at(-1);
  if (last && y <= last.getBoundingClientRect().bottom) return undefined;
  return content.replace(/\s+$/, "").length;
}

/**
 * Where the room of the blank lines before an element of a cell's rendering starts: the bottom of what is drawn before
 * it past the space between (`spaceBefore`: an element, or text the host left unwrapped), a margin between theirs too;
 * where nothing is, the top of what holds it (a quote's first block after the quote's empty first lines; the cell),
 * the blank lines before that its holder's own
 */
function blankRoomTop(element: Element, cellElement: Element): number {
  const { before } = spaceBefore(element);
  if (!before) return (element.parentElement ?? cellElement).getBoundingClientRect().top;
  if (before instanceof Element) return before.getBoundingClientRect().bottom;
  const range = cellElement.ownerDocument.createRange();
  range.selectNodeContents(before);
  return range.getBoundingClientRect().bottom;
}

/**
 * Where a click on a blank line of a cell's rendering is in its markdown: the start of that blank line (none where the
 * click is on no blank line). Blank lines are drawn as space, no element marked with its place in it: found by
 * height, between the element drawn before (its bottom) and the one after (its top, its `data-pos`), as many lines
 * there as its markdown has blank lines before it
 */
export function blankLineAt(content: string, cellElement: HTMLElement, y: number): number | undefined {
  const lines = cellLines(cellElement, content);
  const next = lineStarts(cellElement, lines).find(({ element }) => element.getBoundingClientRect().top > y);
  if (!next) return undefined;
  const { element, offset } = next;
  // (The nearest first)
  const blanks = blankLineStarts(lines, offset);
  if (!blanks.length) return undefined;
  const top = element.getBoundingClientRect().top;
  const bottom = blankRoomTop(element, cellElement);
  if (y < bottom || top <= bottom) return undefined;
  const line = (top - bottom) / blanks.length;
  const nth = Math.min(blanks.length, Math.max(1, Math.ceil((top - y) / line)));
  return blanks[nth - 1];
}
