# Silverware Database: Files & media

A property type of files and images, in the spirit of Notion's *Files & media*: several files in one value, shown as
small previews where the item is shown, a popup to manage them, a file opened in Silverware Assets' side panel, new
files uploaded through Silverware Assets' insert dialog. Planned 2026-11-16 with the user, reviewed against the code the
same day (its findings are in this plan). Nothing built yet.

## Decisions (the user's, 2026-11-16)

- **Uploading is in the first version**, not later: Ctrl+V and a drop of files, through Silverware Assets' insert
  dialog (the same as in the editor), reused through its API.
- **Uploaded files go to `<database>/files/`**: the root page's own folder, `<folder>/db-<id>/files/<name>`. `files`,
  not `_files`, confirmed after the review: an item named `files` would show the uploads as its subpages in
  SilverBullet's tree, which the user accepts.
- **An image of an extreme aspect ratio is cropped**, centred (CSS `object-fit: cover`), never stretched: fitted into
  its box (a max width and a max height), and where its shorter side would fall under the box's minimum it is cropped
  instead of shrunk further. The whole image shows in the popup and the side panel.
- **A board's card cover is in the first version**: the board's setting *Card preview* names a Files & media property,
  the first image of an item's value drawn over its card.
- **A click on a file always opens it in Silverware Assets' side panel** in the first version, whatever Assets' setting
  for a click on a file in a page says (the user's choice: to be seen in use, then decided).
- **Ctrl+V on a cell too**, not only in the popup and the peek: the cell of a files property focused takes a paste
  (below, *What the user sees*).
- **Files left behind are offered for deletion as something is deleted**: deleting a database asks whether its
  `files/` goes too; deleting an item asks whether its files go too, those in its folder `files/` that no other item's
  value names (listed in the question). Taking a file out of a value, or undoing an upload, leaves the file (it may be
  named elsewhere; *Undo* would otherwise lose it).

## What the user sees

- **A new type, Files & media** (`files`), offered with the other types in the properties' dialog. Not offered in
  Group by (a list of files is no group), nor taken by a board as its columns.
- **In a table's cell and a list's row**: the files as small previews side by side in a strip of fixed height; past a
  fixed number (a CSS variable, 3 by default) the rest summed up as `+N`. An image as itself; a PDF, DOCX or XLSX as its
  preview where its plugin is installed and a preview is kept in the space (none drawn anew in a list of many: its
  icon then); any other file its type's icon and name.
- **A click on a file** (a button: in the cell, the popup, the peek, a card's cover): opened in Silverware Assets' side
  panel. Without Silverware Assets: a file of the space opened as SilverBullet opens it, an address in a new tab.
- **A click in the cell beside the files**: a popup with larger previews of every file. In it: × on each, its grip to
  reorder (by the pointer, Alt+↑ ↓ from the keys), **+ Add** (a file of the space, searched by name, or an address of
  the web typed), **Upload** (Silverware Assets' dialog opened empty, with Files and on a touch screen Camera, as
  *File: Upload*). Every control reachable by Tab.
- **A drop of files** on a cell, a card, the popup or the property's row in the peek, **Ctrl+V** on a cell, in the
  popup and on the peek's row: Silverware Assets' dialog with those files (a name each, a preview, an image of the web linked at its
  address or kept), its *Inserted as* hidden (a property keeps a link, not a view), the upload told by its panel; the
  files added at the end of the value as it is once they are written.
- **The peek**: the property's row draws the previews larger, its pencil to edit as a link's row has; the same click,
  popup, paste and drop.
- **A board's card**: with *Card preview* set (the board's menu, as the calendar's *Dates by*), the first image of that
  property over the card at the card's width. Other views' lines (calendar, timeline) show a files value as its
  files' names.
- **Without Silverware Assets**: files picked and addresses typed work, images drawn by Database itself, other files
  as icon and name; no upload (its button says Silverware Assets is needed), no side panel.

## How a value is kept

In the item's frontmatter, a list, each entry a wiki link to a file of the space, or an address of the web as written:

```yaml
photos:
  - "[[Databases/db-ab12/files/sunset.jpg]]"
  - "[[Docs/report.pdf]]"
  - "https://example.com/cat.png"
```

- Wiki links, so the index takes them for links: the file lists the item among its links, and a rename of the file is
  written into the value by SilverBullet. From the fork's source (`plugs/index/refactor.ts`): `renameDocument` updates
  backlinks; renaming a database (`renamePrefixCommand`) moves the documents under it, `files/` with them; renaming an
  item (`renamePage`) leaves `files/` where it is. Whether the 2.12.1 release rewrites links in frontmatter lists is
  step 1's probe.
- Read by a reading of its own (`domain/types/files.ts`), not the reference's: a reference's target is cut at `#` and
  `@` (`linkedDocument`), which a file's name may hold (`photo@2x.png`). A name with `[`, `]` or `|` cannot be a wiki
  link: refused where picked, and Assets' names offered for an upload must avoid them (checked in step 3).
- One link alone, not in a list, reads too (written by hand). Filtered and sorted by the files' names (`text`).

## Sizes

Fixed boxes, CSS variables of the style page (`--swd-media-*`), a theme's to change; nothing measured, nothing
written into a page. Rows and columns of a table size to their content, so the strip's height and its count are set,
not taken from the row.

| Where | Box (max) | Shorter side at least, else cropped |
| --- | --- | --- |
| A table's cell, a list's row | 28 px high × 84 px | 14 px |
| A board's card (cover) | the card's width × 160 px | 60 px |
| The popup, the peek | 240 × 180 px | 90 px |

An image is Database's own `<img>` (its URL from the binding, as `shared/silverbullet/embedimage.ts` makes it;
`loading="lazy"`, `decoding="async"`): drawn at its proportions within the box, and once loaded, one whose shorter side
would be under the minimum gets the minimum on that side and `object-fit: cover`. A file that is no image: Assets'
preview at the box's size (below), else its icon and name.

## Silverware Assets' API (shared/assets.ts)

Optional members, the version unchanged (an older Assets without them: the stand-ins above). Each plugin whose bundle
`shared/assets.ts` reaches gets its changelog entry at release.

- `drawPreview?(target, page, box: { width, height }, signal): HTMLElement | null`: a file's preview by its type's own
  renderer, its room the box, no frame, label, menu or settings' height; the stored preview where the type keeps one,
  none drawn anew where `costly` (null: Database draws the icon); what it started ends with `signal`. Not `drawEmbed` (now `fieldDrawing`):
  that draws as the page does (the view and height of the settings, the frame, labels), which a 28 px box cannot hold
  without Database styling Assets' classes, and it holds a registry subscription until aborted.
- `showFile?(target, page)`: a file shown in Assets' side panel (its action `peek`, run without a frame as links
  already run their actions: `decorate.ts` `drawInto`). Its name says what it does: a caller wanting the click's
  action of the settings later gets a member of its own.
