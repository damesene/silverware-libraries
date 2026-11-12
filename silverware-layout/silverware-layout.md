---
name: Library/damesene/silverware-layout
tags: meta/library
version: 1.0.0
description: "Silverware Layout: The width of a page's text (its own or a default for every page) and of its tables, databases and charts, wider or narrower than the text by a handle beside them that snaps to guides of your own; the editor's font size, and font zoom with Ctrl + scroll."
files:
- silverware-layout.js
- silverware-layout-init.md
- silverware-layout-api.md
- silverware-layout-style.md
---
# Silverware Layout

The layout of your pages: how wide a page's text is, how wide each of its tables, databases and charts is, and how large the editor's font is. Give one page a wider text (a page of tables), all of them a width of your own without touching your theme, one table or chart more room than the text has, or zoom the text with Ctrl + scroll.

## Page width

Run **Silverware Layout: Page layout** from the command palette. Its **Page width** tab has two rows:

- **All pages**: the width of every page without its own.
- **This page**: the width of this page alone.

Set a width with its slider, marked with your guides (it snaps to them), or type it, in **px** or in **%** of the editor's width (the px / % switch beside the number). A row without a width of its own shows the width it uses in grey, and says where it comes from (*Uses all pages' width*, *Uses your theme's width*); **↺** beside a width of its own takes it back.

Every row of the dialog works this way, the **Font** tab's too. The page shows each change at once; while you hold a slider, the dialog all but disappears, its slider alone left, so you see the page under it as it changes (on a phone too, where the dialog takes the screen). **Save** keeps it, **Cancel** (or Esc) puts the page back.

A page's own width is kept in its frontmatter:

```yaml
_layout:
  width: 1100
```

or `width: "90%"`. You can type it there too: the page follows as you type. Taking the width away (**↺** in the dialog) takes `_layout` away with it, where it holds nothing else.

## A widget's width

A table of Silverware Table, a database of Silverware Database and a chart of Silverware Chart can each be wider than the page's text, or narrower, as tables in Confluence: point at one (on a tablet, tap it), and a bar shows beside its right edge.

- **Drag the bar**: it grows (or shrinks) on both sides, staying centred on the text. While you drag, a faint line each side shows the page's width and each of your guides (900 px, 1200 px and Full width, unless you change them); the bar snaps to one as you come near it, and its lines darken a little. Let go, and the width is saved. Esc while dragging puts it back.
- **Double-click the bar** (double-tap it): it is as wide as the text again.

A width is never wider than the editor: in a narrower window, or on a phone, it is as wide as there is room (a table's columns in proportion, a chart drawn smaller). Each keeps its width itself:

- a table in its metadata (`layout.width='1200'`), so it needs Silverware Table's *Store table metadata* setting;
- a database in its block, a line `layout.width: 1200`;
- a chart in its block, a comment `%% layout.width: 1200` (in the Mermaid format; a format of your own that keeps no such line says so, and the width holds until the chart is drawn again).

Without Silverware Layout, each is as wide as the text, its width still kept.

## Font size

The dialog's **Font** tab sets the editor's font size: **All pages** for every page (your theme's size until you set one), by its slider or typed in px. Headings, code, tables and charts grow with it.

**Font zoom**: hold Ctrl and scroll over the page, and its font grows or shrinks a pixel a step, as the browser zooms. A label at the bottom left says the size for a moment, and says *default* where it is back at your default. **Ctrl+0** puts the default back. The size you zoom to is this device's alone, kept as the browser keeps its zoom, and never written into your space. On the Font tab, **This device** sets it too, by its slider or typed (on a phone, which has no Ctrl + scroll, that is how you zoom), and **↺** takes it off. Untick *Ctrl + scroll zooms here*, and Ctrl + scroll zooms the browser again. With the dialog open, Ctrl + scroll and Ctrl+0 set its **This device** row, as its slider does: **Save** keeps it, **Cancel** puts it back.

## Guides

The widths a widget snaps to, and the page's sliders are marked with. Change them in the dialog's **Guides** tab: set a width in its row by its slider (held, it shows the guides on the page as it moves) or type it, in **px** or in **%** of the editor's width (the px / % switch beside it), × takes one away, **+ Add guide** adds one, **Full width** is the editor's whole width. They show from the narrowest. A widget snapped to a guide in % keeps that share of the editor (`layout.width: 80%`): in a wider or narrower window it is still at the guide. Saved into your CONFIG, in a block of Silverware Layout's own.

Hold **Preview** (press it, or hold Space or Enter on it) to see the guides on the page as you typed them, the dialog out of the way meanwhile. **Default guides** puts the default ones back (900 px, 1200 px and Full width) once you confirm; **Save** keeps them, as everything in the dialog.

## Settings

In the Configuration Manager (Configuration: Open), under Silverware Layout, or in your CONFIG:

```lua
config.set("silverware.layout.textWidth", "1100px")
config.set("silverware.layout.minPaneWidth", 600)
config.set("silverware.layout.guides", { "900px", "1200px", "full" })
config.set("silverware.layout.fontSize", "18px")
config.set("silverware.layout.fontZoom.enabled", true)
```

- `textWidth`: the default text width, in px or % (empty: your theme's).
- `minPaneWidth`: where the editor is narrower than this (px), as on a phone, Silverware Layout sets no width: the text is as wide as the screen. Wider again (a phone turned), the widths come back.
- `guides`: the guides (see above), each a width in px (`"1200px"`), in % of the editor's width (`"80%"`), or `full` for the editor's whole width.
- `fontSize`: the editor's font size on every page, in px (empty: your theme's).
- `fontZoom.enabled`: whether Ctrl + scroll and Ctrl+0 zoom the font (see above).

## Good to know

- A page's own width wins over your theme's, even where your theme sets its width with `!important`.
- As a page is opened in a new window (or the window is reloaded), it shows at your theme's width for a moment, until SilverBullet has loaded its scripts.
