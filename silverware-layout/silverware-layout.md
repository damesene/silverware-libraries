---
name: Library/damesene/silverware-layout
tags: meta/library
version: 0.1.0
description: "Silverware Layout: the width of a page's text, its own or a default for every page, in px or % of the editor."
files:
- silverware-layout.js
- silverware-layout-init.md
- silverware-layout-api.md
- silverware-layout-style.md
---
# Silverware Layout

The layout of your pages. For now: how wide a page's text is. Give one page a wider text (a page of tables), or all of them a width of your own, without touching your theme.

## A page's text width

Run **Silverware Layout: Page layout** from the command palette. The dialog shows:

- **This page**: *Default* (the default below), one of the presets, or a width of its own: a number in **px**, or in **%** of the editor's width (the px / % switch beside the number).
- **Every page**: the default width of pages without their own. Empty: your theme's.

The page shows each change at once. **Save** keeps it, **Cancel** (or Esc) puts the page back.

A page's own width is kept in its frontmatter:

```yaml
_layout:
  width: 1100
```

or `width: "90%"`. You can type it there too: the page follows as you type. Taking the width away (*Default* in the dialog) takes `_layout` away with it, where it holds nothing else.

## Settings

In the Configuration Manager (Configuration: Open), under Silverware Layout, or in your CONFIG:

```lua
config.set("silverware.layout.textWidth", "1100px")
config.set("silverware.layout.minPaneWidth", 600)
config.set("silverware.layout.presets", {
  { name = "Wide", width = "1200px" },
  { name = "Full width", width = "full" },
})
```

- `textWidth`: the default text width, in px or % (empty: your theme's).
- `minPaneWidth`: where the editor is narrower than this (px), as on a phone, Silverware Layout sets no width: the text is as wide as the screen. Wider again (a phone turned), the widths come back.
- `presets`: the widths offered in one click; `full` is the editor's whole width.

## Good to know

- A page's own width wins over your theme's, even where your theme sets its width with `!important`.
- As a page is opened in a new window (or the window is reloaded), it shows at your theme's width for a moment, until SilverBullet has loaded its scripts.
