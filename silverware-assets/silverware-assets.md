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
- **Preview**: smaller (a PDF in a small viewer).
- **Card**: a small card with the file's icon and name, the file itself not shown. A file SilverBullet cannot show (a zip, a document) is a card instead of an error.

Point at a file, and a **…** button shows at its top right: choose how it is shown there, or open it in a new tab, in a side panel or enlarged. On a card, its icon is that button (as a link's icon). A click on a card or a preview opens the file in a new tab; Shift+click does the same, unless you set otherwise: either can instead show the file in a panel at the window's right (**Show in a side panel**, the page still beside it) or enlarged over the page (**Show enlarged**). Esc or × closes them, and a click beside the enlarged file.

**Its width** (the original's: a preview keeps the size the settings give it), with [Silverware Layout](https://github.com/damesene/silverware-libraries/blob/main/silverware-layout/silverware-layout.md) installed: point at an image (or a video, a PDF as the original or as a preview), and the bar beside its right edge makes it wider or narrower, as a table's; it stays where it is and grows to the right (*Width dragged* below sets it centred instead). Let go, and the width is saved as SilverBullet's own size: `![[photo.png|Photo|300]]`.

## Links to files

**Links to files** (`[[report.pdf]]`) show the file's icon before their text, in a grid of Silverware Layout's too (a markdown link, `[report](report.pdf)`, only in a grid). Click the icon for what you can do with the file: open it in a new tab, show it in a side panel or enlarged, or **Show as embedded** (`[[report.pdf]]` becomes `![[report.pdf]]`); a click on the link's text opens it as SilverBullet does. An embedded file's **…** menu has **Show as a link** the other way (its alt text kept as the link's, its size and view left out). The settings' **Assets** tab turns the icons off.

## Where it is kept

What you choose is kept in the embed itself, after SilverBullet's own size:

```markdown
![[report.pdf|Report||{ view: icon }]]
![Photo|300|{ view: preview }](photo.png)
```

SilverBullet reads only the alt text and the size, so without Silverware Assets every file shows as SilverBullet shows it, at its size: nothing is lost. Keep the three parts, even an empty one (`||`): with two, SilverBullet would take the size for the alt text.

## Settings

**For all files, or for one kind of file**: run **Silverware Assets: Settings**; its **Assets** tab. Set how files are shown, what a click and a Shift+click do, whether a width dragged stays at the start or is centred, a preview's size (its width and height: an image fits in it, its proportions kept; a PDF's preview is that large) and an original PDF's height (one with a height of its own, `|200x120`, keeps it), and what a card shows besides the file's name (its icon, its size, its date), for all files; then, per kind (image, video, audio, PDF, file), anything other than that, a preview's size too ("Default", or a size left empty, follows all files). What a file's own `view` says wins over both.

Saved into your CONFIG, in a block of Silverware Assets' own.

Files in a grid's columns (Silverware Layout's) are shown the same way, and their bar makes them wider or narrower within their column: it snaps to a quarter, a half, three quarters and the whole of the column's width.

**SilverBullet's markdown as written** (*Editor: Toggle Markdown Syntax Rendering*): SilverBullet still draws embedded files in that mode; Silverware Assets hides them there, so you see their markdown alone. In that mode a click on a link only puts the cursor there (before an embed's `![[` too), the pointer a text one over it; Ctrl+click (Cmd+click) still follows it. Each can be turned off in the settings' **Markdown** tab (or in the Configuration Manager, under Silverware Assets):

```lua
config.set("silverware.assets.syntaxMode.hideAssets", false)
config.set("silverware.assets.syntaxMode.clickPlacesCursor", false)
```
