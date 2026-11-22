// A panel a plugin shows at the window's right, lying over the page (Silverware Assets' file panel, Silverware Database's
// peek): its element carries one attribute every plugin knows (beside `data-silverware-over-window`, shared/overwindow.ts),
// so another plugin can tell one is open without knowing whose (Silverware Layout's text at the left while one is:
// docs/silverware-layout-text-align.md). Several may be open at once; the page is not narrowed by any.
import { marked, watchMark } from "./watchmark.ts";

/** The attribute on a side panel's element */
export const SIDE_PANEL_ATTRIBUTE = "data-silverware-side-panel";

/** An element marked as a side panel, or not */
export function markSidePanel(element: Element, on: boolean): void {
  element.toggleAttribute(SIDE_PANEL_ATTRIBUTE, on);
}

/** Whether a side panel is open in a document */
export function sidePanelOpen(doc: Document): boolean {
  return marked(doc, SIDE_PANEL_ATTRIBUTE);
}

/** Told as the first side panel opens (at once) and as the last closes (a moment later: one drawn anew is not closed) */
export function watchSidePanel(doc: Document, changed: (open: boolean) => void): () => void {
  return watchMark(doc, SIDE_PANEL_ATTRIBUTE, changed);
}
