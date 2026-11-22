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

/** Whether the pane is marked too narrow for any layout of Silverware Layout's (no widget's handle shown beside it) */
export function isNarrow(doc: Document): boolean {
  return doc.documentElement.hasAttribute(NARROW_ATTRIBUTE);
}

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

/**
 * The editor's text shown at a font size (px; none: the host's, nothing of ours left), its editor marked for the rule;
 * whether it was marked now (an editor made since: the size shown on it from now, what reads its look to read it again)
 */
export function showFontSize(doc: Document, page: PageHost, size: number | undefined): boolean {
  const root = doc.documentElement;
  const editor = page.editor();
  const marked = !!editor && !editor.hasAttribute(EDITOR_ATTRIBUTE);
  if (marked) editor.setAttribute(EDITOR_ATTRIBUTE, "");
  if (size === undefined) {
    if (root.hasAttribute(FONT_SIZE_ATTRIBUTE)) root.removeAttribute(FONT_SIZE_ATTRIBUTE);
    if (root.style.getPropertyValue(FONT_SIZE)) root.style.removeProperty(FONT_SIZE);
    return marked;
  }
  const value = `${size}px`;
  if (root.getAttribute(FONT_SIZE_ATTRIBUTE) !== String(size)) root.setAttribute(FONT_SIZE_ATTRIBUTE, String(size));
  if (root.style.getPropertyValue(FONT_SIZE) !== value) root.style.setProperty(FONT_SIZE, value);
  return marked;
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

/** The editor's font size as it is drawn (px; none without an editor or a size): what its look is read at */
export function editorFontSize(doc: Document, page: PageHost): number | undefined {
  const editor = page.editor();
  const size = editor ? parseFloat(doc.defaultView?.getComputedStyle(editor).fontSize ?? "") : NaN;
  return Number.isFinite(size) ? size : undefined;
}

/**
 * The page's styles watched: told as one is added, taken out or changed (a host loading its styles after its scripts:
 * the font a size of ours sets shown only then); what it gives back stops it
 */
export function watchStyles(doc: Document, changed: () => void): () => void {
  const win = doc.defaultView;
  if (!win?.MutationObserver) return () => {};
  const observer = new win.MutationObserver((records) => {
    if (records.some((record) => [record.target, ...record.addedNodes, ...record.removedNodes].some((node) => node.nodeName === "STYLE" || node.nodeName === "LINK" || node.parentNode?.nodeName === "STYLE"))) changed();
  });
  observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

const TEXT_ALIGN_ATTRIBUTE = "data-swl-text-align";
const TEXT_MOVING_ATTRIBUTE = "data-swl-text-moving";
const ALONG_TEXT_ATTRIBUTE = "data-swl-along-text";
const TEXT_MARGIN = "--swl-text-margin";
const TEXT_SHIFT = "--swl-text-shift";
const TEXT_START = "--swl-text-start";
// How long the text is marked moving after its alignment changed (the style page's transition, a little longer)
const MOVING_MS = 320;
// Per document: the alignment placed last, the end of its move, and the box the text is centred in watched (a scrollbar
// coming or going there changes its room, not the pane's)
type Placed = { align: "left" | "center" | undefined; timer?: ReturnType<typeof setTimeout>; watched?: Element; observer?: ResizeObserver };
const placed = new WeakMap<Document, Placed>();

/** An element the host places by the text, as it is (its title over the page, its notifications): moved with it */
export function markAlongText(element: Element): void {
  if (!element.hasAttribute(ALONG_TEXT_ATTRIBUTE)) element.setAttribute(ALONG_TEXT_ATTRIBUTE, "");
}

/**
 * The page's text placed at the pane's left or centred (none: the host's own place, nothing of ours left;
 * docs/silverware-layout-text-align.md): its left margin a length the style page gives the content, so it moves from
 * one to the other (the root marked moving a moment as the alignment changes, never as the pane is resized); how far
 * the host's elements placed by the text move with it (`--swl-text-shift`, from where the host centres them), and where
 * its lines start in the pane (`--swl-text-start`: the widgets wider than the text grow from there)
 */
export function showTextAlign(doc: Document, page: PageHost, align: "left" | "center" | undefined): void {
  const root = doc.documentElement;
  const content = page.content();
  const was: Placed = placed.get(doc) ?? { align: undefined };
  placed.set(doc, was);
  if (!align || !content?.parentElement) {
    if (root.hasAttribute(TEXT_ALIGN_ATTRIBUTE)) root.removeAttribute(TEXT_ALIGN_ATTRIBUTE);
    for (const name of [TEXT_MARGIN, TEXT_SHIFT, TEXT_START]) if (root.style.getPropertyValue(name)) root.style.removeProperty(name);
    was.align = undefined;
    return;
  }
  const win = doc.defaultView;
  const style = win?.getComputedStyle(content);
  const parent = content.parentElement;
  // (Placed again as the box it is centred in changes its width: the alignment as it is, not moved)
  if (was.watched !== parent && win?.ResizeObserver) {
    was.observer?.disconnect();
    was.watched = parent;
    let first = true;
    was.observer = new win.ResizeObserver(() => {
      // (Told once as it starts watching: placed already)
      if (first) return void (first = false);
      if (was.align) showTextAlign(doc, page, was.align);
    });
    was.observer.observe(parent);
  }
  const box = content.getBoundingClientRect();
  const around = parent.getBoundingClientRect();
  const margin = parseFloat(style?.marginLeft ?? "") || 0;
  // What stands before the content in its box (a host's gutters), and the room it is centred in
  const before = box.left - margin - around.left - parent.clientLeft;
  const centred = Math.max(0, (parent.clientWidth - before - content.offsetWidth) / 2);
  const shown = align === "left" ? 0 : centred;
  // (From the pane's content box, its padding left out, as its width is given: `paneWidth`)
  const pane = page.pane();
  const paneLeft = pane.getBoundingClientRect().left + (parseFloat(win?.getComputedStyle(pane).paddingLeft ?? "") || 0);
  const start = around.left + parent.clientLeft + before + shown + (parseFloat(style?.paddingLeft ?? "") || 0) - paneLeft;
  const px = (n: number) => `${Math.round(n * 100) / 100}px`;
  const set = (name: string, value: string) => root.style.getPropertyValue(name) !== value && root.style.setProperty(name, value);
  set(TEXT_MARGIN, px(shown));
  set(TEXT_SHIFT, px(shown - centred));
  set(TEXT_START, px(start));
  // (Moved where it stood placed by us before, at the other side: not as it is first placed, nor as the pane is resized)
  if (was.align !== undefined && was.align !== align && win) {
    root.setAttribute(TEXT_MOVING_ATTRIBUTE, "");
    clearTimeout(was.timer);
    was.timer = setTimeout(() => root.removeAttribute(TEXT_MOVING_ATTRIBUTE), MOVING_MS);
  }
  was.align = align;
  if (root.getAttribute(TEXT_ALIGN_ATTRIBUTE) !== align) root.setAttribute(TEXT_ALIGN_ATTRIBUTE, align);
}

/**
 * Where the text starts where it stands at the pane's left (as `showTextAlign` placed it, not where a move has it a
 * moment): x in the window and px from the pane's left edge (its padding left out); none where it is not at the left
 */
export function textAtLeft(doc: Document, page: PageHost): { readonly x: number; readonly start: number } | undefined {
  const root = doc.documentElement;
  if (root.getAttribute(TEXT_ALIGN_ATTRIBUTE) !== "left") return undefined;
  const start = parseFloat(root.style.getPropertyValue(TEXT_START));
  if (!Number.isFinite(start)) return undefined;
  const pane = page.pane();
  const padding = parseFloat(doc.defaultView?.getComputedStyle(pane).paddingLeft ?? "") || 0;
  return { x: pane.getBoundingClientRect().left + padding + start, start };
}

/** Whether a node is in the editor (its text, its widgets): where Ctrl + scroll zooms its font */
export const inEditor = (page: PageHost, node: unknown): boolean => node instanceof Node && !!page.editor()?.contains(node);
