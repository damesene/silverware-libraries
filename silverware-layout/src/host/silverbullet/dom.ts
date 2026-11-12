// What Silverware Layout assumes of SilverBullet's page, in one place (docs/silverware-layout.md, probes 1 and 2):
// - the text's width is the variable `--editor-width` its theme declares on the root, read by the text, the top bar
//   and the notifications alike: set inline on the root, important, it wins over a theme's or a Space Style's
//   `!important` (probe 2);
// - the editor's pane is `#sb-editor` (a size container since 2.11, which CSS measures as `100cqw`).
import { cssWidth, type Width } from "../../model/width.ts";

const TEXT_WIDTH = "--editor-width";
const PANE_SELECTOR = "#sb-editor";

/** The page's text shown at a width (none: the theme's, nothing of ours left) */
export function showTextWidth(doc: Document, width: Width | undefined): void {
  const style = doc.documentElement.style;
  if (width) {
    const value = cssWidth(width);
    if (style.getPropertyValue(TEXT_WIDTH) !== value || style.getPropertyPriority(TEXT_WIDTH) !== "important") style.setProperty(TEXT_WIDTH, value, "important");
  } else if (style.getPropertyValue(TEXT_WIDTH)) style.removeProperty(TEXT_WIDTH);
}

/** The text width shown now by Silverware Layout (an inline value on the root), as CSS has it; empty: none */
export const textWidthNow = (doc: Document): string => doc.documentElement.style.getPropertyValue(TEXT_WIDTH);

/** The editor's pane, or the window where it is not there */
const paneOf = (doc: Document): Element => doc.querySelector(PANE_SELECTOR) ?? doc.documentElement;

/** The editor's pane's width now (px) */
export const paneWidth = (doc: Document): number => paneOf(doc).getBoundingClientRect().width;

/**
 * Told as the editor's pane changes its width (the window, a side panel): its width now. Watches the pane SilverBullet
 * has when called (made once, as the page loads); the function given back stops it
 */
export function watchPaneWidth(doc: Document, changed: (width: number) => void): () => void {
  const win = doc.defaultView;
  if (!win?.ResizeObserver) return () => undefined;
  const observer = new win.ResizeObserver(() => changed(paneWidth(doc)));
  observer.observe(paneOf(doc));
  return () => observer.disconnect();
}
