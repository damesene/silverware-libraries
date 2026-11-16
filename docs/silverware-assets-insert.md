# Silverware Assets: inserting files (plan)

Files pasted (Ctrl+V), dropped, or uploaded are put into the page by a dialog of Silverware Assets in place of
SilverBullet's prompts: each file's name and how it is inserted (a link, a card, a preview, the original), shown as it
will be in the page. Decided with the user on 2026-11-15; nothing is implemented yet (the user starts it).

## What SilverBullet does today

Seen in SilverBullet's main (2026-11-15, d:\git\silverbullet: `client/codemirror/editing/editor_paste.ts`,
`plugs/editor/upload.ts`). 2.12.1, which the UI tests run, is to be checked against it (step 1).

- **A paste or a drop of files** into its editor (`EditorView.domEventHandlers`):
  - A file of the clipboard without a name is named by the date and time, `2026-11-15_13-09-48.<ext>`, the extension
    the MIME type's subtype (`localDateString(new Date())`, the `T` a `_`, the `:` a `-`).
  - A dropped file keeps its name.
  - The path is asked by a prompt ("File name for pasted document"), offered in the page's folder
    (`resolveMarkdownLink(currentPath, name)`).
  - A path taken is asked again ("A file with that name already exists…"); the same path replaces the file.
  - A file over `maximumDocumentSize` (MiB, SilverBullet's config, 10 by default) is refused.
  - It writes `![[path]]` for an image, `[[path]]` for anything else, at the cursor. A drop's place is not taken (a TODO
    of theirs).
  - It takes the first file alone.
  - The event `silverbullet:upload-files` (its `detail.files`) goes the same way.
- **File: Upload** (the toolbar's paperclip, `/upload`, the File menu's Insert File…): a plug's command. It opens a
  picker for one file (`editor.uploadFile(accept, capture)`), asks its path by the same prompts, and inserts
  `editor.insertAtCursor`. It is no event of the page: it cannot be taken as a paste is (step 1 probes how to take it).

## Found in SilverBullet's source (step 1, 2026-11-15: its tag 2.12.1 and main)

- **The same in both**: `client/codemirror/editor_paste.ts` (main: `editing/editor_paste.ts`) and
  `plugs/editor/upload.ts`; the event `silverbullet:upload-files` is in 2.12.1 too.
- **A paste** with `text/html` in the clipboard is HTML made markdown (an image copied from a web page: a link to its
  URL); without it, the first file of the clipboard is uploaded. A paste with HTML is left to SilverBullet: files are
  taken where the clipboard has neither `text/html` nor `text/plain`.
- **A command of Space Lua replaces a plug's of the same name** (`client/plugos/hooks/command.ts` `buildAllCommands`:
  "Script commands come last — they always win over built-ins and plugs"; its `run` replaces the plug's). *File: Upload*
  is taken so: the toolbar's paperclip, `/upload` and the File menu's Insert File… invoke it by its name. With the
  setting off, it runs SilverBullet's own (`system.invokeFunction("editor.uploadFile")`).
- No command of Silverware Assets' own: *File: Upload* replaced is the one (the user's choice: none of its own where
  SilverBullet's can be replaced).

## Decisions (the user's, 2026-11-15)

1. **A setting of its own, "Insert as"**, beside *Show as* in the settings window's Files tab, the same shape (all
   files', and a type's own). Its values are *As shown* (the default: as *Show as* says), *Link*, *Card*, *Preview*
   and *Original*. *Show as* stays how an embed without its own view is shown; *Insert as* is what is written as a
   file is inserted. A link is no embed, so it has no place in *Show as*.
2. **What is written**:
   - *Link*: `[[path]]`.
   - *Card*, *Preview* or *Original*: `![[path]]`.
   - A view other than the one *Show as* gives the type is written in the embed's metadata, as a file's menu writes
     it (`![[path|||{ view: icon }]]`).
   - The same view as *Show as* is written as none, so a later change of *Show as* changes it too (as an embed typed
     by hand).
