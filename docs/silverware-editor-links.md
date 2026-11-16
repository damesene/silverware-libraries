# Links in an editor's field

A database's peek and a grid's cell edited show their markdown in Silverware Editor's field. A link there (`[[Page]]`,
`[[photo.png]]`, `[text](url)`) showed as coloured text alone: no file's icon and menu, as Silverware Assets draws in the
page, and a click put the caret in it, where the page follows it. A `\[` showed its backslash, where the page hides it.
Reported by the user 2026-11-16 (a link to an image in an item's content, the peek); decided with them the same day.

## As in the page

The page's parts keep their owners in a field:

- **A link followed is the host's**, as SilverBullet follows one in the page: the editor tells its user a link was
  pressed (`EditorOptions.openLink`, the link's markdown and whether in a new tab: Ctrl, Cmd or the middle button), the
  plugin's binding follows it (shared/silverbullet/links.ts `followLink`: a wiki link's target from the space's root, a
  markdown link's from the page's folder, its section kept; a URL in a tab of its own; a new tab by its address). The
  peek closes first, as its Open does; a cell is left as by a press elsewhere. An Alt+press puts the caret there, its
  markdown shown, as on an embed. Without `openLink` a press puts the caret, as before.
- **A file's icon and menu are Silverware Assets'**: drawn before a link to a file of the space, as `decorateLinks`
  draws them in the page (its type's icon, the setting off a marker), its menu the page's (Show as, open, copy, Delete
  file…), what it changes written into the field's text (`EmbedEdit`). One method builds the menu for both
  (`linkMenu`), told how to write.
- **An escape** (`\[`) is drawn without its backslash where the caret is not on it, as SilverBullet draws it.

## One way through for what a plugin draws in a field

Silverware Editor, Assets and `shared/rendered.ts` are not on `main` yet (2026-11-16), so their API is changed, not
added to: what a plugin draws in another's field goes one way, `FieldDrawing` (shared/editor.ts: `embed`, `linkIcon`),
in place of the embed's alone:

- `EditorOptions.drawing` (was `embed`);
- Silverware Assets' API `fieldDrawing(page)` (was `drawEmbed(markdown, page)`);
- `shared/rendered.ts` `drawInFields(drawer)`, the drawer giving a page's `FieldDrawing` (was `drawEmbeds`);
- Silverware Database's `ModuleHost.fieldDrawing(item)` (was `drawEmbed`), Silverware Layout's `GridHost.fieldDrawing()`
  and `CellHost.drawing` (were `embeds`, `embed`); an image alone where Assets is not installed, as before.

## Steps

1. [x] The contract and the editor: `FieldDrawing`, `openLink`, the escape; unit tests.
2. [x] Silverware Assets: `linkMenu`, `editorLinkIcon`, `fieldDrawing`; `drawInFields`; unit tests.
3. [x] Silverware Database and Layout: the hosts, `followLink`, the init pages (Layout's `navigate`).
4. [x] UI tests in SilverBullet: the peek (a file's link's icon and menu, `\[` shown as `[`, a page's link followed, the
   panel closed) and a cell (a file's link's icon; a page's link followed once the cell's text is written into its own
   page); unit tests of the editor (a link's icon, a press followed, the escape), Assets (the icon, its menu writing into
   the field) and `followLink`; docs.
