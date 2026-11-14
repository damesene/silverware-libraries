// A workbook's preview: its first sheet's first cells, drawn small (docs/silverware-viewers.md), cut to the preview's
// room. A box of the preview's room at once, the type's icon and the file's name in it until the workbook is read,
// and where it cannot be (ExcelJS not loaded, a file it cannot read: said in its title). Where Silverware Assets keeps
// previews in the space (`stored`, docs/silverware-assets-stored-previews.md), the cells drawn are kept as HTML, read
// back and made safe after: the workbook not read again.
import type { StoredPreview } from "../../shared/assets.ts";
import { el } from "../../shared/elements.ts";
import { fileVersion } from "../../shared/reads.ts";
import { safeHtml } from "../../shared/safehtml.ts";
import { workbook } from "./load.ts";
import { drawSheet } from "./table.ts";

// The cells a preview draws at most, and how small (CSS zoom)
const ROWS = 12;
const COLUMNS = 8;
export const PREVIEW_ZOOM = 0.6;
// The tables kept in memory (by file and version: a preview drawn anew shows at once), the oldest let go past this many
const KEPT = 20;
const kept = new Map<string, Promise<string>>();

/** The room a preview has, in CSS pixels */
export type PreviewBox = { readonly width: number; readonly height: number };

/** A workbook's first cells drawn, as HTML */
async function drawnCells(doc: Document, url: string, again = false): Promise<string> {
  const { sheets } = await workbook(doc, url, again);
  const first = sheets[0];
  if (!first || !first.rows.length) throw new Error("the workbook has no cells");
  return drawSheet(doc, first, { rows: ROWS, columns: COLUMNS, headers: false }).outerHTML;
}

/** A workbook's first cells as kept in the space: read back where kept for this version, else drawn and kept (`anew`: drawn) */
async function storedCells(doc: Document, url: string, stored: StoredPreview): Promise<string> {
  const key = `${await fileVersion(new URL(url, doc.baseURI).href, doc.baseURI)} ${url}`;
  const known = stored.anew ? undefined : kept.get(key);
  if (known) return known;
  const made = (async () => {
    const own = await (await stored.read("text/html"))?.text();
    if (own) return own;
    const html = await drawnCells(doc, url, stored.anew);
    // (Not kept where the space cannot be written: drawn again next time, as without)
    void stored.write(new Blob([html], { type: "text/html" })).catch(() => undefined);
    return html;
  })();
  kept.delete(key);
  kept.set(key, made);
  made.catch(() => kept.get(key) === made && kept.delete(key));
  while (kept.size > KEPT) kept.delete(kept.keys().next().value!);
  return made;
}

/** A workbook's preview: a box at once (its icon and name), its first sheet's first cells in it once read */
export function xlsxPreview(doc: Document, url: string, name: string, icon: string, box: PreviewBox, signal: AbortSignal, stored?: StoredPreview): HTMLElement {
  const preview = el(doc, "div", { class: "swa-xlsx-preview", attrs: { "data-swa-xlsx-state": "reading", title: name } }, el(doc, "span", { class: "swa-xlsx-preview-icon", html: icon }), el(doc, "span", { class: "swa-xlsx-preview-name", text: name }));
  preview.style.setProperty("--swa-xlsx-box-width", `${Math.round(box.width)}px`);
  preview.style.setProperty("--swa-xlsx-box-height", `${Math.round(box.height)}px`);
  (stored ? storedCells(doc, url, stored) : drawnCells(doc, url))
    .then((html) => {
      if (signal.aborted) return;
      // (What was kept made safe as it is read: anyone who can write the space can write it)
      const table = safeHtml(doc, html, { styleSheets: false }).querySelector<HTMLElement>("table");
      if (!table) throw new Error("the workbook has no cells");
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
