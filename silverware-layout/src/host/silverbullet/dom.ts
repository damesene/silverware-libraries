// What Silverware Layout assumes of SilverBullet's page, in one place (docs/silverware-layout.md, probes 1 and 2):
// - the text's width is the variable `--editor-width` its theme declares on the root, read by the text, the top bar
//   and the notifications alike: set inline on the root, important, it wins over a theme's or a Space Style's
//   `!important` (probe 2);
// - the editor's pane is `#sb-editor` (a size container since 2.11, which CSS measures as `100cqw`);
// - the page is seen in CodeMirror's scroller (`.cm-scroller`), below SilverBullet's top bar.
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

/** Whether the pane is too narrow for any layout of Silverware Layout's (the style page's rule for widgets reads it) */
export function markNarrow(doc: Document, narrow: boolean): void {
  doc.documentElement.toggleAttribute("data-swl-narrow", narrow);
}

/**
 * The text's width the theme gives (px), Silverware Layout's own set aside a moment: what a page follows where neither
 * it nor the default has a width. Read once, as the dialog opens
 */
export function themeTextWidth(doc: Document): number {
  const content = doc.querySelector<HTMLElement>(".cm-content");
  const win = doc.defaultView;
  if (!content || !win) return 0;
  const style = doc.documentElement.style;
  const value = style.getPropertyValue(TEXT_WIDTH);
  const priority = style.getPropertyPriority(TEXT_WIDTH);
  if (value) style.removeProperty(TEXT_WIDTH);
  const padding = win.getComputedStyle(content);
  const width = content.clientWidth - parseFloat(padding.paddingLeft || "0") - parseFloat(padding.paddingRight || "0");
  if (value) style.setProperty(TEXT_WIDTH, value, priority);
  return Math.round(width);
}

/** The text width shown now by Silverware Layout (an inline value on the root), as CSS has it; empty: none */
export const textWidthNow = (doc: Document): string => doc.documentElement.style.getPropertyValue(TEXT_WIDTH);

/**
 * The part of the window the page is seen in: CodeMirror's scroller (below SilverBullet's top bar), cut to the window;
 * the window where there is none (the playground)
 */
export function pageView(doc: Document): { readonly top: number; readonly bottom: number } {
  const height = doc.defaultView?.innerHeight ?? 0;
  const scroller = doc.querySelector(".cm-scroller")?.getBoundingClientRect();
  return scroller ? { top: Math.max(0, scroller.top), bottom: Math.min(height, scroller.bottom) } : { top: 0, bottom: height };
}

/**
 * Where a widget's guides go while it is dragged: CodeMirror's scroller, a stacking context of its own (position
 * relative, z-index 0) the page's lines and widgets are in, so a guide at z-index -1 lies under the widgets and over
 * the editor's background (verified in SilverBullet 2.12.1)
 */
export const guideLayer = (doc: Document): HTMLElement | undefined => doc.querySelector<HTMLElement>(".cm-scroller") ?? undefined;

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

// The editor's font size: SilverBullet 2.12.1 sizes `#sb-main .cm-editor` in px, its main by `--editor-font-size`; the
// style page's rule wins over either where the root has the attribute (docs/silverware-layout-font-size.md, probe)
const FONT_SIZE_ATTRIBUTE = "data-swl-font-size";
const FONT_SIZE = "--swl-font-size";
const EDITOR_SELECTOR = "#sb-main .cm-editor";

/** The editor's text shown at a font size (px; none: the theme's, nothing of ours left) */
export function showFontSize(doc: Document, size: number | undefined): void {
  const root = doc.documentElement;
  if (size === undefined) {
    if (root.hasAttribute(FONT_SIZE_ATTRIBUTE)) root.removeAttribute(FONT_SIZE_ATTRIBUTE);
    if (root.style.getPropertyValue(FONT_SIZE)) root.style.removeProperty(FONT_SIZE);
    return;
  }
  const value = `${size}px`;
  if (root.getAttribute(FONT_SIZE_ATTRIBUTE) !== String(size)) root.setAttribute(FONT_SIZE_ATTRIBUTE, String(size));
  if (root.style.getPropertyValue(FONT_SIZE) !== value) root.style.setProperty(FONT_SIZE, value);
}

/** The font size the theme gives the editor (px), Silverware Layout's own set aside a moment; none without an editor */
export function themeFontSize(doc: Document): number | undefined {
  const editor = doc.querySelector(EDITOR_SELECTOR);
  const win = doc.defaultView;
  if (!editor || !win) return undefined;
  const root = doc.documentElement;
  const shown = root.getAttribute(FONT_SIZE_ATTRIBUTE);
  if (shown !== null) root.removeAttribute(FONT_SIZE_ATTRIBUTE);
  const size = parseFloat(win.getComputedStyle(editor).fontSize);
  if (shown !== null) root.setAttribute(FONT_SIZE_ATTRIBUTE, shown);
  return Number.isFinite(size) ? Math.round(size) : undefined;
}

/** Whether a node is in the editor (its text, its widgets): where Ctrl + scroll zooms its font */
export const inEditor = (node: unknown): boolean => node instanceof Element && !!node.closest(EDITOR_SELECTOR);
