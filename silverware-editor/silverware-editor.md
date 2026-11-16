---
name: Library/damesene/silverware-editor
tags: meta/library
version: 1.0.0
description: "Silverware Editor: a markdown editor for the other Silverware plugins where they let you write (a grid's cell, a database item's content): markdown highlighted, lists continued on Enter, brackets closed, links to your pages completed. Without it they keep a plain text field."
files:
- silverware-editor.js
- silverware-editor-api.md
- silverware-editor-init.md
- silverware-editor-codemirror.js
---
# Silverware Editor

A markdown editor for the other Silverware plugins, where they let you write markdown in a field of their own: a column of [Silverware Layout](https://github.com/damesene/silverware-libraries/blob/main/silverware-layout/silverware-layout.md)'s grid as you edit it, an item's content in [Silverware Database](https://github.com/damesene/silverware-libraries/blob/main/silverware-database/silverware-database.md)'s side panel. Without this library they keep a plain text field; with it you get:

- **Markdown highlighted** in your theme's colours: headings, bold, italic, links, code, quotes.
- **Shown as SilverBullet shows it**: tasks as checkboxes you click to tick, done tasks struck through, bullets for list marks; the `**`, `#`, backticks and link brackets hidden, shown again where your cursor touches them; tables drawn as tables (click a cell to edit its markdown); embedded files drawn where the library using it draws them (in Silverware Layout's grid and a database's item, as Silverware Assets draws them in the page, a link to a file with its icon and menu too; without it, images); a backslash before a character (`\[`) hidden.
- **Lists and tasks continued** as you press Enter, indented with Tab.
- **Brackets closed** as you type them.
- **Links to your pages completed**: type `[[` and pick a page.
- **Links followed** where the library using it says so (a grid's cell, a database item's content): click a link to open its page or file (Ctrl+click or the middle button: in a new tab); Alt+click to put your cursor in it and edit it.
- **Its own undo and redo** (Ctrl+Z, Ctrl+Y) while you write in it; what you wrote goes into the page as one change, undone at once by SilverBullet's undo.
- **[Silverware Toolbar](https://github.com/damesene/silverware-libraries/blob/main/silverware-toolbar/silverware-toolbar.md) over it**: select text in it, and the toolbar shows over it as in the page.

It is not SilverBullet's own editor: what SilverBullet draws in a page as you write (the result of an expression) is not drawn in it, and its slash commands are not offered there.

The editor ([CodeMirror](https://codemirror.net), the editor SilverBullet is made with) comes with this library (installed beside it), so it works offline. It is loaded once SilverBullet has started, when the browser is idle.

## Good to know

- Install it beside the libraries that use it; it shows nothing on its own.
- The very first field opened right as SilverBullet starts may still be a plain text field: the editor is loaded a moment after.
