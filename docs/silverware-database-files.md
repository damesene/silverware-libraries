# Silverware Database: Files & media

A property type of files and images, in the spirit of Notion's *Files & media*: several files in one value, shown as
small previews where the item is shown, a popup to manage them, a file opened in Silverware Assets' side panel, new
files uploaded through Silverware Assets' insert dialog. Planned 2026-11-16 with the user, reviewed against the code the
same day and again on 2026-11-18 after step 1's probe (their findings are in this plan). Built on 2026-11-18, steps 1 to 11
on the branch `feat/database-files`; each step's note says what it became where it differs from what was planned.

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
  written into the value by SilverBullet. **Probed in the 2.12.1 release (2026-11-18, step 1)**: the index takes each
  entry of a frontmatter list, and a single link (`cover: "[[…]]"`), as a link with its range (tags `link` and
  `relation`, `toTag: "document"`); *Document: Rename Document* rewrites them in the frontmatter as in the body;
  *Page: Batch Rename Prefix* of a database (`Databases/db-ab12` to `Databases/db-cd34`) moves its root page, its
  items and `files/`, and rewrites the items' values to the new paths; an item renamed or moved to another folder
  (*Page: Rename*) leaves `files/` where it is and its value unchanged, still right (the links are absolute).
- **A name SilverBullet cannot link** (its reference grammar, `plug-api/lib/ref.ts` `refRegex`: a path holds none of
  `@ # | < > $`, nor `[[` or `]]`): probed, `[[…/photo@2x.png]]` is no link in the index (`@` starts a position) and
  SilverBullet's own rename of the file does nothing. Such a name is refused where a file is picked (+ Add), and the
  names Assets offers for an upload avoid them (checked in step 3), as `[`, `]` do. The value is still read by a
  reading of its own (`domain/types/files.ts`), not the reference's, so a value written by hand with such a name shows
  the file rather than a cut name. It builds on the reference's (`domain/types/reference.ts`: `readReference`,
  `writeReference`, the same wiki links) and differs where a reference has none: an entry may be an address of the
  web, and a name is checked by the rules above (a check of its own, not `validateReferenceTarget`, which a page's
  reference keeps).
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
`shared/assets.ts` reaches gets its changelog entry at release. Built in step 3 (2026-11-18) as below; where it differs
from what was first planned, the built one is written here.

- `drawPreview?(target, page, box: { width, height }, signal): Promise<HTMLElement | null>`: a file's preview by its
  type's own renderer, its room the box, no frame, label, menu or settings' height; where its type keeps previews or is
  `costly`, only the one kept is drawn, none made anew (null: Database draws the icon); an image with no renderer of its
  type the browser's `<img>`; resolved once drawn (a renderer is async); what it started ends with `signal`. Not `fieldDrawing`:
  that draws as the page does (the view and height of the settings, the frame, labels), which a 28 px box cannot hold
  without Database styling Assets' classes, and it holds a registry subscription until aborted. It draws through the
  registry and the types' renderers as `decorate.ts` does (which type takes the file, its stored preview), sharing that
  code, not a copy of it.
- `showFile?(target, page)`: a file shown in Assets' side panel (its action `open-panel`, `builtin/panels.ts`, run without a frame as links
  already run their actions: `decorate.ts` `drawInto`). Its name says what it does: a caller wanting the click's
  action of the settings later gets a member of its own.
