# Silverware Assets: stored previews, and files drawn in a grid's cell editor

Decided with the user 2026-11-14. Two pieces of work that meet: a file in a grid's cell being edited is drawn by
Silverware Assets (as on the page), and a preview is made once and kept in the space instead of being drawn from the
file every time.

## Why

- **The cell editor** (Silverware Editor in a grid's cell) draws images alone, as plain images (an image shown as a
  preview on the page becomes an original there: no label, no preview size); a PDF, DOCX or XLSX stays markdown.
  The live preview's own image drawing (`EditorOptions.image`, Layout's `images` hook deciding by extension) knows what
  Assets knows, twice.
- **A preview is drawn anew every time**: a PDF's first page by pdf.js, a DOCX's by docx-preview (the file unzipped
  and laid out), an XLSX's by reading the workbook. Slow for big files, every time a page is opened.
- **A PDF's preview kept as an image** is ordinary markdown that any renderer shows (GitHub, Obsidian, an export): the
  image, a click opening the PDF. In the cell editor it is an image, nothing more to draw.

## Decisions

### Files in the cell editor: drawn by Silverware Assets, every type

- Silverware Editor's live preview gets a general hook in place of `image`: a widget for an embed's markdown, given an
  empty container to draw into and an `AbortSignal` ended when the widget goes (the caret in it, scrolled away). It
  knows nothing of files.
- Silverware Layout's API takes a registration of what draws an embed (Silverware Assets registers it from its init
  page's Lua, as types register with Assets); the grid hands it to its cell editor. Without Assets: Layout's image
  drawing as now, the fallback.
