// SilverBullet's "Editor: Toggle Markdown Syntax Rendering": the page's markdown shown as written. SilverBullet keeps
// drawing an embed's widget and a custom syntax's in that mode (2.12.1, `client/codemirror/clean.ts`,
// `pluginsNeededEvenWhenRenderingSyntax`: an embed's medium over its line, a grid under its lines), which the user
// does not want there: Silverware Layout marks the root `data-swl-syntax-shown` while it is on, and its style page
// hides what it draws or decorates (media, grids). The mode is SilverBullet's UI option, read by the bridge; asked as
// SilverBullet draws widgets anew (switching the mode rebuilds the editor), once a burst of them is still.
const MARK = "data-swl-syntax-shown";
// SilverBullet's widgets of an embed or a custom syntax, drawn anew as the mode changes
const WIDGETS = ".sb-inline-content, .sb-lua-directive-block";
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
  return () => {
    observer.disconnect();
    clearTimeout(timer);
  };
}
