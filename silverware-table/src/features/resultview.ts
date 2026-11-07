// The formulas module's Show result: a cell's result of several values (a
// cell showing #SPILL!) as a table over the window, read only, until views
// make tables of such results. The table is the core's preview table (the
// page's tables' look) in the core's dialog, made as wide and high as the
// window: no table of the page, so nothing is written, sorted or selected.
// Copy (and the cell menu's Copy result) copies the whole result.
import type { Dialog, ModelHost } from "../core/feature.ts";
import { clipboardHtml, clipboardText, writeClipboard } from "../clipboard.ts";
import { el } from "../../../shared/elements.ts";
import { columnLetters, type Grid, scalarText } from "../formulas/index.ts";
import { ICONS } from "../icons.ts";

/** At most so many rows drawn: the copy has every one */
export const SHOWN_ROWS = 2000;

/** A result's header: its columns' names where it came from a table's, else their letters (A, B, C) */
export function resultHeader(grid: Grid): string[] {
  return Array.from({ length: grid.width }, (_, c) => grid.names[c] ?? columnLetters(c));
}

/** A result's rows as text, as cells show their values (an error by its code) */
export function resultRows(grid: Grid, limit = grid.height): string[][] {
  return grid.rows().slice(0, limit).map((row) => row.map((value) => scalarText(value)));
}

/** Its size as said above it: 1,284 × 3 */
export function resultSize(grid: Grid): string {
  return `${grid.height.toLocaleString("en")} × ${grid.width.toLocaleString("en")}`;
}

export class ResultView {
  private dialog: Dialog | undefined;

  constructor(private readonly host: ModelHost) {}

  /** The whole result copied: its header and every row, as text and as an HTML table (for a spreadsheet) */
  async copy(grid: Grid): Promise<void> {
    const values = [resultHeader(grid), ...resultRows(grid)];
    try {
      await writeClipboard(this.host.doc, clipboardText(values), clipboardHtml(values));
      void this.host.bridge.flash(`Silverware Table: result copied (${resultSize(grid)})`, "info");
    } catch {
      void this.host.bridge.flash("Silverware Table: the result could not be copied", "error");
    }
  }

  /** Shows `grid`, the result of `formula`, over the window */
  show(formula: string, grid: Grid): void {
    this.close();
    const { doc } = this.host;
    const shown = Math.min(grid.height, SHOWN_ROWS);
    const preview = this.host.previewTable(resultHeader(grid), resultRows(grid, shown), {});
    // Read by a screen reader as any table (the preview of a theme is hidden from it)
    preview.element.removeAttribute("aria-hidden");
    preview.element.classList.add("swt-result-table");
    const copy = el(doc, "button", {
      class: "swt-result-copy",
      title: "Copy the whole result (for a spreadsheet, or to paste as a table)",
      attrs: { "aria-label": "Copy result" },
      html: ICONS.copy,
      run: () => void this.copy(grid),
    });
    const size = el(doc, "span", {
      class: "swt-result-size",
      text: shown < grid.height ? `${resultSize(grid)} · ${shown.toLocaleString("en")} of ${grid.height.toLocaleString("en")} rows shown` : resultSize(grid),
    });
    const bar = el(doc, "div", { class: "swt-result-bar" }, size, copy);
    const content = el(doc, "div", { class: "swt-result-box" }, preview.element);
    this.dialog = this.host.openDialog({
      title: "Result",
      subtitle: formula,
      className: "swt-result-dialog",
      bar,
      content,
      focus: copy,
      closed: () => {
        this.dialog = undefined;
      },
    });
    // The formula cut with an ellipsis above the table: whole on hover
    this.dialog.element.querySelector(".swt-dialog-subtitle")?.setAttribute("title", formula);
  }

  close(): void {
    this.dialog?.close();
    this.dialog = undefined;
  }
}
