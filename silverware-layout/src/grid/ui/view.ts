// A grid drawn: its cells side by side as its column template says (a narrow pane stacks them: the style page's rule),
// each cell's markdown as the host rendered it.
import { el } from "../../../../shared/elements.ts";

const COLUMNS = "--swl-grid-columns";

/** A grid's element: a cell per rendered markdown (the host's HTML, its elements marked with their offsets in the cell's text) */
export function drawGrid(doc: Document, template: string, cells: readonly string[]): HTMLElement {
  const grid = el(doc, "div", { class: "swl-grid" });
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

/** A cell's markdown that could not be rendered, shown as its text */
export function plainCell(doc: Document, content: string): string {
  const pre = el(doc, "div", { class: "swl-grid-plain", text: content });
  return pre.outerHTML;
}
