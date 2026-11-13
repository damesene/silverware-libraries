// What a grid asks of SilverBullet (src/grid/grids.ts, `GridHost`): a cell's markdown rendered as SilverBullet renders
// a page (`markdown.markdownToHtml`, handed over by the init page: on 2.12.1 there is no `renderToDom`), the page's
// text, and the button bar (Reload, Copy, Edit) of the frame SilverBullet draws a custom syntax's widget in hidden, as
// Silverware Chart and Database leave theirs out. Set inline and important: on a touch screen SilverBullet shows it by
// a rule naming `#sb-main`, also important, whose specificity no rule of a style page naming no SilverBullet element
// outweighs. (The frame's border is the style page's, by the class the init page gives the frame: SilverBullet sets it
// unimportant. An inline border set here did not hold in 2.12.1, 2026-11-13: the frame's style is SilverBullet's.)
import { resolvedTarget } from "../../../../shared/markdown/embed.ts";
import { pageChanges } from "../../../../shared/pages/changes.ts";
import type { PageWriter } from "../../../../shared/pages/writer.ts";
import type { Bridge } from "../../bridge.ts";
import { documentUrl } from "./platform.ts";
import { ownTasks } from "./tasks.ts";
import { keepUndrawn } from "./undrawn.ts";

// SilverBullet's frame of a grid (its custom syntax's, the class the init page gives it), and its button bar in it
// (2.12.1: .button-bar, in a div of the frame beside the widget's content, probed 2026-11-13; its main: .sb-widget-menu-bar)
const GRID_FRAME = ".swl-grid-widget";
const GRID_BARS = ".swl-grid-widget .button-bar, .swl-grid-widget .sb-widget-menu-bar";
// A task's box in a grid's cell
const TASK_BOXES = '.swl-grid-cell .sb-task > input[type="checkbox"]';

/** A cell to write (src/grid/grids.ts' `CellWrite`, named here apart: the host knows no area) */
type CellWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly cell: number; readonly content: string };
/** A grid's cells to change (src/grid/grids.ts' `CellsWrite`) */
type CellsWrite = {
  readonly body: string;
  readonly occurrence: number;
  readonly of: number;
  readonly cells: { readonly kind: "move"; readonly cell: number; readonly by: -1 | 1 } | { readonly kind: "add"; readonly after?: number } | { readonly kind: "takeOut"; readonly cell: number } | { readonly kind: "ungrid" };
};
/** A grid's attributes to write (src/grid/grids.ts' `AttributesWrite`) */
type AttributesWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly attributes: Readonly<Record<string, string | null>> };

export function silverBulletGridHost(bridge: Bridge, writer: PageWriter) {
  return {
    renderMarkdown: async (text: string): Promise<string> => {
      if (!bridge.renderMarkdown) throw new Error("the init page hands over no renderMarkdown");
      // (An embed SilverBullet's HTML draws none of, a PDF, a zip, kept as a place: the page's widget draws it)
      const page = String(await bridge.getCurrentPage());
      const kept = keepUndrawn(text, (embed) => documentUrl(resolvedTarget(embed, page)));
      // (Its tasks the page's own, not a query's: no link to their ref)
      return ownTasks(kept.restore(String(await bridge.renderMarkdown(kept.text))));
    },
    pageText: async (): Promise<string> => String(await bridge.getText()),
    // Through the page writer (the page open: one replaceRange, one undo step)
    writeCell: async (write: CellWrite): Promise<string | undefined> => {
      const page = String(await bridge.getCurrentPage());
      const report = await writer.write(pageChanges().page(page, (p) => p.grids.replaceCell(write.body, write.cell, write.content, { occurrence: write.occurrence, of: write.of })).build());
      return report.skipped[0]?.reason;
    },
    writeAttributes: async (write: AttributesWrite): Promise<string | undefined> => {
      const page = String(await bridge.getCurrentPage());
      const report = await writer.write(pageChanges().page(page, (p) => p.grids.setAttributes(write.body, write.attributes, { occurrence: write.occurrence, of: write.of })).build());
      return report.skipped[0]?.reason;
    },
    changeCells: async (write: CellsWrite): Promise<string | undefined> => {
      const page = String(await bridge.getCurrentPage());
      const report = await writer.write(pageChanges().page(page, (p) => p.grids.changeCells(write.body, write.cells, { occurrence: write.occurrence, of: write.of })).build());
      return report.skipped[0]?.reason;
    },
    moveCursor: (at: number): void => {
      if (bridge.moveCursor) void bridge.moveCursor(at, true);
    },
    problem: (message: string): void => void bridge.flash(message, "error"),
    settle: (element: HTMLElement): void => settleGridFrames(element.ownerDocument),
  };
}

