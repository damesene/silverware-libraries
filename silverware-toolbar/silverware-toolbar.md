---
name: Library/damesene/silverware-toolbar
tags: meta/library
description: "Silverware Toolbar: select text and a toolbar beside it (over the keyboard on a phone) formats it, turns its lines into a list, a heading, a quote or a code block and back, and runs any action or command; gesture buttons, text snippets, and icons and emoji of your own with Silverware Icons."
files:
- silverware-toolbar.js
- silverware-toolbar-init.md
- silverware-toolbar-api.md
- silverware-toolbar-style.md
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
* **On a phone** (text selected by touch) the toolbar is docked at the bottom, over the keyboard, each row of the favourites a line you scroll sideways (its items fade out under a faint shade at an end there is more to scroll to, a faint hairline between the lines; **…** always at the last line's end): the system's own menu (Cut, Copy, Paste) shows by the selection, where the toolbar would be. On a phone it stays there while you write, with nothing selected too, its buttons showing the formats around the cursor. Where and when a toolbar shows are its own (see *Toolbars*): by the selection, or docked at the bottom or at the top (under SilverBullet's top bar; docked, it is as wide as the editor, not over SilverBullet's sidebars); always (also where you are not writing in the page), while writing (on a computer by the cursor; **Esc** then leaves it) or only after selecting text. Docked always or while writing, the editor makes room for it, so it covers no text. By default a computer shows *Float*, by the selection after selecting text, a phone *Docked*, at the bottom always (also where you are not writing). SilverBullet's own bar over the keyboard, where it is on, stays under it; the settings offer to turn that one off.

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
| Slash commands | `actions.slashCommands` | SilverBullet's slash commands at the cursor, as typing `/` does: writes `/` (after the text selected; a space before it after a word, where SilverBullet would offer none) and opens the list. Handy in a phone's toolbar, where `/` is a keyboard page away. Comes from the *Slash commands* module |
| Hide the keyboard | `actions.hideKeyboard` | On a phone or tablet: hides the on-screen keyboard, the selection kept as it is, the toolbar staying (to see more of the page while you format it); the next tap in the text brings the keyboard back. Put it in your favourites to have it in the bar at the bottom: the settings offer it in *Touch*'s favourites on any device, a computer too. (Where the browser cannot hide it alone, Safari on iOS, the text is left: the keyboard and the bar go.) |
| Emoji | `actions.emoji` | A picker of every emoji, its groups over the search as filters (*All*, then each group by its emoji: only that group's shown, and searched): type to find one by its name or keywords (in English: `heart`, `thumb`, `party`), the arrows and Enter, or click it; those you used last come first. It is written at the cursor, replacing the text selected. The emoji themselves are not in the **…** list. It needs [Silverware Icons](https://github.com/damesene/silverware-libraries/blob/main/silverware-icons/silverware-icons.md) installed (without it, the picker says so) |
| Toolbar | `actions.switchToolbar` | The toolbar you work with now (with a mouse, or by finger) switched to another of yours: the list of your toolbars, the one shown checked. It shows at once, and is kept in `CONFIG` (its *Used for*). With its parameter *Toolbar* set (in its panel in the settings, or `args = { toolbar = "Float" }`) it switches to that one at once, no list: in the settings, *Add* and *Toolbar* opens its panel at that parameter. The toolbars themselves are found by the popup's search, not offered apart under *Add*. Also the command *Silverware Toolbar: Switch toolbar*. Put it in each toolbar you switch between, or find it in the **…** list |
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

## Toolbars and their favourites

You have up to 5 toolbars, each with a name, its favourites (rows, one under another, each a list of items), where it shows (`placement`: `"selection"`, `"bottom"`, `"top"`), when (`show`: `"selection"` after selecting text, `"writing"`, `"always"`) and what shows it (`useFor`: `{ "click" }` with a mouse or a touchpad, `{ "touch" }` by finger, both, or left out: none, a toolbar kept to switch to). Each way of working shows one toolbar: switching a phone from a docked toolbar to one by the selection is giving *Touch* another toolbar, with its own rows. A computer with a touch screen counts as *Click* (its touchpad is what it is mostly worked with). An item is an action by its `id` (see *Actions*; its `type` is `"action"`, which can be left out), shown as its icon, or with `show = "label"` as its icon and its name, a separator (`type = "separator"`), or a gesture button (`type = "gesture"`, see below). An action that offers a list (*Turn into*) has an arrow, and shows the choice your selection has. Every action is in the **…** list: *Every action* (`actions.more`), an item as any other, in the default at the end of the last row. You can put it anywhere, or on a gesture button's swipe; a toolbar without it gets it at its end, and the settings say so, with a button putting it there. An id no action has (a module turned off, a custom format not defined) is left out. The defaults: *Float* (Click's, by the selection after selecting text): *Turn into* with its name, at a width of 8 characters; Bold, Italic, Highlight, Underline, Strikethrough; Link, Wiki link, Code, Code block; *Emoji* with its name and **…** (headings, lists and tasks are in *Turn into*). *Docked* (Touch's, at the bottom, always): the same actions in one row, the kin of one on its gesture button's swipes: Bold (up Italic, down Highlight), Strikethrough (down Underline), Link (up Wiki link), Code (up Code block), *Emoji*; *Turn into* pinned at the left end, at a width of 8 characters, and **…** pinned at the right (up: *Slash commands*, down: *Hide the keyboard*). *Docked* needs the *Gestures* module: with it off, *Float* shows by finger too.

An item shown with its label may have a fixed width, in characters: `width = 9` (3 to 30). A longer label is cut with an ellipsis, a shorter one leaves the room, so what follows keeps its place as the label changes (*Turn into* saying *Paragraph*, then *Bullet list*). Where a toolbar is docked, each row is a line of its own, one under another, scrolled sideways; an item may be pinned at its row's left or right end, out of what scrolls: `pin = "left"` or `pin = "right"`, wherever it is in its row. By the selection a pin only orders its row (pinned left first, pinned right last), kept for when the toolbar docks. Several rows docked are several lines: put what you want in one line in one row (separators between its groups). An action's item may have an icon and a label of its own, in place of the action's: `icon = "★"` (up to 3 characters, an emoji too, or a monochrome icon of [Silverware Icons](https://github.com/damesene/silverware-libraries/blob/main/silverware-icons/silverware-icons.md): `icon = "lucide:house"`, drawn in the toolbar's colors; *Choose…* by the field in the settings picks one; text of that form, lower case letters, a colon and letters or digits, is read as such an icon), `label = "Tučně"` (also its tooltip, whether it shows its label or not; *Turn into* keeps showing the block format of your lines, its own label is its tooltip).

The settings dialog's *Toolbars* tab edits them without writing Lua (see *Settings*): a tab for each toolbar, with what shows it, + *New toolbar*; the one picked with its name, *Used for* (*Click*, *Touch*: picked here, the toolbar showing it before no longer does), *Where* and *When*, *Duplicate* and *Delete* (not the last; one in use asked first, its way of working given to the first left); *Reset to defaults* (asked first) puts *Float* and *Docked* back. It shows each item as the toolbar does: its icon alone, or its label too, at its width. Click an item to change how it shows (its icon, or its icon and label), its label's width, and its own icon and label (empty: the action's; ↺ puts the action's back); its panel opens right under it. A docked toolbar's rows have on top their *Pinned left* and *Pinned right* boxes side by side, the ends of their line, and their other items under them: drag an item in to pin it, out to unpin it, or set *Pin* in its panel. By the selection a pinned item has a pin by its name; moved by hand where its pin would put it back at an end, it is unpinned. By finger, hold an item a moment to drag it; moved at once, your finger scrolls the list.

In `CONFIG`, written by hand:

```lua
config.set("silverware.toolbar.favorites", {
  { name = "Float", useFor = { "click" }, placement = "selection", show = "selection", rows = { { { id = "formats.bold" } } } },
  { name = "Docked", useFor = { "touch" }, placement = "bottom", show = "always", rows = { … } },
})
config.set("silverware.toolbar.version", 2)
```

The settings carry the version of their model, `silverware.toolbar.version` (the settings dialog writes it): settings of an older version are updated once, as the toolbar starts, and written back to CONFIG with the new version. Version 1, the favourites of each device and where and when each device's toolbar showed, becomes toolbars showing the same: Click's and Touch's favourites each a toolbar where and when they showed (one for both where they showed alike; a phone without favourites of its own gets Click's; favourites for touch you had turned off kept as a toolbar for none), a docked one's rows one row as it showed them in one line; the keys of before are taken out. Write `version = 2` with toolbars you write by hand.

