// SilverBullet's page as Silverware Layout lays it out (host/page.ts) and its grids use it (its own text, its editor focused
// again: ./grid.ts): the one place naming its elements and its theme's variable (docs/silverware-layout.md, probes 1
// and 2; docs/silverware-layout-font-size.md):
// - the text and its widgets are in CodeMirror's content (`.cm-content`), its font is the editor's (`#sb-main
//   .cm-editor`, which SilverBullet 2.12.1 sizes in px and its main by `--editor-font-size`);
// - the text's width is the variable `--editor-width` its theme declares on the root, read by the text, the top bar
//   and the notifications alike: set inline on the root, important, it wins over a theme's or a Space Style's
//   `!important` (probe 2);
// - the editor's pane is `#sb-editor`;
// - the page is seen in CodeMirror's scroller (`.cm-scroller`), below SilverBullet's top bar: a stacking context of its
//   own (position relative, z-index 0) the page's lines and widgets are in, so a guide at z-index -1 in it lies under
//   the widgets and over the editor's background (verified in SilverBullet 2.12.1).
// silverware-layout/ui-tests/silverbullet.spec.ts checks each against SilverBullet.
import { cssWidth, type Width } from "../../model/width.ts";
import { textWidthOf } from "../marks.ts";
import type { PageHost } from "../page.ts";

const TEXT_WIDTH = "--editor-width";
const CONTENT_SELECTOR = ".cm-content";
const EDITOR_SELECTOR = "#sb-main .cm-editor";
const PANE_SELECTOR = "#sb-editor";
const SCROLLER_SELECTOR = ".cm-scroller";

/** SilverBullet's page in a document (the playground's imitates it) */
export function silverBulletPage(doc: Document): PageHost {
  return {
    content: () => doc.querySelector<HTMLElement>(CONTENT_SELECTOR) ?? undefined,
    editor: () => doc.querySelector<HTMLElement>(EDITOR_SELECTOR) ?? undefined,
    // (The window where SilverBullet's pane is not there)
    pane: () => doc.querySelector<HTMLElement>(PANE_SELECTOR) ?? doc.documentElement,
    view: () => {
      const height = doc.defaultView?.innerHeight ?? 0;
      const scroller = doc.querySelector(SCROLLER_SELECTOR)?.getBoundingClientRect();
      return scroller ? { top: Math.max(0, scroller.top), bottom: Math.min(height, scroller.bottom) } : { top: 0, bottom: height };
    },
    guideLayer: () => doc.querySelector<HTMLElement>(SCROLLER_SELECTOR) ?? undefined,
    showTextWidth: (width) => showTextWidth(doc, width),
    themeTextWidth: () => themeTextWidth(doc),
    watchAlongText: (found) => watchAlongText(doc, found),
  };
}

// What SilverBullet places by the text's width, centred as the text is (its `--editor-width`): the page's title in its
// top bar (`#sb-top .main .inner`, its left edge the text's: verified 2026-11-22 on its edge build) and the
// notifications (`.sb-notifications`, put in the body as one shows, taken out as the last goes)
const ALONG_TEXT = ["#sb-top .main .inner", ".sb-notifications"];

/** SilverBullet's elements placed by the text, each told as it is there: now, and as one is put in the body later */
function watchAlongText(doc: Document, found: (element: HTMLElement) => void): () => void {
  const look = () => {
    for (const selector of ALONG_TEXT) for (const element of doc.querySelectorAll<HTMLElement>(selector)) found(element);
  };
  look();
  const win = doc.defaultView;
  if (!win?.MutationObserver) return () => undefined;
  // (The body's own children, where the notifications are put, and the top bar, which its client may draw anew or later:
  // not the whole page, which the editor changes as it is typed in; until there is a top bar, the body's whole tree)
  let top: Element | null = null;
  const observer = new win.MutationObserver((records) => {
    if (!records.some((record) => record.addedNodes.length)) return;
    look();
    if (doc.querySelector("#sb-top") !== top) watch();
  });
  const watch = () => {
    observer.disconnect();
    top = doc.querySelector("#sb-top");
    observer.observe(doc.body, { childList: true, subtree: !top });
    if (top?.parentElement && top.parentElement !== doc.body) observer.observe(top.parentElement, { childList: true });
    if (top) observer.observe(top, { childList: true, subtree: true });
  };
  watch();
  return () => observer.disconnect();
}

