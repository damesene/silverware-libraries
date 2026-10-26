// Everything Silverware Toolbar assumes about SilverBullet's DOM lives here, so
// a SilverBullet update that changes it has one place to fix.

// CodeMirror's editable area of a page
export const CONTENT_SELECTOR = ".cm-content";

// What is not the page's text: a dialog (SilverBullet's are `<dialog
// class="sb-modal-box">`, client/components/basic_modals.tsx; their fields and
// the page name in the top bar are plain inputs, 2026-10-26; mini editors of
// older versions were CodeMirror), and widgets inside the page (a table, a
// query's result: CodeMirror marks them contenteditable=false)
const NOT_THE_PAGE = "dialog, .sb-modal-box, .sb-mini-editor, [contenteditable='false']";

/** The page's editable area a node is in, if it is the page's text (not a widget's, not another editor's) */
export function pageContentOf(node: Node | null): HTMLElement | undefined {
  const element = node instanceof Element ? node : node?.parentElement;
  const content = element?.closest<HTMLElement>(CONTENT_SELECTOR);
  if (!element || !content || element.closest(NOT_THE_PAGE)) return undefined;
  return content;
}

// CodeMirror's scroller: the page's view, below SilverBullet's top bar
const SCROLLER_SELECTOR = ".cm-scroller";

/** The top of the page's view around a node (the toolbar goes below it there), else the window's */
export function viewTopOf(node: Node | null): number {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest(SCROLLER_SELECTOR)?.getBoundingClientRect().top ?? 0;
}