### Text snippets

A text snippet is a button of your own character (any, an emoji too, or an icon of Silverware Icons) and label that writes your text at the cursor. In the text, `{s}` stands for the text selected and `{c}` for where the cursor goes:

* `%%{s}%%` wraps the selection; it stays selected after (nothing selected: the cursor between the `%%`).
* `**Note:** {c}` writes it and puts the cursor at its end of your choice; text selected is replaced.
* Without `{s}` or `{c}` the text replaces the selection and the cursor goes to its end. `{{s}}` and `{{c}}` write `{s}` and `{c}` as they are.

In the settings, *Add* offers *Text snippet*, its text typed in place; its icon and label are set in its panel (a click on it), as an action's are. In Lua:

```lua
{ type = "snippet", icon = "📌", label = "Comment", text = "%%{s}%%", show = "label" }
```

Text snippets come from the *Snippets* module: with it off they are left out.

### Gesture buttons

A gesture button holds up to three actions in one place: a click (a tap) runs the first, swiping it up runs another, swiping it down a third. As you drag it up, its icon rolls up and the swipe's action comes in from below (dragging down, from above), following your finger or the mouse; let go once it is more than halfway in (or flick it) and that action runs; drag back and nothing happens. Each swipe's icon is shown small, in the button's top right corner for up and its bottom right corner for down: it tells the button from a plain one and shows what a swipe runs, in color where that action is on for the selection, so a swipe turns it off (a swipe for *Bold* on bold text). While you drag, the button is tinted once letting go would run the action. It is as wide as the widest of its actions, with their labels too where `show = "label"`. In the settings, *Add* offers *Gesture button*, then asks for its actions; either swipe may be *None*. In Lua:

