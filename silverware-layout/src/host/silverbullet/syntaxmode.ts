// SilverBullet's "Editor: Toggle Markdown Syntax Rendering": the page's markdown shown as written. SilverBullet keeps
// drawing an embed's widget and a custom syntax's in that mode (2.12.1, `client/codemirror/clean.ts`,
// `pluginsNeededEvenWhenRenderingSyntax`: an embed's medium over its line, a grid under its lines), which the user
// does not want there: Silverware Layout marks the root `data-swl-syntax-shown` while it is on, and its style page
// hides what it draws or decorates (media, grids). The mode is SilverBullet's UI option, read by the bridge; asked as
// SilverBullet draws widgets anew (switching the mode rebuilds the editor), once a burst of them is still.
//
// In that mode a plain click in the text puts the cursor there and follows nothing (the user's wish: the markdown is
// edited there): SilverBullet follows a link, a hashtag, any `page:click` on its `click` in the editor (2.12.1,
// `client/codemirror/editor_state.ts`), on all of a wiki link's text, `![[` too, which left no way to put the cursor
// before an embed. Its click is held back as it comes (the cursor is placed by the press before it, CodeMirror's);
// Ctrl or Cmd held, it follows as before; a click in a widget (a query's buttons) is the widget's.
const MARK = "data-swl-syntax-shown";
// SilverBullet's widgets of an embed or a custom syntax, drawn anew as the mode changes
const WIDGETS = ".sb-inline-content, .sb-lua-directive-block";
// The editor's text, and what in it is no text of the page (a widget)
const TEXT = "#sb-main .cm-content";
const NOT_TEXT = '[contenteditable="false"], .sb-lua-directive-block, .sb-inline-content, .cm-widgetBuffer';
const STILL_MS = 80;

/** The root marked while SilverBullet shows the markdown's syntax, from now on; stopped by the function given back */
export function watchSyntaxMode(doc: Document, shown: () => unknown): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = async () => {
    let on = false;
    try {
      on = (await shown()) === true;
    } catch {
      // (Not known: as SilverBullet draws it)
    }
    if (doc.documentElement.hasAttribute(MARK) !== on) doc.documentElement.toggleAttribute(MARK, on);
  };
  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void check(), STILL_MS);
  };
  void check();
  const observer = new (doc.defaultView ?? window).MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches(WIDGETS) || node.querySelector(WIDGETS))) return soon();
      }
    }
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  // A plain click in the text while the markdown is shown as written: the cursor's alone
  const click = (event: MouseEvent) => {
    if (!doc.documentElement.hasAttribute(MARK) || event.button !== 0 || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof Element ? event.target : (event.target as Node | null)?.parentElement;
    if (!target?.closest(TEXT) || target.closest(NOT_TEXT)) return;
    event.stopPropagation();
  };
  doc.addEventListener("click", click, true);
  // The mode asked again as a press in the text comes, before its click (a page with no widget to draw anew as the
  // mode changes kept the mark it had)
  const press = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : (event.target as Node | null)?.parentElement;
    if (target?.closest(TEXT)) void check();
  };
  doc.addEventListener("mousedown", press, true);
  return () => {
    observer.disconnect();
    clearTimeout(timer);
    doc.removeEventListener("click", click, true);
    doc.removeEventListener("mousedown", press, true);
  };
}