- `insertFiles?(given, { folder }): Promise<readonly string[] | undefined>`: the insert dialog for what an event
  gave (`given`: a snapshot `{ files, html, uriList, source }` read in the event (`source` "clipboard" or "drop": a
  pasted image is named by the time), so Assets finds an image's address of the web
  itself, `webUrlOf`; none: opened empty to upload, Files and Camera), the paths offered in `folder`, *Inserted as*
  hidden (its column and the all-files row: the dialog's `nameOnly`, each file drawn as the first view its type has); written as now (names apart from the space's, its progress panel), and
  resolved only once written, with the targets a link names (paths of the space, or addresses of the web where linked);
  undefined where cancelled. The write half of `host/silverbullet/insert.ts` (`writeChosen`, which `insertChosen`
  calls before `putIn`) and `index.ts` (`writeWithProgress`) split so a caller gets what was written without its being put in a page. Not ruled by
  `insert.enabled` (that setting is about SilverBullet's own pasting into pages). The dialog opened as an editor's
  companion always (the dialog's option `companion`, today set for a field of another plugin's alone), so Database's
  popup, which ends on its `focusout`, stays open under it.
- `deleteFiles?(paths): Promise<readonly string[]>`: files deleted from the space as *Delete file…* deletes one
  (`deleteFile` of `host/silverbullet/assets.ts`), the previews kept of them with them (`core/stored.ts`); no question
  asked (the caller asked it, naming them all); the paths not deleted given back, nothing said of them (the caller says). Without it a
  database's files deleted leave their kept previews behind, for *Clean up previews*.
- **Drops and pastes Assets leaves alone**: today Assets' document capture (`watchInserts`, `targetOf`) takes a drop on
  any widget of the page (a database's cell or card included: its search ends at `.cm-content`) and stops it, embedding
  the files beside the block. A generic mark in `shared/` (as `overwindow.ts` is), `data-silverware-takes-files`: an
  element so marked, or within one, is not Assets' (Database marks its cells of files, cards, the popup and the peek's
  rows). Fixed first, with an Assets UI test, as it already happens.

## Layers (silverware-database/src/isolation.test.ts holds them)

- **domain/types/files.ts, domain/types/builtin/files.ts**: the value's reading (`readFiles`, `writeFile`) and the type
  (`name: "files"`, `label: "Files & media"`, `lists: true`, `editor: "files"`, `look: "media"`, `groups: false`). Pure.
- **domain/types/type.ts**: `editor` and `look` widened by `"files"` and `"media"`; `groups?: false`, a type not offered
  in Group by (`core/groupmenu.ts` `groupable`); a board takes its columns from what Group by offers (its `groupBy:
  { required, prefer }`), so the one check keeps a files property out of both.
  `domain/types/custom.ts`: users' types may take `files` / `media` too (its `EDITORS`, `LOOKS`), documented.
- **core/view.ts, core/place.ts, core/module.ts**: `media` given by the binding through `PlaceOptions` into each
  place's `ViewHost`, and into the window's `ModuleHost`:
  - `draw(target, box: { width, height }, signal): HTMLElement` (an image, a preview, an icon and name),
  - `open(target)`,
  - `upload(database, given?): Promise<readonly string[] | undefined>` (the folder from the store, below),
  - `files(): Promise<readonly string[]>` (the space's files, for + Add),
  - `remove(paths): Promise<readonly string[]>` (files deleted, those not deleted given back).

  Optional: a host without it draws names and opens nothing. `valueNodes`, `fieldNodes` and `EditorHost` (a `Pick`,
  made by the peek's `editorHost()` too) take it. `ViewHost` is the API for users' views: `media` on it is a promise
  kept from then on (a MINOR release; changing it later breaks users' views), so it is kept small and documented in
  silverware-database.md (its examples run by `docs.test.ts`).
- **Lifetimes**: values are drawn synchronously and cells thrown away on each change, aborting nothing. What `draw`
  starts is ended by a signal the binding aborts once the element is out of the document (checked on the next change
  and by `index.ts`' tidy), so no preview redraws a detached element.
- **views/values.ts**: `look: "media"`: the strip, `+N`, each file a button (a click on it `media.open`, stopped so the
  cell's editor does not open).
- **views/fileseditor.ts** (`editor: "files"`, dispatched from `views/editors.ts`, which is long already): a popup of
  its own (`floatPanel` as the other editors): its list writes the
  value itself (no joined text through `parse`: an address or a name may hold a comma); + Add searches `media.files()`
  (the search list of the documents editor factored out into a small file of its own, shared by both, no new document
  offered); Upload by `media.upload`.
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
  `insertFiles`, `deleteFiles`), else Database's own images, SilverBullet's opening and its `space.deleteDocument`.
  The bridge has neither yet: the init page hands over pages alone (`listPages`), and the platform's `Space` is pages
  (`list`, `remove`); `listDocuments` and `deleteDocument` are added to the bridge for `media`, not to `Space`.
- **playground/database.ts**: a stand-in `media` over the memory store (images by URL, no upload).

## Layers on screen

Assets' side panel and Database's peek are both sheets (`--sw-layer-sheet`) over the same area: the one opened later
lies over the other. A press in Assets' panel does not close the peek (its `role="dialog"` is not beside it). A file
opened from the peek opens over it; closing it shows the peek again. Database's own panels over the peek (75) would
show over Assets' panel: checked in a UI test, the panel lifted where it must be.

## Files zoomed (2026-11-18, asked by the user after step 11)

Files zoom with the content as Silverware Assets' do (Silverware Layout's font zoom with files, `--sw-content-scale`,
`shared/contentscale.ts`): `media.draw` sets its box on the element as variables (`--swd-media-width`,
`--swd-media-height`, each `scaledPx`) and an image's fitted size as `scaledPx` too, so the browser sizes them anew as
the zoom changes, nothing drawn again; the style page reads the box from those variables alone (no size of its own: a
small line's height, a file's pill, the popup's rows, a card's cover). A preview of Assets' is given its room at the
scale of 1, as the contract has it. The same variables hold an image in its box before it has loaded: a large one in
the popup was drawn at its own size until its `load` sized it (reported by the user).

## Smaller in the peek and the popup (2026-11-18, asked by the user)

The peek's row draws files as a table's cell does (`small`: they took the whole panel); the popup's files at most 150 px
on their longer side, no name beside them (their title says it), and a ⋯ menu each in place of × (*View original* in a
new tab, *Download*, *Remove* from the value; `Media.url`).

## Next: sources in Silverware Assets' dialog, titles (decided with the user 2026-11-18, not built)

- **The peek's popup out of the properties' flow**: laid over the page as a table's editors are (`floatPanel`), under
  the row or over it where there is no room (over the content, over the item's name), its height the window's, its list
  alone scrolling.
- **A file's menu within the window**: opened under its ⋯ from its left edge, from its right edge where it would cut
  off, over it where there is no room under it.
- **Sources in Assets' insert dialog** (for a page too): one bar always shown, *Files…*, *Camera…* (touch), *Link*
  (a field under the bar: an address added as a row), *Space* (a search of the space's files, a few found under it);
  rows of two lines with a small picture (about 48 px, larger on a press): a file of the device its name, a web
  address *Kept* (Link / Save to space), a file of the space nothing to set; the foot says what happens
  (`1 to upload · 1 link · 1 from your space`, *Add 3*). A page's insert keeps *Inserted as*.
- **Titles**: every row may have one (a file of the device's behind *+ Title*); a web address's shown first. In a page
  an embed's alt / a link's text; in Database's value **B**: kept with the file, a space's file `[[path|title]]` (read
  already), a web address `[title](url)` (a form the value reads anew), the title shown in place of the name (its
  tooltip, its menu, the text sorted and filtered by).
- **Database's popup**: its files and **+ Add files…** alone (the dialog); without Silverware Assets the field of today
  in its place (an address, a file of the space). A link pasted on the open popup opens the dialog with it.

## Steps

1. **Probe** (2.12.1): a file named by a wiki link in a frontmatter list; the file renamed, the database renamed: are the
   links written anew? Done 2026-11-18: yes, both (*How a value is kept*); names with `@ # | < > $` cannot be linked.
2. **Drops Assets leaves alone**: the mark in `shared/`, Assets' `targetOf`, an Assets UI test (a drop on a database's
   cell is not Assets'). Done 2026-11-18: `shared/takesfiles.ts` (`markTakesFiles`, `takesFilesAt` an event, in a
   shadow root too), checked first in Assets' paste, dragover and drop; Assets' UI test marks a grid as the stand-in,
   as Database marks nothing yet: a drop and a paste on a real cell of files are Database's UI tests in step 8.
3. **Assets' API**: `drawPreview`, `showFile`, `insertFiles`, `deleteFiles` (the write half split, *Inserted as* hidden, names without
   `[ ] @ # | < > $`), unit and UI tests in Assets. Done 2026-11-18: a single bracket is refused in every name Assets
   offers now (a page's insert too: no wiki link can name it), Assets' `ui-tests/api.spec.ts`.
4. **The type and its value** (domain, `groups: false`, `custom.ts`), unit tests; offered in the properties' dialog. Done 2026-11-18:
   `domain/types/files.ts` (`readFile`, `readFiles`, `writeFile`, `validateFileTarget`, `fileName`, `typedFiles`: a typed
   text's links and addresses, a plain name refused as it may hold a comma), `domain/types/builtin/files.ts` (after
   Reference), `groups: false` read by `groupable` alone (`groupedBy` takes from it), its icon a paperclip. Until steps 6
   and 7 a value shows as its files' names and is edited as text. Links to files guessed as files, not references
   (`namesFile`: an extension other than `.md`, as SilverBullet tells them; `areFiles`), for a key outside the schema
   (`domain/loose.ts`) and a converter's links (`converters/infer.ts`).
5. **`media` through the core** (`PlaceOptions`, `ViewHost`, `ModuleHost`, `EditorHost`), the binding's (Assets, the
   file listing in the init page) and the playground's; the fallbacks without Assets unit-tested (the UI tests' space
   has every plugin). Done 2026-11-18: `core/media.ts` (`MediaSource` the binding's, `mediaHost` the core's, as
   `documents` and `mentions`; `media.remove` beside the plan's four), `host/silverbullet/media.ts`, the store's
   `filesFolderOf`, the playground's files pictures made of their names. Differs from *Sizes*: the box's numbers are
   the caller's (`draw(target, { width, height, min })`), and an image is sized in px once loaded (`fittedSize`); step 6
   decides whether a view takes them from the style page's variables.
6. **The look** in table, list, peek and the other views' lines; the click on a file. Done 2026-11-18: `views/values.ts`
   `valueNodes` / `fieldNodes` take `{ files: "small" | "large" }` (table, list, board's card lines small; the peek
   large, its pencil after the files; calendar and timeline none: their files' names). The sizes and the count of a
   small line are constants there (`FILE_BOXES`, `FILES_IN_LINE` 3), not the style page's variables: the image's size and
   a preview's room are reckoned in the script, which reads no CSS (nothing measured). An image smaller than its box is
   drawn larger to fit it. `ui-tests/files.spec.ts`.
7. **The popup editor**: remove, reorder (keys too), + Add, Upload. Done 2026-11-18: `views/fileseditor.ts`, opened by
   `editValue` for the editor `files` (a value that does not read as files edited as text). One field adds: words of a
   file's name (the space's files, `media.files()`), an address of the web, or a link typed; the references' search is
   not factored out, as what both share is `domain/folders.ts`' `folderSearch` and `foundBy` already. Its leaving is
   looked at a task after the focus goes (a control drawn anew loses it in between) and not while a grip drags (its row
   moves in the document); a press on its buttons keeps the focus where it is (a button pressed on its icon takes none).
   An upload written after the popup was left is added to the value as the popup wrote it.
8. **Paste and drop** on a cell, the popup, a card, the peek's row. Done 2026-11-18: `views/takefiles.ts` (`takeFiles`: the
   element marked, `shared/takesfiles.ts`, lit while files are dragged over it; `uploadInto`: the files added to the
   value as the store has it once written). A card's drop goes to the value of files whose line it falls on, else the
   first the view shows, else the database's first; a list's rows take none (no focus, no drop place of their own).
   Found by the UI test: another block of the database is drawn with a write only once the index has it, so a card
   dropped on just after showed the value before it and the write was refused (the file uploaded, its link lost):
   `ViewHost.current(item)`, the item as the store has it now, is what the files are added to. Without Silverware Assets
   a drop is still taken there and said (nothing put in the page).
9. **The board's cover** (*Card preview*). Done 2026-11-18: `views/builtin/board.ts` (`coverMenu` in ⋯'s view slot, the meta
   `cardPreview` in `propertyMeta`; a cover the first image of the value, a button opening it, drawn in a box of 320 × 160
   with 60 its least side and cropped by the style page to the card's width). Files dropped on a card with a cover go to
   its property. Its user docs with step 11.
10. **Files offered for deletion**: deleting a database (`core/deletedatabase.ts`) and an item ask about their files;
    the files an item alone names found by the store (every item's values of a files type read), deleted by
    `media.remove` (Silverware Assets' `deleteFiles`, its kept previews with them); Undo of the deletion does not bring
    the files back, the question says so. An item is removed from several places (the peek's *Delete*, a table's rows,
    each a `removeItem` change of a transaction), so the question is asked in one place, the core's, as it applies
    removals, and generically: a type tells what a removed value leaves behind (a member of its own, `leaves?`), the core
    knows no files. That logic is a file of its own in `core/` (what removed values leave, the question), not more of
    `core.ts`, which is long already. Done 2026-11-18: `PropertyType.leaves` (the files type's: its files of the space),
    `core/leftbehind.ts` (`leftBehind`, `namedFew`), `core.remove(database, items, documents?)` asking after the removal
    is written, `documents` the caller's (the place's and the peek's `media.remove`); the deletion dialog's *Also delete
    its uploaded files* (`DeleteDatabaseHost.files`, `DatabaseCore.filesFolderOf`), not ticked by default, deleted once
    the database is gone. A type of the user's leaves nothing (`leaves` is not taken from a definition).
11. **Docs**: silverware-database.md (the type, the cover, `media` of `ViewHost`), silverware-assets.md (the API), the
    CLAUDE.md of both. Done 2026-11-18: the users' pages say what a user sees (Assets' page: what it does for a database's
    files; its API for plugins in docs/silverware-assets.md, *Another plugin's files*).

Each step a commit with its tests (`ui-tests/` of Database for every pointer, key, paste and drop), deployed to the
local SilverBullet after the larger ones. A release proposed once it is whole (Database and Assets MINOR, the other
plugins `shared/assets.ts` reaches PATCH).
