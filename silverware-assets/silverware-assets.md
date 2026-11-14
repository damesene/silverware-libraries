---
name: Library/damesene/silverware-assets
tags: meta/library
version: 1.0.0
description: "Silverware Assets: embedded files shown as the original, as a preview or as a card (a zip or a document too), a link to a file with its icon and a menu, a file shown in a side panel or enlarged, a link turned into an embed and back."
files:
- silverware-assets.js
- silverware-assets-init.md
- silverware-assets-api.md
- silverware-assets-style.md
---
# Silverware Assets

The files your pages embed and link: images, videos, audio, PDFs and any other file of your space (a zip, a document). Show each as the original, as a smaller preview or as a card with its icon and name; open it in a new tab, in a side panel or enlarged over the page; turn a link to a file into an embed and back. With [Silverware Layout](https://github.com/damesene/silverware-libraries/blob/main/silverware-layout/silverware-layout.md), drag a file's width as a table's, and files in its grid's columns are shown the same way.

## Embedded files

Images, videos, audio, PDFs and other files you embed (`![[photo.png]]`, `![Photo](photo.png)`) can each be shown three ways:

- **Original**: the file itself, as SilverBullet shows it (the image, a player, a viewer).
- **Preview**: smaller (a PDF in a small viewer; with Silverware Assets PDF installed, its first page as an image).
- **Card**: a small card with the file's icon and name, the file itself not shown. A file SilverBullet cannot show (a zip, a document) is a card instead of an error.

Point at a file, and a **…** button shows at its top right: choose how it is shown there, or open it in a new tab, in a side panel or enlarged. On a card, its icon is that button (as a link's icon); with the icon hidden, a small arrow after the card's name. A click on a card or a preview opens the file in a new tab; Shift+click does the same, unless you set otherwise: either can instead show the file in a panel at the window's right (**Show in a side panel**, the page still beside it) or enlarged over the page (**Show enlarged**). Esc or × closes them, and a click beside the enlarged file.

**Its alignment**, with [Silverware Layout](https://github.com/damesene/silverware-libraries/blob/main/silverware-layout/silverware-layout.md) installed (it places what is on a page): click the bar beside a file (a preview's too), and **Align** in its menu puts it at the left, in the middle or at the right of its line (of its column, in a grid); kept in its embed, `![[photo.png|Photo||{ align: center }]]`. Without its own, the default in Silverware Layout's **Page layout** dialog (**Alignment**: previews and originals apart) holds, left unless you change it. A card is always at the left. Without Silverware Layout files stand as SilverBullet draws them.

**Its width** (the original's: a preview keeps the size the settings give it), with [Silverware Layout](https://github.com/damesene/silverware-libraries/blob/main/silverware-layout/silverware-layout.md) installed: point at an image (or a video, a PDF), and the bar beside it makes it wider or narrower, as a table's. It grows as it is aligned: at the left to the right (the bar at its right edge), centred both ways, at the right to the left (the bar at its left edge). Let go, and the width is saved as SilverBullet's own size: `![[photo.png|Photo|300]]`.

## Links to files

**Links to files** (`[[report.pdf]]`) show the file's icon before their text, in a grid of Silverware Layout's too (a markdown link, `[report](report.pdf)`, only in a grid). Click the icon for what you can do with the file: open it in a new tab, show it in a side panel or enlarged, or **Show as embedded** (`[[report.pdf]]` becomes `![[report.pdf]]`); a click on the link's text opens it as SilverBullet does. An embedded file's **…** menu has **Show as a link** the other way (its alt text kept as the link's, its size and view left out). The settings' **Appearance** tab (**Link**) hides the icons: a small arrow after the link then opens its menu.

**Delete file…**, last in a file's menu and a link's, deletes the file itself from your space, not only the embed or the link: SilverBullet asks first, and there is no undo. The embed is then taken out of the page, and a link becomes its text (`[[report.pdf|the report]]` becomes `the report`). Other pages that embed or link the file show it missing.

## Where it is kept

What you choose is kept in the embed itself, after SilverBullet's own size:

```markdown
![[report.pdf|Report||{ view: icon }]]
![Photo|300|{ view: preview }](photo.png)
```

SilverBullet reads only the alt text and the size, so without Silverware Assets every file shows as SilverBullet shows it, at its size: nothing is lost. Keep the three parts, even an empty one (`||`): with two, SilverBullet would take the size for the alt text.

## Settings

**For all files, or for one kind of file**: run **Silverware Assets: Settings**. Its tabs:

- **Files**: how a file is shown (the original, a preview or a card) and what a click and a Shift+click on it do; all files first, then each kind (image, video, audio, PDF, archive, file), "Like all files" following them. What a file's own `view` says wins over both.
- **Appearance**: how a file looks where it is shown, picked by **Preview**, **Original**, **Card** or **Link**, each on a sample drawn as your pages draw it. Point at (or tap) a part of a sample for its name and a × that hides it; the parts not shown are in a row over the sample, click one to show it.
  - **Preview**: a row for all files and one for each kind of file; click one to open it. Each holds the label (below), the size (its width and height: an image fits in it, its proportions kept; a PDF's preview is that large) . A kind of file follows all files until you change one of them there: its row is then marked **Own**, and **↺ Reset to all files** inside it takes it back.
  - **Original**: an original PDF's height (one with a height of its own, `|200x120`, keeps it).
  - **Card**: what a card shows besides the file's name (its icon, its size, its date changed). With the icon hidden, a small arrow after the name opens its menu.
  - **Link**: whether links to files show the file's icon. Hidden, a small arrow after the link opens its menu instead.
- **Markdown**: what happens while SilverBullet shows the markdown as written (below).

**A preview's label**: by default a preview shows its type's icon and its alt text above it (its file's name where it has none). On the **Appearance** tab, under **Preview** and **Label**, a sample preview shows what you set as you set it: the label above and below it is made of the properties shown (the type's icon, the alt text, the name, the size, the date changed), as a preview shows them; those not shown are in a row over it. Point at a property (or tap it) for its name and a × that hides it; drag it above or below the preview, in the order you want, or up to the row to hide it (or move it by Alt+arrows). Click a property in the row, or drag it into the label, to show it. Set it for all files, or open a kind of file's row and change it there (a PDF's apart from an image's). With both the alt text and the name on, a file without alt text shows its name once.

Saved into your CONFIG, in a block of Silverware Assets' own.

Files in a grid's columns (Silverware Layout's) are shown the same way, and their bar makes them wider or narrower within their column: it snaps to a quarter, a half, three quarters and the whole of the column's width.

**SilverBullet's markdown as written** (*Editor: Toggle Markdown Syntax Rendering*): SilverBullet still draws embedded files in that mode; Silverware Assets hides them there, so you see their markdown alone. In that mode a click on a link only puts the cursor there (before an embed's `![[` too), the pointer a text one over it; Ctrl+click (Cmd+click) still follows it. Each can be turned off in the settings' **Markdown** tab (or in the Configuration Manager, under Silverware Assets):

```lua
config.set("silverware.assets.syntaxMode.hideAssets", false)
config.set("silverware.assets.syntaxMode.clickPlacesCursor", false)
```
