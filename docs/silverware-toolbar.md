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
7. **Default favourites**: bold, italic, code, link, *Turn into* (the block's
   type to pick), highlight.

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

### Also decided

- **Default favourites** in the core, in a file of their own
  (`core/favorites.ts`), by id; an id no action has (a module off, renamed,
  missing) is skipped in the toolbar and shown dimmed in the settings; a test
  keeps them equal to the library page's `config.define`.
- **A shared dialog** (`shared/`): a generic dialog with optional tabs (a
  component of its own), usable outside settings; writing CONFIG a separate
  function. The table's settings dialog moves onto it.
- **The toolbar's settings dialog**: tabs General, Favorites (picked and
  ordered there, saved into CONFIG), Modules.
- **The page unchanged between reading and writing**: an action checks it
  (a snapshot of the text it read), else writes nothing.
- Not now: a code block format, keys per action, a dialog for links, phones.
