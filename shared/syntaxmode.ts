// A host's mode showing the page's markdown as written (SilverBullet's "Editor: Toggle Markdown Syntax Rendering"),
// followed for a plugin: while it is on, the root marked as the plugin's settings say (its style page hides what it
// draws or decorates there, SilverBullet drawing an embed's and a custom syntax's widget in that mode still), and,
// where the plugin asks, a plain click in the text placing the cursor alone. The mode is asked of the host (`shown`,
// SilverBullet's UI option) as the host draws its widgets anew (switching the mode rebuilds the editor) once a burst
// of them is still, and as a press in the text comes. The host's elements are given (`page`): this file names none.
//
// A click held back: the host follows a link, a hashtag, any `page:click` on its `click` in the editor (SilverBullet
// 2.12.1, `client/codemirror/editor_state.ts`), on all of a wiki link's text, `![[` too, which left no way to put the
// cursor before an embed. Its click is held back as it comes (the cursor is placed by the press before it, the
// editor's); Ctrl or Cmd held, it follows as before; a click in a widget (a query's buttons) is the widget's.

/** The host's elements, as its own part of a plugin names them */
export type SyntaxModePage = {
  // Its widgets, drawn anew as the mode changes (the mode asked again then)
  readonly widgets: string;
  // The editor's text, and what in it is no text of the page (a widget)
  readonly text: string;
  readonly notText: string;
};

export type SyntaxModeOptions<S> = {
  readonly page: SyntaxModePage;
  // Whether the host shows the markdown as written now (anything but true: not; a failure: not)
  readonly shown: () => unknown;
  // The plugin's settings, as configured
  readonly read: () => Promise<S> | S;
  readonly same: (a: S, b: S) => boolean;
  // The root's attributes while the mode is on, each set where it is true
  readonly marks: (settings: S) => Readonly<Record<string, boolean>>;
  // Whether a plain click in the text places the cursor alone while the mode is on (none: the host's as ever)
  readonly placesCursor?: (settings: S) => boolean;
  // An attribute put on the editor's text as the mode is asked (the style page then tells the text by it, naming none of
  // the host's elements: the text's pointer over a link where a click places the cursor alone)
  readonly textMark?: string;
  // Before any read: the defaults
  readonly initial: S;
};

export type SyntaxModeWatcher<S> = {
  readonly stop: () => void;
  // The settings just saved: shown at once, held until the configuration read gives them (a while at most)
  readonly settingsChanged: (settings: S) => void;
};

const STILL_MS = 80;
const SAVED_HELD_MS = 10_000;

/** The host's markdown shown as written followed from now on, as the plugin's settings say (asked each time; told when they change) */
export function watchSyntaxMode<S>(doc: Document, options: SyntaxModeOptions<S>): SyntaxModeWatcher<S> {
  const { page } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Whether the host shows the markdown as written now, and the settings, as last asked (both again with each check:
  // the configuration read as the plugin starts again after a save may be the one before it)
  let on = false;
  let settings = options.initial;
  // The settings just saved, held until the configuration read gives them (SilverBullet loads it again a moment after
  // a save: read before, it is the one before), a while at most
  let saved: { readonly settings: S; readonly until: number } | undefined;
  // Every attribute this plugin may set, to take off what no longer holds
  const names = Object.keys(options.marks(options.initial));
  const mark = () => {
    if (options.textMark) {
      const text = doc.querySelector(page.text);
      if (text && !text.hasAttribute(options.textMark)) text.setAttribute(options.textMark, "");
    }
    const wanted = options.marks(settings);
    for (const name of new Set([...names, ...Object.keys(wanted)])) {
      const set = on && wanted[name] === true;
      if (doc.documentElement.hasAttribute(name) !== set) doc.documentElement.toggleAttribute(name, set);
    }
  };
  const check = async () => {
    const [mode, given] = await Promise.allSettled([options.shown(), options.read()]);
    // (Not known: as the host draws it)
    on = mode.status === "fulfilled" && mode.value === true;
    if (given.status === "fulfilled") {
      if (saved && (options.same(given.value, saved.settings) || Date.now() > saved.until)) saved = undefined;
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
        if (node instanceof Element && (node.matches(page.widgets) || node.querySelector(page.widgets))) return soon();
      }
    }
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  const targetOf = (event: Event) => (event.target instanceof Element ? event.target : (event.target as Node | null)?.parentElement);
  // A plain click in the text while the markdown is shown as written: the cursor's alone
  const click = (event: MouseEvent) => {
    if (!on || !options.placesCursor?.(settings) || event.button !== 0 || event.ctrlKey || event.metaKey) return;
    const target = targetOf(event);
    if (!target?.closest(page.text) || target.closest(page.notText)) return;
    event.stopPropagation();
  };
  if (options.placesCursor) doc.addEventListener("click", click, true);
  // The mode asked again as a press in the text comes, before its click (a page with no widget to draw anew as the
  // mode changes kept the mark it had)
  const press = (event: MouseEvent) => {
    if (targetOf(event)?.closest(page.text)) void check();
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
