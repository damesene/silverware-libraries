---
name: Library/damesene/silverware-layout
tags: meta/library
version: 0.1.0
description: "Silverware Layout: the width of a page's text, its own or a default for every page, and of its tables, databases and charts, wider or narrower than the text."
files:
- silverware-layout.js
- silverware-layout-init.md
- silverware-layout-api.md
- silverware-layout-style.md
---
# Silverware Layout

The layout of your pages: how wide a page's text is, and how wide each of its tables, databases and charts is. Give one page a wider text (a page of tables), all of them a width of your own without touching your theme, or one table or chart more room than the text has.

## A page's text width

Run **Silverware Layout: Page layout** from the command palette. Its **Page** tab has two widths:

- **This page**: *Default* (the width of all pages) or *Own*.
- **All pages**: the width of pages without their own, *Theme* (your theme's) or *Own*.

Set a width with its slider, marked with your guides (it snaps to them), or type it, in **px** or in **%** of the editor's width (the px / % switch beside the number). Moving the slider or typing makes the width *Own*.

The page shows each change at once. **Save** keeps it, **Cancel** (or Esc) puts the page back.

A page's own width is kept in its frontmatter:

```yaml
_layout:
  width: 1100
```

or `width: "90%"`. You can type it there too: the page follows as you type. Taking the width away (*Default* in the dialog) takes `_layout` away with it, where it holds nothing else.

## A widget's width

A table of Silverware Table, a database of Silverware Database and a chart of Silverware Chart can each be wider than the page's text, or narrower, as tables in Confluence: point at one (on a tablet, tap it), and a bar shows beside its right edge.

- **Drag the bar**: it grows (or shrinks) on both sides, staying centred on the text. While you drag, a faint line each side shows the text's width and each of your guides (900 px, 1200 px and Full width, unless you change them); the bar snaps to one as you come near it, and its lines darken a little. Let go, and the width is saved. Esc while dragging puts it back.
- **Double-click the bar** (double-tap it): it is as wide as the text again.

A width is never wider than the editor: in a narrower window, or on a phone, it is as wide as there is room (a table's columns in proportion, a chart drawn smaller). Each keeps its width itself:

- a table in its metadata (`layout.width='1200'`), so it needs Silverware Table's *Store table metadata* setting;
- a database in its block, a line `layout.width: 1200`;
- a chart in its block, a comment `%% layout.width: 1200` (in the Mermaid format; a format of your own that keeps no such line says so, and the width holds until the chart is drawn again).

Without Silverware Layout, each is as wide as the text, its width still kept.

## Guides

The widths a widget snaps to, and the page's sliders are marked with. Change them in the dialog's **Guides** tab: type a width in its row, × takes one away, **+ Add guide** adds one, **Full width** is the editor's whole width. They show from the narrowest. Saved into your CONFIG, in a block of Silverware Layout's own.

## Settings

In the Configuration Manager (Configuration: Open), under Silverware Layout, or in your CONFIG:

```lua
config.set("silverware.layout.textWidth", "1100px")
config.set("silverware.layout.minPaneWidth", 600)
config.set("silverware.layout.guides", { "900px", "1200px", "full" })
```

- `textWidth`: the default text width, in px or % (empty: your theme's).
- `minPaneWidth`: where the editor is narrower than this (px), as on a phone, Silverware Layout sets no width: the text is as wide as the screen. Wider again (a phone turned), the widths come back.
- `guides`: the guides (see above), each a width in px, or `full` for the editor's whole width.

## Good to know

- A page's own width wins over your theme's, even where your theme sets its width with `!important`.
- As a page is opened in a new window (or the window is reloaded), it shows at your theme's width for a moment, until SilverBullet has loaded its scripts.