3. **Several files at once**: one dialog, a row each, and a choice for all of them at once.
4. **Pasted, dropped and uploaded** go by the dialog: *File: Upload* (replaced: the toolbar's button, `/upload` and the
   File menu with it; no command of Silverware Assets' own). On a phone a file may be picked or a photo taken with the
   camera.
5. **Where a file is kept**: as SilverBullet keeps it. The page's folder, the name editable, a name taken offered to
   replace or as another name.
6. **The original in the dialog**:
   - It is at most 320 px high and as wide as the dialog.
   - A type whose original is costly to draw (a document parsed whole in the page's script: DOCX, XLSX) says so in
     its contract (step 3). Its original over 20 MB is drawn live only on a click (*Show here*).
   - The browser's own media (an image, a PDF, a video, audio) is drawn whatever its size.
   - No preview is kept in the space for the dialog (`RenderContext.stored` none).
7. **It can be turned off**: a setting, on by default. Off, nothing is taken: SilverBullet's paste, drop and upload
   work as before.

## The dialog

- **Title**: *Insert files* (one file: *Insert file*). Buttons *Insert* and *Cancel*; Enter inserts, Esc cancels.
- **A row per file**:
  - **Its path**: a field, in the page's folder, the name as above. A name of the clipboard's: the date and time; two in
    the same second: `-1`, `-2` after it.
  - **What is wrong with it**, under the field:
    - A name SilverBullet would refuse: why, and *Insert* is off until it is changed.
    - A path taken: *Replace* or *Keep both* (the name given `-1`).
    - Too large: the row left out, and why.
  - **Insert as**: a row of choices, *Link*, *Card*, *Preview*, *Original*; the setting's chosen first.
  - **The file as it will be**: drawn by its type as the page draws it, its label as set, at most 320 px high.
- **For all** (changed 2026-11-15, the user's): with more than one file, a row of choices above them sets every row's
  *Insert as*, one set by hand too; it shows the choice the rows share, none where they differ.
- **On a phone** it is a sheet over the whole screen, as the settings window is there, with the rows one under another.
- **Uploading** (step 6): the dialog opened empty, with **Files** (several) and **Camera** (`capture="environment"`, on a
  touch screen alone); the files picked are rows of it. A photo of the camera, named `image.jpg` by the phone, is named
  by the date and time.

## How

- **Where**: Silverware Assets.
  - `ui/insertdialog.ts`: the dialog.
  - `core/insert.ts` (pure): names, paths, what is written.
  - `host/silverbullet/insert.ts`: taking the events, writing the file, putting the markdown in.
  - The settings: `model/settings.ts` and the Files tab.
- **Taking a paste or a drop** (`host/silverbullet/insert.ts`):
  - A listener of the document's capture takes `paste`, `dragover` and `drop` of files before SilverBullet's editor.
  - It takes files where the clipboard has no plain text. Copied from a document (Word gives an image of the text
    beside it), text stays text and goes to SilverBullet.
  - It takes them in the page's editor, and in a field of another plugin (a grid's cell: Silverware Editor). That
    field is found by `surfaceOf` (`shared/editor.ts`), its markdown put in through its `EditingSurface`, never
    through another plugin's code.
  - The event `silverbullet:upload-files` is taken the same way.
- **A drop's place**: the drop's point made a DOM position (`document.caretPositionFromPoint`) and that a position of
  the text by `positionOf` (`host/silverbullet/editorposition.ts`, the one exception to SilverBullet's internals that
  is allowed: no new one). Where none is found: the cursor.
- **Writing**:
  - Each file by the space's API (`space.writeDocument`, handed over by the init page).
  - Then the markdown in one edit:
    - A paste replaces the selection.
    - Several embeds go one under another (a line each).
    - Several links go on one line, a space apart.
  - A file written before a later one fails is said (a notification), not taken back.
- **The file drawn before it is written**:
  - An `Asset` of kind `file` with its path to be and a `blob:` URL of the file in memory.
  - Drawn by the registry's type for the view chosen, through the same rendering as the page's (`decorate.ts`'s
    renderer of a view, its label).
  - The URLs freed as the dialog closes.
  - The types fetch `asset.url`, so a `blob:` URL is all they need (to check for each: step 3).
- **The settings**:
  - `silverware.assets.insert`: `{ enabled = true, as = { default = "shown", types = {} } }`, in Assets' own block of
    CONFIG as its other keys.
  - Values `shown`, `link`, `icon`, `preview`, `embed`.
  - The Files tab:
    - *Paste, drop and upload files through Silverware Assets*, a box.
    - *Insert as*, a column beside *Show as*.

## The plan's review (2026-11-15), taken in

- **SilverBullet's facts corrected**:
  - *File: Upload* asks "File name for uploaded document", checks by `isValidPath` (a paste's first prompt by the
    stricter `isValidName`).
  - It writes a link in the style of `defaultLinkStyle` (wikilink or `[path](encoded)`) and inserts only where the
    current editor is the page's.
  - A paste inserts at `selection.main.from`, the selection kept: ours replacing it is new.
  - A paste with `text/html` (Shift not held) is HTML made markdown, its files never looked at: Chrome's *Copy image*
    (a PNG and an `<img>`) gives `![](https://…)`, nothing stored.
  - `silverbullet:upload-files` is sent by no part of SilverBullet: an API for desktop shells (its commit a6264532).
  - The extension of the MIME type's subtype is lossy (`svg+xml`, `jpeg`, `undefined`): `core/insert.ts` maps types to
    extensions.
  - The command replaced keeps the plug's `menu`. Script commands get no read-only filter: the override has a guard of
    its own. Off, it runs `system.invokeFunction("editor.uploadFileCommand", {})` (the manifest's key, its context
    first). Another library defining *File: Upload* after it wins.
- **Where it is taken**:
  - The page's editor is found by SilverBullet's elements in `host/silverbullet/` (not `surfaceOf`: Silverware
    Editor's knows its own editors alone), told apart from SilverBullet's prompt's and palette's CodeMirrors.
  - A grid's cell field by `surfaceOf`, with Silverware Editor's API handed over by the init page (`editorsOf`; the
    stand-in's `<textarea>` has no surface: a file pasted there is SilverBullet's or nothing's).
  - `EditingSurface` gets an optional `readOnly`.
- **The events**:
  - A `DataTransfer` is read in the event alone and `preventDefault` is synchronous: the files copied and the decision
    taken before any `await`, from what is known then (the setting, the surface, read-only, cached).
  - A drop is taken where its `types` have `Files` alone: SilverBullet's tree drags and Silverware Layout's text drags
    left; the desktop app's drop of a file already in the space (`silverbulletDesktop.resolveSpaceFileDrop`) left to
    SilverBullet.
  - `dragover`: `preventDefault` and `dropEffect = "copy"` where a drop will be taken, never stopped (Layout and
    CodeMirror use it).
  - `silverbullet:upload-files` is dispatched on the document: a capture listener and `stopImmediatePropagation`.
  - Not taken in fenced code or the front matter.
- **A drop's place**: `posAtCoords(x, y)` of SilverBullet's editor added to `host/silverbullet/editorposition.ts`
  (still the one file of SilverBullet's internals; `assets.spec.ts` checks it by name). Not `caretPositionFromPoint`:
  older Safari lacks it. A drop on a widget (an embed, a grid): after it.
- **What is written**:
  - "The same view as *Show as*" compares with the view configured (`views.types[type] ?? views.default`), as
    `decorate.ts` does, not the one drawn.
  - A view the type cannot draw is not offered (`can`).
  - The markdown is put in as *Insert* is pressed, at the selection then, on the page then: another page open meanwhile,
    the files written are said and their markdown offered to copy.
  - In a table's row or mid-line, files a space apart; in a list's item, its lines indented as its continuation.
  - One edit, one undo step; undo leaves the files written (as SilverBullet does).
  - Nothing is written before *Insert*: Cancel writes nothing.
- **Names**:
  - Taken apart across the whole batch (several iOS photos are `image.jpg`), case alike (a disk that does not tell
    case), the first free `-N` against the space and the other rows, again as one is edited.
  - A name SilverBullet would refuse is offered cleaned (its characters taken out, else `file.<ext>`), not blocked.
    SilverBullet's rules (`plug-api/lib/ref.ts`) are copied into `core/insert.ts`, cited, tested.
  - A dropped `.md` becomes a page (`writeDocument` writes it so).
- **The size**: `maximumDocumentSize` read through `getConfig`. Its default is 10 MiB, under the 20 MB of a costly
  draw: the guard counts where the limit was raised.
- **The contract's flag**: costly to draw in any view (a DOCX's or XLSX's preview parses it whole too), not the
  original alone; one costly draw at a time across the rows (`shared/reads.ts`' turns).
- **Drawing an unwritten file**: size and date from the `File`, not `host.fileInfo` (a path replaced would show the old
  file's). The original by the read-only path of a cell's field (`editorEmbed`, `plainMedium`), not SilverBullet's
  widget. Videos do not play by themselves. HEIC that Chrome cannot draw: its card.
- **The dialog**: `role="dialog"`, `aria-modal`, titled, the focus kept in it and given back to the editor;
  *Insert as* a `radiogroup` with arrow keys; a row's problem tied to its field (`aria-describedby`), said; Enter
  inserts where the focus is on no button or choice. *Camera*: `accept="image/*"` with `capture="environment"`. Picked
  in the dialog (the picker's user activation kept).
- **The steps**: step 1 asks no more about *File: Upload* (answered); it probes whether CodeMirror runs its handlers
  for an untrusted `ClipboardEvent` (the "setting off" test), a drop on a widget, read-only. The tests add: *File:
  Upload* taken and off, Cancel, a write failing in a batch, the drop's place, a paste in a fenced block, the upload
  event, read-only, Camera, names taken apart in a batch. The init page's changes (Silverware Editor's API, the
  selection, `maximumDocumentSize`, the command) and the isolation tests' are steps of their own.

## Decided after the review (the user's, 2026-11-15)

1. **An image copied from a web page** goes into the dialog: kept in the space. Taken where the clipboard's HTML holds
   that image alone (no text); a part of a page with text is still SilverBullet's (HTML made markdown).
2. **A file that is no image** is inserted *as shown* too (by default *Original*: `![[file.pdf]]`); a link where
   *Insert as* says so, for all files or a type.
3. **A link is written in SilverBullet's `defaultLinkStyle`** (`[[file.pdf]]`, or `[file.pdf](file.pdf)` where it is
   set so), as its *File: Upload* writes it. An embed is always `![[…]]`: it alone holds Silverware Assets' view.

## Steps

1. **Probes** in SilverBullet 2.12.1 and main:
   - Whether a capture listener of the document takes a paste and a drop of files before SilverBullet's editor, its
     handlers not run (`preventDefault`, `stopPropagation`).
   - Whether 2.12.1 has the event `silverbullet:upload-files`.
   - How *File: Upload* may be taken (a Space Lua command of the same name replacing a plug's?). Else Assets defines
     its own command, the toolbar's button and `/upload` pointed at it, and SilverBullet's left as it is.
   - `document.caretPositionFromPoint` over the editor (a drop's place).
2. **The model and the settings**: `insert` read and written, the Files tab's box and column, unit tests.
3. **The contract**:
   - The optional `AssetType` flag of a costly original.
   - A type drawn from a `blob:` URL: checked for each built-in type and Silverware Assets PDF, DOCX, XLSX; a type that
     cannot be is drawn as its card in the dialog.
4. **The dialog**:
   - Its rows, names, conflicts, *Insert as*, for all, the file drawn, the limits.
   - Unit tests over `core/insert.ts`.
   - A playground page.
5. **Paste and drop** in the page and in a grid's cell, behind the setting; UI tests:
   - A paste of a file (a `ClipboardEvent` with a `DataTransfer`) and a drop (CDP's drag events).
   - Several files.
   - A name taken.
   - The setting off: SilverBullet's own prompt.
   - A cell's field.
   - Text with an image in the clipboard left to SilverBullet.
6. **Upload**: *File: Upload* as step 1 found; Files and Camera on a phone (the touch project: the input's `accept`,
   `capture`).
7. **Review**, the library page, the changelog's entry drafted (a release proposed to the user, not made).

## Open

- A dialog over a page's editor that is read-only (SilverBullet's read-only mode): nothing taken, as SilverBullet takes
  nothing there? Not checked in step 1; still to try.
- A grid's cell: a file dropped on a cell's rendering, not in its field. Today Silverware Layout moves dropped text
  into the cell (`src/grid/drag.ts`). A dropped file could open the cell's field and insert there, through a hook of
  Layout's `rendered` API; to decide once paste and drop in the page work.

## Done (2026-11-15)

Steps 1 to 7 are done: the settings (`insert`), `core/insert.ts`, the contract's `costly`, the dialog, the events and
*File: Upload* (`host/silverbullet/insert.ts`, the init page), the library page, unit tests and UI tests
(`ui-tests/insert.spec.ts`, `insert-touch.spec.ts`). What the code does where the plan said otherwise:

- **A paste is taken where SilverBullet would upload** (files, no HTML; plain text beside them too: SilverBullet uploads
  a file copied in a file manager, its name beside it, as well), and a web page's image. Not "no plain text": with it,
  SilverBullet's own prompt came instead of the dialog.
- **The page a file goes into** is handed over by the init page as a page loads (`pageLoaded`, `editor:pageLoaded`), not
  asked as it is pasted: the event cannot wait, and the decorator, which reads it otherwise, reads none on a page of no
  file.
- ***File: Upload***: its Space Lua calls one function of the bundle that decides (`upload`), as Settings does; a choice
  made in Space Lua by a value of the bundle's left the command waiting. SilverBullet runs a command by the commands its
  UI was told of last (`client.runCommandByName`: `viewState.commands` first), a moment (200 ms) after Space Lua loads:
  the UI tests wait for the one replaced there.
- **A grid's cell's field**: the dialog marked its companion before it opens (`COMPANION_ATTRIBUTE`, its first row's name
  focused), the field focused again as it closes; else the cell was taken for left, written and closed before the files
  were put in. A drop into a field goes to its cursor (a field gives no place of a point).
- **A drop on a widget** (marked not editable by CodeMirror, a grid's inside a line) puts the files on a line of their own
  beside it, after the front matter where it would be before it.
- **Insert waits for the names taken in the space** (Insert off until they are known; where they cannot be listed, said).
- **The costly guard** is a type's alone (DOCX, XLSX over 20 MB on a click); their own reads take turns already
  (`readTurns`). A file the browser cannot draw (HEIC in Chrome) shows the browser's broken image, not the card.
- **The desktop app**: every drop is left to SilverBullet there (its `resolveSpaceFileDrop`), as it links a file of the
  space; a drop of files from outside it is SilverBullet's own there too.
- Not tested in the UI: read-only, a write failing in a batch, the upload event.

## Files being uploaded (asked 2026-11-15, built the same day: a panel)

The user's report, tried on a phone: after *Insert* nothing shows for a long while (the files written one by one, a
camera's photo several MB), then the embeds appear at once; it looks as if nothing happened. Wanted: a placeholder where
each file goes, of its size, with its upload's progress, several at once, virtual (no markdown written for it).

- **Progress**: SilverBullet's `space.writeDocument` is one `fetch` PUT (`client/spaces/http_space_primitives.ts`): no
  progress of bytes. The user's choice: per file (waiting, uploading, done, failed; "2 of 5").
- **Where it is drawn**: a block that takes room in the page's editor is CodeMirror's block widget decoration. SilverBullet
  exports none of CodeMirror's classes; they are reached from `client.editorView` (SILVERBULLET-INTERNAL, as
  `host/silverbullet/editorposition.ts`). A grid's cell's field is Silverware Editor's own CodeMirror (its API).

### The probe (2026-11-15, SilverBullet 2.12.1 and the fork's main)

A script in the browser (Playwright), the same result in both:

- **The classes are reached**: `EditorView` as `view.constructor`; `StateEffect` as the constructor of
  `EditorView.scrollIntoView(0)`; `StateField` as the constructor of a field found in `view.state.config.base` (an object
  with `createF` and `updateF`); `Decoration` and `WidgetType` up the prototypes of a decoration the editor draws
  (`view.state.facet(EditorView.decorations)`).
- **A field of our own** (`StateField.define`, its set mapped through each transaction's changes, `provide` into
  `EditorView.decorations`), added by `StateEffect.appendConfig`, takes a block widget (`Decoration.widget({ block: true })`)
  by an effect of its own: drawn 240 px high, the lines under it pushed down.
- **The page is not changed**: the transaction of effects alone changes no document (no `docChanged`), the page's file
  not written (its time the same 2.5 s later), no undo step (Ctrl+Z took back the text typed, the widget stayed).
- **It follows the text**: text typed above it moves it with its line.
- **A reconfigure takes it away**: SilverBullet's `rebuildEditorState` (`client/content_manager.ts`, as its configuration
  changes: Space Lua loaded again, settings saved) dispatches `StateEffect.reconfigure` of its own extensions, our field
  gone with it (and an update listener of ours). A page opened anew is a new state too. To hold it: added again where
  `state.field(field, false)` is none (checked as each file's state changes and on a timer while uploading), its places
  kept by us as last mapped.
- **Its text deleted round it**: its place is mapped as CodeMirror maps a point; where the text it stood in is deleted, it
  goes (the whole page replaced took it away). The files are still put in at the place mapped, else at the cursor.
- **Fragile**: it stands on SilverBullet bundling one CodeMirror and on its public statics (`decorations`,
  `scrollIntoView`, `appendConfig`) and two property names of its internals (`config.base`; `createF` and `updateF` of a
  field). Where any is missing, no placeholder (or a floating one over the page), the upload as now.

### Decided and built (the user's choice, 2026-11-15): a panel at the bottom right

A floating placeholder at the place was built first (each file's room over the page) and taken back the same day: the
user, seeing it, chose the simpler. The CodeMirror widget was not taken (a second exception to the rule of no
SilverBullet internals).

- **The panel** (`ui/uploadprogress.ts`): at the window's bottom right, over the controls (layer `menu`), under dialogs;
  *Uploading 2 of 5…*, then a row per file: its type's icon, its name, its state (waiting, uploading, uploaded, not
  uploaded) and a bar running while it uploads (SilverBullet tells no bytes written). Gone 1.5 s after the files are put
  in, 5 s where one failed (the failure said by a notification as before). Uploads at once: a panel each, one above
  another in one column. A screen reader is told the line of how many are done (`role="status"` on it alone).
- **Its colours** set from the theme's variables (`--root-color`, `--root-background-color`): it is put into the body,
  outside SilverBullet's root, which sets them.
- **Not put in, said with the markdown** (a notification): another page open, a grid's cell's field closed meanwhile,
  a failure after the writes.
- **Where the files go**: the place (a drop's, else the selection) is read as Insert is pressed, not after the writes,
  and moved by what is typed elsewhere meanwhile (`core/insert.ts` `mappedPlace`: the text then and now apart in one
  run); where the change took the place in, the cursor then (a drop's place too: then a line of its own beside a widget
  no more).

## An image of the web linked, not kept (the user's, 2026-11-15)

- **Which**: the one file of a paste or a drop whose address the browser gives (`core/insert.ts` `webUrlOf`): an image
  copied from a web page (*Copy image*: its HTML that image alone, `<img src>`, not a lazy page's `data-src`), one
  dragged from a page (its `text/uri-list`); an `http(s)` address alone, whose name ends in an image's extension
  (SilverBullet draws an image of a URL by it, Silverware Assets takes its type so: `photo?id=5` would be drawn as no
  image: kept in the space then). A file of the disk, the camera or a screenshot has none: no choice. A
  drag of a page's image that carries no file (only its address) is still SilverBullet's.
- **The dialog**: such a row has *Kept*: *Linked from the web* (the default, the user's choice the same day) or *In the
  space* (as any file); linked, its
  address in place of its name's field, a note that it shows while its site keeps it there. One too large for the space
  is linked at once (*In the space* off). It is drawn in the dialog from the file the browser gave, as any.
- **Written**: no file; SilverBullet's image of a URL, `![](https://…)`, its view in its metadata where it is not the one
  shown (`![||{ view: icon }](…)`: SilverBullet reads the first two segments as the alt text and the size); a link
  `[name](url)` (`webMarkdownOf`; what would end or break the URL encoded). Not in the upload's panel.
- **Not done**: a choice for all files of *Kept* (a copy of a page's image is one file), a default in the settings.
