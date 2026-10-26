---
name: Library/damesene/silverware-toolbar
tags: meta/library
description: "Silverware Toolbar: select text and a toolbar beside it formats it, or turns a paragraph into a list, a heading or a quote and back."
files:
- silverware-toolbar.js
---
# Silverware Toolbar

Select text in a page and a toolbar shows beside it: make it bold, italic or code, link it, or turn its lines into a list, a heading or a quote and back. Every change is an ordinary edit of the markdown you can undo.

## At a glance

* **Select text** with the mouse or the keyboard: the toolbar shows above it (below it near the top of the page), with your favourite actions as icons. It goes when the selection does.
* **Click an icon** to apply it. Formats are toggles: *Bold* on bold text takes the bold off (also inside another format: in `**_word_**` it leaves `_word_`); an icon shown pressed is on for the whole selection. Turned on over text that has it in parts, it becomes one: `**a** b` bold is `**a b**`.
* **Turn into** shows the block format of your lines (*Bullet list*, *Heading 2*; *Multiple types* when they differ): click it for the list of block formats, the one your lines have checked, and pick one to turn every line selected into it. Picking the one they all have turns them back into paragraphs.
* **Every action**: the **…** button, or **Ctrl-Shift-q**, opens a list of every action under the toolbar, with a search field. Type to find (each word you type starts a word of an action's name: `num` finds *Numbered list*, `h2` *Heading 2*), **↑ ↓** to pick (Tab and Shift-Tab too, PageUp and PageDown by five), **Enter** to apply, **Esc** to close the list (a second **Esc** hides the toolbar). *Turn into* is one item there: **Enter** (or **→**) or a click opens its block formats in its place, and **Esc**, **←** or the arrow at the top goes back; typing finds the block formats straight away. The command *Silverware Toolbar: Show actions* is the same.
* **Without a selection**, **Ctrl-Shift-q** shows the toolbar at the cursor with the list open. Its icons show the formats around the cursor: in a link, *Link* is pressed, and clicking it takes the link off. Typing or moving the cursor hides it.
* The key is a setting (*Key for every action*). In Firefox on Windows, **Ctrl-Shift-q** quits the browser: choose another key there.
* **On a phone** (text selected by touch) the toolbar is docked at the bottom, over the keyboard, as one row you scroll sideways (**…** always at its end): the system's own menu (Cut, Copy, Paste) shows by the selection, where the toolbar would be. *Where the toolbar shows* (a setting) keeps it by the selection, or docked always. SilverBullet's own bar over the keyboard, where it is on, stays under it; the settings offer to turn that one off.

## Actions

| Action | Its id (for favourites) | What it does |
|---|---|---|
| Bold | `formats.bold` | `**text**`; also takes `__text__` off |
| Italic | `formats.italic` | `_text_`; also takes `*text*` off |
| Strikethrough | `formats.strikethrough` | `~~text~~` |
| Highlight | `formats.highlight` | `==text==` |
| Code | `formats.code` | `` `text` ``; the formats inside it are taken off, and no format goes inside code |
| Link | `formats.link` | `[text](…)`, the cursor where the URL goes; a URL selected becomes the link's target, the cursor where its text goes; nothing selected: `[link](…)`. In a link (selected, or the cursor in its text): the link taken off, its text kept |
| Wiki link | `formats.wikiLink` | `[[text]]`, and back (a wiki link with an alias leaves the alias) |
| Clear formatting | `actions.clear` | Takes bold, italic, strikethrough, highlight and code off the selection, its text kept |
| Turn into | `actions.turnInto` | The list of the block formats below |
| Any SilverBullet command | `commands.<its name>`, e.g. `commands.Navigate: Home` | Runs it, as the command palette does. There are many: type a command's name in the **…** list to find it (they are not listed until you type) |
| Silverware Toolbar settings… | `actions.settings` | The settings dialog (see *Settings*), last in the **…** list |
| Paragraph | `formats.paragraph` | Plain lines: a list's, a heading's or a quote's marker taken off |
| Heading 1, 2, 3 | `formats.heading1` … `formats.heading3` | `# `, `## `, `### ` |
| Bullet list | `formats.bullet` | `- ` (a list's indentation kept) |
| Numbered list | `formats.numbered` | `1. `, `2. `, … from 1 at each depth |
| Task | `formats.task` | `- [ ] ` (a task done stays done) |
| Quote | `formats.quote` | `> ` |

Formats apply line by line: a list's marker or a heading's `#` is left out, and so are the spaces at the selection's ends. Nothing applies inside a fenced code block; tables, rules and code fences are not turned into another block.

## Favourites

The toolbar shows your favourites: rows, one under another, each a list of items. An item is an action by its `id` (see *Actions*; its `type` is `"action"`, which can be left out), shown as its icon, or with `show = "label"` as its icon and its name, or a separator (`type = "separator"`). An action that offers a list (*Turn into*) has an arrow, and shows the choice your selection has. Every action stays in the **…** list, at the end of the last row. An id no action has (a module turned off, a custom format not defined) is left out. The default:

```lua
config.set("silverware.toolbar.favorites", {
  { { id = "actions.turnInto", show = "label" } },
  { { id = "formats.bold" }, { id = "formats.italic" }, { id = "formats.code" }, { type = "separator" }, { id = "formats.link" }, { id = "formats.highlight" } },
})
```

In the **…** list, the star by an action puts it at the end of the toolbar's last row, or takes it out (**Alt+Enter** does it for the action picked); it is saved at once. The settings dialog's *Favorites* tab edits them without writing Lua (see *Settings*).

## Settings

*Silverware Toolbar settings…*, the last item of the **…** list (or the command *Silverware Toolbar: Settings*), opens the settings, for every page in the space:

* **General**: the key for every action, as SilverBullet writes keys (`Ctrl-Shift-q`, `Alt-k`), and where the toolbar shows. On a phone with SilverBullet's keyboard bar on, it offers to turn that bar off (on that device, at once).
* **Favorites**: the toolbar's rows, one under another. Drag an item within its row or into another, or with the keyboard: focus it (Tab) and press **Alt+←** or **Alt+→** to move it within its row, **Alt+↑** or **Alt+↓** into the row above or below, **Delete** to remove it. The button beside an action's name shows it as its icon or with its name too; **×** removes it. **Add** searches every action (and a separator) to add at the row's end; **Add row** adds a row. A row left empty is left out. An item no action has is dimmed, named by its id.
* **Modules**: each part of the toolbar on or off (its actions with it).

Nothing changes until **Save**. The favourites and where the toolbar shows apply at once; a module or the key needs the page loaded again (**Save and reload**). They are saved in your `CONFIG` page: the key and the modules in the block SilverBullet's own settings (*Configuration: Open*) keep, so either shows what the other wrote; the favourites in a block of their own (`-- managed-by: silverware-toolbar`), which SilverBullet's settings leave alone. You can edit both by hand too.

## Custom formats

Add formats of your own, or replace a built-in one, in a JS file of your space, and give them to Silverware Toolbar in Space Lua:

```lua
silverware.toolbar.defineFormats(js.importFromSpace("Library/me/formats.js"))
```

The file exports a list of formats, or a function that gets the helpers and returns them. A format of a built-in one's name replaces it (its id stays, so favourites keep working); the others are added after the built-in ones. Each is `formats.<name>`:

```js
export default (helpers) => [
  // A block format: a callout, offered in Turn into
  { name: "callout", scope: "block", label: "Callout", marker: "> [!note] " },
  // An inline format of markers: ^superscript^
  { name: "superscript", scope: "inline", label: "Superscript", marker: "^" },
  // An inline format of its own: <kbd>key</kbd>, recognized with the cursor in it too
  {
    name: "kbd",
    scope: "inline",
    label: "Key",
    read: (text, { before, after }) => {
      const whole = /^<kbd>(.*)<\/kbd>$/.exec(text);
      if (whole) return whole[1];
      // The cursor (or a part selected) in its text: "<kbd>Ct" before, "rl</kbd>" after
      const start = before.touching(/<kbd>[^<]*/);
      const end = after.touching(/[^<]*<\/kbd>/);
      return start && end ? { text: start.slice(5) + text + end.slice(0, -6), start, end } : undefined;
    },
    write: (text) => `<kbd>${text || helpers.cursor()}</kbd>`,
  },
];
```

* `name` (letters, digits, `_`), `scope`: `"block"` (whole lines, one format per line, offered in *Turn into*) or `"inline"` (the text selected, formats combine, an action and an icon of its own).
* `label` offers it (without one it is only recognized), `icon` (an SVG, else its first letter), `group` (the list's group, inline), `keywords` (more words the search finds it by).
* `marker`: a block's prefix (the indentation dropped: `"## "`), or an inline format's sign written around the text, once or more (`"**"`, `"=="`; a list: the first written, every one recognized, as bold's `["**", "__"]`).
* Else `read` and `write`. A block's `read(text, { index, indent })` gets the line after its indentation and gives its text after the marker, or `undefined` when the line is not this format; `write(text, { index, indent })` gives the line (keep `indent` for a list). With `multiline: true`, `write(items)` gets every line as `{ text, indent, index }` and gives their lines (a numbered list counts them: `helpers.numberByIndent(items)`). A block format without `write` is only recognized: its lines are left as they are.
* An inline `read(text, { before, after, index })` gets the text selected (empty for the cursor) and the line's text around it: `before.text`, `after.text`, and `before.touching(x)` / `after.touching(x)`, what touches the selection: a string, a regex's match, or so many characters. It gives the plain text when the selection is the format, or `{ text, start, end }` when the format reaches past the selection (`start`, `end`: the parts of `before` and `after` it covers), else `undefined`. `write(text, { index })` gives the text formatted. `literal: true`: its content is not formatted (as code).
* In what `write` gives, `helpers.cursor()` marks where the cursor goes, `helpers.cursor("url")` writes `url` selected. `afterWrite(written, editor)` runs after it is written: `editor.select(from, to)`, relative to `written.text`.
* Helpers: `cursor`, `isUrl(text)`, `numberByIndent(items)`, `icons` (the built-in icons).

A mistake in a definition is a notification; a format whose `read` or `write` fails shows that when it is used, and nothing is written. Definitions are made again each time Space Lua loads.

## Custom actions

Actions that are not a format, with code of their own, the same way:

```lua
silverware.toolbar.defineActions(js.importFromSpace("Library/me/actions.js"))
```

```js
export default (helpers) => [
  {
    name: "upper",
    label: "Upper case",
    run: (context) => ({ from: context.from, to: context.to, text: context.text.slice(context.from, context.to).toUpperCase() }),
  },
];
```

Each is `actions.<name>` (one of a built-in action's name, `turnInto` or `clear`, replaces it). `run(context)` gets the page's `text`, the selection's `from` and `to`, and the `lines` it touches, and gives `{ from, to, text }`: the text replacing that part of the page (`helpers.cursor()` in it marks the cursor), or nothing. Also `icon`, `group` (else *Custom*), `keywords`, `enabled(context)` and `active(context)` (false: shown dimmed; true: shown pressed), `afterWrite`.

Instead of `run`, an action may offer `choices`: a list of actions, as *Turn into* does. In the toolbar it shows the choice that is `active` (its icon and label; none: its `mixed` text, else its label), and a click opens the list; in the list of every action it is one item that opens them, and the search finds them too.

## Implementation

```space-lua
-- priority: 50
-- Silverware Toolbar's Space Lua API, loaded before your scripts (they have priority 0
-- unless they say otherwise): silverware.toolbar.defineFormats and
-- silverware.toolbar.defineActions, see "Custom formats" and "Custom actions"
silverware = silverware or {}
silverware.toolbar = silverware.toolbar or {}
if js and js.window then
  local silverwareToolbarJs = js.importFromSpace("Library/damesene/silverware-toolbar.js")
  -- Space Lua is loaded (again): the scripts' definitions replace those of before (kept until then)
  silverwareToolbarJs.resetDefinitions()
  -- The others are defined; a mistake is shown, the rest of the script goes on
  local function shown(problem)
    if problem then
      editor.flashNotification(problem, "error")
    end
  end
  function silverware.toolbar.defineFormats(definitions)
    shown(silverwareToolbarJs.defineFormats(definitions))
  end
  function silverware.toolbar.defineActions(definitions)
    shown(silverwareToolbarJs.defineActions(definitions))
  end
else
  -- Space Lua without a window (no toolbar to show): nothing to define
  function silverware.toolbar.defineFormats() end
  function silverware.toolbar.defineActions() end
end
```

```space-lua
-- Settings, shown in the Configuration Manager (Configuration: Open)
config.defineCategory {
  name = "Silverware Toolbar",
  description = "A toolbar beside the text selected.",
  priority = 4,
}

config.define("silverware.toolbar", {
  description = "Silverware Toolbar settings",
  type = "object",
  properties = {
    favorites = {
      type = "array",
      items = {
        type = "array",
        items = {
          type = "object",
          additionalProperties = false,
          properties = {
            type = { type = "string", enum = { "action", "separator" } },
            id = { type = "string" },
            show = { type = "string", enum = { "icon", "label" } },
          },
        },
      },
      default = {
        { { id = "actions.turnInto", show = "label" } },
        { { id = "formats.bold" }, { id = "formats.italic" }, { id = "formats.code" }, { type = "separator" }, { id = "formats.link" }, { id = "formats.highlight" } },
      },
      description = "The toolbar's rows, each a list of items: { id = <its id>, show = \"icon\" or \"label\" }, or { type = \"separator\" } (every action is in the list of the … button).",
      ui = { category = "Silverware Toolbar", label = "Favourite actions", priority = 2 },
    },
    shortcut = {
      type = "string",
      default = "Ctrl-Shift-q",
      description = "The key that shows every action (with nothing selected, the toolbar at the cursor), as SilverBullet writes keys. Applies after a reload.",
      ui = { category = "Silverware Toolbar", label = "Key for every action", priority = 1 },
    },
    placement = {
      type = "string",
      enum = { "auto", "selection", "bottom" },
      default = "auto",
      description = "Where the toolbar shows: auto docks it at the bottom, over the keyboard, when the text was selected by touch (on a phone the system's Cut / Copy / Paste menu is by the selection), else by the selection; selection always by it; bottom always docked.",
      ui = { category = "Silverware Toolbar", label = "Where the toolbar shows", priority = 0.95 },
    },
    modules = {
      type = "object",
      additionalProperties = false,
      properties = {
        inline = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Bold, italic, strikethrough, highlight, code, links and wiki links.", ui = { category = "Silverware Toolbar", label = "Inline formats", priority = 0.9 } } } },
        blocks = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Turn lines into a paragraph, a heading, a list, a task or a quote.", ui = { category = "Silverware Toolbar", label = "Turn into", priority = 0.8 } } } },
        clear = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Remove the inline formats of the selection.", ui = { category = "Silverware Toolbar", label = "Clear formatting", priority = 0.6 } } } },
        commands = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Every SilverBullet command, found by typing its name in the list of every action, and as a favourite.", ui = { category = "Silverware Toolbar", label = "Commands", priority = 0.5 } } } },
      },
    },
  },
})

-- Silverware Toolbar only uses the public editor and config API, handed over here
if js and js.window then
  local silverwareToolbarJs = js.importFromSpace("Library/damesene/silverware-toolbar.js")
  silverwareToolbarJs.init({
    getSelection = editor.getSelection,
    setSelection = editor.setSelection,
    replaceRange = editor.replaceRange,
    getText = editor.getText,
    flash = editor.flashNotification,
    focus = editor.focus,
    getConfig = config.get,
    confirm = editor.confirm,
    readPage = space.readPage,
    -- The settings dialog: saved as SilverBullet's Configuration Manager saves
    -- (the CONFIG page, indexed, the configuration loaded again)
    saveConfigPage = function(text)
      space.writePage("CONFIG", text)
      -- Written: the rest only loads it; a failure there says so, the page is saved
      local ok, err = pcall(function()
        if sync and sync.performFileSync then sync.performFileSync("CONFIG.md") end
        mq.send("indexQueue", "CONFIG.md")
        mq.awaitEmptyQueue("indexQueue")
        editor.reloadConfigAndCommands()
        if editor.rebuildEditorState then editor.rebuildEditorState() end
      end)
      if not ok then
        editor.flashNotification("Silverware Toolbar: the settings are saved in CONFIG, but loading them failed (" .. tostring(err) .. "): reload the page", "error")
      end
    end,
    reloadUI = editor.reloadUI,
    -- The commands module: SilverBullet's commands, run on the editor's selection
    listCommands = system.listCommands,
    invokeCommand = editor.invokeCommand,
    -- Whether SilverBullet's keyboard bar is on (the settings offer to turn it off on a phone)
    getUiOption = editor.getUiOption,
  })
  command.define {
    name = "Silverware Toolbar: Settings",
    run = function()
      silverwareToolbarJs.openSettings()
    end,
  }
  -- The key is the command's: SilverBullet handles it (and shows it in the command palette)
  command.define {
    name = "Silverware Toolbar: Show actions",
    key = config.get("silverware.toolbar.shortcut", "Ctrl-Shift-q"),
    run = function()
      silverwareToolbarJs.showActions()
    end,
  }
end
```

```space-style
/* Silverware Toolbar (prefix swb-): the toolbar by the selection, the list
   of a button's choices under it, the popup of every action. Over the page and
   SilverBullet's top bar (z-index 20), under its dialogs. Hidden with
   display: none !important: themes set display on every button with
   !important (Tiniri does) */
.swb-floating {
  position: fixed;
  z-index: 60;
  display: none !important;
  box-sizing: border-box;
  font: 13px/1.3 var(--ui-font, system-ui, sans-serif);
  color: var(--root-color, #222);
  background: var(--root-background-color, #fff);
  border: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
}
.swb-floating.swb-visible {
  display: flex !important;
}
.swb-floating svg {
  width: 18px;
  height: 18px;
  flex: none;
}
/* The toolbar: icons in a row */
.swb-bar {
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 3px;
}
.swb-button {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.swb-button:hover:not(:disabled),
.swb-button[aria-expanded="true"] {
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-button[aria-pressed="true"] {
  color: var(--ui-accent-color, #464cfc);
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 14%, transparent);
}
.swb-button:disabled {
  opacity: 0.35;
  cursor: default;
}
/* A row of the favourites */
.swb-row {
  display: flex;
  align-items: center;
  gap: 2px;
}
/* Docked at the bottom (a phone): one row across the window over the keyboard, scrolled sideways, … at its end */
.swb-bar.swb-docked {
  flex-direction: row;
  align-items: center;
  box-sizing: border-box;
  width: 100vw;
  max-width: none;
  padding: 4px 4px 4px 6px;
  border-width: 1px 0 0;
  border-radius: 0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.12);
}
.swb-bar.swb-docked .swb-dock-items {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  touch-action: pan-x;
}
.swb-bar.swb-docked .swb-dock-items::-webkit-scrollbar {
  display: none;
}
.swb-bar.swb-docked .swb-button {
  flex: none;
  width: 40px;
  height: 36px;
}
.swb-bar.swb-docked .swb-button.swb-labeled,
.swb-bar.swb-docked .swb-button.swb-choices {
  width: auto;
}
.swb-bar.swb-docked .swb-more {
  flex: none;
  margin-left: 2px;
}
/* An action with its label, one offering choices with a chevron (its choice on) */
.swb-button.swb-labeled,
.swb-button.swb-choices {
  width: auto;
  gap: 6px;
  padding: 0 6px;
  font: inherit;
}
.swb-button.swb-labeled {
  max-width: 200px;
}
.swb-button .swb-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.swb-button.swb-choices:not(.swb-labeled) {
  gap: 0;
  padding: 0 2px 0 6px;
}
.swb-button.swb-choices svg:last-child {
  width: 14px;
  height: 14px;
  opacity: 0.6;
}
.swb-divider {
  width: 1px;
  align-self: stretch;
  margin: 4px 3px;
  background: var(--button-border-color, rgba(128, 128, 128, 0.35));
}
/* A list of choices (under a button), the popup's actions */
.swb-menu,
.swb-popup {
  flex-direction: column;
}
.swb-menu {
  min-width: 180px;
  padding: 4px;
}
.swb-menu-item,
.swb-option {
  display: flex !important;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 30px;
  padding: 4px 8px;
  text-align: left;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.swb-menu-item:hover:not(:disabled),
.swb-option.swb-current {
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 14%, transparent);
}
.swb-menu-item:disabled,
.swb-option[aria-disabled="true"] {
  opacity: 0.4;
  cursor: default;
}
.swb-icon {
  display: inline-flex;
  opacity: 0.8;
}
.swb-label {
  flex: 1;
}
.swb-check {
  display: inline-flex;
  color: var(--ui-accent-color, #464cfc);
}
.swb-check:empty {
  width: 18px;
}
/* An action's star (in the toolbar or not): shown on the action under the pointer or current, and always while it is a favourite */
.swb-star {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  opacity: 0;
  cursor: pointer;
}
.swb-option:hover .swb-star,
.swb-option.swb-current .swb-star {
  opacity: 0.55;
}
.swb-star[aria-pressed="true"] {
  opacity: 1 !important;
  color: var(--ui-accent-color, #464cfc);
}
.swb-star:hover {
  opacity: 1 !important;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-star svg {
  width: 16px;
  height: 16px;
}
/* The popup: a search field over the actions found */
.swb-popup {
  width: 320px;
  max-height: min(420px, 70vh);
}
.swb-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
  opacity: 0.9;
}
.swb-search-field {
  flex: 1;
  min-width: 0;
  padding: 2px 0;
  font: inherit;
  font-size: 14px;
  color: inherit;
  background: none;
  border: 0;
  outline: none;
}
.swb-list {
  overflow-y: auto;
  padding: 4px;
}
.swb-group {
  padding: 8px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.swb-none {
  padding: 12px 8px;
  opacity: 0.6;
}
/* An action's choices open in the popup: the way back over them, its label the title */
.swb-back {
  display: flex !important;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  font: inherit;
  font-weight: 600;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.swb-back:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}

/* The settings dialog (Silverware Toolbar settings…, "Silverware Toolbar: Settings"):
   Silverware Table's settings' look, tabs, rows in cards, switches */
.swb-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--modal-backdrop-color, rgba(0, 0, 0, 0.35));
  font-family: var(--ui-font, system-ui, sans-serif);
}
.swb-settings {
  --swb-settings-line: var(--button-border-color, rgba(128, 128, 128, 0.3));
  --swb-settings-card: color-mix(in srgb, var(--root-color) 4%, var(--root-background-color));
  /* As tall as its content, as far as the window has room; then its body scrolls */
  display: flex;
  flex-direction: column;
  width: min(600px, calc(100vw - 24px));
  max-height: calc(100vh - 32px);
  max-height: calc(100dvh - 32px);
  color: var(--root-color);
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
  font-size: 14px;
  overflow: hidden;
}
.swb-settings:focus {
  outline: none;
}
.swb-settings button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.swb-settings-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px 8px;
}
.swb-settings-titles {
  flex: 1;
  min-width: 0;
}
.swb-settings-title {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
}
.swb-settings-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.65;
}
.swb-settings-close {
  display: inline-flex;
  padding: 5px;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.65;
}
.swb-settings-close:hover {
  opacity: 1;
  background: var(--swb-settings-card);
}
.swb-settings-close svg {
  width: 16px;
  height: 16px;
}
/* One row however many tabs: too wide for the dialog (a phone), it scrolls sideways */
.swb-settings-tabs {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--swb-settings-line);
}
.swb-settings-tab {
  flex: none;
  white-space: nowrap;
  padding: 7px 10px;
  margin-bottom: -1px;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  opacity: 0.7;
}
.swb-settings-tab:hover {
  opacity: 1;
}
.swb-settings-tab[aria-selected="true"] {
  opacity: 1;
  font-weight: 600;
  border-bottom-color: var(--ui-accent-color);
}
.swb-settings-body {
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 16px 12px;
}
.swb-settings-panel[hidden] {
  display: none;
}
.swb-settings-group {
  margin: 14px 2px 6px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.6;
}
.swb-settings-panel > .swb-settings-card:first-child {
  margin-top: 12px;
}
.swb-settings-card {
  background: var(--swb-settings-card);
  border: 1px solid var(--swb-settings-line);
  border-radius: 8px;
}
.swb-settings-card > :not(:first-child) {
  border-top: 1px solid var(--swb-settings-line);
}
.swb-settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
}
.swb-settings-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.swb-settings-module-name,
.swb-settings-name {
  font-weight: 500;
}
.swb-settings-hint {
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.62;
}
.swb-settings-row select,
.swb-settings-row input[type="number"] {
  flex: none;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
  padding: 4px 8px;
}
.swb-settings-row select {
  max-width: 55%;
}
.swb-settings-row input[type="number"] {
  width: 6.5em;
}
.swb-settings-row input.swb-settings-invalid {
  border-color: var(--danger-color, #c62828);
}
/* A switch: the checkbox (invisible, still focusable) drawn as a track and a knob */
.swb-settings-switch {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
}
.swb-settings-switch input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.swb-settings-knob {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: color-mix(in srgb, var(--root-color) 22%, var(--root-background-color));
  transition: background 0.15s;
  pointer-events: none;
}
.swb-settings-knob::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s;
}
.swb-settings-switch input:checked + .swb-settings-knob {
  background: var(--ui-accent-color);
}
.swb-settings-switch input:checked + .swb-settings-knob::after {
  transform: translateX(14px);
}
.swb-settings-switch input:focus-visible + .swb-settings-knob {
  outline: 2px solid var(--ui-accent-color);
  outline-offset: 2px;
}
.swb-settings-switch input:disabled + .swb-settings-knob {
  opacity: 0.5;
}
/* A module's own settings: under it, indented, while it is on */
.swb-settings-module-settings {
  margin: 0 12px 10px 24px;
  border-left: 2px solid var(--swb-settings-line);
}
.swb-settings-module-settings .swb-settings-row {
  padding: 6px 0 6px 12px;
}
.swb-settings-module-settings[hidden] {
  display: none;
}
.swb-settings-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 12px;
  border-top: 1px solid var(--swb-settings-line);
}
.swb-settings-note {
  flex: 1;
  font-size: 12px;
  opacity: 0.75;
}
.swb-settings-cancel,
.swb-settings-save {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--swb-settings-line);
  background: var(--root-background-color);
}
.swb-settings-save {
  color: #fff !important;
  background: var(--ui-accent-color);
  border-color: var(--ui-accent-color);
}
.swb-settings-save:disabled {
  opacity: 0.45;
  cursor: default;
}
@media (max-width: 480px), (pointer: coarse) and (max-height: 600px) {
  .swb-settings {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    max-height: none;
    border: 0;
    border-radius: 0;
  }
  .swb-settings-body {
    flex: 1 1 auto;
  }
  .swb-settings-tab {
    padding: 10px 12px;
  }
  .swb-settings-row {
    min-height: 44px;
  }
  .swb-settings-cancel,
  .swb-settings-save {
    padding: 10px 18px;
  }
  .swb-settings-row {
    flex-wrap: wrap;
  }
  .swb-settings-row select {
    max-width: 100%;
  }
  .swb-settings-row select,
  .swb-settings-row input[type="number"] {
    font-size: 16px;
  }
}

/* The settings' own controls: the key's field, the favourites' rows of items
   (dragged, moved with Alt+arrows), the search of actions to add */
.swb-settings-row input.swb-settings-key {
  width: 160px;
  flex: 0 0 auto;
  padding: 5px 8px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-intro {
  margin: 0 0 12px;
  opacity: 0.75;
  font-size: 13px;
}
.swb-settings-favrow {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--swb-settings-card);
  border: 1px solid var(--swb-settings-line);
  border-radius: 8px;
}
.swb-settings-favhead {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.7;
}
.swb-settings-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 34px;
  padding: 2px;
  border-radius: 6px;
}
.swb-settings-items.swb-settings-drop-end {
  box-shadow: inset 0 0 0 2px var(--ui-accent-color, #464cfc);
}
.swb-settings-empty {
  align-self: center;
  padding: 0 6px;
  opacity: 0.55;
  font-size: 13px;
}
.swb-settings-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 8px;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.swb-settings-item:focus-visible {
  outline: 2px solid var(--ui-accent-color, #464cfc);
  outline-offset: 1px;
}
.swb-settings-item.swb-settings-dragged {
  opacity: 0.45;
  cursor: grabbing;
}
.swb-settings-item.swb-settings-drop-before {
  box-shadow: -3px 0 0 var(--ui-accent-color, #464cfc);
}
.swb-settings-item.swb-settings-drop-after {
  box-shadow: 3px 0 0 var(--ui-accent-color, #464cfc);
}
.swb-settings-item.swb-settings-unknown {
  opacity: 0.5;
  border-style: dashed;
}
.swb-settings-item.swb-settings-separator .swb-settings-item-icon::before {
  content: "";
  display: block;
  width: 1px;
  height: 16px;
  margin: 0 auto;
  background: currentColor;
  opacity: 0.6;
}
.swb-settings-item-icon {
  display: inline-flex;
  width: 18px;
  justify-content: center;
}
.swb-settings-item-icon svg {
  width: 18px;
  height: 18px;
}
.swb-settings-show,
.swb-settings-remove {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 4px;
  opacity: 0.7;
}
.swb-settings-show:hover,
.swb-settings-remove:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-settings-show[aria-pressed="true"] {
  opacity: 1;
  color: var(--ui-accent-color, #464cfc);
}
.swb-settings-show svg,
.swb-settings-remove svg {
  width: 16px;
  height: 16px;
}
.swb-settings-add,
.swb-settings-add-row {
  margin-top: 8px;
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-add:hover,
.swb-settings-add-row:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.swb-settings-picker {
  margin-top: 8px;
}
.swb-settings-pick-field {
  box-sizing: border-box;
  width: 100%;
  padding: 6px 8px;
  font: inherit;
  color: inherit;
  background: var(--root-background-color);
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-pick-list {
  max-height: 220px;
  margin-top: 4px;
  overflow-y: auto;
}
.swb-settings-pick {
  display: flex !important;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 6px;
}
.swb-settings-pick:hover,
.swb-settings-pick:focus-visible {
  background: color-mix(in srgb, currentColor 8%, transparent);
  outline: none;
}
.swb-settings-pick-label {
  flex: 1 1 auto;
}
.swb-settings-pick-group {
  font-size: 12px;
  opacity: 0.6;
}
.swb-settings-pick-separator .swb-settings-item-icon::before {
  content: "";
  display: block;
  width: 1px;
  height: 16px;
  margin: 0 auto;
  background: currentColor;
  opacity: 0.6;
}
.swb-settings-pick-none {
  padding: 8px;
  opacity: 0.6;
}
/* Advice under the settings (SilverBullet's keyboard bar on): its button as the dialog's others */
.swb-settings-advice {
  margin-top: 12px;
  border-color: color-mix(in srgb, var(--ui-accent-color, #464cfc) 45%, var(--swb-settings-line));
}
.swb-settings-advice-button {
  flex: none;
  padding: 5px 12px;
  background: none;
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-advice-button:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
```
