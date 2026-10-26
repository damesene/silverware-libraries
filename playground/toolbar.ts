// The toolbar playground: Silverware Toolbar on a CodeMirror editor of
// markdown, as SilverBullet's (its sources, not the committed bundle). The
// bridge is SilverBullet's editor API in short, over this editor; the
// library page's space-style block is applied as SilverBullet would, and the
// command's key bound as SilverBullet binds a command's (a keymap of the editor).
// Settings are the playground's own store (no CONFIG page here), which the
// settings dialog writes through `saveSettings`.
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { DEFAULT_SHORTCUT, PATHS } from "../silverware-toolbar/src/bridge.ts";
import { init, openSettings, showActions } from "../silverware-toolbar/src/index.ts";
import libraryPage from "../silverware-toolbar/silverware-toolbar.md";
import { flash, setUpTheme } from "./common.ts";
import sample from "./toolbar-sample.md";

setUpTheme();

const style = document.createElement("style");
style.textContent = /```space-style\r?\n([\s\S]*?)```/.exec(libraryPage)?.[1] ?? "";
document.head.append(style);

const STORE = "silverware.toolbar.playground.text";
const SETTINGS_STORE = "silverware.toolbar.playground.settings";
const load = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const stored = load(STORE);

// The settings by path, as config.get gives them
let settings: Record<string, unknown> = {};
try {
  settings = JSON.parse(load(SETTINGS_STORE) ?? "{}");
} catch {
  settings = {};
}
const shortcut = typeof settings[PATHS.shortcut] === "string" ? (settings[PATHS.shortcut] as string) : DEFAULT_SHORTCUT;

const view = new EditorView({
  parent: document.getElementById("sb-editor")!,
  state: EditorState.create({
    doc: stored ?? sample,
    extensions: [
      history(),
      keymap.of([
        {
          key: shortcut,
          run: () => {
            showActions();
            return true;
          },
        },
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      markdown(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        try {
          localStorage.setItem(STORE, update.state.doc.toString());
        } catch {
          // A private window: the page starts from the sample next time
        }
      }),
    ],
  }),
});
// For the interaction tests: the editor, to read and set its text and selection
(window as unknown as { playgroundView: EditorView }).playgroundView = view;

void init({
  getSelection: () => {
    const { from, to } = view.state.selection.main;
    return { from, to, text: view.state.sliceDoc(from, to) };
  },
  setSelection: (from, to) => view.dispatch({ selection: { anchor: from, head: to } }),
  replaceRange: (from, to, text) => view.dispatch({ changes: { from, to, insert: text } }),
  getText: () => view.state.doc.toString(),
  // As SilverBullet's editor.focus: CodeMirror's own, which shows its selection again
  focus: () => view.focus(),
  flash,
  getConfig: (path, fallback) => (path in settings ? settings[path] : fallback),
  saveSettings: (values) => {
    for (const [path, value] of Object.entries(values)) {
      if (value === undefined) delete settings[path];
      else settings[path] = value;
    }
    try {
      localStorage.setItem(SETTINGS_STORE, JSON.stringify(settings));
    } catch {
      // A private window: they hold until the page is loaded again
    }
  },
  reloadUI: () => location.reload(),
  // A few of SilverBullet's commands, as system.listCommands gives them (Text: Bold as its own wraps the selection)
  listCommands: () => ({
    "Text: Bold": { name: "Text: Bold" },
    "Navigate: Home": { name: "Navigate: Home" },
    "Hidden command": { name: "Hidden command", hide: true },
  }),
  // No pages to open here: said so
  navigate: (page) => flash(`Playground: would open ${page}`),
  invokeCommand: (name) => {
    if (name !== "Text: Bold") {
      flash(`Playground: would run ${name}`);
      return;
    }
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: `**${view.state.sliceDoc(from, to)}**` }, selection: { anchor: from + 2, head: to + 2 } });
  },
});

document.getElementById("swb-settings")!.addEventListener("click", () => void openSettings());

document.getElementById("reset")!.addEventListener("click", () => {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: sample } });
});
