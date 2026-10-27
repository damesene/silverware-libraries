---
name: Library/damesene/silverware-toolbar
tags: meta/library
description: "Silverware Toolbar: select text and a toolbar beside it (over the keyboard on a phone) formats it, turns its lines into a list, a heading, a quote or a code block and back, and runs any action or command; gesture buttons, text snippets and an emoji picker."
files:
- silverware-toolbar.js
- silverware-toolbar-emoji.js
---
# Silverware Toolbar

Select text in a page and a toolbar shows beside it: make it bold, italic or code, link it, or turn its lines into a list, a heading or a quote and back. Every change is an ordinary edit of the markdown you can undo.

## At a glance

* **Select text** with the mouse or the keyboard: the toolbar shows above it, to its left so what you read beside it stays in view (as far left as the window allows; below it near the top of the page), with your favourite actions as icons. It goes when the selection does.
* **Click an icon** to apply it. Formats are toggles: *Bold* on bold text takes the bold off (also inside another format: in `**_word_**` it leaves `_word_`); an icon shown pressed is on for the whole selection. Turned on over text that has it in parts, it becomes one: `**a** b` bold is `**a b**`.
* **Turn into** shows the block format of your lines (*Bullet list*, *Heading 2*; *Multiple types* when they differ): click it for the list of block formats, the one your lines have checked, and pick one to turn every line selected into it. Picking the one they all have turns them back into paragraphs.
* **Every action**: the **…** button, or **Ctrl-Shift-q**, opens a list of every action under the toolbar, with a search field. Type to find (each word you type starts a word of an action's name: `num` finds *Numbered list*, `h2` *Heading 2*), **↑ ↓** to pick (Tab and Shift-Tab too, PageUp and PageDown by five), **Enter** to apply, **Esc** to close the list (a second **Esc** hides the toolbar). *Turn into* is one item there: **Enter** (or **→**) or a click opens its block formats in its place, and **Esc**, **←** or the arrow at the top goes back; typing finds the block formats straight away. The command *Silverware Toolbar: Show actions* is the same.
* **Without a selection**, **Ctrl-Shift-q** shows the toolbar at the cursor with the list open. Its icons show the formats around the cursor: in a link, *Link* is pressed, and clicking it takes the link off. Typing or moving the cursor hides it.
* The key is a setting (*Key for every action*). In Firefox on Windows, **Ctrl-Shift-q** quits the browser: choose another key there.
* **On a phone** (text selected by touch) the toolbar is docked at the bottom, over the keyboard, as one row you scroll sideways (a shade at an end there is more to scroll to; **…** always at its end): the system's own menu (Cut, Copy, Paste) shows by the selection, where the toolbar would be. *Where the toolbar shows* (a setting) keeps it by the selection, or docked always. On a phone it stays there while you write, with nothing selected too, its buttons showing the formats around the cursor; *When the toolbar shows* makes it always (also by the cursor on a computer) or only after selecting text. SilverBullet's own bar over the keyboard, where it is on, stays under it; the settings offer to turn that one off.

## Actions

| Action | Its id (for favourites) | What it does |
|---|---|---|
| Bold | `formats.bold` | `**text**`; also takes `__text__` off |
| Italic | `formats.italic` | `_text_`; also takes `*text*` off |
| Underline | `formats.underline` | `<u>text</u>` (markdown has no underline of its own; SilverBullet shows the HTML tag underlined), and back |
| Strikethrough | `formats.strikethrough` | `~~text~~` |
| Highlight | `formats.highlight` | `==text==` |
| Code | `formats.code` | `` `text` ``; the formats inside it are taken off, and no format goes inside code |
| Link | `formats.link` | `[text](…)`, the cursor where the URL goes; a URL selected becomes the link's target, the cursor where its text goes; nothing selected: `[link](…)`. In a link (selected, or the cursor in its text): the link taken off, its text kept |
| Wiki link | `formats.wikiLink` | `[[text]]`, and back (a wiki link with an alias leaves the alias) |
| Tag | `formats.tag` | `#text`, and back; a text that cannot be a tag of one word (spaces, digits alone) `#<text>`; nothing selected: `#` and the cursor |
| Clear formatting | `actions.clear` | Takes bold, italic, underline, strikethrough, highlight and code off the selection, its text kept (links stay) |
| Turn into | `actions.turnInto` | The list of the block formats below |
| Any SilverBullet command | `commands.<its name>`, e.g. `commands.Navigate: Home` | Runs it, as the command palette does. There are many: type a command's name in the **…** list to find it (they are not listed until you type) |
| Hide the keyboard | `actions.hideKeyboard` | On a phone or tablet: hides the on-screen keyboard, the selection kept as it is, the toolbar staying (to see more of the page while you format it); the next tap in the text brings the keyboard back. Put it in your favourites to have it in the bar at the bottom. (Where the browser cannot hide it alone, Safari on iOS, the text is left: the keyboard and the bar go.) |
| Emoji | `actions.emoji` | A picker of every emoji, its groups over the search as filters (*All*, then each group by its emoji: only that group's shown, and searched): type to find one by its name or keywords (in English: `heart`, `thumb`, `party`), the arrows and Enter, or click it; those you used last come first. It is written at the cursor, replacing the text selected. The emoji themselves are not in the **…** list. Names and keywords are Unicode's (CLDR), through emojibase-data |
| Silverware Toolbar settings… | `actions.settings` | The settings dialog (see *Settings*): the gear by the search field of the **…** list, found by typing too |
| Paragraph | `formats.paragraph` | Plain lines: a list's, a heading's or a quote's marker taken off |
| Heading 1, 2, 3 | `formats.heading1` … `formats.heading3` | `# `, `## `, `### ` |
| Bullet list | `formats.bullet` | `- ` (a list's indentation kept) |
| Numbered list | `formats.numbered` | `1. `, `2. `, … from 1 at each depth |
| Task | `formats.task` | `- [ ] ` (a task done stays done) |
| Quote | `formats.quote` | `> ` |
| Code block | `formats.codeBlock` | The lines between ` ``` ` fences (indented as the first line, in a list's item too), the cursor after the opening one for the code's language; nothing selected on an empty line, the cursor between them. In a code block (on its fences too): its fences taken off, its lines kept |

With nothing selected, a format (and *Clear formatting*) works on the word the cursor is in or touches, as if you had selected it: what spaces separate, without a sentence's punctuation at its ends (`word,` bolded is `**word**,`, a tag of `idea.` is `#idea.`; select the punctuation too to have it in); the cursor stays where it was. *A word at the cursor as if selected* (a setting) turns this off, so a format at the cursor writes its markers there to type into.

Over several lines of one paragraph, a format of markers (bold, italic, strikethrough, highlight, code) is one pair around them all, as markdown allows within a paragraph; list items, headings, quotes and paragraphs apart (a blank line between) each get their own. Otherwise formats apply line by line: a list's marker or a heading's `#` is left out, and so are the spaces at the selection's ends. Nothing applies inside a fenced code block; tables, rules and code fences are not turned into another block.

## Favourites

The toolbar shows your favourites: rows, one under another, each a list of items. An item is an action by its `id` (see *Actions*; its `type` is `"action"`, which can be left out), shown as its icon, or with `show = "label"` as its icon and its name, a separator (`type = "separator"`), or a gesture button (`type = "gesture"`, see below). An action that offers a list (*Turn into*) has an arrow, and shows the choice your selection has. Every action is in the **…** list: *Every action* (`actions.more`), an item as any other, in the default at the end of the last row. You can put it anywhere, or on a gesture button's swipe; favourites without it get it at the end of the toolbar, and the settings say so. An id no action has (a module turned off, a custom format not defined) is left out. The default: *Turn into* with its name; Bold, Italic, Highlight, Underline, Strikethrough; Link, Wiki link, Code, Code block; *Emoji* with its name and **…** (headings, lists and tasks are in *Turn into*). Where the screen is worked by finger, the default is the same actions in a shorter bar, the kin of one on its gesture button's swipes: Bold (up Italic, down Highlight), Strikethrough (down Underline), Link (up Wiki link), Code (up Code block). That default needs the *Gestures* module: with it off, and for a space whose favourites are its own (set before favourites for touch came), the favourites show by finger too, until *Own favourites for touch* is turned on.

The settings dialog's *Favorites* tab edits them without writing Lua (see *Settings*).

Where the screen is worked by finger (a phone, a tablet), the toolbar can show other favourites: `silverware.toolbar.favorites-touch`, written as the favourites are, with gesture buttons in place of plain ones (the default, see above). A computer with a touch screen counts as one with a mouse (its touchpad is what it is mostly worked with). `silverware.toolbar.favorites-touch-enabled = false` turns them off for a while: the favourites show by finger too, those for touch kept. In the settings, *Favorites* has *Click* and *Touch* at its top (opened by finger on *Touch* where its own are on): *Own favourites for touch* turns them on and off (off, *Click*'s show by finger, those for touch kept), *Copy from Click* / *Copy from Touch* puts the other's over the ones shown, and *Reset to defaults* (asked first) puts the defaults back, each its own.

### Text snippets

A text snippet is a button of your own character (any, an emoji too) and label that writes your text at the cursor. In the text, `{s}` stands for the text selected and `{c}` for where the cursor goes:

* `%%{s}%%` wraps the selection; it stays selected after (nothing selected: the cursor between the `%%`).
* `**Note:** {c}` writes it and puts the cursor at its end of your choice; text selected is replaced.
* Without `{s}` or `{c}` the text replaces the selection and the cursor goes to its end. `{{s}}` and `{{c}}` write `{s}` and `{c}` as they are.

In the settings, *Add* offers *Text snippet*, its icon, label and text typed in place. In Lua:

```lua
{ type = "snippet", icon = "📌", label = "Comment", text = "%%{s}%%", show = "label" }
```

Text snippets come from the *Snippets* module: with it off they are left out.

### Gesture buttons

A gesture button holds up to three actions in one place: a click (a tap) runs the first, swiping it up runs another, swiping it down a third. As you drag it up, its icon rolls up and the swipe's action comes in from below (dragging down, from above), following your finger or the mouse; let go once it is more than halfway in (or flick it) and that action runs; drag back and nothing happens. Each swipe's icon is shown small, in the button's top right corner for up and its bottom right corner for down: it tells the button from a plain one and shows what a swipe runs, in color where that action is on for the selection, so a swipe turns it off (a swipe for *Bold* on bold text). While you drag, the button is tinted once letting go would run the action. It is as wide as the widest of its actions, with their labels too where `show = "label"`. In the settings, *Add* offers *Gesture button*, then asks for its actions; either swipe may be *None*. In Lua:

```lua
{ type = "gesture", tap = "formats.bold", up = "formats.highlight", down = "formats.code" }
```

The button shows as pressed when its first action is on for the selection; a swipe's action not offered there is dimmed and does nothing. Gesture buttons come from the *Gestures* module: with it off they are left out.

## Settings

*Silverware Toolbar settings…*, the gear by the search field of the **…** list (typing `settings` there finds it too; or the command *Silverware Toolbar: Settings*), opens the settings, for every page in the space:

* **General**: the key for every action, as SilverBullet writes keys (`Ctrl-Shift-q`, `Alt-k`), where and when the toolbar shows, and whether a format works on the word at the cursor. On a phone with SilverBullet's keyboard bar on, it offers to turn that bar off (on that device, at once).
* **Favorites**: *Click* (with a mouse) or *Touch* (by finger, see *Favourites*); the toolbar's rows, one under another. Drag an item within its row or into another, or with the keyboard: focus it (Tab) and press **Alt+←** or **Alt+→** to move it within its row, **Alt+↑** or **Alt+↓** into the row above or below, **Delete** to remove it. The button beside an action's name shows it as its icon or with its name too; **×** removes it. **Add** searches every action (and a separator, and a gesture button, whose two actions it asks for next; click either to change it) to add at the row's end; **Add row** adds a row, the **×** in a row's head removes it with its items. A row left empty is left out. An item no action has is dimmed, named by its id.
* **Modules**: each part of the toolbar on or off (its actions with it).

Nothing changes until **Save**. The favourites, where and when the toolbar shows and the word at the cursor apply at once; a module or the key needs the page loaded again (**Save and reload**). They are saved in your `CONFIG` page: the key and the modules in the block SilverBullet's own settings (*Configuration: Open*) keep, so either shows what the other wrote; the favourites in a block of their own (`-- managed-by: silverware-toolbar`), which SilverBullet's settings leave alone. You can edit both by hand too.

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
* Else `read` and `write`. A block's `read(text, { index, indent })` gets the line after its indentation and gives its text after the marker, or `undefined` when the line is not this format; `write(text, { index, indent })` gives the line (keep `indent` for a list). With `multiline: true`, `write(items)` gets every line as `{ text, indent, index }` and gives their lines (a numbered list counts them: `helpers.numberByIndent(items)`). A block format without `write` is only recognized: its lines are left as they are. With `joins: true` its lines one after another are one block, as a paragraph's are: a format of markers selected over them is one pair, not one on each line.
* An inline `read(text, { before, after, index })` gets the text selected (empty for the cursor) and the line's text around it: `before.text`, `after.text`, and `before.touching(x)` / `after.touching(x)`, what touches the selection: a string, a regex's match, or so many characters. It gives the plain text when the selection is the format, or `{ text, start, end }` when the format reaches past the selection (`start`, `end`: the parts of `before` and `after` it covers), else `undefined`. `write(text, { index })` gives the text formatted. `literal: true`: its content is not formatted (as code). `clear(text)`: the text without the format, for *Clear formatting* to take it off too (underline's gives the text without its tags); without it, *Clear formatting* leaves the format (as a link). A format of markers it always takes off.
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
    edit: (context) => ({ from: context.from, to: context.to, text: context.text.slice(context.from, context.to).toUpperCase() }),
  },
];
```

Each is `actions.<name>` (one of a built-in action's name, `turnInto` or `clear`, replaces it). `edit(context)` gets the page's `text`, the selection's `from` and `to`, and the `lines` it touches, and gives `{ from, to, text }`: the text replacing that part of the page (`helpers.cursor()` in it marks the cursor), or nothing. Also `icon`, `group` (else *Custom*), `keywords`, `enabled(context)` and `active(context)` (false: shown dimmed; true: shown pressed), `afterWrite`.

Instead of `edit`, an action may offer `choices`: a list of actions, as *Turn into* does. In the toolbar it shows the choice that is `active` (its icon and label; none: its `mixed` text, else its label), and a click opens the list; in the list of every action it is one item that opens them, and the search finds them too.

Or, instead of `edit`, `perform(context, editor)` does something that is no change of the text: the toolbar writes nothing for it. `editor` has `invokeCommand(name)` (runs a SilverBullet command), `navigate(page)` (opens a page), `flash(message, type)` (a notification) and `select(from, to)`; `perform` may be `async`, and a mistake it throws is shown. An action has one of `edit`, `perform` and `choices`.

```js
{
  name: "openSelected",
  label: "Open the page selected",
  listed: false,
  perform: (context, editor) => editor.navigate(context.text.slice(context.from, context.to)),
}
```

`listed: false` keeps an action out of the list of every action as it opens: typing in its search finds it (SilverBullet's commands are so). It can be a favourite all the same.

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
    -- No default for either favourites: left out they are told as not set (SilverBullet would copy a default in,
    -- client/config.ts applySchemaDefaults); the toolbar's own defaults apply then (the library page says them)
    favorites = {
      type = "array",
      items = {
        type = "array",
        items = {
          type = "object",
          -- An item of a module's kind (the gestures module's button) has fields of its own, which its kind reads
          properties = {
            type = { type = "string" },
            id = { type = "string" },
            show = { type = "string", enum = { "icon", "label" } },
          },
        },
      },
      description = "The toolbar's rows, each a list of items: { id = <its id>, show = \"icon\" or \"label\" }, { type = \"separator\" }, or a module's kind: { type = \"gesture\", tap = <an id>, up = <an id>, down = <an id> } (every action is in the list of the … button).",
      ui = { category = "Silverware Toolbar", label = "Favourite actions", priority = 2 },
    },
    ["favorites-touch"] = {
      type = "array",
      items = {
        type = "array",
        items = {
          type = "object",
          -- An item of a module's kind (the gestures module's button) has fields of its own, which its kind reads
          properties = {
            type = { type = "string" },
            id = { type = "string" },
            show = { type = "string", enum = { "icon", "label" } },
          },
        },
      },
      description = "The toolbar's rows where the screen is worked by finger (a phone, a tablet), as the favourites are written (gesture buttons need the Gestures module).",
      ui = { category = "Silverware Toolbar", label = "Favourite actions for touch", priority = 1.9 },
    },
    -- No default either: left out, on unless the favourites are the space's own and those for touch are not
    ["favorites-touch-enabled"] = {
      type = "boolean",
      description = "Whether the favourite actions for touch show where the screen is worked by finger; off, the favourite actions show there, those for touch kept. Not set: on, unless the favourite actions are your own and those for touch are not.",
      ui = { category = "Silverware Toolbar", label = "Own favourites for touch", priority = 1.8 },
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
    show = {
      type = "string",
      enum = { "always", "mobile", "selection" },
      default = "mobile",
      description = "When the toolbar shows: always while you write (docked at the bottom, or by the cursor), always on a phone (docked) and after selecting text elsewhere, or only after selecting text.",
      ui = { category = "Silverware Toolbar", label = "When the toolbar shows", priority = 0.94 },
    },
    wordAtCaret = {
      type = "boolean",
      default = true,
      description = "With nothing selected, Bold (any inline format) and Clear formatting work on the word the cursor is in or touches (what spaces separate), the cursor staying where it was.",
      ui = { category = "Silverware Toolbar", label = "A word at the cursor as if selected", priority = 0.93 },
    },
    modules = {
      type = "object",
      additionalProperties = false,
      properties = {
        inline = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Bold, italic, strikethrough, highlight, code, links and wiki links.", ui = { category = "Silverware Toolbar", label = "Inline formats", priority = 0.9 } } } },
        blocks = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Turn lines into a paragraph, a heading, a list, a task or a quote.", ui = { category = "Silverware Toolbar", label = "Turn into", priority = 0.8 } } } },
        clear = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Remove the inline formats of the selection.", ui = { category = "Silverware Toolbar", label = "Clear formatting", priority = 0.6 } } } },
        commands = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "Every SilverBullet command, found by typing its name in the list of every action, and as a favourite.", ui = { category = "Silverware Toolbar", label = "Commands", priority = 0.5 } } } },
        keyboard = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "On a phone or tablet: an action hiding the on-screen keyboard, the selection kept as it is (to see more of the page while you format it).", ui = { category = "Silverware Toolbar", label = "Hide the keyboard", priority = 0.4 } } } },
        emoji = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "An action picking an emoji to write at the cursor, found by its name and keywords.", ui = { category = "Silverware Toolbar", label = "Emoji", priority = 0.1 } } } },
        snippets = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "A text snippet among the favourites: a button of your own character (an emoji too) and label writing your text at the cursor, {s} in it the text selected, {c} where the cursor goes.", ui = { category = "Silverware Toolbar", label = "Snippets", priority = 0.2 } } } },
        gestures = { type = "object", additionalProperties = false, properties = { enabled = { type = "boolean", default = true, description = "A gesture button among the favourites: two actions in one, a click runs the first, swiping it up the second.", ui = { category = "Silverware Toolbar", label = "Gestures", priority = 0.3 } } } },
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
    -- Actions that open a page (custom ones' perform)
    navigate = editor.navigate,
    -- Whether SilverBullet's keyboard bar is on (the settings offer to turn it off on a phone)
    getUiOption = editor.getUiOption,
  })
  command.define {
    name = "Silverware Toolbar: Settings",
    run = function()
      silverwareToolbarJs.openSettings()
    end,
  }
  -- Every script loaded (the toolbar started before the scripts after it): their commands read, as actions
  event.listen {
    name = "system:ready",
    run = function()
      silverwareToolbarJs.scriptsLoaded()
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
/* Its items in a box shaded at each end it scrolls further to (swb-more-left / -right) */
.swb-bar.swb-docked .swb-dock-scroll {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
}
.swb-dock-shade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 18px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms;
}
.swb-dock-shade-left {
  left: 0;
  background: linear-gradient(to right, rgba(0, 0, 0, 0.14), transparent);
}
.swb-dock-shade-right {
  right: 0;
  background: linear-gradient(to left, rgba(0, 0, 0, 0.14), transparent);
}
.swb-dock-scroll.swb-more-left .swb-dock-shade-left,
.swb-dock-scroll.swb-more-right .swb-dock-shade-right {
  opacity: 1;
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
/* The gestures module's button: its faces in one cell (as wide as the widest), on a reel rolled by
   --swb-roll (0 the click's face, 1 the swipe up's, -1 the swipe down's), following the pointer while
   dragged (swb-rolling: no transition), settling once let go, the button tinted while letting go would
   run a swipe's action; each swipe's icon small in its top right corner (up) or its bottom right one
   (down), showing its action's state */
.swb-button.swb-gesture {
  --swb-roll: 0;
  --swb-rolled: 0;
  position: relative;
  overflow: hidden;
  touch-action: pan-x;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.swb-gesture-reel {
  display: grid;
  align-items: stretch;
  justify-items: stretch;
  height: 100%;
  min-width: 0;
}
.swb-gesture-face {
  grid-area: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  box-sizing: border-box;
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: transform;
}
.swb-gesture-tap {
  transform: translateY(calc(var(--swb-roll) * -100%));
}
.swb-gesture-up {
  transform: translateY(calc((1 - var(--swb-roll)) * 100%));
}
.swb-gesture-down {
  transform: translateY(calc((-1 - var(--swb-roll)) * 100%));
}
.swb-gesture.swb-rolling .swb-gesture-face {
  transition: none;
}
.swb-gesture-face.swb-off {
  opacity: 0.35;
}
.swb-gesture-up.swb-on,
.swb-gesture-down.swb-on {
  color: var(--ui-accent-color, #464cfc);
}
.swb-button.swb-gesture.swb-armed {
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 14%, transparent);
}
.swb-button.swb-gesture[aria-disabled="true"] {
  cursor: default;
}
/* Quiet; on (in the accent, at full strength) where the swipe's action is on for the
   selection, so a swipe turns it off (bold already); gone as the button rolls (its faces go past it) */
.swb-gesture-hint {
  position: absolute;
  right: 2px;
  display: flex;
  --swb-hint: 0.45;
  opacity: max(0, var(--swb-hint) - var(--swb-rolled) * 3 * var(--swb-hint));
  pointer-events: none;
  transition: opacity 120ms;
}
/* In the page's color while off, also in a button pressed (its color the accent) */
.swb-gesture-hint:not(.swb-on) {
  color: var(--root-color, #222);
}
.swb-gesture-hint.swb-hint-up {
  top: 2px;
}
.swb-gesture-hint.swb-hint-down {
  bottom: 2px;
}
.swb-gesture-hint.swb-on {
  --swb-hint: 1;
  color: var(--ui-accent-color, #464cfc);
}
.swb-floating .swb-gesture-hint svg {
  width: 8px;
  height: 8px;
  stroke-width: 3;
}
/* Following the pointer: at once */
.swb-gesture.swb-rolling .swb-gesture-hint {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .swb-gesture-face {
    transition-duration: 1ms;
  }
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
/* A text snippet's character, as an icon is shown */
.swb-glyph {
  display: inline-block;
  min-width: 18px;
  font-size: 16px;
  line-height: 1;
  text-align: center;
}
/* A panel of an action's own (the emoji picker), where the popup shows */
.swb-panel.swb-visible {
  flex-direction: column;
  width: 340px;
  max-width: calc(100vw - 16px);
}
/* Its groups as filters, over the search: All, then each by its first emoji */
.swb-emoji-tabs {
  display: flex;
  padding: 6px 6px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.swb-emoji-tabs::-webkit-scrollbar {
  display: none;
}
.swb-emoji-tab {
  /* All ten in the panel's width, sharing what is left */
  flex: 1 0 auto;
  min-width: 28px;
  height: 30px;
  padding: 0 3px;
  font: inherit;
  font-size: 16px;
  line-height: 1;
  color: inherit;
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
}
.swb-emoji-tab:first-child {
  font-size: 12px;
  font-weight: 600;
}
.swb-emoji-tab:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.swb-emoji-tab[aria-checked="true"] {
  border-bottom-color: var(--ui-accent-color, #464cfc);
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 10%, transparent);
}
.swb-emoji-list {
  overflow-y: auto;
  max-height: 280px;
  padding: 4px 6px 6px;
}
.swb-emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
}
.swb-emoji {
  height: 36px;
  padding: 0;
  font-size: 22px;
  line-height: 1;
  background: none;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.swb-emoji.swb-current {
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 16%, transparent);
}
.swb-emoji-name {
  min-height: 1.3em;
  padding: 6px 10px;
  border-top: 1px solid var(--button-border-color, rgba(128, 128, 128, 0.35));
  opacity: 0.75;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* Icons by the search field (the settings) */
.swb-popup-tools {
  display: flex;
  gap: 2px;
}
.swb-popup-tool {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 6px;
  opacity: 0.7;
  cursor: pointer;
}
.swb-popup-tool:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-popup-tool svg {
  width: 16px;
  height: 16px;
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
/* Over the part of the window an on-screen keyboard leaves (shared/dialog.ts sets where it is) */
.swb-settings-backdrop {
  position: fixed;
  inset: 0;
  top: var(--sw-view-top, 0);
  bottom: auto;
  height: var(--sw-view-height, 100%);
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
  max-height: calc(var(--sw-view-height, 100dvh) - 32px);
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
  /* Never shrunk by a tall body (it scrolls sideways, so a column's flex would squeeze it: on a phone it slid under the body) */
  flex: none;
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
    height: var(--sw-view-height, 100dvh);
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
  /* The name keeps room to be read; a control that does not fit beside it goes under it, the row's width */
  .swb-settings-label {
    flex: 1 1 14em;
  }
  .swb-settings-row select {
    flex: 1 1 auto;
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
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
}
.swb-settings-favhead > span {
  opacity: 0.7;
}
/* A row's ×, at the right end of its head */
.swb-settings-row-remove {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  padding: 0;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 4px;
  opacity: 0.6;
  cursor: pointer;
}
.swb-settings-row-remove:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-settings-row-remove svg {
  width: 14px;
  height: 14px;
}
/* A row's handle: dragged, the row moves up or down */
.swb-settings-row-grip {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-left: -4px;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 4px;
  opacity: 0.6;
  cursor: grab;
  touch-action: none;
}
.swb-settings-row-grip:hover {
  opacity: 1;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.swb-settings-row-grip svg {
  width: 16px;
  height: 16px;
}
/* Dragged (an item or a row): its place held, dimmed, the others sliding aside; a copy following the pointer */
.swb-settings-placeholder {
  opacity: 0.3;
}
.swb-settings-ghost {
  position: fixed;
  z-index: 101;
  margin: 0;
  pointer-events: none;
  box-sizing: border-box;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  cursor: grabbing;
  opacity: 0.95;
}
/* The search of what to add: its field and its close button */
.swb-settings-pick-top {
  display: flex;
  gap: 6px;
  align-items: center;
}
.swb-settings-pick-close {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
}
.swb-settings-pick-close svg {
  width: 16px;
  height: 16px;
}
.swb-settings-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 34px;
  padding: 2px;
  border-radius: 6px;
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
/* A kind's item (the gesture button): its name, look and × on the first line, its slots under them,
   side by side where they fit, else one under another (a phone) */
.swb-settings-item.swb-settings-kind {
  flex-wrap: wrap;
  max-width: 100%;
  box-sizing: border-box;
}
.swb-settings-kind .swb-settings-item-name {
  flex: 1 1 auto;
}
.swb-settings-slots {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
  padding-bottom: 2px;
}
/* A slot of a kind's item (the gesture button's Click, Swipe up): the action picked for it */
/* The favourites for a mouse (Click) or for a finger (Touch): two segments; Touch the same as Click shown dimmed, not edited */
.swb-settings-devices {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0 10px;
}
.swb-settings-devices-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.swb-settings-device-actions {
  display: flex;
  gap: 6px;
}
.swb-settings-reset,
.swb-settings-copy-from {
  padding: 4px 10px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid var(--swb-settings-line);
  border-radius: 6px;
  cursor: pointer;
}
.swb-settings-copy-from:disabled {
  opacity: 0.45;
  cursor: default;
}
.swb-settings-device-tabs {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px;
  border: 1px solid var(--swb-settings-line);
  border-radius: 7px;
}
.swb-settings-device {
  padding: 4px 14px;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}
.swb-settings-device[aria-checked="true"] {
  color: #fff;
  background: var(--ui-accent-color, #464cfc);
}
/* … not in the favourites: added at the end, said so */
.swb-settings-warning {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-left: 3px solid var(--ui-accent-color, #464cfc);
  border-radius: 4px;
  background: color-mix(in srgb, var(--ui-accent-color, #464cfc) 8%, transparent);
}
.swb-settings-rows-same {
  opacity: 0.5;
}
.swb-settings-slot {
  display: inline-flex !important;
  flex: 1 1 200px;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 30px;
  padding: 2px 8px;
  font: inherit;
  color: inherit;
  background: none;
  border: 1px solid var(--swb-settings-line);
  border-radius: 4px;
  cursor: pointer;
}
.swb-settings-slot:hover,
.swb-settings-slot[aria-expanded="true"] {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.swb-settings-slot[aria-expanded="true"] {
  border-color: var(--ui-accent-color, #464cfc);
}
.swb-settings-slot.swb-settings-unknown {
  border-style: dashed;
  opacity: 0.7;
}
.swb-settings-slot-name {
  flex: none;
  white-space: nowrap;
  font-size: 11px;
  opacity: 0.65;
}
.swb-settings-slot-action {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* A field of a kind's item (a snippet's icon, label, text), typed in place */
.swb-settings-field {
  display: inline-flex;
  flex: 1 1 200px;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 2px 6px;
  border: 1px solid var(--swb-settings-line);
  border-radius: 4px;
}
.swb-settings-field.swb-settings-field-multiline {
  flex-basis: 100%;
  align-items: flex-start;
}
.swb-settings-field-input {
  flex: 1;
  min-width: 0;
  padding: 3px 0;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  outline: none;
  resize: vertical;
}
.swb-settings-field:focus-within {
  border-color: var(--ui-accent-color, #464cfc);
}
.swb-settings-slot .swb-settings-item-icon:empty {
  display: none;
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
.swb-settings-advice + .swb-settings-card {
  margin-top: 12px;
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
