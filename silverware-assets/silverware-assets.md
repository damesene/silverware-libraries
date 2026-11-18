---
name: Library/damesene/silverware-assets
tags: meta/library
version: 1.1.0
description: "Silverware Assets: embedded files shown full, as a preview or as a card (a zip or a document too), a link to a file with its icon and a menu, a file opened in a side panel or enlarged, a link turned into an embed and back."
files:
- silverware-assets.js
- silverware-assets-init.md
- silverware-assets-api.md
- silverware-assets-style.md
---
# Silverware Assets

The files your pages embed and link: images, videos, audio, PDFs and any other file of your space (a zip, a document). Show each in full, as a smaller preview or as a card with its icon and name; open it in a new tab, in a side panel or enlarged over the page; turn a link to a file into an embed and back. With [Silverware Layout](https://github.com/damesene/silverware-libraries/blob/main/silverware-layout/silverware-layout.md), drag a file's width as a table's, and files in its grid's cells are shown the same way.

## Embedded files

Images, videos, audio, PDFs and other files you embed (`![[photo.png]]`, `![Photo](photo.png)`) can each be shown three ways:

- **Full**: the whole file itself, as SilverBullet shows it (the image, a player, a viewer).
- **Preview**: smaller (a PDF in a small viewer; with Silverware Assets PDF installed, its first page as an image).
- **Card**: a small card with the file's icon and name, the file itself not shown. A file SilverBullet cannot show (a zip, a document) is a card instead of an error.

Point at a file, and a **…** button shows at its top right (also in a grid's cell being edited and in a database's peek, where what you choose changes the text there; Alt+click shows its markdown). On a card, a small arrow after its name is that button (as a link's after its text); its icon is a picture alone. Its menu, the same for every file:

- **Show as**, at the top: a row of four, how the file is in the page: a **link**, a **card**, a **preview** or **full**, the one shown lit, the one your settings give marked *(default)*. One a file cannot be shown as is greyed out (a zip has no preview).
- **Rename…**, under it: a small dialog with the file's **Title** on this page (its alt text, shown above a preview where its label shows it; empty or × for none) and its **File name** in your space, its folder and extension kept. Change either, or both: **Use the title as the file name** fills the name from the title (what a file's name cannot hold left out), for you to check before **Save**. A file renamed is renamed as SilverBullet's **Document: Rename** does it: the links and embeds to it in every page follow, which undo does not put back. A link's dialog has its **Text** (what the link shows) in place of the title; an image of the web has a title alone (its name is the site's), and so does a file in a grid's cell or a database's peek while you edit it (rename its file from the page).
- **Open in a new tab**, **Open in side panel** (a panel at the window's right, the page still beside it; drag its left edge to make it wider or narrower, kept on this device, a double click on the edge for its default width), **Open enlarged** (over the page). Esc or × closes them, and a click beside the enlarged file.
- What is done with the file: **Copy image** (an image), **Copy markdown**, **Download**, **Regenerate preview** (a preview kept in the space).
- **Remove from page** (an embedded file, an image of the web too): takes the embed out of the page, the file left as it is; undo puts it back.
- **Delete file…**, last (a file of your space).

A click on a card or a preview opens the file in a new tab; Shift+click does the same, unless you set otherwise: either can instead open it in the side panel, enlarged, or download it.

**Its alignment**, with [Silverware Layout](https://github.com/damesene/silverware-libraries/blob/main/silverware-layout/silverware-layout.md) installed (it places what is on a page): click the bar beside a file (a preview's too), and **Align** in its menu puts it at the left, in the middle or at the right of its line (of its cell, in a grid); kept in its embed, `![[photo.png|Photo||{ align: center }]]`. Without its own, the default in **Silverware Layout: Settings** (its **Alignment** tab: previews and full files apart) holds, left unless you change it. A card is always at the left. Without Silverware Layout files stand as SilverBullet draws them.

**Its width** (a full file's: a preview keeps the size the settings give it), with [Silverware Layout](https://github.com/damesene/silverware-libraries/blob/main/silverware-layout/silverware-layout.md) installed: point at an image (or a video, a PDF), and the bar beside it makes it wider or narrower, as a table's. It grows as it is aligned: at the left to the right (the bar at its right edge), centred both ways, at the right to the left (the bar at its left edge). Let go, and the width is saved as SilverBullet's own size: `![[photo.png|Photo|300]]`. In a grid's cell the bar is inside the file, at its edge (beside it is the line between the grid's columns), also while you edit the cell.

## Links to files

**Links to files** (`[[report.pdf]]`) show the file's icon before their text, in a grid of Silverware Layout's too (a markdown link, `[report](report.pdf)`, only in a grid). Click the small arrow after the link for the file's menu, the same as an embedded file's: its **Show as** row has the link lit, and a card, a preview or full there makes it an embed shown so (`[[report.pdf]]` becomes `![[report.pdf]]`); a click on the link's text (or its icon) opens it as SilverBullet does. An embedded file's row has **link** the other way (its alt text kept as the link's, its size and view left out). The settings' **Appearance** tab (**Link**) hides the icons; the arrow stays.

**Download**, in every file's menu and a link's, saves the file under its own name (a file of another site that does not allow it opens in a new tab instead); it can be a click's action too. **Copy markdown**, in every file's menu and a link's, copies its markdown as the page has it, its size and settings too (`![[photo.png|Photo|200|{ view: preview }]]`). **Copy image**, in an image's menu, copies the image itself, to paste into another app; the browser allows it where SilverBullet is served over HTTPS (or on your own machine).

**Previews made once**: a preview that is slow to make (a PDF's first page, with Silverware Assets PDF) is made the first time it is shown and kept in your space, in the folder `_silverware-assets-previews` at your space's top, and shown from there after, on every device. SilverBullet does not show that folder (a name starting with `_` is left out of its pickers, its space tree and link completion), so a preview never comes up where you look for your files; it is there on disk, synced and backed up with the rest. Another folder can be set on the settings' **Files** tab (a name without `_` is shown in SilverBullet as any folder); saved, the previews kept are moved there. Replace the file, and its preview is made again. **Regenerate preview**, in a preview's menu, makes it again now. To make previews every time instead (none kept, no Regenerate preview in the menu), turn off **Save slow previews in the space** under **Saved previews** on the settings' **Files** tab; on by default. A file deleted or renamed leaves its preview behind: **Clean up previews** there (or the command **Silverware Assets: Clean up previews**) takes away those whose file is gone or was replaced since (a renamed file's preview is made again under its new name as it is shown).

**Delete file…**, last in a file's menu and a link's, deletes the file itself from your space, not only the embed or the link: SilverBullet asks first, and there is no undo. The embed is then taken out of the page, and a link becomes its text (`[[report.pdf|the report]]` becomes `the report`); its preview kept in the space goes with it. Other pages that embed or link the file show it missing.

## Inserting files

**Paste a file** (Ctrl+V: a screenshot, an image copied from a web page, a file copied), **drop files** on the page, or **upload** (**File: Upload**, the toolbar's paperclip, `/upload`; with Silverware Toolbar, its action **Upload file**, which also puts the files into a grid's cell being edited or a database's peek where you run it there), and a dialog asks how to put them in, a row per file:

- **Its title** first: an image's alt text, a link's text (empty: none, the file's name shown where it is named). Under it, what happens to the file (**Upload**, **Link**, **Already in your space**) and its name in your space, in the page's folder: ✎ changes it. A file pasted without a name of its own (a screenshot, a photo) is named by the date and time (`2026-11-15_13-09-48.png`), as SilverBullet names it. A name SilverBullet would not take, or a link could not name (`@`, `#`, `|`, `<`, `>`, `$`, a bracket), shows its field with the name offered (**Use …**). A file of the same name already in your space is kept, the new one named `-1` after it, unless you choose **Replace it**; two files of one name in the same batch are named apart.
- **Inserted as**: a **link**, a **card**, a **preview** or **full**, and under it the file as it will be in the page (at most 320 px high here). It starts as the settings say (below). A large document (DOCX, XLSX) is shown here only on **Show here**, as reading it takes a while.
- For an image copied from a web page or dragged from one, or a link added: **Link** (the default: nothing uploaded, its address written in its place, `![](https://…)`) or **Save a copy** (uploaded, as any file; a site that refuses other sites' fetching cannot be copied: link it). A linked image shows only while its site keeps it there, and not offline; some sites do not let other pages show their images. One too large for your space can only be linked.
- With several files, **All files** above them sets every file at once, one you set yourself too; it shows a choice only while all the files have the same.
- Over the rows, one field adds more: paste a link (**Add link**), or type words of a file's name in your space (what it finds is offered under it: ↑ ↓ and Enter or a click add one, nothing uploaded); **Browse…** beside it picks your device's files (on a phone its picker offers the camera too), and files dropped anywhere on the dialog are added. The foot says what happens (`2 to upload · 1 link · 1 from your space`) and its button counts the files (**Insert 4 files**); Ctrl+Enter presses it from anywhere.
- On a phone the dialog covers the screen.

**Insert** writes the files and puts them where you pasted (a selection is replaced) or dropped them (dropped on an embedded file or a grid: on a line of their own beside it; in a grid's cell being edited: at its cursor); **Cancel** writes nothing. While the files upload, a panel at the bottom right shows each with whether it is waiting, uploading, uploaded or failed, and how many are done; they go where the cursor was when you pressed **Insert**, even if you go on writing elsewhere meanwhile. A link is written as SilverBullet's `defaultLinkStyle` says. Several files go one under another, or a space apart in a table's row or a line of text. Undo takes the markdown out; the files stay in your space. A file larger than SilverBullet takes (`maximumDocumentSize`, 10 MiB by default) is left out, said in its row (an image of the web is linked instead). Text you paste stays text, and nothing is taken in a code block or the front matter.

**How a file is inserted** is set on the settings' **Files** tab, by **Inserted as**: **Same as shown** (the default: as **Shown as** says, nothing written into the embed, so changing **Shown as** later changes it too), **Link**, **Card**, **Preview** or **Full**, for all files and for each kind. To let SilverBullet insert files as it does without Silverware Assets, turn off **Use the insert dialog for pasted, dropped and uploaded files** under it; on by default.

## Files of Silverware Database

[Silverware Database](https://github.com/damesene/silverware-libraries/blob/main/silverware-database/silverware-database.md)'s **Files & media** uses Silverware Assets for its files: their small pictures (a PDF's, a document's as its kept preview), the side panel a file opens in, the dialog its uploads go through (their names alone asked: the database keeps a link of its own) and the deletion of its files (their kept previews with them). Files dropped or pasted on a database's value of files are the database's, not put into the page.

## Where it is kept

What you choose is kept in the embed itself, after SilverBullet's own size, as `view: card`, `view: preview` or `view: full` (none where it is your settings' own):

```markdown
![[report.pdf|Report||{ view: card }]]
![Photo|300|{ view: preview }](photo.png)
```

SilverBullet reads only the alt text and the size, so without Silverware Assets every file shows as SilverBullet shows it, at its size: nothing is lost. Keep the three parts, even an empty one (`||`): with two, SilverBullet would take the size for the alt text.

## Settings

**For all files, or for one kind of file**: run **Silverware Assets: Settings**. Its tabs:

- **Files**: under **All files**, how a file is shown (**Shown as**: card, preview or full), how it is inserted (above), and what a click and a Shift+click on it do. Under **Per type**, a row for each kind of file (Images, Videos, Audio, PDF, Archives, Other files; Word and Excel with Silverware Assets DOCX and XLSX): closed, it says what it sets of its own (or *Like all files*); click it to open it, set what differs, and **↺ Reset to all files** takes it back. How one file is shown, chosen in its **…** menu, wins over both. Under **Saved previews**, whether slow previews are kept in your space, their folder, and **Clean up previews** (above).
- **Appearance**: how a file looks where it is shown, picked by **Link**, **Card**, **Preview** or **Full**, each on a sample drawn as your pages draw it. Point at (or tap) a part of a sample for its name and a × that hides it; the parts not shown are in a row over the sample, click one to show it.
  - **Preview**: a row for all files and one for each kind of file; click one to open it. Each holds the label (below), and the size (its width and height: an image fits in it, its proportions kept; a PDF's preview is that large). A kind of file follows all files until you change one of them there: its row is then marked **Own**, and **↺ Reset to all files** inside it takes it back.
  - **Full**: a label for files shown full, set as a preview's is (rows for all files and each kind of file), none shown until you turn a property on; and a **Document height**: a PDF, a Word or Excel document shown full scrolls in a box this tall (480 px unless you change it), for all files and, in its own row, for PDF, Word or Excel apart. One with a height of its own in its embed (`|200x120`) keeps it.
  - **Card**: what a card shows besides the file's name (its icon, its size, its date changed). The small arrow after the name opens its menu, always.
  - **Link**: whether links to files show the file's icon. The small arrow after the link opens its menu, always.
- **Markdown**: a change of SilverBullet's own behaviour in its plain markdown view (below).

**A preview's label**: by default a preview shows its type's icon and its alt text above it (its file's name where it has none). On the **Appearance** tab, under **Preview** and **Label**, a sample preview shows what you set as you set it: the label above and below it is made of the properties shown (the type's icon, the alt text, the name, the size, the date changed), as a preview shows them; those not shown are in a row over it. Point at a property (or tap it) for its name and a × that hides it; drag it above or below the preview, in the order you want, or up to the row to hide it (or move it by Alt+arrows). Click a property in the row, or drag it into the label, to show it. Set it for all files, or open a kind of file's row and change it there (a PDF's apart from an image's). With both the alt text and the name on, a file without alt text shows its name once.

Saved into your configuration page (`Library/Config`; `CONFIG` in SilverBullet 2.12 and before), in a block of Silverware Assets' own.

Files in a grid's cells (Silverware Layout's) are shown the same way, and their bar makes them wider or narrower within their cell: it snaps to a quarter, a half, three quarters and the whole of the cell's width. A width snapped to one is saved as that share, `![[photo.png|Photo|50%]]`, so the file follows its cell as the cell grows or shrinks; one not snapped is saved in pixels.

**SilverBullet's plain markdown view** (*Editor: Toggle Markdown Syntax Rendering*): SilverBullet still draws embedded files in that view, under their markdown; Silverware Assets hides them there, so `![[photo.png]]` stays plain text like the rest of the page. To get SilverBullet's own behaviour back, untick **Hide embedded files in this view** in the settings' **Markdown** tab (or in the Configuration Manager, under Silverware Assets):

```lua
config.set("silverware.assets.syntaxMode.hideAssets", false)
```

A click on a link there (an embed's `![[` too) only puts the cursor in it, with [Silverware Layout](https://github.com/damesene/silverware-libraries/blob/main/silverware-layout/silverware-layout.md) installed: its **Markdown** tab.
