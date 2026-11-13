// What a grid asks of SilverBullet (src/grid/grids.ts, `GridHost`): a cell's markdown rendered as SilverBullet renders
// a page (`markdown.markdownToHtml`, handed over by the init page: on 2.12.1 there is no `renderToDom`), the page's
// text, and the button bar (Reload, Copy, Edit) of the frame SilverBullet draws a custom syntax's widget in hidden, as
// Silverware Chart and Database leave theirs out. Set inline and important: on a touch screen SilverBullet shows it by
// a rule naming `#sb-main`, also important, whose specificity no rule of a style page naming no SilverBullet element
// outweighs. (The frame's border is the style page's, by the class the init page gives the frame: SilverBullet sets it
// unimportant. An inline border set here did not hold in 2.12.1, 2026-11-13: the frame's style is SilverBullet's.)
import { pageChanges } from "../../../../shared/pages/changes.ts";
import type { PageWriter } from "../../../../shared/pages/writer.ts";
import type { Bridge } from "../../bridge.ts";
import { resolvedTarget } from "./assets.ts";
import { documentUrl } from "./platform.ts";
import { keepUndrawn } from "./undrawn.ts";

// SilverBullet's frame of a widget, and its button bar in it (2.12.1: .button-bar; its main: .sb-widget-menu-bar)
const FRAME = ".sb-lua-directive-block";
const BARS = ":scope > .button-bar, :scope > .sb-widget-menu-bar";
// How many frames a grid drawn is waited for to be in the page
const SETTLE_FRAMES = 60;

/** A cell to write (src/grid/grids.ts' `CellWrite`, named here apart: the host knows no area) */
type CellWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly cell: number; readonly content: string };
/** A grid's attributes to write (src/grid/grids.ts' `AttributesWrite`) */
type AttributesWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly attributes: Readonly<Record<string, string | null>> };

export function silverBulletGridHost(bridge: Bridge, writer: PageWriter) {
  return {
    renderMarkdown: async (text: string): Promise<string> => {
      if (!bridge.renderMarkdown) throw new Error("the init page hands over no renderMarkdown");
      // (An embed SilverBullet's HTML draws none of, a PDF, a zip, kept as a place: the page's widget draws it)
      const page = String(await bridge.getCurrentPage());
      const kept = keepUndrawn(text, (embed) => documentUrl(resolvedTarget(embed, page)));
      return kept.restore(String(await bridge.renderMarkdown(kept.text)));
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
    moveCursor: (at: number): void => {
      if (bridge.moveCursor) void bridge.moveCursor(at, true);
    },
    problem: (message: string): void => void bridge.flash(message, "error"),
    settle: (element: HTMLElement): void => whenInPage(element, () => bare(element)),
  };
}

/** `then` once the element is in the page (SilverBullet puts a widget's content into its frame after the renderer returns) */
function whenInPage(element: HTMLElement, then: () => void, frames = SETTLE_FRAMES): void {
  if (element.isConnected) return then();
  if (frames <= 0) return;
  const win = element.ownerDocument.defaultView;
  if (!win) return;
  win.requestAnimationFrame(() => whenInPage(element, then, frames - 1));
}

/** SilverBullet's frame round a grid: its bar of buttons hidden */
function bare(element: HTMLElement): void {
  const frame = element.closest<HTMLElement>(FRAME);
  if (!frame) return;
  for (const bar of frame.querySelectorAll<HTMLElement>(BARS)) bar.style.setProperty("display", "none", "important");
}

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

