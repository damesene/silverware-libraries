// SilverBullet's "Editor: Toggle Markdown Syntax Rendering": the page's markdown shown as written. SilverBullet keeps
// drawing an embed's widget and a custom syntax's in that mode (2.12.1, `client/codemirror/clean.ts`,
// `pluginsNeededEvenWhenRenderingSyntax`: an embed's medium over its line, a grid under its lines), which the user
// does not want there: Silverware Layout marks the root `data-swl-syntax-shown` while it is on (and the setting
// `syntaxMode.hideWidgets` is), and its style page hides what it draws or decorates (media, grids). The mode is
// SilverBullet's UI option, read by the bridge; asked as SilverBullet draws widgets anew (switching the mode rebuilds
// the editor), once a burst of them is still.
//
// In that mode a plain click in the text puts the cursor there and follows nothing (the user's wish: the markdown is
// edited there): SilverBullet follows a link, a hashtag, any `page:click` on its `click` in the editor (2.12.1,
// `client/codemirror/editor_state.ts`), on all of a wiki link's text, `![[` too, which left no way to put the cursor
// before an embed. Its click is held back as it comes (the cursor is placed by the press before it, CodeMirror's);
// Ctrl or Cmd held, it follows as before; a click in a widget (a query's buttons) is the widget's. The setting
// `syntaxMode.clickPlacesCursor` off: as SilverBullet does.
const MARK = "data-swl-syntax-shown";
// The root while a click there places the cursor alone: the style page shows the text's pointer over a link, not a hand
const CLICKS = "data-swl-syntax-clicks";
// SilverBullet's widgets of an embed or a custom syntax, drawn anew as the mode changes
const WIDGETS = ".sb-inline-content, .sb-lua-directive-block";
// The editor's text, and what in it is no text of the page (a widget)
const TEXT = "#sb-main .cm-content";
const NOT_TEXT = '[contenteditable="false"], .sb-lua-directive-block, .sb-inline-content, .cm-widgetBuffer';
const STILL_MS = 80;
const SAVED_HELD_MS = 10_000;

/** What Silverware Layout does in that mode (src/model/settings.ts' `SyntaxModeSettings`) */
type SyntaxSettings = { readonly hideWidgets: boolean; readonly clickPlacesCursor: boolean };

/** SilverBullet's markdown shown as written followed from now on, as the settings say (asked each time; told when they change) */
export function watchSyntaxMode(doc: Document, shown: () => unknown, read: () => Promise<SyntaxSettings> | SyntaxSettings): { readonly stop: () => void; readonly settingsChanged: (settings: SyntaxSettings) => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Whether SilverBullet shows the markdown as written now, and the settings, as last asked (both again with each
  // check: the configuration read as Silverware Layout starts again after a save may be the one before it)
  let on = false;
  let settings: SyntaxSettings = { hideWidgets: true, clickPlacesCursor: true };
  // The settings just saved, held until the configuration read gives them (SilverBullet loads it again a moment after
  // a save: read before, it is the one before), a while at most
  let saved: { readonly settings: SyntaxSettings; readonly until: number } | undefined;
  const same = (a: SyntaxSettings, b: SyntaxSettings) => a.hideWidgets === b.hideWidgets && a.clickPlacesCursor === b.clickPlacesCursor;
  const mark = () => {
    const hide = on && settings.hideWidgets;
    if (doc.documentElement.hasAttribute(MARK) !== hide) doc.documentElement.toggleAttribute(MARK, hide);
    const clicks = on && settings.clickPlacesCursor;
    if (doc.documentElement.hasAttribute(CLICKS) !== clicks) doc.documentElement.toggleAttribute(CLICKS, clicks);
  };
  const check = async () => {
    const [mode, given] = await Promise.allSettled([shown(), read()]);
    // (Not known: as SilverBullet draws it)
    on = mode.status === "fulfilled" && mode.value === true;
    if (given.status === "fulfilled") {
      if (saved && (same(given.value, saved.settings) || Date.now() > saved.until)) saved = undefined;
      settings = saved ? saved.settings : given.value;
    }
    mark();
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
    if (!on || !settings.clickPlacesCursor || event.button !== 0 || event.ctrlKey || event.metaKey) return;
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
  return {
    stop: () => {
      observer.disconnect();
      clearTimeout(timer);
      doc.removeEventListener("click", click, true);
      doc.removeEventListener("mousedown", press, true);
    },
    settingsChanged: (given) => {
      settings = given;
      saved = { settings: given, until: Date.now() + SAVED_HELD_MS };
      mark();
    },
  };
}
