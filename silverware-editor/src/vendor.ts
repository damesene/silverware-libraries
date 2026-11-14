// CodeMirror as a file of its own beside Silverware Editor's bundle (silverware-editor-codemirror.js, built by
// scripts/build.mjs), loaded as Space Lua starts, once the browser is idle (src/index.ts `loadCodeMirror`): never imported by the bundle
// itself, only its types (src/codemirror.ts).
export { Compartment, EditorSelection, EditorState, Prec, StateField, Transaction } from "@codemirror/state";
export { Decoration, drawSelection, EditorView, keymap, placeholder, WidgetType } from "@codemirror/view";
export { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
export { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
export { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
export { autocompletion, closeBrackets, closeBracketsKeymap, closeCompletion, completionKeymap, completionStatus } from "@codemirror/autocomplete";
export { tags } from "@lezer/highlight";
