# Silverware Editor: a markdown editor for the other plugins

Planned 2026-11-14 with the user, on its own branch (`feat/editor`, from `docs/layout-assets`) so it can be dropped whole if it does not work well.

## The idea

A library of its own, **Silverware Editor** (`silverware-editor/`, prefix `swe-`, `silverware.editor`), giving the other plugins a pleasant markdown editor where they now have a plain `<textarea>`: a grid's cell (Silverware Layout), an item's content in a database's peek (Silverware Database), later a table's long text. CodeMirror 6 underneath (the repository has it already, for the playground), never shown to the plugins: they get an abstraction of what they need.

## Decided (2026-11-14)

- **No plugin needs it.** The contract (`shared/editor.ts`, as `shared/icons.ts` is Silverware Icons') gives an `Editors` API handed over by the init page's Lua (`silverware.editor.api`), or a stand-in without it: the same `TextEditor` drawn as a `<textarea>`. A plugin writes against `TextEditor` alone and works the same with or without the library.
- **CodeMirror is not exposed**: `TextEditor` is the text, the selection, a range replaced, read-only, focus, the selection's place on screen, its element, change and leave told, keys of the plugin's own (`Mod-Enter`…). What we need beyond (a list continued on Enter, `[[links]]` completed from the space's pages) are the library's own extensions, chosen by options.
- **No SilverBullet but through an abstraction**: the library reaches SilverBullet only by what its init page hands over (the space's pages for completion), its look by SilverBullet's CSS variables; no `window.client`, no SilverBullet's own CodeMirror.
- **Loaded once ready**: the library's own bundle is small; CodeMirror is a file beside it (`silverware-editor-codemirror.js`), loaded as Space Lua starts, when the browser is idle. `create` is synchronous (a cell is edited at once): CodeMirror's where it is loaded, the stand-in's until then.
- **Markdown shown as SilverBullet shows it** (the user's wish, 2026-11-14): a task's `[ ]` a checkbox that toggles it, a done task struck through, a bullet list's `-` a bullet, the marks of bold, italic, strikethrough, code, headings, links and `[[wiki links]]` hidden, each shown again where the selection touches what it marks (as SilverBullet does, a caret beside a mark included); a read-only editor shows none. SilverBullet's behaviour written anew (`src/livepreview.ts`), not its code; GitHub's markdown read (tasks, strikethrough) and wiki links by an inline parser of our own. Links are not followed: a click places the caret.
- **Silverware Toolbar over it**: an editor focused is an *editing surface* (the text, the selection, a range replaced, the selection's rectangle, its element); Silverware Toolbar asks the editor API for the surface the focus is in (handed over by its init page, as it takes Silverware Icons') and reads and writes through it in place of SilverBullet's editor. Its actions and modules see no change.

## Risks, each to be checked (a probe first)

- **Two CodeMirrors in a page** (SilverBullet's and ours, two copies of `@codemirror/*`): the generated style classes of `style-mod` must not collide (it shares its counter through a global symbol, to be verified); no extension crosses between them.
- **Keys**: SilverBullet takes some keys at the window (Ctrl+Z: the grid's field had to undo itself) and its commands' shortcuts; inside our editor its own keys must win, the page's editor never moved.
- **A phone**: SilverBullet scrolls to its own cursor as the keyboard or the focus changes; our editor's caret must stay in view.
- **Undo**: our editor's own history while it is open; what it hands back is one edit of the page, one undo of SilverBullet's.

## Steps

1. A probe in SilverBullet (2.12.1 and main): two CodeMirrors, their styles, keys, a phone's keyboard.
2. The contract and the stand-in (`shared/editor.ts`), the library (`silverware-editor/`), its tests.
3. Silverware Layout's grid cell edited in it.
4. Silverware Database's peek: an item's content edited in it.
4b. Markdown shown as SilverBullet shows it (tasks, bullets, marks hidden).
5. Silverware Toolbar over an editing surface (done 2026-11-14: the selection read in the shadow root, reads and writes through the surface, the popup's search not leaving the editor: `COMPANION_ATTRIBUTE`).
6. A review; the user's look. (Review done 2026-11-14: its findings fixed, see the commits of that day; the user's look on a real phone is left.)