- Assets draws read-only there: the view, size and label as its settings and the embed's metadata say; no "…" menu,
  no click action (a click puts the caret in the markdown, as on an image now); metadata read, never written (the
  cell's text is not the page's yet). An original that SilverBullet draws on the page (a PDF's viewer) is drawn by
  Assets itself there (no SilverBullet drawing in a field).

### Stored previews

- **Where**: one folder, `_silverware-asset-preview/`, hidden by SilverBullet (a name starting with `_`, *SilverBullet
  2.12.1* below; shown for a while on 2026-11-15, hidden again by the user's choice: a cache in the pickers and `[[`
  completion is in the way, a preview linked by mistake), mirroring the files' paths (`_silverware-asset-preview/Projects/Report.pdf.webp`),
  so names do not collide.
- **Made** when a file is embedded or switched to a preview, by **Regenerate preview** in its menu, and **when it is
  shown without one** (a file, not a page, is written: what is written for a version is the same on every device, so a
  sync conflict breaks nothing; a read-only space: drawn live as now). Never a page's text written as it is opened.
- **Out of date**: a preview of another version of its file (*Freshness* below) is not read: made anew as it is shown
  with the plugin installed. Without the plugin the old one is shown; nothing helps that.
- **The folder a setting too** (2026-11-15, the user's): `silverware.assets.previewFolder`, by default
  `_silverware-asset-preview`; any folder SilverBullet reads (a name without `_` shown in it as any folder). Changed
  in the settings window, the previews kept are moved into it before the setting is saved.
- **A setting** (2026-11-15, the user's): `silverware.assets.storePreviews`, **Keep previews in the space** on the
  settings' Files tab, on by default. Off: no type gets `stored` (each preview made as it is shown), no Regenerate
  preview in a menu; those kept stay until Clean up previews, and a file deleted from its menu still takes its own.
- **Deleting a file** from its menu takes its version's previews with it (read before it goes: a file gone has no version).
- **Regenerate preview** (menu only, `gesture: false`, as Copy image): made anew whatever the version, the file
  overwritten (its path unchanged, the page's text unchanged but for the version in the metadata). Only for types
  that store a preview.
- **The contract** (`shared/assets.ts`): the render context gets `stored`: read the preview kept for this version of
  the file, or write a new one. The type decides what it keeps and draws it itself; Assets keeps, versions and cleans
  up, and knows no format (but an image's, for the markdown below).
- **PDF: an image**, WebP (PNG where the browser makes no WebP: told by the blob's type), its longer side 600 px.
  Its preview written as a link around the image, metadata in the image's alt as SilverBullet's `|` segments:

  ```md
  [![Report|{version: 1731600000-48213}](/_silverware-asset-preview/Report.pdf.webp)](/Report.pdf)
  ```

  Assets reads this form as the PDF in its preview view (not as an image); switching to the original or a card
  writes `![[Report.pdf]]` back (as a link and an embed are switched now).
- **DOCX and XLSX: the preview's HTML**, not an image (an image of HTML would always be a compromise, and a table drawn
  by us would only imitate the cells' formatting). It saves what is slow (docx-preview's layout, the workbook read).
  Their markdown stays `![[Report.docx]]`: the stored HTML is a cache only.
  - **Sanitized as it is read**: anyone with access to the space can write that file; an allowlist of elements and
    attributes (no `on*`, no `<script>`, no `javascript:`), what docx-preview and our table write.
  - **Images in it**: docx-preview writes them as data URLs already (`useBase64URL`, silverware-assets-docx/src/load.ts);
    scaled down to the preview's size before it is kept, where a big one makes the file big.
- **SilverBullet's native `![[Report.pdf]]` is read as ever**: shown as the settings or its metadata say; shown as a
  preview, the stored preview is used (made if there is none), its markdown left alone.
- **Types storing nothing** (video, audio, and any type of another plugin that does not use `stored`): their preview
  as now.
- **No compatibility to keep**: Silverware Assets is not in `main` yet (Layout's 1.0.0 there has no files' previews);
  the preview's form is new with its first release, no `!`.

## SilverBullet 2.12.1, read in its sources (step 1, 2026-11-14)

The tag 2.12.1 of SilverBullet's repository (not the fork's changes), read, not run.

- **A folder at the space's top whose name starts with `_` is out of the pickers**: the document picker and the space
  tree (`client/navigator/views/pages.ts` `spaceContents`: `!document.name.startsWith("_")`), the `[[`/`![[`
  completion (`plugs/editor/complete.ts`), `space.listDocuments` (`client/space.ts` `isListedDocument`). The test is
  on the whole path: `_asset-previews/…` would be hidden, `Folder/_x/…` is not. The index keeps them (`index.tag
  "document"`), and they sync. A page's `meta` tag hides a page alone (an image has no frontmatter).
- **An image inside a markdown link (`[![alt|300](/_silverware-asset-preview/x.webp)](/Report.pdf)`) is handled badly**:
  - the editor draws the image (its widget does not look at the parent node), but its link mark is wrong: the link
    regex (`client/markdown_parser/constants.ts` `mdLinkRegex`) reads the title `![alt|300` and the URL
    `/_silverware-asset-preview/x.webp)](/Report.pdf`;
  - the index records a bogus link to that URL and stops there (`plugs/index/relation.ts`): the PDF gets no backlink
    from the page, the image none either, so **renaming the PDF does not rewrite this link** (`updateBacklinks` goes by
    the index);
  - a click on the source (`plugs/editor/navigate.ts`) finds the first URL in the tree, the image's: it opens the
    image, not the PDF; a click on the image's widget does nothing (its Open button opens the image).
- **Paths**: a markdown URL starting with `/` is from the space's root; any other is from the page's folder
  (`plug-api/lib/resolve.ts` `resolveMarkdownLink`). A wiki link is found by its path, then by its name anywhere.
- **Renaming a document** (`Document: Rename Document`) rewrites the links the index knows; there is no rename event:
  a rename is a write and a delete (`file:changed`, `file:deleted`, which Space Lua can listen to).
- **Writing and reading a file's facts**: `space.writeDocument(name, Uint8Array)`, `space.readDocument(name)`,
  `space.getFileMeta(name)` (`size`, `lastModified` in ms, its content not read; `getDocumentMeta` gives the time as
  text).

**What this changes**: the link around an image, the PDF's portable form, works against SilverBullet itself: no
backlink, no rewrite on a rename, a broken link mark without Assets. **For the user to decide**: (a) keep that form
anyway (portable outside SilverBullet, Assets then drawing over SilverBullet's broken mark, renames handled by Assets
itself), or (b) the PDF's preview kept as a cache only, as DOCX's and XLSX's, its markdown `![[Report.pdf]]`
(backlinks and renames SilverBullet's, nothing portable). Step 3 builds what both need first (the cache); the markdown
form waits for the answer.

**Freshness by the file's version** (changed after the review of 2026-11-14, which found comparing the two times
wrong: a file copied with its older time kept, by a sync tool or `rsync -t`, was older than its preview): a preview is
named by the version of its file it was made of, `getFileMeta`'s `lastModified` and `size`
(`_silverware-asset-preview/Report.pdf.1731600000000-48213.webp`), and read for that version alone. The previews of versions
gone are left until **Clean up previews** takes them away, with those of files gone.

## Steps

1. **Probe SilverBullet 2.12.1** (the release, not the fork): whether a folder's files can be kept out of its file
   pickers and listings (a page's `meta` tag is a page's only: an image has no frontmatter), whether it reads the
   `|` segments of an image's alt inside a link, how absolute and relative paths of an image and a link resolve.
   Results into this file.
2. **The cell editor's hook**: Silverware Editor's general embed widget (`image` replaced), Layout's registration and
   its fallback, Assets' read-only drawing; unit tests and a UI scenario (a PDF in a cell being edited: drawn,
   markdown on a click, drawn again as the caret leaves).
3. **Stored previews in Assets**: `stored` in the contract, the folder, the version, made when shown without one,
   Regenerate preview; the PDF's image and its markdown form, read and written.
4. **DOCX and XLSX** store their HTML: sanitized, images inlined.
5. **A command** to clean up previews of files gone (renamed or deleted), and to make the missing ones of a page or the
   space; whether a renamed file's preview can follow it (what SilverBullet does on a renamed document: probed in 1).

Each step its commits, built and verified; UI tests of what it changes; deployed to the local SilverBullet (3010).