/**
 * SilverBullet's frames round grids settled, those there now and each put in after (once per document):
 *
 * - their button bars hidden: SilverBullet puts its bar in after the grid, and draws a frame anew (CodeMirror's widget
 *   made again, the grid's element moved into it) with a bar of its own, so a frame watched alone was left with one
 *   shown;
 * - a task's box in a cell enabled: SilverBullet disables one it cannot toggle itself as it attaches its handlers to
 *   the widget (2.12.1), the grid toggles it (src/grid/grids.ts).
 *
 * A frame of a grid is SilverBullet's custom syntax's, given the class `swl-grid-widget` by the init page
 */
function settleGridFrames(doc: Document): void {
  if (watched.has(doc)) return;
  watched.add(doc);
  const win = doc.defaultView;
  if (!win) return;
  const settle = (root: ParentNode) => {
    // (Not one in a grid's own content: a cell's markdown may hold a widget of its own)
    for (const bar of root.querySelectorAll<HTMLElement>(GRID_BARS)) {
      if (!bar.closest(".swl-grid") && bar.style.getPropertyValue("display") !== "none") bar.style.setProperty("display", "none", "important");
    }
    for (const box of root.querySelectorAll<HTMLInputElement>(TASK_BOXES)) if (box.disabled) box.disabled = false;
  };
  settle(doc);
  new win.MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        const box = record.target;
        if (box instanceof win.HTMLInputElement && box.disabled && box.matches(TASK_BOXES)) box.disabled = false;
        continue;
      }
      for (const node of record.addedNodes) {
        if (!(node instanceof win.Element)) continue;
        const frame = node.closest(GRID_FRAME);
        settle(frame ?? node);
      }
    }
  }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
}
const watched = new WeakSet<Document>();

/** What Put into grid asks of SilverBullet (src/grid/build.ts' `PutHost`): its selection, its filter box, the page writer */
export function silverBulletPutHost(bridge: Bridge, writer: PageWriter) {
  return {
    selection: async (): Promise<{ readonly from: number; readonly to: number }> => {
      const selection = (await bridge.getSelection?.()) as { from?: unknown; to?: unknown } | undefined;
      const from = Number(selection?.from);
      const to = Number(selection?.to);
      if (Number.isFinite(from) && Number.isFinite(to)) return { from, to };
      const cursor = Number(await bridge.getCursor?.());
      return { from: cursor, to: cursor };
    },
    pageText: async (): Promise<string> => String(await bridge.getText()),
    pick: async (label: string, options: readonly { readonly name: string; readonly description: string }[]): Promise<number | undefined> => {
      if (!bridge.filterBox) return undefined;
      const picked = (await bridge.filterBox(label, options.map((option, index) => ({ ...option, index })))) as { index?: unknown } | undefined;
      return typeof picked?.index === "number" ? picked.index : undefined;
    },
    put: async (from: number, to: number, was: string, mode: "gallery" | "split", columns: number): Promise<string | undefined> => {
      const page = String(await bridge.getCurrentPage());
      const report = await writer.write(pageChanges().page(page, (p) => p.grids.put(from, to, was, mode, columns)).build());
      return report.skipped[0]?.reason;
    },
    problem: (message: string): void => void bridge.flash(message, "error"),
  };
}