/** The page's text shown at a width (none: the theme's, nothing of ours left) */
function showTextWidth(doc: Document, width: Width | undefined): void {
  const style = doc.documentElement.style;
  if (width) {
    const value = cssWidth(width);
    if (style.getPropertyValue(TEXT_WIDTH) !== value || style.getPropertyPriority(TEXT_WIDTH) !== "important") style.setProperty(TEXT_WIDTH, value, "important");
  } else if (style.getPropertyValue(TEXT_WIDTH)) style.removeProperty(TEXT_WIDTH);
}

/**
 * The text's width the theme gives (px), Silverware Layout's own set aside a moment: what a page follows where neither
 * it nor the default has a width. Read once, as the dialog opens
 */
function themeTextWidth(doc: Document): number {
  const content = doc.querySelector<HTMLElement>(CONTENT_SELECTOR);
  if (!content) return 0;
  const style = doc.documentElement.style;
  const value = style.getPropertyValue(TEXT_WIDTH);
  const priority = style.getPropertyPriority(TEXT_WIDTH);
  if (value) style.removeProperty(TEXT_WIDTH);
  const width = textWidthOf(content);
  if (value) style.setProperty(TEXT_WIDTH, value, priority);
  return Math.round(width);
}

// SilverBullet's editor a grid is drawn in: CodeMirror's editable area
const PAGE_EDITOR = '[contenteditable="true"]';

// What is not the page's own text in its editor: a widget (a grid, a table), which CodeMirror marks so
const NOT_PAGE_TEXT = '[contenteditable="false"]';

/** Whether a node is in the page's own text: in SilverBullet's editor, not in a widget there (a drag begun there is its selection's) */
export function isPageText(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return !!element?.closest(PAGE_EDITOR) && !element.closest(NOT_PAGE_TEXT);
}

/**
 * The page's editor a cell is in given the focus back as the cell is left, where it does not have it. Unfocused, the
 * next press in a grid focused it, and it took the press's selection for its own: its cursor in the grid's text, the
 * grid shown as its markdown
 */
export function focusPage(cell: HTMLElement): void {
  const page = cell.closest<HTMLElement>(PAGE_EDITOR);
  if (page?.isConnected && cell.ownerDocument.activeElement !== page) page.focus({ preventScroll: true });
}

// A line of SilverBullet's editor, its editable area, the editor round it, and the frame of a grid drawn in a line
const EDITOR_LINE = ".cm-line";
const EDITOR_CONTENT = ".cm-content";
const EDITOR_AROUND = ".cm-editor";
const GRID_IN_LINE = ".swl-grid-widget";

/**
 * Whether a press is beside a grid, not in it: on the line it is drawn in (by a grid narrower than the line, aligned),
 * or in the editor's margin at its height, where SilverBullet's editor would put its cursor into the grid's text and
 * show its markdown (as beside a table)
 */
export function pressBesideGrid(event: MouseEvent): boolean {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || target.closest(".swl-grid")) return false;
  let line = target.closest(EDITOR_LINE);
  // (In the margin: the line at the press's height)
  if (!line && !target.closest(NOT_PAGE_TEXT)) {
    const content = target.closest(EDITOR_AROUND)?.querySelector(EDITOR_CONTENT) ?? (target.matches(EDITOR_CONTENT) ? target : null);
    line = content ? ([...content.children].find((one) => {
      const box = one.getBoundingClientRect();
      return one.matches(EDITOR_LINE) && event.clientY >= box.top && event.clientY <= box.bottom;
    }) ?? null) : null;
  }
  return !!line?.querySelector(GRID_IN_LINE);
}
