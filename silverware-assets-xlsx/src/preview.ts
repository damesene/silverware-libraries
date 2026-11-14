// A workbook's preview: its first sheet's first cells, drawn small (docs/silverware-viewers.md), cut to the preview's
// room. A box of the preview's room at once, the type's icon and the file's name in it until the workbook is read,
// and where it cannot be (ExcelJS not loaded, a file it cannot read: said in its title).
import { el } from "../../shared/elements.ts";
import { workbook } from "./load.ts";
import { drawSheet } from "./table.ts";

// The cells a preview draws at most, and how small (CSS zoom)
const ROWS = 12;
const COLUMNS = 8;
export const PREVIEW_ZOOM = 0.6;

/** The room a preview has, in CSS pixels */
export type PreviewBox = { readonly width: number; readonly height: number };

/** A workbook's preview: a box at once (its icon and name), its first sheet's first cells in it once read */
export function xlsxPreview(doc: Document, url: string, name: string, icon: string, box: PreviewBox, signal: AbortSignal): HTMLElement {
  const preview = el(doc, "div", { class: "swa-xlsx-preview", attrs: { "data-swa-xlsx-state": "reading", title: name } }, el(doc, "span", { class: "swa-xlsx-preview-icon", html: icon }), el(doc, "span", { class: "swa-xlsx-preview-name", text: name }));
  preview.style.setProperty("--swa-xlsx-box-width", `${Math.round(box.width)}px`);
  preview.style.setProperty("--swa-xlsx-box-height", `${Math.round(box.height)}px`);
  workbook(doc, url)
    .then(({ sheets }) => {
      if (signal.aborted) return;
      const first = sheets[0];
      if (!first || !first.rows.length) throw new Error("the workbook has no cells");
      const table = drawSheet(doc, first, { rows: ROWS, columns: COLUMNS, headers: false });
      table.style.zoom = String(PREVIEW_ZOOM);
      preview.replaceChildren(el(doc, "div", { class: "swa-xlsx-preview-sheet" }, table));
      preview.dataset.swaXlsxState = "sheet";
    })
    .catch((error: unknown) => {
      if (signal.aborted) return;
      preview.dataset.swaXlsxState = "failed";
      preview.title = `${name}: ${error instanceof Error ? error.message : String(error)}`;
    });
  return preview;
}
