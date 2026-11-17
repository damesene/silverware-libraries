// What Silverware Layout's grids allow for of how SilverBullet behaves (not of its page's elements: dom.ts), each the
// answer of a `GridHost` hook (src/grid/grids.ts) the grids ask and another host answers its own way or not at all.
// Found by probes against 2.12.1 and main (2026-11-14); each held by a UI test (ui-tests/grid.spec.ts,
// grid-touch.spec.ts) that fails by name where a new SilverBullet behaves otherwise.
import type { EditorHost } from "../../../../shared/editor.ts";
import { type Grid, readGridBody, readGrids } from "../../../../shared/markdown/grid.ts";

// How often and how long apart the page's text is read again as a grid is drawn, where it has none of its body nor
// one like it (the page opening: its text not read yet)
const TEXT_TRIES = 5;
const TEXT_RETRY_MS = 50;
// How long a press is waited for to end (its click), at most: a focus gone by none (another window) goes on after it
const PRESS_MS = 600;

/**
 * The page's text as the grid of a body SilverBullet draws is in it. It draws a grid anew as the text changes (a task
 * toggled in a cell, a cell written) before its editor's text is the new one, which still has the grid as it was: that
 * one (the one most like it) given the body drawn. As a page opens, its text not read yet: read again a few times a
 * moment apart. (Drawn from the text before, the grid had none of its attributes, its width, and was drawn narrower
 * for a moment; drawn later, nothing stood in its place meanwhile: SilverBullet takes the grid before out first)
 */
export async function textForDrawing(pageText: () => Promise<string>, body: string): Promise<string> {
  let text = "";
  for (let attempt = 0; attempt <= TEXT_TRIES; attempt++) {
    if (attempt) await new Promise((resolve) => setTimeout(resolve, TEXT_RETRY_MS));
    text = await pageText().catch(() => "");
    if (readGrids(text).some((grid) => same(grid.body) === same(body))) return text;
    const like: Grid | undefined = gridLike(text, body);
    if (like) return text.slice(0, like.bodyFrom) + body + text.slice(like.bodyTo);
    // (A text with grids, none like it: as it is, the grid's place found as it is drawn and read again)
    if (readGrids(text).length && attempt >= 1) return text;
  }
  return text;
}

/** A body as compared: its line breaks LF, no line break at its end (as the grids compare them) */
const same = (body: string) => body.replace(/\r\n/g, "\n").replace(/\n+$/, "");

/**
 * The grid of a text most like a body not in it: of those of as many cells, the one sharing the most of its start and
 * end with it (a cell's text changed: the rest the same); none where none shares more than half of it
 */
export function gridLike(text: string, body: string): Grid | undefined {
  const wanted = same(body);
  const cells = readGridBody(body).length;
  let best: { readonly grid: Grid; readonly shared: number } | undefined;
  for (const grid of readGrids(text)) {
    const other = same(grid.body);
    if (readGridBody(grid.body).length !== cells) continue;
    let start = 0;
    while (start < wanted.length && start < other.length && wanted[start] === other[start]) start++;
    let end = 0;
    while (end < wanted.length - start && end < other.length - start && wanted[wanted.length - 1 - end] === other[other.length - 1 - end]) end++;
    const shared = start + end;
    if (shared * 2 > wanted.length && (!best || shared > best.shared)) best = { grid, shared };
  }
  return best?.grid;
}

/**
 * When a cell left by a press may be written: once the press is over (its click, or `PRESS_MS` at most), a frame and a
 * task later. SilverBullet sets its editor's selection again as it draws a grid anew after its text changed: on a
 * phone, a tap's caret not read by its editor yet, the one before the tap (the cursor went back where it was)
 */
export function afterPress(doc: Document): Promise<void> {
  const win = doc.defaultView;
  if (!win) return Promise.resolve();
  return new Promise((resolve) => {
    let ran = false;
    const go = () => {
      if (ran) return;
      ran = true;
      win.removeEventListener("click", go, true);
      clearTimeout(timer);
      win.requestAnimationFrame(() => setTimeout(resolve, 0));
    };
    const timer = setTimeout(go, PRESS_MS);
    win.addEventListener("click", go, true);
  });
}

/** How SilverBullet's page behaves for an editor of a cell (shared/editor.ts): it takes Ctrl+Z (Ctrl+Y) at the window and holds them back (2.12.1) */
export const SILVERBULLET_EDITORS: EditorHost = { historyAtWindow: true };

/**
 * What SilverBullet does on a tap with two fingers (`client/editor_ui.tsx`, a `touchstart` of two touches at the window,
 * 2.12.1 and main 2026-11-15: `startPageNavigate("page")`), as the command doing the same (`client/editor_commands.ts`):
 * run where Silverware Layout takes two fingers for its pinch (the setting `fontZoom.pinch`) and they tapped
 */
export const TWO_FINGER_TAP_COMMAND = "Navigate: Page Picker";

/**
 * Whether an Alt+press in the field of a cell edited is handed to the field by the grids as it comes: where
 * SilverBullet takes an Alt+press anywhere in a widget at the widget's element (its capture, `widget_util.ts`), before
 * what is in it, and puts its cursor at the widget's start (the grid's markdown shown, the cell left): after 2.12.1, as
 * the init page tells (`widgetTakesAltPress`). 2.12.1 does not, and the field takes its own (an Alt+drag selecting).
 * SB-2.12-COMPAT: told for 2.12.1; once it is dropped, always.
 */
export function handsAltPressToField(widgetTakesAltPress: unknown): boolean {
  return widgetTakesAltPress === true;
}
