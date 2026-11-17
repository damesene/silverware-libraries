// A grid drawn: its cells side by side as its column template says (a narrow pane stacks them: the style page's rule),
// each cell's markdown as the host rendered it.
import { el } from "../../../../shared/elements.ts";
import { blankLinesAbove, blankLinesDrawn } from "../core/blanklines.ts";
import type { BorderStyle } from "../model/border.ts";
import { BLANK, spaceBefore } from "./cellparts.ts";
import { cellLines, lineStarts } from "./offsets.ts";

const COLUMNS = "--swl-grid-columns";

/** A grid's element: a cell per rendered markdown (the host's HTML, its elements marked with their offsets in the cell's text) */
export function drawGrid(doc: Document, template: string, cells: readonly string[]): HTMLElement {
  // (Focusable by a press, not by Tab: a press anywhere in it (a cell, the gap between two, a divider) focuses the grid,
  // not the editor round it, whose selection would go into the grid's text and show its markdown there)
  const grid = el(doc, "div", { class: "swl-grid", attrs: { tabindex: -1 } });
  showColumns(grid, template);
  cells.forEach((html, index) => {
    const cell = el(doc, "div", { class: "swl-grid-cell", attrs: { "data-swl-cell": index } });
    // The host's rendering of the page's markdown (SilverBullet's renderer, which leaves out what would run), not
    // markup of Silverware Layout's own: set as the host gave it
    cell.innerHTML = html;
    grid.append(cell);
  });
  return grid;
}

/** A grid's column template set (unchanged: nothing touched) */
export function showColumns(grid: HTMLElement, template: string): void {
  if (grid.style.getPropertyValue(COLUMNS) !== template) grid.style.setProperty(COLUMNS, template);
}

// A grid whose columns are as many as fit (`columns="auto"`): no divider, its columns kept in a narrow pane
const FIT = "data-swl-fit";

/** A grid shown as one of columns as many as fit or not (unchanged: nothing touched) */
export function showFit(grid: HTMLElement, on: boolean): void {
  if (grid.hasAttribute(FIT) !== on) grid.toggleAttribute(FIT, on);
}

/** Whether a grid is shown as one of columns as many as fit */
export const shownFit = (grid: HTMLElement): boolean => grid.hasAttribute(FIT);

// A grid drawn with all its lines, and with the lines between its cells alone (its `border` attribute)
const BORDER = "data-swl-border";
const BORDER_INNER = "data-swl-border-inner";

/** A grid's lines shown as their style says (unchanged: nothing touched) */
export function showBorder(grid: HTMLElement, style: BorderStyle): void {
  if (grid.hasAttribute(BORDER) !== (style === "all")) grid.toggleAttribute(BORDER, style === "all");
  if (grid.hasAttribute(BORDER_INNER) !== (style === "inner")) grid.toggleAttribute(BORDER_INNER, style === "inner");
}

/** A cell's markdown that could not be rendered, shown as its text */
export function plainCell(doc: Document, content: string): string {
  const pre = el(doc, "div", { class: "swl-grid-plain", text: content });
  return pre.outerHTML;
}

/**
 * A cell drawn with the blank lines of its markdown the host's rendering left out (next to a list, a heading, a table,
 * between a loose list's items: core/blanklines.ts): a line of space each before the element it was before, as the
 * editor shows it. Each line told by the element that starts it (ui/offsets.ts: a list's, not its first item's)
 */
export function keepBlankLines(doc: Document, cell: HTMLElement, content: string): void {
  const lines = cellLines(content);
  for (const { element, offset } of lineStarts(cell, lines)) {
    const wanted = blankLinesAbove(lines, offset).length;
    if (!wanted) continue;
    // (Those put back already counted: drawn again over the same, none more)
    const { breaks, blanks, before } = spaceBefore(element);
    for (let missing = wanted - blanks - blankLinesDrawn(breaks, before); missing > 0; missing--) element.before(el(doc, "div", { class: BLANK, attrs: { "aria-hidden": "true" } }));
  }
}
