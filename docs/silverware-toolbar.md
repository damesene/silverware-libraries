# Silverware Toolbar: plan

Status: decided on 2026-10-26, built on the long-lived branch
`silverware-toolbar` (merged into `main` once ready).

## The request

Select text in a SilverBullet page and a toolbar shows beside it, as Notion's
does: it formats the text (bold, italic, …) and turns a block into another
(a paragraph into a list and back, a heading, a quote, …). Built on the
principles of Silverware Table: a core offering an API, modules registering
actions into menus; a module does not know what shows it, and a module turned
off is not loaded at all. The toolbar shows favourite actions as icons
(configurable), and a popup with every action, searched as soon as it opens,
usable without a mouse.

## What SilverBullet offers (its source, 2026-10-26)

- `client/plugos/syscalls/editor.ts`: `editor.getSelection()` gives
  `{ from, to, text }` of the main selection, `editor.setSelection(from, to)`,
  `editor.replaceRange(from, to, text)` (one undo step), `editor.getText()`,
  `editor.invokeCommand(name)`, `editor.dispatch(transaction)`. No event when the
  selection changes and nothing about where it is on screen: both come from the
  DOM (`selectionchange`, the selection's range in `.cm-content`).
- `plugs/editor/editor.plug.yaml`: commands `Text: Bold` (`**`), `Text: Italic`
  (`_`), `Text: Strikethrough` (`~~`), `Text: Marker` (`==`), `Text: Quote
  Selection`, `Text: Listify Selection`, `Text: Number Listify Selection`,
  `Text: Taskify Line`, `Text: Link Selection`, `Text: Wiki Link`; none for
  headings. **Mod-. is a chord prefix** there (`Mod-. k/j/h/l` move outline
  items, `Mod-. Mod-.` toggles a fold).

## Decisions

1. **Silverware Toolbar**: folder `silverware-toolbar/`, settings and Space Lua
   API `silverware.toolbar.*`, CSS prefix `swb-` (`swt-` is the table's).
2. **Its own core**, no code shared with Silverware Table for now; a shared
   folder (bundled into each plugin, no dependency at run time) once it is
   clear what really repeats (floating elements, menus, a dialog, icons).
3. **Edits by its own functions** over the markdown (pure, tested; toggling,
   turning one block into another), not SilverBullet's commands; those come as
   a module of their own (`commands`, later), so any command can be a
   favourite.
4. **When it shows**: once a selection is made (the mouse let go, or selected
   with the keyboard, after a short pause), not while dragging; it goes when
   typing, scrolling or the selection ends.
5. **The key is `Ctrl-Shift-q`** (a setting), on every system: Ctrl-. was the
   first choice, but SilverBullet reserves `Mod-.` as a chord prefix (`Mod-. l`
   indents selected items, `Mod-. t` cycles tasks), which a selection broke;
   `Cmd-Shift-q` logs out on a Mac. Firefox on Windows quits on
   `Ctrl-Shift-q` (Chrome no longer does, since 2018): the library page says
   so. Changed on 2026-10-26, see *Extensions*.
6. **Desktop first**: on a phone SilverBullet has its own bar over the
   keyboard, and the system's selection menu would cover the toolbar.
7. **Default favourites**: *Turn into* with its label in a row of its own,
   under it bold, italic, code, a separator, link, highlight (see
   *Favourites: rows of items*).

## Design

- **Core** (`core/`): follows the selection in the page's text (not in a
  table's cell or another widget), gives modules a **context** (the text
  selected, `from`/`to`, the lines it touches, their block type: paragraph,
  heading 1–6, bullet list, numbered list, task, quote, code; the inline
  formats around it), **writes** (one `replaceRange` per action, the selection
  set again after it), shows the **toolbar** by the selection (above it, below
  near the top of the view) with the favourites as icons and `…`, and the
  **popup** of every action (a search field focused when it opens, arrows,
  Enter, Esc, groups by menu). Modules are created in a fixed order; one off
  (`silverware.toolbar.modules.<name>.enabled`) is not loaded.
- **A module** gives actions: `id`, `label`, `icon`, `keywords` (search),
  `menu` (its group: *Format*, *Turn into*, *Insert*…), `active(context)` (shown
  as on: bold already), `enabled(context)`, `run(context, host)`. It knows
  nothing of what shows it: the toolbar, the popup, later a palette or a menu.
- **Favourites**: `silverware.toolbar.favorites`, the ids of the actions shown
  as icons, in their order.

## Modules (first version)

| Module | Actions |
|---|---|
| `inline` | bold, italic, strikethrough, highlight, code: each a toggle |
| `blocks` | turn into a paragraph, heading 1–3, bullet list, numbered list, task, quote, and back; over several lines too |
| `links` | link, wiki link `[[…]]`, remove a link (to go: link and wiki link become inline formats, see *Extensions*) |
| `clear` | remove inline formatting |
| `commands` (later) | any SilverBullet command as an action (a favourite too) |

## Steps

1. Skeleton: the folder, build and deploy for two plugins, the library page
   (the JS loaded, `config.define`), an empty core and registry.
2. A playground for it: a real CodeMirror with markdown as SilverBullet has it
   (Playwright needs a selection in it; the table's playground has no
   CodeMirror).
3. The core: following the selection, the context, writing, the toolbar with
   the favourites, the popup with search and keys, settings.
4. Modules `inline` and `blocks`: pure functions with unit tests, then UI tests
   of the toolbar and the popup.
5. Modules `links` and `clear`; docs (the library page, CLAUDE.md).
6. Checked in a live SilverBullet (by the user): the selection, where the
   toolbar shows, alongside tables and SilverBullet's own keys.
7. Later: `commands`, favourites edited from the popup (a star), phones.
8. *Extensions* below: the formats domain, built-in formats moved into it,
   `defineFormats` / `defineActions`, the key as the command's, the toolbar
   without a selection, favourites, the shared dialog and settings.

## Extensions (decided and built 2026-10-26; the settings dialog and the shared dialog not yet)

Formats (bold, a heading, a link) and actions can be added, built-in and the
user's alike, without changing the core, the formats domain or a module. The
model is Silverware Table's column types and functions: one shape for built-in
and custom definitions, given in JS, custom ones replacing built-in ones by
name.

### Layers

| Layer | Knows | Does not know |
|---|---|---|
| core (`core/`) | actions, the context (text, selection, lines, a line's index), a change, the UI | markdown, formats |
| formats domain (`formats/`) | the registry; two engines: block (Turn into) and inline (toggle, clear) | any particular format |
| formats (`formats/builtin/`, the user's) | their own syntax: indentation, numbering, markers | the engines, the UI |
| modules (`modules/`) | which formats and actions to offer | a format's syntax |

```
src/formats/
  format.ts     the Format type, Helpers
  registry.ts   built-in and custom, their order, formatsOf(scope)
  custom.ts     the user's definitions checked; a throwing read/write caught
  helpers.ts    HELPERS (indentOf, numberByIndent, isFence, isUrl, cursor…)
  block.ts      the Turn into engine
  inline.ts     the toggle and clear engine
  builtin/      one format per file, index.ts their list
  index.ts      the domain's API
src/modules/
  inline.ts     an action per inline format
  blocks.ts     Turn into, a choice per block format that has `write`
  clear.ts      clear, through the inline engine
```

`markdown/` goes (its logic split into the engines and the built-in formats);
the `links` module goes (link and wiki link are inline formats, group
*Links*).

### A format

```js
{
  name: "heading2",
  scope: "block",                 // "block" | "inline"
  label: "Heading 2",
  icon: "…",
  group: "…",                     // the popup's group (inline)
  keywords: ["title", "h2"],
  marker: "## ",                  // shorthand for read/write
  read: (text, context) => …,     // is it this format? its plain text
  write: (text, info) => …,       // the plain text in this format
  multiline: true,                // block: read/write get every line
  literal: true,                  // inline: its content is not formatted
  afterWrite: (written, editor) => { … },
}
```

A definition is a function given HELPERS that returns a format, or a list of
them; built-in formats are the same and get HELPERS the same way.

**`scope`**:

| | `"block"` | `"inline"` |
|---|---|---|
| acts on | the lines the selection touches, whole | the text selected on each line (without the line's block marker and spaces at its ends) |
| towards others | exclusive: a line has one block format | combines: bold, italic and a link at once |
| run | Turn into: the current format's `read`, the target's `write`; lines all of the target already: back to paragraphs | a toggle: `read` recognizes it, it is taken off; else `write` puts it on |
| offered as | a choice of Turn into (module `blocks`) | an action and an icon (module `inline`) |
| shown as on | a check by the current format | the button pressed when `read` recognizes every line |
| `info` | `{ index, indent }` | `{ index }` |
| its own option | `multiline` | `literal` |
| `marker` | a line's prefix (`"## "`) | a pair around the text (`"**"`), with the whole engine (formats nested, pairs merged, the caret inside) |

**Block formats.** The engine takes each line's indentation off (`indent`) and
hands it over; the format decides what becomes of it (a list keeps it, a
heading drops it). Numbering is the numbered list's own: it is `multiline` and
counts with `helpers.numberByIndent`. A format without `write` (a fence, a
table, a rule) is only recognized: its lines stay as they are. Reading order:
custom formats first, then built-in ones in a fixed order (a task before a
bullet); the paragraph is last and reads anything.

**Inline formats.** `read(text, context)`: `context.before` and
`context.after` are the line's text before and after the selection (not the
block marker), each with `text` and `touching(x)`: what touches the selection
(its end for `before`, its start for `after`), for a string, a regex (anchored
by the engine) or a number of characters, else `undefined`. `read` returns the
plain text when the selection is this format exactly, `{ text, start, end }`
when the format reaches past the selection (`start`, `end`: the parts of
`before` and `after` it covers, each optional), else `undefined`. The engine
checks `start` and `end` really touch the selection and, taking the format
off, replaces `start` + the selection + `end` with `text`; it does not know
which characters are markers. An empty selection (the caret) is read the
same, so a caret inside a link or bold shows its button pressed. A format that
does not look at the context is recognized only when selected exactly.
`literal` (code, wiki link): other formats wrap it but are not put inside it;
put on text with formats, it takes their markers off.

**The selection after writing.** `write` may put `helpers.cursor()` (a caret
there) or `helpers.cursor("url")` (`url` written and selected) into its text:
two Private Use Area characters (U+E000, U+E001) the engine takes out before
`replaceRange` and makes the selection of; not typeable text such as
`{{cursor}}`, which SilverBullet's templates use. Several (a format on several
lines): the last one counts; a wrong use (an end before its start) writes
nothing and shows a notification. Without them the text written is selected.
`afterWrite(written, editor)` stays for anything else: called once after the
format is put on (not when taken off), `written.text` the text written,
`editor` a small API of the core (`select(from, to)` relative to it, for now).
The core still writes once, one undo step.

**The link**, complete:

```js
export default (helpers) => ({
  name: "link",
  scope: "inline",
  label: "Link",
  icon: "…",
  group: "Links",
  keywords: ["url", "href"],
  read: (text, { before, after }) => {
    const whole = /^\[([^\]]*)\]\([^)]*\)$/.exec(text);
    if (whole) return whole[1];
    const start = before.touching(/\[[^\][]*/);
    const end = after.touching(/[^\][]*\]\([^)]*\)/);
    if (!start || !end) return undefined;
    const label = start.slice(1) + text + end.slice(0, end.indexOf("]"));
    return { text: label, start, end };
  },
  write: (text) =>
    helpers.isUrl(text)
      ? `[${helpers.cursor()}](${text})`
      : `[${text || "link"}](${helpers.cursor()})`,
});
```

`Notion` → `[Notion](‸)`; `https://notion.so` → `[‸](https://notion.so)`;
nothing selected → `[link](‸)`; the caret or a part of the text inside
`[Notion](https://x.cz)` → `Notion`.

### Registration and ids

```lua
silverware.toolbar.defineFormats(js.importFromSpace("Library/my-formats.js"))
silverware.toolbar.defineActions(js.importFromSpace("Library/my-actions.js"))
```

As the table's `defineFunctions`: the priority-50 API block; each load of
Space Lua replaces the definitions before; a mistake is a notification.
`defineActions` takes actions with code that are no format:
`{ name, label, icon, group, run(context) → change }`, `afterWrite` too.

Built as decided, with these details: a block format's `read` is always one
line (only `write` is `multiline`: a line's format must be told line by
line); lines of the format turned into are left as written (a task done
stays done), a multiline format gets every line changed; the format lines go
back to is the one read last (the paragraph), not one named; a marker is one
sign written once or more (the engine reads runs of them); a part inside a
pair of markers is taken off that part only (`**wo**r**d**`), a caret in a
pair takes the pair off; a list's indentation is the line's, whatever its
format (a paragraph indented by two spaces turned into a bullet stays
indented).

Ids are by what a thing is, not by the module offering it: `formats.<name>`
(`formats.bold`, `formats.heading2`, `formats.link`) and `actions.<name>`
(`actions.clear`, `actions.turnInto`, the user's). A custom definition of a
built-in name replaces it in its place, so favourites keep working; two custom
ones of a name: the later one, with a notification. A module turned off leaves
its formats and actions out (favourites skip them).

### The key and the toolbar without a selection

- The key is the command's: `command.define { name = "Silverware Toolbar:
  Show actions", key = <the setting> }`, so SilverBullet handles it, shows it
  in the command palette and resolves conflicts; `core/shortcut.ts` goes.
- `…` and the key open the popup under the toolbar, which stays: Esc closes the
  popup only, an action run closes it and the toolbar shows its new state.
- Without a selection the key shows the toolbar at the caret with the popup
  open; its buttons show the formats around the caret (a caret in a link: Link
  pressed, a click takes it off). Esc closes the popup, a second Esc the
  toolbar; typing or moving the caret closes it.

### Favourites: rows of items (decided and built 2026-10-26)

The toolbar is a column of rows, each a list of items, as Notion's (its
block type above the formats):

```lua
config.set("silverware.toolbar.favorites", {
  { { id = "actions.turnInto", show = "label" } },
  { { id = "formats.bold" }, { id = "formats.italic" }, { id = "formats.code" }, { type = "separator" }, { id = "formats.link" }, { id = "formats.highlight" } },
})
```

- An item is an object, its optional properties left out: an action
  (`type = "action"`, the default) by its `id` (`id`, not the item's: within
  an action's item it is the action's id, as the Actions table calls it),
  `show = "icon"` (the default) or `"label"` (its icon and name; several in a
  row may), or `{ type = "separator" }`.
- An action offering `choices` has a chevron (in both looks), from its
  registration, not a setting; its icon and label are the choice on for the
  selection, else its `mixed` text (Turn into: "Multiple types"). Any action
  may (`defineActions` takes `choices` and `mixed`).
- Items keep their own width (none stretched); `…` ends the last row; an id
  no action has is left out, separators at a row's ends or twice left out,
  rows left empty left out; an item that is none (a property more: `shwo`) is
  left out and logged.
- The schema (config.define) describes rows of objects; SilverBullet checks
  values with JSON Schema draft 7 (`@cfworker/json-schema`, client/config.ts);
  its Configuration Manager edits no lists ("Configure manually in CONFIG"):
  the settings dialog's Favorites tab is where they are edited.

### Also decided

- **Default favourites** in the core, in a file of their own
  (`core/favorites.ts`), by id; an id no action has (a module off, renamed,
  missing) is skipped in the toolbar and shown dimmed in the settings; a test
  keeps them equal to the library page's `config.define`.
- **A shared dialog** (`shared/`): a generic dialog with optional tabs (a
  component of its own), usable outside settings; writing CONFIG a separate
  function. The table's settings dialog moves onto it. See *Next* for how.
- **The toolbar's settings dialog**: tabs General, Favorites, Modules (in
  this order). See *Next*.
- **The page unchanged between reading and writing**: an action checks it
  (a snapshot of the text it read), else writes nothing.
- Not now: a code block format, keys per action, a dialog for links, phones.

## Status and next (2026-10-26)

**Done** (branch `silverware-toolbar`): steps 1 to 5; *Extensions* (the
formats domain, `defineFormats`, `defineActions` with `choices` and `mixed`,
ids `formats.<name>` / `actions.<name>`, the key as the command's, the
toolbar at the caret, the popup under the toolbar, the page checked
unchanged before a write); the favourites in rows (*Favourites: rows of
items*). Committed: 4896c7f (everything up to the favourites in rows); the
favourites in rows are in the working copy until committed.

**Not checked in a live SilverBullet yet** (step 6, the user): the command's
key from `config.get`, the toolbar at the caret, the favourites' rows read
from a Lua table through `config.get` (an array, or an object of 1, 2, …:
both are read), `editor.focus`, the toolbar over the top bar and the Tiniri
theme.

**Next**, in this order, each with unit tests and, for what is used by
pointer or keys, UI tests (`npm run test:ui`):

1. **`shared/`** (a folder of the repository, bundled into each plugin; no
   dependency at run time):
   - `shared/dialog.ts`: a modal dialog over the page, its look given by a
     class base (`base`, e.g. `swt-dialog`, `swt-settings`, `swb-dialog`): the
     backdrop `${base}-backdrop` (plus classes the caller adds: the table's
     UI_CLASS), the box `${base}`, `${base}-head` with `${base}-titles`
     (`${base}-title`, `${base}-subtitle`) and `${base}-close` (its icon
     given), an optional bar under the head (the tabs' bar), `${base}-body`
     (the content), an optional `${base}-foot`. Its keys are its own (no key
     reaches the page), Tab stays in it, Esc / × / a press on the backdrop
     ask `dismiss` first (a promise: the settings ask where changes would be
     lost), the focus goes back where it was. With the bases the table uses
     now, its classes stay as they are: `swt-dialog-*` (the core's
     `Dialogs`, the Functions and Excel dialogs) and `swt-settings-*` (the
     settings; only its subtitle, today `swt-settings-scope`, becomes
     `swt-settings-subtitle`, CSS and test changed with it).
   - `shared/tabs.ts`: tabs as a component of their own: a bar
     (`${base}-tabs`, buttons `${base}-tab` with `aria-selected`,
     `data-<prefix>-tab`) and panels (`${base}-panel`, `hidden` but one,
     `data-<prefix>-panel`), the first selected; the dialog takes the bar
     and the panels apart.
   - `shared/controls.ts`: a setting's row (`${base}-row`, `-label`,
     `-name`, `-hint`) and a switch (`${base}-switch`, `-knob`), the
     table's settings' markup, so the table's CSS stays.
   - `shared/configpage.ts`: the table's `configpage.ts` moved there
     (`withConfigSettings`, CONFIG_PAGE, MANAGED_MARKER; its test moved too),
     writing lists and tables as Lua too (`{ { { id = "…", show = "label" } } }`:
     SilverBullet's Configuration Manager reads them back,
     `plugs/configuration-manager/lua.ts`); a value on one line, as it does.
   - The table moves onto them: `core/dialog.ts` (Dialogs) over
     `shared/dialog.ts`, `settings.ts` over dialog, tabs and controls,
     `controller.ts` imports `shared/configpage.ts`. Its behaviour and tests
     stay (settings.test.ts, its UI tests); `npm run test:ui` for the whole
     repository before committing.
2. **The toolbar's settings dialog** (`src/settings.ts`, the command
   *Silverware Toolbar: Settings*, and an item at the end of the popup), in
   the table's look (its CSS copied with the prefix `swb-`), reading the
   configuration when it opens, writing nothing until Save:
   - **General**: the key (text, as SilverBullet writes keys; applies after
     a reload).
   - **Favorites**: the rows one under another, each its items in order
     (an action's icon and name; a separator; an id no action has dimmed,
     named by its id); an item dragged within its row or into another
     (pointer; with the keyboard: Alt+← → within the row, Alt+↑ ↓ into the
     row above or below); per item a switch icon / icon and label and a
     remove button; *Add* in each row opens a search of every action (the
     popup's search, the choices too) and a separator; *Add row*; a row left
     empty is left out when saved.
   - **Modules**: each module's name, description and switch (*Save and
     reload*, as the table's).
   - Saved as the table saves: `bridge.saveSettings` (the playground's
     store) or the CONFIG page's managed block through the library page's
     Lua `saveConfigPage` (as the table's: writePage, sync, index,
     `editor.reloadConfigAndCommands`); the library page hands over
     `readPage`, `saveConfigPage`, `reloadUI`, `confirm`. The playground
     gets a *Settings* button and a store, as the table's playground has.
3. Then step 6 (the user, in a live SilverBullet) and step 7.
