// A grid drawn: its cells side by side as its column template says (a narrow pane stacks them: the style page's rule),
// each cell's markdown as the host rendered it.
import { el } from "../../../../shared/elements.ts";
import { blankLinesBefore, blankLinesDrawn } from "../core/blanklines.ts";

const COLUMNS = "--swl-grid-columns";
// A blank line of a cell's markdown its rendering left out, put back
const BLANK = "swl-grid-blank";

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

// A grid drawn with its lines (its `border` attribute)
const BORDER = "data-swl-border";

/** A grid's lines shown or not (unchanged: nothing touched) */
export function showBorder(grid: HTMLElement, on: boolean): void {
  if (grid.hasAttribute(BORDER) !== on) grid.toggleAttribute(BORDER, on);
}

/** A cell's markdown that could not be rendered, shown as its text */
export function plainCell(doc: Document, content: string): string {
  const pre = el(doc, "div", { class: "swl-grid-plain", text: content });
  return pre.outerHTML;
}

/**
 * A cell drawn with the blank lines of its markdown the host's rendering left out (next to a list, a heading, a table,
 * between a loose list's items: core/blanklines.ts): a line of space each before the element it was before, as the
 * editor shows it. Each element told by its offset in the cell's text (the host's `data-pos`)
 */
export function keepBlankLines(doc: Document, cell: HTMLElement, content: string): void {
  for (const element of cell.querySelectorAll<HTMLElement>(":scope > [data-pos], :scope li[data-pos]")) {
    const wanted = blankLinesBefore(content, Number(element.getAttribute("data-pos")));
    if (!wanted) continue;
    // (Those put back already counted: drawn again over the same, none more)
    let breaks = 0;
    let kept = 0;
    let before = element.previousElementSibling;
    while (before?.tagName === "BR" || before?.classList.contains(BLANK)) {
      if (before.tagName === "BR") breaks++;
      else kept++;
      before = before.previousElementSibling;
    }
    for (let missing = wanted - kept - blankLinesDrawn(breaks, before ?? undefined); missing > 0; missing--) element.before(el(doc, "div", { class: BLANK, attrs: { "aria-hidden": "true" } }));
  }
}
