# One name for each thing: Silverware Assets' views and settings, Silverware Layout's grid and alignment

Decided with the user 2026-11-16. What a user sees and what is written (markdown, settings, the API, a theme's
selectors) named alike, everything new on `docs/layout-assets`: Silverware Assets, PDF, DOCX, XLSX and Editor are on no
release, nor are Silverware Layout's grids, alignment and new settings. So nothing is kept for the old names: no alias,
no migration, no breaking change, no version. What is on `main` (Layout's `textWidth`, `guides`, `fontSize`,
`fontZoom.enabled`, `layout.width`) is not touched.

## Why

The view a user picks as **Original** was written `view: embed`, the **Card** `view: icon`; a card and a preview are
embeds too (`![[…]]`), and "original" said "its own size" or "the source file", while it is the file drawn whole in
the page (a player, a viewer), a width dragged and a label of its own. Other names said one thing in the settings and
another in the menus.

## The names

- **Views**: Link · Card · Preview · **Full** in the interface; `card`, `preview`, `full` in the markdown
  (`{ view: full }`), the settings (`views`, `insert.as`), the API (`AssetView`, a type's `views.full`,
  `render("full")`, `Capabilities`), the CSS (`data-swa-view="card|preview|full"`, the settings window's
  `data-swa-look="full"`) and Silverware Layout's kinds (`File: full`, the key `silverware-assets/full`). The word
  "embed" keeps its meaning of markdown's `![[…]]` against a link (`shared/rendered.ts`, `removeEmbed`, `toEmbed`,
  `data-swl-embed`).
- **Assets' settings by view**, as the Appearance tab:
  ```lua
  silverware.assets.preview = { width, height, types = { pdf = { width, height } }, labels = { default, types } }
  silverware.assets.full = { height, labels = { default, types } }
  silverware.assets.card = { fields = { "icon", "name" } }
  silverware.assets.link = { fields = { "icon" } }
  ```
  in place of `heights`, `previews`, `labels`, `originalLabels`, `card` (a list), `linkIcons`; those written as none on a
  save (taken out of CONFIG). `views`, `actions`, `insert`, `storePreviews`, `previewFolder` stay.
- **Actions** by their labels: `open-panel` (Open in side panel, was `peek`), `open-enlarged` (Open enlarged, was
  `popover`); `open-tab`, `download`, `copy-image` as they are.
- **A file's type on its element**: `data-swa-type` (was `data-swa-asset`).
- **The previews' folder**: `_silverware-assets-previews` (was `_silverware-asset-preview`).
- **Layout's alignment for themes**: `data-swl-align="left|center|right"`, `data-swl-align-holder` (was
  `data-swl-anchor="start|center|end"`, `data-swl-anchor-holder`), as `align` and the settings say.
- **A grid's cell**: "cell" in the interface and the docs wherever one cell is meant (its grip's menu: Clear cell…,
  Delete cell…), as the markdown's `<cell>` (a grid of four cells in two columns has two rows: "column 2" was a cell);
  "column" only where columns are meant (`columns=`, the lines between them).
- **A grid's least width of a cell** (with `columns="auto"`): `min-width="m"` (was `min`), as the interface's "Min width".
- **Commands and toolbar actions alike**: `Silverware Layout: Wrap in grid` and `Silverware Layout: Move to grid` (were
  "Wrap in new grid", "Move into existing grid"), the toolbar's `layoutWrapInGrid`, `layoutMoveToGrid`.

## Left as they are (looked at)

Grids' `width` and `align` (a tag's own attributes, as an embed's `{ align }`); `syntaxMode.*` (alike in Assets and
Layout); the API between plugins (`scales`, `room`, `unsized`, `drawInFields`); the settings model's own names.

## Steps

1. [x] Assets: views, settings by view, actions, `data-swa-type`, the previews' folder; `shared/assets.ts`; PDF, DOCX,
   XLSX's `views.full`; the init and library pages, CLAUDE.md, the changelog's unreleased entry; unit and UI tests.
2. [x] Layout: `data-swl-align`, cell in the interface, `min-width`, the commands and toolbar actions, Assets' kind in
   its docs; unit and UI tests.
3. [x] Build, verify, the UI tests of Assets, Layout, PDF, DOCX, XLSX against SilverBullet.
4. [x] Review (independent agent), its findings fixed.
5. [ ] The user's own space: `view: embed` / `view: icon` in pages, Assets' and Layout's settings saved again, the old
   previews' folder deleted.

## Findings
- **Assets**: the views renamed in `shared/assets.ts`, the settings model (`model/settings.ts`: `preview`, `full`,
  `card.fields`, `link.fields`; the former keys written as none), the decorator, the settings window, the insert dialog,
  the provider's kind (`full`, "File: full"), the actions, the style page; DOCX and XLSX register `views.full`. The
  settings window's rows of types are marked `data-swa-row-type`, so `data-swa-type` is a drawn file's alone (the style
  page's `[data-swa-type]` rules would have reached the dialog's rows). The glyph `VIEW_ORIGINAL` is `VIEW_FULL`. The
  init page's settings schema lists `insert`, which it had left out. The dated docs keep their words, a note in
  docs/silverware-assets.md says what they are now.
- **Layout** (done by an agent, read after): `data-swl-align`; "cell" in the grip's menu and its confirmations, the
  library page and the living docs (the class `.swl-grid-column-grip` is `.swl-grid-cell-grip`, a theme's selector
  named alike); `min-width`; the commands and toolbar actions (Silverware Toolbar's `surface.spec.ts` with them); its
  pages' "a file shown full". Kept "column" where columns are meant (`columns=`, the dividers, widths, Split's columns).
- `npm run verify` passed (268 files, 2756 tests).
- **UI tests against SilverBullet** (Assets, Layout, PDF, DOCX, XLSX, Toolbar's `surface.spec.ts`): 159 passed, 2
  skipped, 1 flaky: "a file aligned right: its handle beside its left edge…" measured the image as soon as it showed,
  and a frame drawn anew a moment later had gone (`boundingBox` null). It waits now for the image aligned (Layout's
  `data-swl-align="right"`) and measures it once drawn: the two alignment tests ten times each, 20 passed.
- **Review** (independent agent): one bug. A card's or a link's fields all hidden are written `fields = {}`, and an empty
  Lua table comes back from CONFIG as an object, not a list (as Silverware Database's notes say), so the link's icon came
  back after a reload. Read as none now (`readAssetSettings`), a unit test of it, and the UI test of a link's icon
  hidden loads the page again: it failed without the fix, passed with it (its file five times over, 195 passed).
  Leftovers fixed: the previews' folder on DOCX's and XLSX's pages, "shown full" in REPO.md, "cell" where Assets', the
  Editor's and the Toolbar's pages said a grid's column (the Toolbar's line is new on this branch), comments, sample
  metadata of the markdown tests. `npm run verify` passed after (268 files, 2756 tests).
