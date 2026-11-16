# Silverware Assets: a file's title and name (Rename…)

Proposed 2026-11-16, its design decided with the user the same day; built the same day on their word.
A file's menu gets one item to set or remove the embed's title (its alt text) and to rename the file itself.

## Why not one field with "rename the file too"

A title is one embed's alt text on one page, any text (`![[photo.png|Holiday 2026]]`); a file's name is the space's,
for every page, with rules (no `:` `?` `/`, its extension, no other file of that name). A checkbox renaming the file
from the title would have to make a name out of it the user never sees first ("Q3: final!" to `Q3 final.png`), and
couple a change of one page with a change of every page. Two fields keep each explicit; a link fills the name from the
title for whoever wants both alike. A separate "Remove title" item is a field emptied.

## Decided (the user, 2026-11-16)

1. **One dialog of two fields**, Title and File name, with a link "Use the title as the file name" (not a checkbox).
2. **Named "Rename…"** in the menu.
3. **In the Show as section**, right under its row (a change of the page, with the page's changes):

```
photo.png
Show as   [ link | card | preview | full ]
Rename…
───
Open in a new tab
Open in side panel
Open enlarged
───
Copy image
Copy markdown
Download
───
Remove from page
Delete file…
```

## The dialog

```
┌ Rename ───────────────────────────────────────┐
│ Title                                         │
│ [ Holiday 2026                          ] [×] │
│ Shown with the file on this page. Empty: none.│
│                                               │
│ File name                                     │
│ Photos/ [ IMG_2041              ] .png        │
│ ↳ Use the title as the file name              │
│ Renaming changes the links in every page.     │
│                                               │
│                         [ Cancel ]  [ Save ]  │
└───────────────────────────────────────────────┘
```

- The title has the focus; its placeholder is what shows without one (the file's name); × empties it.
- The file's name without its folder and extension (neither changed by mistake); a name not valid or taken said under
  the field, Save disabled. Unchanged, the file is left alone.
- "Use the title as the file name" fills the field with a name made of the title (what a name may not hold taken out),
  seen and editable before Save.
- Save: the title alone written into the embed (one change of the page). The file's name changed: the file renamed
  first through SilverBullet, which rewrites the links to it in every page, told ("Renamed …, updated N backlinks";
  not undone by Ctrl+Z, hence the line under the field), its previews kept taken away (made again under the new name),
  then the title written to the same embed once the page refers to the new name (see *Findings*: written before, a
  title raced SilverBullet's rewrite).
- Enter saves, Esc closes.
- **A file of the web**: the title alone ("A file of the web: its name is the site's" in place of the name), the item
  then "Rename…" all the same.
- **A link** (`[[report.pdf|the report]]`): the first field is its **Text**, alike.
- **In a grid's cell and a database's peek**: the title alone, written into the field's text as Show as writes there;
  its file is renamed from the page (the field keeps its own text while it is edited, which SilverBullet's rewrite of
  the saved page would not reach: left, it would write the old path back).

## To verify first (a probe in SilverBullet)

SilverBullet's `index.renameDocumentCommand` (`{ oldDocument, document }`) renames a document and updates its
backlinks: seen in the fork's source (main of 2026-11-15, `plugs/index/refactor.ts`). Not verified: that release 2.12.1
has it alike, and that it rewrites embeds (`![[…]]`) and markdown images (`![](path)`), not only wiki links. Without
it, the File name field is left out.

## Steps

1. [x] The probe above.
2. [x] The menu item and the dialog; the title written through the page writer (`embeds`), the rename through the
   bridge; unit tests.
3. [x] UI tests (a title set and removed, a file renamed and a link in another page following, a file of the web, a
   link's text), against SilverBullet.
4. [ ] The library page; review; the user's word for a release.

## Findings

- **The probe**: SilverBullet 2.12.1 (upstream's tag, the fork alike) has `index.renameDocumentCommand`: it saves the
  editor, checks the new name (valid, not taken, a case alone differing refused), writes the document anew and deletes
  the old one, then rewrites every textual back reference (`updateBacklinks`, `refactor_splice.ts`): wiki links and
  embeds (`![[…]]`, their alias kept: `|alt|size|{…}`) and markdown links and images (`![](path)`); it says the result
  in its own notification. It gives true where it refused too (`batchRenameFiles` says why and its false is dropped):
  the host tells a rename done by the space's files, the new path there and the old one gone. Proved in SilverBullet
  by the UI test (a link in another page follows the file renamed).
- **Built**: `core/rename.ts` (pure: the path cut, the name and the title checked, a name made of a title, a name
  taken), `ui/renamedialog.ts` (the dialog, its look `ui/dialoglook.ts`, the insert dialog's too), the menu's `page`
  items (`ui/moremenu.ts`, under Show as), the decorator's `rename` (the title first, then the file; its kept previews
  of its version taken away: a renamed file is written anew, another version), the host's `renameFile`,
  `filePaths`, `writeLinkText`; the page writer's `links.setText` (`linkWithText`, shared/markdown/embed.ts). A title
  cannot hold `|`, `[` or `]` (they end the alt text or the link where SilverBullet reads them); a file's name none of
  what a file system or SilverBullet's links refuse.
- **Tests**: unit (the pure part, the dialog of a file of the web, the writer's link text, the decorator's Rename of an
  embed and of a link, the title taken off); UI against SilverBullet: a title written and the file renamed from it, a
  link in another page following; a title taken off by ×, a link's text by Enter. The whole UI suite passed after
  (279), with two expectations of the earlier rename fixed (a database's peek writing `view: card`, a link's menu on a
  phone having Rename…). `scripts/ui-tests.mjs` passes its arguments through a shell on Windows: a `-g` with spaces
  splits into words (the whole suite ran).
- **Review** (independent agent), its findings fixed:
  - SilverBullet's command gives true where it refused (a name taken since the dialog read the files): the rename was
    taken as done and the file's previews taken away. Told by the space's files now (`renameFile`), a test of it.
  - In a field the dialog took the focus before it was marked the editor's companion (the field taken for left, the
    title then not written): marked before it opens, as the insert dialog is. And a file renamed from a field would
    have left the old path in the field's text: a field's Rename sets the title alone (said in the dialog).
  - A title written just before the rename raced SilverBullet's rewrite of the page by its index (a stale range cut
    the wrong text): the file renamed first, the title written once the page refers to the new name, to the same
    reference by its order among the file's (`atRenamed`, at most 10 s, looking every 200 ms).
  - Smaller: a file without an extension of letters and digits not offered (SilverBullet refuses it), a title ending in
    `\` refused, Save held while the space's files are read, the notes tied to their fields (`aria-describedby`,
    `aria-live`), no Rename in a drawing read only, a file not renamed here said why rather than "of the web", the
    dialog's test in `ui/`.
