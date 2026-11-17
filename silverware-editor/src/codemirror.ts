// A `TextEditor` (shared/editor.ts) drawn by CodeMirror (docs/silverware-editor.md): markdown, highlighted in the
// theme's colours and shown as SilverBullet shows it (src/livepreview.ts), a list continued on Enter, brackets closed, its own history, `[[links]]` completed from the space's
// pages; the plugin's keys first. Built over the CodeMirror module loaded beside the bundle (src/vendor.ts: its types
// alone here), never shown to the plugin. Its presses and keys its own (the page's editor takes none, src/index.ts
// takes its undo and redo at the window, where SilverBullet holds them back). Drawn in a shadow root of its own: the
// page's rules for SilverBullet's editor (`#sb-main .cm-editor .cm-scroller` and the like) reached ours and stretched
// it by 360 px (2026-11-14); what it inherits (the font, the colours, the theme's variables) still reaches it.
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";
import type { EditorView as View, KeyBinding } from "@codemirror/view";
import { companionBlur, type EditorOptions, type TextEditor } from "../../shared/editor.ts";
import { livePreview, PREVIEW_THEME, wikiLinks } from "./livepreview.ts";
import { lookRules } from "./look.ts";

/** The CodeMirror module beside the bundle (src/vendor.ts) */
export type CodeMirror = typeof import("./vendor.ts");

/** What an editor drawn by CodeMirror is given besides its options */
export type CodeMirrorHost = {
  // The space's pages, for `[[links]]` (none: nothing completed)
  readonly pages?: () => Promise<readonly string[]>;
  // Told of an editor made and taken off (the surfaces Silverware Toolbar finds)
  readonly made: (editor: TextEditor, view: View) => void;
  readonly gone: (editor: TextEditor) => void;
};

