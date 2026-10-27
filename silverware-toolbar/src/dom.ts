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

// SilverBullet's bar over the on-screen keyboard on a phone (client/components/keyboard_bar.tsx, its main
// since 2026-10, no release yet: shown while its UI option keyboardBar is on and the editor focused)
const KEYBOARD_BAR_SELECTOR = ".sb-keyboard-bar";

/** The top of SilverBullet's keyboard bar where it shows (the docked toolbar goes over it), else undefined */
export function keyboardBarTop(doc: Document): number | undefined {
  const bar = doc.querySelector<HTMLElement>(KEYBOARD_BAR_SELECTOR);
  const rect = bar?.getBoundingClientRect();
  return rect && rect.height > 0 ? rect.top : undefined;
}

/**
 * The bottom of what SilverBullet shows above the on-screen keyboard, where it
 * pins its UI there (a phone: `html.sb-viewport-tracked`, `#sb-root` fixed to
 * the part in view, sized by `--sb-viewport-top` / `--sb-viewport-height` on
 * `html`; client/lib/keyboard_viewport.ts of its main), else undefined: what it
 * measures of the keyboard, which the VirtualKeyboard API's rectangle did not
 * match on a phone (the toolbar too high in Chrome, off the screen in the app)
 */
export function pinnedViewBottom(doc: Document): number | undefined {
  if (!doc.documentElement.classList.contains("sb-viewport-tracked")) return undefined;
  const rect = doc.getElementById("sb-root")?.getBoundingClientRect();
  return rect && rect.height > 0 ? rect.bottom : undefined;
}

// SilverBullet's editor, between its sidebars (client/components: its main's `#sb-editor`): a docked toolbar
// stays within it, not over the sidebars
const EDITOR_SELECTOR = "#sb-editor";

/** Where SilverBullet's editor is on screen, if it shows (else undefined: the window is the toolbar's) */
export function editorBox(doc: Document): DOMRect | undefined {
  const rect = doc.querySelector(EDITOR_SELECTOR)?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : undefined;
}

/** The top of the page's view around a node (the toolbar goes below it there), else the window's */
export function viewTopOf(node: Node | null): number {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest(SCROLLER_SELECTOR)?.getBoundingClientRect().top ?? 0;
}
