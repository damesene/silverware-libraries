// Silverware Editor (docs/silverware-editor.md): a markdown editor for the other plugins, through its API alone
// (`silverware.editor.api`, its API page hands it over; shared/editor.ts). CodeMirror is a file beside the bundle,
// loaded as Space Lua starts, once the browser is idle: an editor asked for before it is loaded is the stand-in's
// (a `<textarea>`), after it CodeMirror's. The editors made are the editing surfaces Silverware Toolbar acts on.
import { EDITOR_VERSION, type EditingSurface, type Editors, ownHistory, textareaEditor, type TextEditor } from "../../shared/editor.ts";
import { type CodeMirror, codeMirrorEditor } from "./codemirror.ts";
import type { EditorView } from "@codemirror/view";

const CODEMIRROR_FILE = "./silverware-editor-codemirror.js";
// How long CodeMirror not loaded is believed before it is asked again (ms)
const RETRY_MS = 30_000;

/** What the init page hands over */
export type Bridge = {
  readonly listPages?: () => Promise<unknown>;
  // The page takes undo and redo at the window before an editor gets them (shared/editor.ts `EditorHost`): its init page says so of SilverBullet
  readonly historyAtWindow?: boolean;
};

let codeMirror: CodeMirror | undefined;
let loading: Promise<CodeMirror> | undefined;

/** CodeMirror, loaded once from beside the bundle (or where `from` says); not loaded: asked again a while later */
export function loadCodeMirror(from: () => Promise<CodeMirror> = () => import(new URL(CODEMIRROR_FILE, import.meta.url).href)): Promise<CodeMirror> {
  loading ??= from().then(
    (module: CodeMirror) => (codeMirror = module),
    (error: unknown) => {
      setTimeout(() => (loading = undefined), RETRY_MS);
      throw error;
    },
  );
  return loading;
}

// The editors drawn by CodeMirror, live: their views, for their history at the window and Silverware Toolbar's surfaces
const live = new Map<TextEditor, EditorView>();
let current: Bridge = {};

// How long the pages' names read are used again: each `[[` read them all across the bridge, slow in a large space
const PAGES_MS = 10_000;
let pagesRead: { readonly at: number; readonly names: Promise<readonly string[]> } | undefined;

/** The space's pages' names, as the init page hands them over (each a name, or a page object with its `name`), read again after `PAGES_MS` */
function pages(): Promise<readonly string[]> {
  if (pagesRead && Date.now() - pagesRead.at < PAGES_MS) return pagesRead.names;
  const names = (async () => {
    const list = await current.listPages?.();
    if (!Array.isArray(list)) return [];
    return list.flatMap((page) => (typeof page === "string" ? [page] : page && typeof page === "object" && typeof (page as { name?: unknown }).name === "string" ? [(page as { name: string }).name] : []));
  })();
  pagesRead = { at: Date.now(), names };
  // (A read that failed not kept)
  names.catch(() => (pagesRead = undefined));
  return names;
}

let historyTaken: (() => void) | undefined;

/** Undo and redo in our editors done by us, at the window, where the page takes them there first (`historyAtWindow`) */
function takeHistory(win: Window): void {
  historyTaken ??= ownHistory(
    win,
    // (A key in an editor's shadow root comes to the window from its element, its host)
    (target) => target instanceof Node && [...live.keys()].some((editor) => editor.element === target || editor.element.contains(target)),
    (redo) => {
      const view = [...live.values()].find((one) => one.hasFocus);
      if (view && codeMirror) (redo ? codeMirror.redo : codeMirror.undo)(view);
    },
  );
}

/** Silverware Editor's API, as its API page hands it to the other plugins (`silverware.editor.api`) */
export const api: Editors = {
  version: EDITOR_VERSION,
  create(doc, options) {
    const cm = codeMirror;
    if (!cm) return textareaEditor(doc, options, { historyAtWindow: !!current.historyAtWindow });
    if (doc.defaultView && current.historyAtWindow) takeHistory(doc.defaultView);
    return codeMirrorEditor(cm, doc, options, {
      pages,
      made: (editor, view) => void live.set(editor, view),
      gone: (editor) => void live.delete(editor),
    });
  },
  surfaceOf(node): EditingSurface | undefined {
    // (A node in an editor's shadow root is in its element's: the root's host is the element)
    for (const editor of live.keys()) if (editor.element.contains(node) || editor.element.shadowRoot?.contains(node)) return editor;
    return undefined;
  },
};

/** Started by the init page (again as Space Lua loads again): SilverBullet's space handed over, CodeMirror loaded when idle */
export function init(bridge: Bridge): void {
  current = bridge;
  const win = globalThis as typeof globalThis & { requestIdleCallback?: (run: () => void) => void };
  const load = () => void loadCodeMirror().catch((error: unknown) => console.error("Silverware Editor: CodeMirror could not be loaded", error));
  if (win.requestIdleCallback) win.requestIdleCallback(load);
  else setTimeout(load, 0);
}
