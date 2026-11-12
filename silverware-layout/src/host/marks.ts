// Silverware Layout's own marks on the page, which its style page reads (no rule of it names a host's element): the
// content its widgets are in, the editor whose font it sizes, the pane's width, a pane too narrow to lay out. Any
// host's page: what is the host's alone is asked of its PageHost (host/page.ts).
import type { PageHost } from "./page.ts";

const NARROW_ATTRIBUTE = "data-swl-narrow";
const CONTENT_ATTRIBUTE = "data-swl-content";
const EDITOR_ATTRIBUTE = "data-swl-editor";
const FONT_SIZE_ATTRIBUTE = "data-swl-font-size";
const FONT_SIZE = "--swl-font-size";
const PANE_WIDTH = "--swl-pane-width";

/** Whether the pane is too narrow for any layout of Silverware Layout's (the style page's rule for widgets reads it) */
export function markNarrow(doc: Document, narrow: boolean): void {
  if (doc.documentElement.hasAttribute(NARROW_ATTRIBUTE) !== narrow) doc.documentElement.toggleAttribute(NARROW_ATTRIBUTE, narrow);
}

/** The element the widgets are in marked: the style page lays out the widgets in it alone */
export function markContent(content: Element): void {
  if (!content.hasAttribute(CONTENT_ATTRIBUTE)) content.setAttribute(CONTENT_ATTRIBUTE, "");
}

/** The pane's width now (px): its content box, its padding left out */
export function paneWidth(page: PageHost): number {
  const pane = page.pane();
  const style = pane.ownerDocument.defaultView?.getComputedStyle(pane);
  const padding = style ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) : 0;
  return pane.getBoundingClientRect().width - padding;
}

/** The width of an element's text (px): its width less its padding (the content a widget follows, the host's text) */
export function textWidthOf(content: HTMLElement): number {
  const style = content.ownerDocument.defaultView?.getComputedStyle(content);
  return content.clientWidth - (style ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0) : 0);
}

/** The pane's width given to the style page (a widget is at most as wide, less its gutter) */
export function showPaneWidth(doc: Document, width: number): void {
  const value = `${Math.round(width * 100) / 100}px`;
  if (doc.documentElement.style.getPropertyValue(PANE_WIDTH) !== value) doc.documentElement.style.setProperty(PANE_WIDTH, value);
}

/**
 * Told as the pane changes its width (the window, a side panel): its width now. Watches the pane the host has when
 * called (made once, as the page loads); the function given back stops it
 */
export function watchPaneWidth(page: PageHost, changed: (width: number) => void): () => void {
  const win = page.pane().ownerDocument.defaultView;
  if (!win?.ResizeObserver) return () => undefined;
  const observer = new win.ResizeObserver(() => changed(paneWidth(page)));
  observer.observe(page.pane());
  return () => observer.disconnect();
}

/** The editor's text shown at a font size (px; none: the host's, nothing of ours left), its editor marked for the rule */
export function showFontSize(doc: Document, page: PageHost, size: number | undefined): void {
  const root = doc.documentElement;
  const editor = page.editor();
  if (editor && !editor.hasAttribute(EDITOR_ATTRIBUTE)) editor.setAttribute(EDITOR_ATTRIBUTE, "");
  if (size === undefined) {
    if (root.hasAttribute(FONT_SIZE_ATTRIBUTE)) root.removeAttribute(FONT_SIZE_ATTRIBUTE);
    if (root.style.getPropertyValue(FONT_SIZE)) root.style.removeProperty(FONT_SIZE);
    return;
  }
  const value = `${size}px`;
  if (root.getAttribute(FONT_SIZE_ATTRIBUTE) !== String(size)) root.setAttribute(FONT_SIZE_ATTRIBUTE, String(size));
  if (root.style.getPropertyValue(FONT_SIZE) !== value) root.style.setProperty(FONT_SIZE, value);
}

/** The font size the host gives its editor (px), Silverware Layout's own set aside a moment; none without an editor */
export function themeFontSize(doc: Document, page: PageHost): number | undefined {
  const editor = page.editor();
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
export const inEditor = (page: PageHost, node: unknown): boolean => node instanceof Node && !!page.editor()?.contains(node);