- `insertFiles?(given, { folder, page }): Promise<readonly string[] | undefined>`: the insert dialog for what an event
  gave (`given`: a snapshot `{ files, html, uriList }` read in the event, so Assets finds an image's address of the web
  itself, `webUrlOf`; none: opened empty to upload, Files and Camera), the paths offered in `folder`, *Inserted as*
  hidden (its column and the all-files row); written as now (names apart from the space's, its progress panel), and
  resolved only once written, with the targets a link names (paths of the space, or addresses of the web where linked);
  undefined where cancelled. The write half of `host/silverbullet/insert.ts` (`insertChosen`, `putIn`) and
  `index.ts` (`uploadChosen`) split so a caller gets what was written without its being put in a page. Not ruled by
  `insert.enabled` (that setting is about SilverBullet's own pasting into pages).
- **Drops and pastes Assets leaves alone**: today Assets' document capture (`watchInserts`, `targetOf`) takes a drop on
  any widget of the page (a database's cell or card included: its search ends at `.cm-content`) and stops it, embedding
  the files beside the block. A generic mark in `shared/` (as `overwindow.ts` is), `data-silverware-takes-files`: an
  element so marked, or within one, is not Assets' (Database marks its cells of files, cards, the popup and the peek's
  rows). Fixed first, with an Assets UI test, as it already happens.

## Layers (silverware-database/src/isolation.test.ts holds them)

- **domain/types/files.ts, domain/types/builtin/files.ts**: the value's reading (`readFiles`, `writeFile`) and the type
  (`name: "files"`, `label: "Files & media"`, `lists: true`, `editor: "files"`, `look: "media"`, `groups: false`). Pure.
- **domain/types/type.ts**: `editor` and `look` widened by `"files"` and `"media"`; `groups?: false`, a type not offered
  in Group by (`core/groupmenu.ts` `groupable`) nor taken as a board's columns (`board.ts` `groupedBy`'s fallback).
  `domain/types/custom.ts`: users' types may take `files` / `media` too (its `EDITORS`, `LOOKS`), documented.
- **core/view.ts, core/place.ts, core/module.ts**: `media` given by the binding through `PlaceOptions` into each
  place's `ViewHost`, and into the window's `ModuleHost`:
  - `draw(target, box: { width, height }, signal): HTMLElement` (an image, a preview, an icon and name),
  - `open(target)`,
  - `upload(database, given?): Promise<readonly string[] | undefined>` (the folder from the store, below),
  - `files(): Promise<readonly string[]>` (the space's files, for + Add).

  Optional: a host without it draws names and opens nothing. `valueNodes`, `fieldNodes` and `EditorHost` (a `Pick`,
  made by the peek's `editorHost()` too) take it. `ViewHost` is the API for users' views: `media` documented in
  silverware-database.md (its examples run by `docs.test.ts`).
- **Lifetimes**: values are drawn synchronously and cells thrown away on each change, aborting nothing. What `draw`
  starts is ended by a signal the binding aborts once the element is out of the document (checked on the next change
  and by `index.ts`' tidy), so no preview redraws a detached element.
- **views/values.ts**: `look: "media"`: the strip, `+N`, each file a button (a click on it `media.open`, stopped so the
  cell's editor does not open).
- **views/editors.ts**: `editor: "files"`, a popup of its own (`floatPanel` as the other editors): its list writes the
  value itself (no joined text through `parse`: an address or a name may hold a comma); + Add searches `media.files()`
  (the search list of the documents editor factored out and shared, no new document offered); Upload by `media.upload`.
  Assets' dialog is the editor's companion (`COMPANION_ATTRIBUTE`, opened with `companion: true`), so the popup does not
  finish on the focus going to it; what comes back is added to the item as it is then (read again by its key), not as
  it was as the popup opened.
- **views/builtin/board.ts**: the cover; *Card preview* as the calendar's *Dates by*: `propertyMeta: ["cardPreview"]` on
  the board's definition (a key renamed is followed by `placestate.ts`), `host.getMeta` / `setMeta`, offered in the
  board's `menu` (`menu.slot.view([menu.submenu(…)])`, as `views/spans.ts`' `spanMenu`), among the Files & media
  properties. A card is not focusable: a drop on it, no paste.
- **A paste on a cell**: a table's cell is focused by Tab (a `td` with a tabindex; a click opens its editor at once, the
  popup, which takes the paste itself). The cell of a files property listens for `paste` while focused, the browser's
  clipboard read in the event (`{ files, html, uriList }`), and hands it to `media.upload`; a paste with no file and no
  image's address in it does nothing there (a text pasted into a files value is no file). A list's row the same where
  its value is focusable; checked in a UI test that SilverBullet's editor does not take the paste first (the focus in
  the widget, not in a line of the page).
- **modules/peek/panel.ts**: the property's row as a cell's, larger; its pencil as a link's row has; paste and drop.
- **store/**: a database's files' folder, `databaseDocumentOf(id)` and `/files`, the store's alone.
- **host/silverbullet/ and index.ts**: `media` made of Silverware Assets' API (`drawPreview`, `showFile`,
  `insertFiles`) and the init page's file listing (SilverBullet's `space.listDocuments`, handed over by the bridge),
  else Database's own images and SilverBullet's opening.
- **playground/database.ts**: a stand-in `media` over the memory store (images by URL, no upload).

## Layers on screen

Assets' side panel and Database's peek are both sheets (`--sw-layer-sheet`) over the same area: the one opened later
lies over the other. A press in Assets' panel does not close the peek (its `role="dialog"` is not beside it). A file
opened from the peek opens over it; closing it shows the peek again. Database's own panels over the peek (75) would
show over Assets' panel: checked in a UI test, the panel lifted where it must be.

## Steps

1. **Probe** (2.12.1): a file named by a wiki link in a frontmatter list; the file renamed, the database renamed: are the
   links written anew? Its answer recorded here.
2. **Drops Assets leaves alone**: the mark in `shared/`, Assets' `targetOf`, an Assets UI test (a drop on a database's
   cell is not Assets').
3. **Assets' API**: `drawPreview`, `showFile`, `insertFiles` (the write half split, *Inserted as* hidden, names without
   `[`, `]`, `|`), unit and UI tests in Assets.
4. **The type and its value** (domain, `groups: false`, `custom.ts`), unit tests; offered in the properties' dialog.
5. **`media` through the core** (`PlaceOptions`, `ViewHost`, `ModuleHost`, `EditorHost`), the binding's (Assets, the
   file listing in the init page) and the playground's; the fallbacks without Assets unit-tested (the UI tests' space
   has every plugin).
6. **The look** in table, list, peek and the other views' lines; the click on a file.
7. **The popup editor**: remove, reorder (keys too), + Add, Upload.
8. **Paste and drop** on a cell, the popup, a card, the peek's row.
9. **The board's cover** (*Card preview*).
10. **Files offered for deletion**: deleting a database (`core/deletedatabase.ts`) and an item ask about their files;
    the files an item alone names found by the store (every item's values of a files type read), deleted through the
    platform's space; Undo of the deletion does not bring the files back, the question says so.
11. **Docs**: silverware-database.md (the type, the cover, `media` of `ViewHost`), silverware-assets.md (the API), the
    CLAUDE.md of both.

Each step a commit with its tests (`ui-tests/` of Database for every pointer, key, paste and drop), deployed to the
local SilverBullet after the larger ones. A release proposed once it is whole (Database and Assets MINOR, the other
plugins `shared/assets.ts` reaches PATCH).
