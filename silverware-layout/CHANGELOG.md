# Silverware Layout: changelog

## 2.0.3 (2026-11-21)

- Fixed: grids take the page's look again when its text size changes after they are drawn (a zoom), and a grid added to the page after a zoom takes the page's look then.

## 2.0.2 (2026-11-19)

- Panels, menus and dialogs scroll with a thin scrollbar, the same in every Silverware plugin; SilverBullet's own scrollbar is unchanged.

## 2.0.1 (2026-11-18)

- A grid's cell draws quotes, headings, bold text, code and `---` as the page does: their colours, font, sizes and spacing.
- Code in a cell highlighted in its language, with Silverware Editor installed.

## 2.0.0 (2026-11-17)

- **Breaking:** the command **Silverware Layout: Page layout** is now **Silverware Layout: Settings**: a keyboard shortcut or a toolbar button that runs it by its old name needs the new one. Your settings and the widths kept in your pages stay as they are.
- Columns: type **/grid** for cells side by side, or select text and run **Wrap in grid** (as a gallery, or split into columns) or **Move to grid**, also as Silverware Toolbar buttons.
- A grid's cell edited where it is (with Silverware Editor, drawn as the page draws it); text dragged into a cell, between cells and out of them; each cell moved, added, cleared or deleted from its grip.
- A grid's columns: their widths dragged (snapping to even shares), as many as fit (Auto, with a min width), lines between or round its cells, its width and place by the bar beside it; its links show in backlinks and follow a renamed page or file.
- Where a widget stands: a table, database, chart, grid or file at the left, in the middle or at the right, from the menu of the bar beside it; a default for each kind on the new **Alignment** tab.
- Embedded files (with Silverware Assets) made wider or narrower by the same bar, in a grid's cell snapping to a quarter, a half or three quarters of it.
- Font zoom by a pinch on a touch screen, and on any device by the **This device** row of the dialog; the files a page shows zoom with the text. Both can be turned off.
- The settings dialog reworked: tabs of rows alike, ↺ takes a value of your own back, the dialog fades while you hold a slider so you see the page; guides set by sliders, with **Hold to preview** and **Restore defaults**.
- Two changes to SilverBullet's own behaviour, each can be turned off: a click on a link shown as markdown only places the cursor (Ctrl+click opens it), and grids stay plain text in the plain markdown view.
- Works with SilverBullet's next version (3.0) as well as 2.12.1: settings saved to `Library/Config` where SilverBullet keeps them there.
- Fixes: a grid's cell draws its lists, quotes, tables, blank lines and embedded pages as the page does, in your theme's look, and a click on a blank line puts the cursor where you clicked; the font zoom's label stays above a toolbar docked at the bottom.

## 1.0.0 (2026-11-12)

First release.

- A page's text width, its own or a default for every page, in px or % of the editor, set in the Page layout dialog.
- Tables (Silverware Table), databases (Silverware Database) and charts (Silverware Chart) wider or narrower than the text: drag the bar beside one, and it snaps to the text's width and to guides of your own, in px or % of the editor.
- The editor's font size for every page, and Font zoom: Ctrl + scroll makes the font larger or smaller on this device, Ctrl+0 puts it back.
- By touch on a tablet; on a phone the text and widgets keep the screen's width.