```lua
{ type = "gesture", tap = "formats.bold", up = "formats.highlight", down = "formats.code" }
```

Each of its actions may have an icon and a label of its own, as an action's item has: write it as `{ id, icon, label }` in place of its id (`tap = { id = "formats.bold", icon = "★", label = "Tučně" }`). In the settings the button shows as in the toolbar (its first action's icon, its swipes' small in its corners); click it for its panel, which lists its actions: click one for its own panel, which shows the action (*Change…* picks another, which drops its own icon and label), and its own icon and label.

Any of them may be a text snippet instead of an action: write the snippet in its place (`up = { type = "snippet", icon = "💬", label = "Comment", text = "%%{s}%%" }`). In the settings, *Change…* offers *Text snippet* beside the actions; its panel then has its text, icon and label. A snippet without its text is left out, as on its own.

The button shows as pressed when its first action is on for the selection; a swipe's action not offered there is dimmed and does nothing. Gesture buttons come from the *Gestures* module: with it off they are left out.

## Settings

*Silverware Toolbar settings…*, the gear by the search field of the **…** list (typing `settings` there finds it too; or the command *Silverware Toolbar: Settings*), opens the settings, for every page in the space:

* **General**: the key for every action, as SilverBullet writes keys (`Ctrl-Shift-q`, `Alt-k`), and whether a format works on the word at the cursor. On a phone with SilverBullet's keyboard bar on, it offers to turn that bar off (on that device, at once).
* **Toolbars**: your toolbars (see *Toolbars and their favourites*), and the one picked's rows, one under another. Each item shows as in the toolbar. Click it for its panel under the row: *Show* (its icon, or its label too), *Width* (its label's, in characters), and an action's own *Icon* and *Label* (↺ puts the action's back). Drag an item within its row or into another, or with the keyboard: focus it (Tab) and press **Alt+←** or **Alt+→** to move it within its row, **Alt+↑** or **Alt+↓** into the row above or below, **Delete** to remove it; **×** removes it. **Add** searches every action (and a separator, and a gesture button, whose actions it asks for next; each set in its panel, opened by a click on it: its actions, and for each its own panel: its action, *Change…*, its own icon and label) to add at the row's end; **Add row** adds a row, the **×** in a row's head removes it with its items. A row left empty is left out. An item no action has is dimmed, named by its id.
* **Modules**: each part of the toolbar on or off (its actions with it).

