// A workbook's reader (docs/silverware-viewers.md): a sheet at a time drawn as a spreadsheet shows it (src/table.ts), its
// tabs in the bar of the shared reader's shell (shared/docreader.ts: the embed's height in the page, or filling a side
// panel or the enlarged view; the zoom); a sheet larger than the most drawn cut, said under it. Where it cannot be
// read: said.
import type { KeptKeys } from "../../shared/silverbullet/keptkeys.ts";
import { readerShell } from "../../shared/docreader.ts";
import { el } from "../../shared/elements.ts";
import { workbook } from "./load.ts";
import type { Sheet } from "./model.ts";
import { drawSheet, holdFrozen } from "./table.ts";

/** What is said under a sheet drawn only in part */
export function cutNote(sheet: Sheet): string | undefined {
  if (!sheet.cut) return undefined;
  return `Shown: the first ${sheet.rows.length} of ${sheet.cut.rows} rows and ${sheet.columns.length} of ${sheet.cut.columns} columns. Open the file to see all of it.`;
}

/** A workbook's reader; `height` its height in the page, none where it fills a panel */
export function xlsxReader(doc: Document, url: string, name: string, height: number | undefined, signal: AbortSignal, keyKept?: KeptKeys): HTMLElement {
  const shell = readerShell(doc, { base: "swa-xlsx" }, { name, height, ...(keyKept ? { keyKept } : {}) });
  const { root: reader, scroller } = shell;
  let shown: HTMLTableElement | undefined;

  const show = (sheets: readonly Sheet[], index: number, tabs: readonly HTMLButtonElement[]) => {
    const sheet = sheets[index]!;
    tabs.forEach((tab, at) => tab.setAttribute("aria-pressed", String(at === index)));
    if (!tabs.length) shell.label(sheet.name);
    if (!sheet.rows.length) {
      shown = undefined;
      scroller.replaceChildren(el(doc, "p", { class: "swa-xlsx-reader-empty", text: "This sheet is empty." }));
      return;
    }
    shown = drawSheet(doc, sheet, { headers: true });
    shown.style.zoom = String(shell.zoom);
    const note = cutNote(sheet);
    scroller.replaceChildren(shown, ...(note ? [el(doc, "p", { class: "swa-xlsx-reader-cut", text: note })] : []));
    scroller.scrollTop = 0;
    scroller.scrollLeft = 0;
    // (Held once laid out: the frozen rows' heights read)
    const table = shown;
    (doc.defaultView?.requestAnimationFrame ?? ((run: () => void) => setTimeout(run, 0)))(() => table.isConnected && holdFrozen(table, sheet.frozen));
  };
  shell.onZoom((zoom) => {
    if (shown) shown.style.zoom = String(zoom);
  });

  workbook(doc, url)
    .then(({ sheets }) => {
      if (signal.aborted) return;
      if (!sheets.length) throw new Error("the workbook has no sheet to show");
      // Its sheets' tabs in the bar, where it has more than one (one alone: its name the bar's label)
      const tabs =
        sheets.length > 1
          ? sheets.map((sheet, index) => el(doc, "button", { class: "swa-xlsx-reader-button swa-xlsx-reader-tab", text: sheet.name, attrs: { type: "button", title: sheet.name }, run: () => show(sheets, index, tabs) }))
          : [];
      shell.tools.replaceChildren(...tabs);
      if (tabs.length) shell.label("");
      shell.state("sheet");
      show(sheets, 0, tabs);
    })
    .catch((error: unknown) => {
      if (signal.aborted) return;
      scroller.replaceChildren(el(doc, "p", { class: "swa-xlsx-reader-failed", text: `This workbook cannot be shown here: ${error instanceof Error ? error.message : String(error)}` }));
      shell.state("failed");
    });
  return reader;
}
