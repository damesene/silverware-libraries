# Silverware Editor

A markdown editor for the other plugins (prefix `swe-`, API under `silverware.editor`), CodeMirror 6 underneath and never shown: the plugins see `TextEditor` (`shared/editor.ts`). The plan, the probe's results and the decisions: [docs/silverware-editor.md](../docs/silverware-editor.md). User docs: `silverware-editor.md`; `-api.md` (priority 50: `silverware.editor.api`), `-init.md` (the space's pages handed over; CodeMirror loaded when idle).

## Mental model

- **The contract is `shared/editor.ts`**: `Editors.create(doc, options)` gives a `TextEditor` (text, selection, a range replaced, read-only, focus, the selection's rectangle, its element; change, focus and blur told; keys of the plugin's own by CodeMirror's names; `preview`: whether it shows the markdown as rendered, so its user draws it in the rendering's look, as Silverware Layout's cell does), `surfaceOf(node)` the `EditingSurface` a node is in (Silverware Toolbar's). `editorsOf(given)` gives the API handed over, or the stand-in: the same editor as a `<textarea>` (`textareaEditor`), so no plugin needs this library.
- **CodeMirror is a file beside the bundle** (`silverware-editor-codemirror.js`, built by `scripts/build.mjs` from `src/vendor.ts`, never imported by the bundle: `src/codemirror.ts` takes its types alone), loaded by `init` when the browser is idle. `create` is synchronous: CodeMirror's editor where it is loaded, the stand-in's until then.
- **The live preview is `src/livepreview.ts`**: decorations made again on every transaction (the editors are small) from the syntax tree of GitHub's markdown plus `wikiLinks` (an inline parser of ours, `WikiLink` / `WikiLinkMark`): marks hidden unless the selection touches their node (ends included), never in a read-only editor; a task's box toggles `[ ]`/`[x]` by a change of the text. Its lines' text is not the markdown: a test reads the editor's text from its state (`.cm-content`'s `cmTile.view.state`, the UI tests' helpers).
- **Keys**: the plugin's keys first, but Esc closes a completion shown before the plugin's Esc; a key its `run` does not take goes on. `setText` is no step of the history (a plugin's text put in is no edit of the user's). The `[[` completion's pages are read again after 10 s.
- **Companions** (`COMPANION_ATTRIBUTE`, shared/editor.ts `companionBlur`): the focus gone to an element acting on the editor (Silverware Toolbar's popup) is not the editor left; told once it goes elsewhere, or to nothing (looked at every 500 ms: a companion taken away tells nothing).
- **No SilverBullet but what the init page hands over** (`listPages`, for `[[links]]` completed); its look by SilverBullet's CSS variables (the theme in `src/codemirror.ts`).

## Verified in SilverBullet (2.12.1 and main, 2026-11-14, a probe of a second CodeMirror in a grid)

- Two CodeMirrors' style classes do not collide (`style-mod` shares its counter: ours `ͼs ͼt…`, SilverBullet's `ͼ1 ͼ2…`); SilverBullet's editor looks the same after ours is made.
- Presses and keys stopped at our element (bubbling): SilverBullet's shortcuts (Ctrl+K, Ctrl+/) do not run from it, its editor is not moved, its text not changed.
- **SilverBullet takes Ctrl+Z at the window first and holds it back** (`defaultPrevented` as it reaches a later listener of the window): our undo and redo are done by a listener of ours at the window, for an event in one of our editors (`ownHistory`, shared/editor.ts; the stand-in's alike, by the browser's undo), only where the binding says the page does so (`historyAtWindow`: this library's init page, the other plugins' SilverBullet hosts in `editorsOf(…, { historyAtWindow: true })`); the shared code assumes nothing of SilverBullet.
- CodeMirror's default keys include Ctrl+/ (a comment toggled: `<!-- -->` in markdown) and Alt+A: left out.
- **SilverBullet's rules for its editor reach any CodeMirror in the page** (`#sb-main .cm-editor .cm-scroller`: 360 px padding at its bottom, among others): ours is drawn in a shadow root of its own (`EditorView`'s `root`), its element the root's host; what it inherits (font, colours, the theme's variables) still reaches it. A node in it is found by `element.shadowRoot.contains`; its selection is the root's (`shadowRoot.getSelection` in Chromium).

## Tests

- `src/isolation.test.ts`: only `shared/editor.ts` and elements of `shared/`; CodeMirror in `vendor.ts` alone at run time (types elsewhere).
- Unit tests (jsdom): the stand-in, the keys' names; the CodeMirror editor made over the vendor module in the test.
- Its use is tested where it is used: Silverware Layout's grid, Silverware Database's peek, Silverware Toolbar over a surface.
