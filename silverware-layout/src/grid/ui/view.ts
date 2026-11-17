// A grid drawn: its cells side by side as its column template says (a narrow pane stacks them: the style page's rule),
// each cell's markdown as the host rendered it.
import { el } from "../../../../shared/elements.ts";
import { type MarkedLine, markedLines } from "../../../../shared/markdown/parse.ts";
import { blankLinesBefore, blankLinesDrawn } from "../core/blanklines.ts";
import type { BorderStyle } from "../model/border.ts";
import { lineStarts } from "./offsets.ts";

const COLUMNS = "--swl-grid-columns";
// A blank line of a cell's markdown its rendering left out, put back
const BLANK = "swl-grid-blank";

// The blank lines put back in a cell's rendering
const BLANK_LINES = `.${BLANK}`;
// The host's line breaks
const BREAKS = "br";
/** What a cell's rendering draws as space, not content: the host's line breaks and the blank lines put back */
export const SPACERS = `${BREAKS}, ${BLANK_LINES}`;
/** A cell's grip, its class (ui/columngrips.ts draws it) */
export const CELL_GRIP = "swl-grid-cell-grip";
/** What a grid puts in its cells besides their rendering: each cell's grip */
export const CELL_CONTROLS = `.${CELL_GRIP}`;

/** The blocks a cell draws of its markdown, in order: its children but the space between them and what the grid puts in it */
export const drawnBlocks = (cell: Element): Element[] => [...cell.children].filter((child) => !child.matches(`${SPACERS}, ${CELL_CONTROLS}`));

/** The space drawn right before an element of a cell's rendering, by kind, and the element drawn before that (none: it is first) */
export function spaceBefore(element: Element): { readonly breaks: number; readonly blanks: number; readonly before: Element | undefined } {
  let breaks = 0;
  let blanks = 0;
  let before = element.previousElementSibling;
  for (; before?.matches(SPACERS); before = before.previousElementSibling) {
    if (before.matches(BREAKS)) breaks++;
    else blanks++;
  }
  return { breaks, blanks, before: before ?? undefined };
}

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

// Each cell's markdown read line by line, for the markdown it was read of
const readLines = new WeakMap<Element, { readonly content: string; readonly lines: readonly MarkedLine[] }>();

/**
 * A cell's markdown read line by line as markdown's parser reads it (`markedLines`): once for its drawing and every
 * point found in it after (a press, a drop), read again only where its markdown is another
 */
export function linesOf(cell: Element, content: string): readonly MarkedLine[] {
  const read = readLines.get(cell);
  if (read?.content === content) return read.lines;
  const lines = markedLines(content);
  readLines.set(cell, { content, lines });
  return lines;
}

/**
 * A cell drawn with the blank lines of its markdown the host's rendering left out (next to a list, a heading, a table,
 * between a loose list's items: core/blanklines.ts): a line of space each before the element it was before, as the
 * editor shows it. Each line told by the element that starts it (ui/offsets.ts: a list's, not its first item's)
 */
export function keepBlankLines(doc: Document, cell: HTMLElement, content: string): void {
  const lines = linesOf(cell, content);
  for (const { element, offset } of lineStarts(cell, lines)) {
    const wanted = blankLinesBefore(lines, offset);
    if (!wanted) continue;
    // (Those put back already counted: drawn again over the same, none more)
    const { breaks, blanks, before } = spaceBefore(element);
    for (let missing = wanted - blanks - blankLinesDrawn(breaks, before); missing > 0; missing--) element.before(el(doc, "div", { class: BLANK, attrs: { "aria-hidden": "true" } }));
  }
}