/** The look: the page's font, colours and selection (SilverBullet's CSS variables where it has them), no frame of its own */
function theme(cm: CodeMirror): Extension {
  return cm.EditorView.theme({
    "&": { color: "inherit", backgroundColor: "transparent", fontSize: "inherit", height: "100%" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit", overflow: "visible" },
    ".cm-content": { padding: "0", caretColor: "var(--editor-caret-color, currentColor)" },
    // (The caret drawn by CodeMirror, the browser's hidden: its own black, unseen on a dark theme)
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--editor-caret-color, currentColor)" },
    ".cm-line": { padding: "0" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--editor-selection-background-color, color-mix(in srgb, var(--ui-accent-color, #464cfc) 25%, transparent)) !important",
    },
    ".cm-placeholder": { opacity: "0.5" },
    ".cm-tooltip": { color: "var(--root-color)", backgroundColor: "var(--root-background-color)", border: "1px solid color-mix(in srgb, var(--root-color) 20%, transparent)" },
    ...PREVIEW_THEME,
  });
}

/** Markdown highlighted as SilverBullet's editor shows it, near enough: headings, emphasis, links, code, quotes */
function highlight(cm: CodeMirror): Extension {
  const t = cm.tags;
  return cm.syntaxHighlighting(
    cm.HighlightStyle.define([
      { tag: t.heading, fontWeight: "bold", color: "var(--editor-heading-color, inherit)" },
      // (The sizes of SilverBullet's rendered headings: a grid's cell shows them so as it is not edited. Each level bold
      // itself: a level's rule takes the place of the heading's, the two are not merged)
      { tag: t.heading1, fontWeight: "bold", fontSize: "1.5em", color: "var(--editor-heading-color, inherit)" },
      { tag: t.heading2, fontWeight: "bold", fontSize: "1.2em", color: "var(--editor-heading-color, inherit)" },
      { tag: t.heading3, fontWeight: "bold", fontSize: "1.1em", color: "var(--editor-heading-color, inherit)" },
      { tag: t.strong, fontWeight: "bold" },
      { tag: t.emphasis, fontStyle: "italic" },
      { tag: t.strikethrough, textDecoration: "line-through" },
      { tag: [t.link, t.url], color: "var(--editor-link-color, var(--link-color, #0969da))" },
      { tag: t.monospace, fontFamily: "var(--editor-monospace-font, monospace)", backgroundColor: "color-mix(in srgb, currentColor 8%, transparent)" },
      { tag: t.quote, color: "color-mix(in srgb, currentColor 70%, transparent)" },
      { tag: [t.processingInstruction, t.meta], color: "color-mix(in srgb, currentColor 50%, transparent)" },
    ]),
  );
}

/** `[[links]]` completed from the space's pages: what is typed after `[[` matched anywhere in a page's name */
function pageCompletion(pages: () => Promise<readonly string[]>) {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const typed = context.matchBefore(/\[\[[^\]\n|]*$/);
    if (!typed) return null;
    const names = await pages();
    const options: Completion[] = names.map((name) => ({ label: name, apply: `${name}]]`, type: "text" }));
    return { from: typed.from + 2, options, validFor: /^[^\]\n|]*$/ };
  };
}

/** A `TextEditor` drawn by CodeMirror */
export function codeMirrorEditor(cm: CodeMirror, doc: Document, options: EditorOptions, host: CodeMirrorHost): TextEditor {
  const element = doc.createElement("div");
  element.className = `swe-editor${options.className ? ` ${options.className}` : ""}`;
  const shadow = element.attachShadow({ mode: "open" });
  const box = doc.createElement("div");
  // (As tall as its element where that has a height of its own, a peek's field: a press under the text still the editor's)
  box.style.height = "100%";
  shadow.append(box);
  // (The page's look of a task's box and a hashtag, where its user gave it)
  const look = options.look ? lookRules(doc, options.look) : "";
  if (look) shadow.append(Object.assign(doc.createElement("style"), { textContent: look }));
  const control = new AbortController();
  // (Left where the focus goes out of it and of what acts on it from outside: Silverware Toolbar's popup is not)
  const blurred = companionBlur(doc, (node) => node instanceof Node && (element.contains(node) || shadow.contains(node)), () => options.onBlur?.(), control.signal);
  const readOnly = new cm.Compartment();
  const shownEmpty = new cm.Compartment();
  // The plugin's keys first, then a list continued on Enter, the history, the rest of the usual keys (Ctrl+/ toggling a
  // comment left out: no markdown of its own to toggle)
  // (A key its run did not take goes on, as in the stand-in: CodeMirror prevents a key's default where run takes it)
  const own: KeyBinding[] = Object.entries(options.keys ?? {}).map(([key, run]) => ({ key, run: () => run() }));
  // (Esc taken only where it closes completions shown: else it goes on to the plugin, a panel closed by it; CodeMirror's
  // own bindings of it take it also where nothing is shown, completions pending or a caret's selection already simple;
  // the completion's own keymap, which autocompletion adds itself, is left out of it for these)
  const noEscape = (binding: KeyBinding) => binding.key !== "Escape";
  const escape: KeyBinding = { key: "Escape", run: (view) => cm.completionStatus(view.state) === "active" && cm.closeCompletion(view) };
  const usual = cm.defaultKeymap.filter((binding) => binding.key !== "Mod-/" && binding.key !== "Alt-A" && noEscape(binding));
  const extensions: Extension[] = [
    // (Esc closing the completion shown before the plugin's Esc: a grid's cell left with `[[Pro` typed, else)
    cm.Prec.highest(cm.keymap.of([escape, ...own])),
    cm.history(),
    cm.drawSelection(),
    // (GitHub's markdown, its tasks and strikethrough, as SilverBullet reads them; wiki links read too, for the preview)
    cm.markdown({ base: cm.markdownLanguage, extensions: [wikiLinks] }),
    livePreview(cm, options.drawing, options.openLink),
    cm.closeBrackets(),
    cm.keymap.of([...cm.closeBracketsKeymap, ...cm.markdownKeymap, ...cm.historyKeymap, ...cm.completionKeymap.filter(noEscape), cm.indentWithTab, ...usual]),
    cm.EditorView.lineWrapping,
    theme(cm),
    highlight(cm),
    readOnly.of([cm.EditorState.readOnly.of(!!options.readOnly), cm.EditorView.editable.of(!options.readOnly)]),
    cm.EditorView.contentAttributes.of({ spellcheck: String(options.spellcheck ?? true), ...(options.label ? { "aria-label": options.label } : {}) }),
    cm.EditorView.updateListener.of((update) => {
      if (update.docChanged) options.onChange?.(update.state.doc.toString());
    }),
    cm.EditorView.domEventHandlers({
      focus: () => void options.onFocus?.(),
      blur: (event) => void blurred(event),
    }),
    shownEmpty.of(options.placeholder ? [cm.placeholder(options.placeholder)] : []),
    ...(host.pages ? [cm.autocompletion({ override: [pageCompletion(host.pages)], icons: false, defaultKeymap: false })] : []),
  ];
  const length = options.text.length;
  const at = options.selection;
  const within = (offset: number, of = view?.state.doc.length ?? length) => Math.max(0, Math.min(of, offset));
  const selection =
    at === undefined || typeof at === "number"
      ? cm.EditorSelection.cursor(within(at ?? length, length))
      : at.backward
        ? cm.EditorSelection.range(within(at.to, length), within(at.from, length))
        : cm.EditorSelection.range(within(at.from, length), within(at.to, length));
  let view: View | undefined;
  view = new cm.EditorView({ parent: box, root: shadow, state: cm.EditorState.create({ doc: options.text, selection, extensions }) });
  const shown = view;
  // (The page's editor takes no press or key of ours: its shortcuts, its cursor put in the widget, its markdown shown.
  // Keys it does not take go on to its user's elements where they say they keep them themselves, `passKeys`)
  for (const type of ["mousedown", "pointerdown", "click"]) element.addEventListener(type, (event) => event.stopPropagation(), { signal: control.signal });
  element.addEventListener("keydown", (event) => !(options.passKeys && !event.defaultPrevented) && event.stopPropagation(), { signal: control.signal });
  const editor: TextEditor = {
    element,
    preview: true,
    getText: () => shown.state.doc.toString(),
    // (Not in the history: undone, the text a plugin put in (a peek's item read) went back to the empty one before)
    setText: (text) => shown.dispatch({ changes: { from: 0, to: shown.state.doc.length, insert: text }, annotations: cm.Transaction.addToHistory.of(false) }),
    getSelection: () => {
      const main = shown.state.selection.main;
      return { from: main.from, to: main.to, backward: main.head < main.anchor };
    },
    setSelection: (from, to = from, backward = false) => {
      const [start, end] = [within(Math.min(from, to)), within(Math.max(from, to))];
      shown.dispatch({ selection: backward ? cm.EditorSelection.range(end, start) : cm.EditorSelection.range(start, end), scrollIntoView: true });
    },
    replaceRange: (from, to, text) => shown.dispatch({ changes: { from: within(from), to: within(to), insert: text } }),
    get readOnly() {
      return shown.state.readOnly;
    },
    set readOnly(value: boolean) {
      shown.dispatch({ effects: readOnly.reconfigure([cm.EditorState.readOnly.of(value), cm.EditorView.editable.of(!value)]) });
    },
    setPlaceholder: (text) => shown.dispatch({ effects: shownEmpty.reconfigure(text ? [cm.placeholder(text)] : []) }),
    selectionRect: () => {
      const main = shown.state.selection.main;
      const start = shown.coordsAtPos(main.from);
      const end = shown.coordsAtPos(main.to, -1) ?? start;
      if (!start || !end) return undefined;
      const left = Math.min(start.left, end.left);
      const top = Math.min(start.top, end.top);
      return new DOMRect(left, top, Math.max(start.right, end.right) - left, Math.max(start.bottom, end.bottom) - top);
    },
    focus: () => shown.focus(),
    hasFocus: () => shown.hasFocus,
    altPress: (event) => {
      // (Its real target, in the editor's shadow root: the event's own is the root's host where it was taken)
      const target = event.composedPath()[0];
      if (!(target instanceof Node) || !shown.contentDOM.contains(target)) return false;
      try {
        const embed = target instanceof Element ? target.closest(".swe-embed") : target.parentElement?.closest(".swe-embed");
        const at = embed ? shown.posAtDOM(embed) : shown.posAtCoords({ x: event.clientX, y: event.clientY });
        if (at !== null) shown.dispatch({ selection: { anchor: at } });
        shown.focus();
      } catch {
        // (Gone from the editor meanwhile)
      }
      return true;
    },
    destroy: () => {
      control.abort();
      host.gone(editor);
      shown.destroy();
    },
  };
  host.made(editor, shown);
  return editor;
}
