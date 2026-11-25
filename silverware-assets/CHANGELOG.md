# Silverware Assets: changelog

## 1.1.2 (2026-11-24)

- Settings are saved again on SilverBullet 3.0: saving any setting kept nothing before (SilverBullet 3.0 tells its configuration page another way).
- An image, a video or audio whose file is missing keeps its place as a preview or full: a box of the same size says *File not found*, and its **…** menu works (before, a preview was a sliver and a full file had no size, its menu out of reach).

## 1.1.1 (2026-11-21)

- Shares updated code with Silverware Table 1.4.0; nothing changes in use.

## 1.1.0 (2026-11-19)

- The insert dialog is simpler: one field at its top adds a link (pasted) or finds a file already in your space by words of its name, offered in a list under the field (arrow keys and Enter, or a click); **Browse…** picks your device's files (on a phone its picker offers the camera); files dropped anywhere on the dialog are added.
- Each file's row starts with its title (an embed's alt text, a link's text) and says what happens to it: uploaded, linked, or already in your space; its name in the space is changed with ✎. An image of the web is linked or saved as a copy in your space.
- The dialog's button says what it does and how many (**Insert 3 files**), Ctrl+Enter presses it from anywhere, and the dialog keeps one height as rows come and go.
- Other plugins can use Silverware Assets for their files: previews, the side panel, the upload dialog and deleting files with their kept previews (Silverware Database's Files & media does). Files dropped on such a plugin's element are left to it.
- Panels, menus and the dialog scroll with a thin scrollbar, the same in every Silverware plugin.

## 1.0.3 (2026-11-18)

- A file's preview in a grid's cell or a database's item as tall as in the page (it was 6 px taller).

## 1.0.2 (2026-11-18)

- Fixes: a link's arrow always opens its menu (in a grid's cell a click on it sometimes opened the link instead); a file's open menu no longer closes when another plugin (Silverware Assets PDF, DOCX or XLSX) registers its file type.

## 1.0.1 (2026-11-17)

- Works with SilverBullet's next version (3.0) as well as 2.12.1: settings saved to `Library/Config` where SilverBullet keeps them there, and files it draws as an embedded page's card shown as Silverware Assets draws them.
- An image, a video and a document's preview get the corners and outline your theme gives pictures, alike in the page, a grid's cell and a field; a document's preview is drawn in a grid's cell while you edit it.
- An escaped embed (`\![[photo.png]]`) stays text, as SilverBullet shows it.

## 1.0.0 (2026-11-13)

First release.

- Embedded files shown three ways, chosen per file or for all and per kind: full (as SilverBullet shows it), as a preview, or as a card with the file's icon, name, size and date; a file SilverBullet cannot show (a zip, a document) a card instead of an error.
- A file's menu (its "…", or the small arrow after a card's name): how it is shown, open it in a new tab, in a side panel or enlarged over the page, show it as a link.
- Rename… in a file's menu: its title on the page and its file's name in the space, each changed on its own, the name made from the title if you like; the links to a renamed file follow.
- Links to files with their file's icon, and a small arrow after them for the file's menu: open it, show it enlarged, or embed it.
- An embedded image's or video's width dragged by Silverware Layout's handle, in a grid's cell too.
- In SilverBullet's markdown-as-written mode, embedded files hidden and a click on a link only placing the cursor.
- Previews' size and label, cards' and links' look, set for all files or each kind on the settings' Appearance tab, each on a sample; a height for documents shown full.
- Pasted, dropped and uploaded files put in through a dialog (how each is shown, its name), their uploads shown as they go.
- Copy image, Copy markdown, Download, Remove from page and Delete file… in a file's menu.
- Slow previews (a PDF's first page, with Silverware Assets PDF) kept in your space and shown from there on every device; Regenerate preview and Clean up previews.
- With Silverware Layout: a file at the left, in the middle or at the right; in a grid's cell its width snaps to shares of the cell.
- Files drawn, with their menu, in a grid's cell being edited and in a database's peek.
