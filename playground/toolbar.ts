// The toolbar playground: Silverware Toolbar on a CodeMirror editor of
// markdown, as SilverBullet's (its sources, not the committed bundle). The
// bridge is SilverBullet's editor API in short, over this editor; the
// library page's space-style block is applied as SilverBullet would, and the
// command's key bound as SilverBullet binds a command's (a keymap of the editor).
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { DEFAULT_SHORTCUT } from "../silverware-toolbar/src/bridge.ts";
import { init, showActions } from "../silverware-toolbar/src/index.ts";
import libraryPage from "../silverware-toolbar/silverware-toolbar.md";
import { flash, setUpTheme } from "./common.ts";
import sample from "./toolbar-sample.md";

setUpTheme();

const style = document.createElement("style");
style.textContent = /```space-style\r?\n([\s\S]*?)```/.exec(libraryPage)?.[1] ?? "";
document.head.append(style);

const STORE = "silverware.toolbar.playground.text";
const stored = (() => {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
})();

const view = new EditorView({
  parent: document.getElementById("sb-editor")!,
  state: EditorState.create({
    doc: stored ?? sample,
    extensions: [
      history(),
      keymap.of([
        {
          key: DEFAULT_SHORTCUT,
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
  flash,
  getConfig: (_path, fallback) => fallback,
});

document.getElementById("reset")!.addEventListener("click", () => {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: sample } });
});
