// Where a point of a cell's rendering is in the cell's markdown (a click, a drop, a selection): the element marked with
// its place there (`data-pos`, the host's rendering), the text before the point in it, a blank line found by height.
import { blankLinesBefore, blankLineStart } from "../core/blanklines.ts";
import { offsetOf } from "./offsets.ts";
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
  const marked = from.closest("[data-pos]");
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
  // (The rendering's own elements: not the cell's "…", nor a blank line put back after its last block)
  const drawn = [...cellElement.children].filter((child) => !child.matches("button, .swl-grid-blank"));
  const last = drawn.at(-1);
  if (last && y <= last.getBoundingClientRect().bottom) return undefined;
  return content.replace(/\s+$/, "").length;
}

/**
 * Where a click on a blank line of a cell's rendering is in its markdown: the start of that blank line (none where the
 * click is on no blank line). Blank lines are drawn as space, no element marked with its place in it: found by
 * height, between the element drawn before (its bottom) and the one after (its top, its `data-pos`), as many lines
 * there as its markdown has blank lines before it
 */
export function blankLineAt(content: string, cellElement: HTMLElement, y: number): number | undefined {
  const marked = [...cellElement.querySelectorAll<HTMLElement>(":scope > [data-pos], :scope li[data-pos]")];
  const next = marked.find((element) => element.getBoundingClientRect().top > y);
  if (!next) return undefined;
  const pos = Number(next.getAttribute("data-pos"));
  const blanks = blankLinesBefore(content, pos);
  if (!blanks) return undefined;
  // The bottom of what is drawn before it (a line break or a put-back blank line is space, not content)
  let before = next.previousElementSibling;
  while (before && (before.tagName === "BR" || before.classList.contains("swl-grid-blank"))) before = before.previousElementSibling;
  const top = next.getBoundingClientRect().top;
  const bottom = before ? before.getBoundingClientRect().bottom : cellElement.getBoundingClientRect().top;
  if (y < bottom || top <= bottom) return undefined;
  const line = (top - bottom) / blanks;
  const nth = Math.min(blanks, Math.max(1, Math.ceil((top - y) / line)));
  return blankLineStart(content, pos, nth);
}