Nothing changes until **Save**. The toolbars and the word at the cursor apply at once; a module or the key needs the page loaded again (**Save and reload**). They are saved in your `CONFIG` page: the key and the modules in the block SilverBullet's own settings (*Configuration: Open*) keep, so either shows what the other wrote; the toolbars in a block of their own (`-- managed-by: silverware-toolbar`), which SilverBullet's settings leave alone. You can edit both by hand too.

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
* `label` offers it (without one it is only recognized), `icon` (an SVG, or an icon of Silverware Icons such as `"lucide:rocket"`, else its first letter), `group` (the list's group, inline), `keywords` (more words the search finds it by).
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

Each is `actions.<name>` (one of a built-in action's name, `turnInto` or `clear`, replaces it). `edit(context)` gets the page's `text`, the selection's `from` and `to`, and the `lines` it touches, and gives `{ from, to, text }`: the text replacing that part of the page (`helpers.cursor()` in it marks the cursor), or nothing. Also `icon` (an SVG, or an icon of Silverware Icons such as `"lucide:rocket"`), `group` (else *Custom*), `keywords`, `enabled(context)` and `active(context)` (false: shown dimmed; true: shown pressed), `afterWrite`.

Instead of `edit`, an action may offer `choices`: a list of actions, as *Turn into* does. In the toolbar it shows the choice that is `active` (its icon and label; none: its `mixed` text, else its label), and a click opens the list; in the list of every action it is one item that opens them, and the search finds them too. Its choices are actions as any other, each with its `edit` or `perform` (below): they need not have anything to do with formats (see the example below).

Or, instead of `edit`, `perform(context, editor)` does something that is no change of the text: the toolbar writes nothing for it. `editor` has `invokeCommand(name)` (runs a SilverBullet command, your own too: one a Space Lua script defines with `command.define` is how an action runs Lua), `navigate(page)` (opens a page), `flash(message, type)` (a notification) and `select(from, to)`; `perform` may be `async`, and a mistake it throws is shown. An action has one of `edit`, `perform` and `choices`.

```js
{
  name: "openSelected",
  label: "Open the page selected",
  listed: false,
  perform: (context, editor) => editor.navigate(context.text.slice(context.from, context.to)),
}
```

A list of your own tools, one changing the text, one running a command of your own in Lua:

```lua
command.define {
  name = "Say hello",
  run = function()
    editor.flashNotification("Hello from Lua")
  end,
}
```

```js
export default (helpers) => [
  {
    name: "tools",
    label: "Tools",
    mixed: "Tools",
    choices: [
      {
        name: "upper",
        label: "Upper case",
        edit: (context) => ({ from: context.from, to: context.to, text: context.text.slice(context.from, context.to).toUpperCase() }),
      },
      { name: "hello", label: "Say hello", perform: (context, editor) => editor.invokeCommand("Say hello") },
    ],
  },
];
```

An action may take parameters, their values set by the favourite holding it: `params`, each a `key`, a `label`, and either `choices` (texts, or `{ value, label }`) to pick from or a text typed (`placeholder`). The settings show them in the item's panel; in `CONFIG` they are `args = { <key> = <value> }` on the item (or on a gesture button's slot: `{ id = …, args = { … } }`). The action's functions get them as their last argument (`edit(context, args)`, `perform(context, editor, args)`, `active(context, args)`, `enabled(context, args)`; none set: `{}`), and `describe(args)` names it by them (none: its label).

```js
{
  name: "template",
  label: "Template",
  params: [{ key: "name", label: "Template", choices: ["Meeting", "Daily note"] }],
  describe: (args) => args.name,
  perform: (context, editor, args) => editor.invokeCommand(`Template: ${args.name ?? "Pick"}`),
}
```

`listed: false` keeps an action out of the list of every action as it opens: typing in its search finds it (SilverBullet's commands are so). It can be a favourite all the same.

## Implementation

Silverware Toolbar is started by [silverware-toolbar-init](silverware-toolbar-init.md) (its settings and commands), its Space Lua API is [silverware-toolbar-api](silverware-toolbar-api.md) and its look [silverware-toolbar-style](silverware-toolbar-style.md). All three are installed with this page.
