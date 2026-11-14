// SilverBullet's cursor kept out of a grid's text, as the arrows move it there (src/host/silverbullet/behaviour.ts'
// kin, the elements of dom.ts): in a grid's text, SilverBullet shows the grid as its markdown, which looks nothing like
// it drawn. An arrow that would take the cursor onto a grid's line (down or right from the line before it, up or left
// from the line after it) takes it over the grid: to the line after it, or the end of the line before it. Clicks keep
// out by the grid's own focus (src/grid/ui/view.ts); the markdown shown on purpose by Alt+click or the menu.
import { readGrids } from "../../../../shared/markdown/grid.ts";
import type { Bridge } from "../../bridge.ts";

// A line of SilverBullet's editor (CodeMirror's), and the frame of a grid drawn in one (its custom syntax's, the class
// the init page gives it)
const LINE = ".cm-line";
const GRID_FRAME = ".swl-grid-widget";
// What is not the page's own text: a widget (CodeMirror marks it so)
const WIDGET = '[contenteditable="false"]';
// The editor's completion shown (its list takes the arrows)
const COMPLETION = ".cm-tooltip-autocomplete";

const watched = new WeakSet<Document>();

type CursorBridge = Pick<Bridge, "getText" | "getCursor" | "moveCursor">;

/** SilverBullet's cursor kept out of the grids' text as the arrows move it (once per document; the bridge as handed over last) */
export function keepCursorOutOfGrids(doc: Document, bridgeNow: () => CursorBridge): void {
  if (watched.has(doc)) return;
  watched.add(doc);
  doc.addEventListener(
    "keydown",
    (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
      if (!forward && event.key !== "ArrowUp" && event.key !== "ArrowLeft") return;
      const bridge = bridgeNow();
      if (!bridge.moveCursor || !bridge.getCursor) return;
      // (A completion's list open: the arrows its own)
      if (doc.querySelector(COMPLETION)) return;
      const line = caretLine(doc);
      if (!line) return;
      // (Up and down only from the line's row next to the grid: a line wrapped has rows of its own between)
      if (event.key === "ArrowDown" && !onEdgeRow(doc, line, "last")) return;
      if (event.key === "ArrowUp" && !onEdgeRow(doc, line, "first")) return;
      // (Left and right only from the line's edge next to the grid)
      if (event.key === "ArrowRight" && !atEdge(doc, line, "end")) return;
      if (event.key === "ArrowLeft" && !atEdge(doc, line, "start")) return;
      const next = forward ? line.nextElementSibling : line.previousElementSibling;
      if (!next?.querySelector(GRID_FRAME)) return;
      event.preventDefault();
      event.stopPropagation();
      void over(bridge, forward).catch((error: unknown) => console.error("Silverware Layout: the cursor could not be moved over the grid", error));
    },
    true,
  );
}

/** The line of SilverBullet's editor the caret is in, in the page's own text (none: elsewhere) */
function caretLine(doc: Document): Element | undefined {
  const node = doc.getSelection()?.focusNode;
  const element = node instanceof Element ? node : node?.parentElement;
  const line = element?.closest(LINE);
  return line && !line.closest(WIDGET) ? line : undefined;
}

/** Whether the caret is on a line's first or last row (a line wrapped into several); where its place is not told, taken as it */
function onEdgeRow(doc: Document, line: Element, row: "first" | "last"): boolean {
  const selection = doc.getSelection();
  if (!selection?.rangeCount) return true;
  const caret = selection.getRangeAt(0).getClientRects()[0] ?? selection.getRangeAt(0).getBoundingClientRect();
  const box = line.getBoundingClientRect();
  if (!caret || caret.height === 0) return true;
  return row === "first" ? caret.top - box.top < caret.height / 2 : box.bottom - caret.bottom < caret.height / 2;
}

/** Whether the caret is at a line's start or end (nothing of its text before it, or after it) */
function atEdge(doc: Document, line: Element, edge: "start" | "end"): boolean {
  const selection = doc.getSelection();
  if (!selection?.focusNode || !selection.isCollapsed) return false;
  const range = doc.createRange();
  range.selectNodeContents(line);
  if (edge === "start") range.setEnd(selection.focusNode, selection.focusOffset);
  else range.setStart(selection.focusNode, selection.focusOffset);
  return range.toString().length === 0;
}

/** The cursor moved over the grid after it (to the line after it) or before it (to the end of the line before it); none there: where it is */
async function over(bridge: CursorBridge, forward: boolean): Promise<void> {
  const text = String(await bridge.getText());
  const cursor = Number(await bridge.getCursor?.());
  if (!Number.isFinite(cursor)) return;
  const grids = readGrids(text);
  if (forward) {
    const grid = grids.find((one) => one.from >= cursor);
    if (!grid) return;
    const after = text.startsWith("\r\n", grid.to) ? grid.to + 2 : text.startsWith("\n", grid.to) ? grid.to + 1 : undefined;
    if (after !== undefined) await bridge.moveCursor?.(after);
    return;
  }
  const grid = [...grids].reverse().find((one) => one.to <= cursor);
  if (!grid || grid.from === 0) return;
  const before = text[grid.from - 2] === "\r" ? grid.from - 2 : grid.from - 1;
  await bridge.moveCursor?.(before);
}
