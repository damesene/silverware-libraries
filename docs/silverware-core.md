# Silverware Core (plan, 2026-11-25)

Status: planned, nothing built. On branch `silverware-core`. The plugins' own
UI moves to Preact on top of it: docs/silverware-preact.md. **The work itself
(its order, each step's scope and what done means, its progress) is
docs/silverware-core-work.md**: start there.

## What it is

A library for the other plugins, nothing on its own (as Silverware Icons):
**one module per window that every plugin loads**, so what the plugins share
at run time has one instance. Every plugin `requires:` it (SilverBullet 3.0's
library dependencies) and refuses to start, saying why, where the installed
core is not one it works with.

`shared/` stays: code bundled into each plugin where no instance needs to be
shared (pure code, helpers). Silverware Core is for what needs one instance, or
one version for every plugin at once.

## Why

Today nothing is shared at run time (`shared/` is bundled into each plugin),
and what the plugins must agree on goes through side channels:

- **Marks in the DOM**, each watched by a MutationObserver of each plugin
  that reads it (`shared/watchmark.ts`): `data-silverware-over-window` (a full
  screen, a sheet, a peek: the toolbar stands back, Silverware Layout's CSS
  leaves the element's width alone), `data-silverware-side-panel` (Silverware
  Layout moves its text), `data-silverware-takes-files`, the editor's
  companion (`COMPANION_ATTRIBUTE`), SilverBullet's widget menu taken off
  (shared/silverbullet/widgetmenu.ts: every bundle watches the document for
  the same attribute).
- **CSS variables on the root**: the layers (`--sw-layer-*`, set by each of 7
  plugins as it starts, `applyLayers`), the room a docked bar takes
  (`--sw-room-*`), the content's zoom (`--sw-content-scale`).
- **APIs handed through Lua**: `silverware.icons.api`, `silverware.editor.api`,
  `silverware.assets.api`, `silverware.layout.api`, `silverware.table.tables`,
  each with its bridge in a Lua page, ordered by the pages' priorities.
- **Each plugin's own copy of what should be one**: a dialog opened over
  another plugin's dialog (Silverware Assets' upload dialog over a database's
  peek, Silverware Icons' picker over a settings dialog) fights it for Tab,
  Esc and where the focus goes back, as each plugin's `Dialogs`
  (shared/dialog.ts) knows its own alone; two side panels lie over each other
  at the right (shared/sidepanel.ts: "Several may be open at once"); the peek
  keeps a hand-written list of elements a press on which does not close it
  (`NOT_BESIDE` in modules/peek/panel.ts), other plugins' among them; menus
  are placed and closed by shared/popupmenu.ts (Silverware Assets, Layout), by
  their callers (Silverware Table, Database, Chart, drawing shared/menu.ts),
  or by a code of their own (Silverware Toolbar's popup).
- **Registries one per bundle where the user expects one**: a function defined
  by `silverware.table.defineFunctions` is `#NAME?` in a database's formulas
  (docs/silverware-database-formulas.md, *Later*), as each bundle has its own
  registry (shared/formulas/registry.ts).
- **SilverBullet's API handed over by every plugin's Lua**: 8 to 19 functions
  each (`posAtDOM` and `listCommands` by several), the events
  (`editor:pageLoaded` by 4 plugins, `page:index` by 3) listened to apiece; a
  change of SilverBullet's API is met in each.

All of it works; it is protocol over side channels, untyped, ordered by Lua.

## Probes (2026-11-25, SilverBullet 3.0.0 and edge, Chromium)

Run in a scratch space with plugins of a probe's own (no plugin of the
repository changed).

1. **One instance.** `js.importFromSpace` is a plain `import()` of
   `<base>/.fs/<path>` with no cache-buster (client/space_lua/stdlib/js.ts), and
   a browser keeps one module per URL: three plugins' bundles importing
   `./core.js` (one from another folder, `../probe/core.js`; one by `import()`;
   Lua itself by `js.importFromSpace`) got the same module, evaluated once.
2. **Space Lua loaded again** (System: Reload) evaluates no module again: the
   core's state, and each plugin's module state, survive it. A changed file is
   loaded only by a reload of the browser (as plugins' bundles today).
3. **A missing core**: imported statically, the plugin's whole script fails,
   told in the console alone (nothing the user sees), the other plugins
   unharmed; imported by `import()`, the failure is caught; in Lua,
   `pcall(js.importFromSpace, …)` catches it, and Lua reads the module's
   exports (its version) as they are.
4. **Installed by `requires:`** (Library: Install of a plugin requiring
   `./core.md`): the core is installed with it, its files beside the plugin's.
   **Library: Update of the plugin alone leaves the core as it was** (as
   SilverBullet documents: requirements already installed are not updated);
   a version check in the plugin refused it ("needs core 2.x, has 1.0").
   **Library: Update All** updated the core too. A requirement missing is
   installed by an update (SilverBullet's `updateLibrary` calls
   `installMissingRequirements`): a user updating a plugin to its first
   release needing the core gets the core with it.
5. **Offline** (emulated phone, network off): SilverBullet 3.0 keeps pages
   offline, and other files (a bundle is one) only with
   `config.set("sync.documents", true)`. Without it **no Silverware plugin
   starts offline today**, core or not (the service worker answers 404); with
   it the plugin and the shared core start offline and survive System: Reload.

Not probed: Safari (not a target until a user reports a problem); an install
from GitHub itself, and a `requires:` entry going up a folder
(`../silverware-core/silverware-core.md`; SilverBullet's
client/workbench/libraries/library_requires.ts resolves `..` within the
repository): both checked with the first release's install, step 1's
definition of done.

## Shape

- Folder `silverware-core/`, library page `silverware-core.md` (user docs: what
  it is, that the other plugins need it, what to do where one says so),
  `-api.md`, `-init.md` where it needs one, `-style.md`, the built
  `silverware-core.js`, `CHANGELOG.md`, `src/`, `ui-tests/`, `CLAUDE.md`.
  Prefix `swk-`; Space Lua API under `silverware.core`, and
  `silverware.formulas` (*API changes* P1).
- Like every plugin: its version and changelog (scripts/versions.mjs), its
  isolation test, deployed by `npm run deploy`, listed in REPO.md, in the
  build's, the playground's and the UI test servers' lists.
- The repository's rules change with step 1 (root CLAUDE.md: "a plugin needs
  no other installed" and "nothing is shared at run time" no longer hold; the
  plugins' table, the prefix, the commit scope `core`).

### Loading and the version gate

- **The core's version is its API's version**: a plugin works with a core of
  the same major and at least the minor it was built against. Within a major
  the core only adds; a change that breaks a plugin is a new major, released
  with every plugin. No second number: the gate reads the library's version,
  exported by the bundle (`VERSION`, checked against the library page by
  scripts/versions.mjs).
- **The core's API page runs first of ours** (`-- priority: 60`; the plugins'
  API pages are at 50, their init pages at 0 or below): it hands
  SilverBullet's API to the core (*Services* B) and defines `silverware.core`
  and `silverware.formulas`.
- **The gate is in each plugin's API page, before its `importFromSpace`**
  (every API page imports its bundle, e.g. silverware-table-api.md:27):
  `pcall(js.importFromSpace, "Library/damesene/silverware-core.js")`, its
  `VERSION` against the plugin's need. Missing or not matching: one
  notification ("Silverware Table needs Silverware Core 2.1 or later (installed
  1.4): run Library: Update All, then reload the page": a core updated is
  loaded only by a reload, probe 2), the bundle not imported, the plugin's
  Space Lua API defined as stubs that tell the same, so a user's script calling
  it fails with that message, not on a nil; the init page sees the plugin
  refused (`silverware_internal.<name>.refused`) and does nothing. Matching:
  the bundle is imported and imports the core statically (loaded by then).
- The gate is one block of Lua, written into each API page by a script between
  marks with the plugin's need as a parameter (as scripts/sharedstyles.mjs
  writes the CSS blocks with each page's base), checked by check-build.
- **A plugin's need** is the core's version it is built against, in one place
  per plugin, read by the gate's block; check-build fails where the
  repository's core is older.
- Each library page `requires:` `../silverware-core/silverware-core.md`.
- **Space Lua loaded again**: Lua pages run again, modules do not. The core
  takes SilverBullet's API again (the new functions replace the old), and every
  registration with the core is keyed by the plugin, a second one replacing
  the first, never added beside it.

### Build and tests

- The plugins' bundles take the core as external, written
  `./silverware-core.js`: esbuild's `external` with aliases for the core's
  module and for `preact`, `preact/hooks`, `preact/jsx-runtime` and
  `@preact/signals` (re-exported by the core); tsconfig `paths` alike, so tsc
  checks against the core's source.
- **Unit tests and the playground start the core without Lua**: a bridge of
  memory (the platform the playground fakes today) and `ready` given at once;
  vitest and scripts/playground.mjs (its 6 entries) resolve the core to its
  source.
- Types: plugins import the core's public module (`silverware-core/src/api.ts`),
  never its internals (each plugin's isolation test).
- The UI test servers deploy the core with the plugins (scripts/deploy.mjs
  lists it). UI tests of the gate: a plugin with no core, with an older core,
  says so, starts nothing, and its API's stubs say so.

## Where code goes: the core or shared/

One rule, checked by a test, so the line between the two does not blur:

- **Silverware Core**: what must be **one per window** (a registry every
  plugin reads, the overlay stack, a watcher of the document, a signal every
  plugin follows) or **one version for every plugin** (the formulas' engine,
  whose values are told by class).
- **shared/**: code bundled into each plugin. Pure, or with state that is
  **meant to be each plugin's own** (each bundle its copy on purpose), and
  then only listed.
- **The test** (shared/modulestate.test.ts, in `verify`): every file of
  shared/ read line by line; a declaration at the module's top level that holds
  mutable state fails it (`let` or `var`; a `const` made by `new Map`, `Set`,
  `WeakMap`, `WeakSet`, `MutationObserver`, or an array, not typed
  `ReadonlyMap`, `ReadonlySet` or `readonly …[]`), unless the test's list names
  it with why it is each plugin's own. Constants are typed readonly.

shared/ today (2026-11-25), by that rule:

- **To the core** (one per window): the formulas' registry and its parse
  cache (shared/formulas/registry.ts `custom`, `anew`; parser.ts `parsed`),
  with the engine (G); SilverBullet's widget menu's watcher
  (silverbullet/widgetmenu.ts `watched`, B); the menus' counter of ids
  (menu.ts `problemIds`) goes with the menus (C).
- **Each plugin's own, listed**: the page writer's parts (pages/parts.ts
  `parts`, `partOf`: a plugin's parts are its own, no other plugin's types see
  them), the copy command's guard (clipboard.ts `copying`), caches of a
  bundle's own (intl.ts `numberFormats`, `dateFormats`; table/model.ts
  `madeFrom`).
- **Constants, typed readonly**: formulas/help.ts `BEFORE_OPERAND`,
  formulas/references.ts `VOLATILE`, safehtml.ts `DOCUMENT_ATTRIBUTES`,
  silverbullet/editorsample.ts `EM`, pages/parts.ts `BODY`, table/model.ts
  `NO_ATTRIBUTES`.

## SilverBullet kept apart

SilverBullet is the host, one of possible hosts: what knows it is a binding,
in one place per plugin and one in the core, never spread through them. The
core concentrates it: one binding of SilverBullet's API (B) instead of one
per plugin, so a host of another kind would need one binding and each
plugin's few own pieces.

- **What "knows SilverBullet" means**: its API and Lua (syscalls,
  `js.importFromSpace`, `posAtDOM`, events, Space Lua's reload), its DOM
  (`.sb-*` classes, its navigator, widget menu, modal and notifications), its
  index's names and its pages' places (`Library/`, `Library/Config`, the index
  queue). Markdown is not SilverBullet's (*Storage*); CodeMirror is the
  editor's, met by Silverware Editor and Layout as today.
- **The core's own layers**: `silverware-core/src/` holds what is host-free
  (the stack, the registry, signals, the formulas, the geometry's and the
  surfaces' interfaces) and `src/host/silverbullet/` the binding (the Lua
  bridge, events, SilverBullet's panels as geometry, its widget menu, the
  look's sample, the settled index). The core's public API names no
  SilverBullet concept; its isolation test keeps the layers, as Silverware
  Database's does (src/isolation.test.ts).
- **Each plugin**: `src/host/silverbullet/` its binding (Silverware Assets,
  Database, Layout and Table have one today; Chart, Toolbar, Tags, Icons,
  Editor and the viewers keep SilverBullet in their entry files, `index.ts`,
  `bridge.ts`, `dom.ts`, and Tags in `space/silverbullet.ts`). The entry
  composes the binding with the rest and holds no SilverBullet code itself.
  Leaks today, to move into bindings: the peek's `NOT_BESIDE` with
  SilverBullet's classes (Database, modules/peek/panel.ts), the toolbar's
  commands module (modules/commands.ts), the table's and toolbar's `dom.ts`.
- **shared/**: what knows SilverBullet is in shared/silverbullet/ only, imported
  by bindings only; shared/configpage.ts (`Library/Config`) moves there. Most of
  shared/silverbullet/ moves into the core's binding with its service
  (navpanels, widgetmenu, editorsample, platform, position).
- **The test** (scripts/hostisolation.test.ts, in `verify`): every plugin's and
  the core's src/ outside `host/`, entry files included, and shared/ outside
  shared/silverbullet/, read for SilverBullet's markers
  (imports of shared/silverbullet/ or of a `host/silverbullet/`, `.sb-`
  selectors, `Library/`, `js.importFromSpace`, `posAtDOM`, its event names);
  each hit fails it unless the test's list names it, the list naming today's
  leaks with the step that moves each (docs/silverware-core-work.md) and empty
  at the end. Comments saying what SilverBullet does (the markdown read "as
  SilverBullet's parser does") are no hit: the test reads code, not comments.

## Storage

Markdown stays the format; nothing here changes what a space holds. What
changes is that every plugin reaches it through the abstraction that fits
what it works on, and none writes a page's text by itself.

### Two kinds of plugins, two abstractions

- **A plugin with a model of its own**: what the user works on is not text,
  only kept as text. A database's item is a record kept as a page with its
  frontmatter; a table is a model of cells kept as a markdown table. **A store
  with a contract** maps the model to markdown and back, with a store in
  memory beside the real one, both passing the contract's tests. Silverware
  Database (`DatabaseStore`, src/store/, src/store/contract.ts, its items
  opaque `ItemKey`s) and Silverware Table (its markdown store over the table
  model, src/store/, core/store.ts) are so today.
- **A plugin over the document**: what the user works on is the document's
  own syntax: a hashtag (Silverware Tags), a grid (Silverware Layout), an
  embed (Silverware Assets), a chart's block (Silverware Chart). There is no
  model kept as text; it is the text. **The document model** is the
  abstraction: the markdown reader (shared/markdown/: blocks, grids, embeds,
  tags, a block's lines) gives structure, and the page writer's parts
  (shared/pages/: `tags`, `grids`, `embeds`, `codeBlocks`, a plugin's own
  registered part) take planned changes. A store over these would only pass
  calls on. A plugin whose block holds a format of its own reads and writes it
  by a codec (Silverware Chart's formats: `read` and `write` between its model
  and the block's text), the block itself written by the `codeBlocks` part.

Silverware Toolbar is neither: it is an editing tool, changing the user's text
in the surface being edited, as the user would; so are a field's own edits
(`setText` in a grid's cell or the peek).

### Rules

- **Every write of a page's text goes through the page writer** (shared/pages/),
  never a range written by a plugin (`replaceRange`, `writePage` of a page's
  text): the writer reads the page as it is, tells blocks written alike apart
  by their place, and leaves a page changed since it was read. Editing tools
  (the toolbar, an editor's field) are the exception, listed by the test.
- **A plugin over the document works on structure, not on places in the
  text**: it reads through the reader and writes through a part's changes,
  never by offsets of its own.
- **The domain plans writes; the UI calls the domain.** No dialog or panel
  composes page changes itself.
- **Settings through `Platform.settings`** (shared/platform.ts: `get`, `save`),
  made by the binding; a plugin's settings that are tables (the toolbar's
  favourites), kept in its own block of the configuration page today
  (shared/configpage.ts), go through it too (a `save` of the plugin's own
  block). No plugin reads or writes `Library/Config` itself: where settings
  are kept is the host's.
- **The formulas** read through `TableSource` and `FormulaCells`
  (shared/formulas/), never a store or a page: moving them into the core takes
  no knowledge of storage with them. The core holds no storage: its index (H)
  is the binding's reading of SilverBullet's index, handed to the stores
  through `Platform`'s `index` as today.

### Where the plugins are today (2026-11-25)

- **Silverware Chart** reads its block through its formats' codec, then writes
  the text it made by `replaceRange` of the block's offsets
  (src/core/controller.ts:203, src/modules/insert.ts:36): to be written by the
  `codeBlocks` part, as Silverware Database writes its block.
- **Silverware Layout**'s `/grid` puts a grid in by `replaceRange` (src/index.ts,
  `runSlashCommand`): to go through the `grids` part.
- **Silverware Tags** composes page changes in its UI (src/ui/chips.ts,
  workspace.ts) beside its modules: the UI to call its modules alone.
- **Settings**: every plugin reads them through its bridge and writes its block
  of `Library/Config` through shared/configpage.ts; Silverware Database alone
  through `Platform.settings`.
- Silverware Database, Table and Assets keep to the rules already.

**The test** (scripts/pagewrites.test.ts, in `verify`): `replaceRange`,
`writePage`, `writeFile` of a page and `CONFIG_PAGE` outside the page writer,
the bindings and the listed editing tools fail it; today's places listed with
the step that moves each.

## Services

What goes into the core, each a service the plugins call in TypeScript.

### A. Runtime

- **Preact and `@preact/signals`**, re-exported: the plugins import them
  through the core, one copy per window. Pinned; a major of Preact is a major
  of the core. The core's components and a plugin's can be one tree (a
  plugin's content in the core's dialog is a vnode, not a DOM node).

### B. SilverBullet bridge and events

- **SilverBullet's API handed over once**, by the core's API page: the editor,
  space, index, UI and system functions the plugins take today one by one, as
  the `Platform` of shared/platform.ts (`editor`, `space`, `index`, `ui`,
  `settings`) and the few beyond it (`posAtDOM`, `listCommands`,
  `renderMarkdown`, `moveCursor`). A plugin's binding keeps what is its own
  (its settings, its commands, its widgets); a rename in SilverBullet is met
  in one place.
- **Events once**: the core's Lua listens to `editor:pageLoaded`,
  `editor:pageModified`, `page:index`, `page:deleted`,
  `mq:emptyQueue:indexQueue`, `system:ready`, and the plugins subscribe in JS.
  A plugin's Lua keeps only events that are its own (a slash command, a code
  widget, `editor:complete`).
- **SilverBullet's widget menu taken off** (widgetmenu.ts `keepFromWidgetMenu`):
  one watcher of the document, the plugins telling the core their widgets.

### C. Overlays

One stack of what is laid over the page and closed again, across plugins:

- **The stack**: what opens goes on top; Esc, Tab and the keys kept from
  SilverBullet go to the top one alone; a press beside the top one closes it,
  a press on another overlay of the stack is no press beside; the focus goes
  back to where it was in the one under it, another plugin's too.
- **Its layers**: the stack orders `sheet`, `sheetPanel`, `menu` and `dialog`
  of shared/layers.ts by their place in it (a menu opened from a dialog over
  it, a dialog from a menu over that). `lifted`, `overWindow`, `control` and
  `dragged` stay layers of their own: a widget over the window lies under the
  plugins' controls on purpose (its own toolbar over it, layers.ts).
- **Dialogs** (from shared/dialog.ts): the same frame and classes by the
  plugin's base (`swt-dialog`, `swb-dialog`), so each plugin's style page,
  written by hand for its dialogs, keeps working; `peek` (put aside, out of
  the stack meanwhile), `above` (now any plugin's), `dismiss`.
- **Menus** (from shared/popupmenu.ts, which already places and closes
  Silverware Assets' and Layout's menus): open at an anchor, flipped at the
  window's edges, a sheet on a phone, submenus, one menu open across plugins,
  closed by a press beside or Esc. Entries stay data (`MenuEntry`, drawn by
  shared/menu.ts's markup); `menuslots.ts` stays in shared/.
- **Side panels** (Silverware Assets' file panel, a database's peek): the frame
  at the right of the editor's area (shared/silverbullet/editorarea.ts,
  sheetarea.ts), the whole view on a phone, its width dragged or keyed and
  kept by its kind, Esc and a press beside. **A second panel goes on top of
  the first** (decided 2026-11-25), Esc or its back takes it off, the first as
  it was. The two panels' frames differ today (classes, structure): one frame
  for both is a change of their look, made with their snapshots (step 6).
- **Floating** (`useFloating`): what a part lays over the page while it is its
  own (an editor's panel, the names offered under a field): `liftOut` and
  `floatPanel` (views/float.ts) with all they do (a mark where it came from,
  back into its place while CodeMirror takes the block out, closed as its
  holder leaves the page, the computed variables of its origin).
- **The marks stay; their watchers go.** The overlay host writes
  `data-silverware-over-window` and `data-silverware-side-panel` on the
  elements as today: Silverware Layout's CSS selects them, `overWindowOf(node)`
  asks of an element (Silverware Chart, Table, Toolbar), and users' styles may
  select them. What changes: a plugin wanting to know whether something is
  open reads the core's signal instead of a MutationObserver
  (shared/watchmark.ts goes). `NOT_BESIDE` keeps SilverBullet's own elements
  only (its modal, notifications, `dialog` elements).

### D. The page's geometry

- The view less SilverBullet's panels (shared/silverbullet/navpanels.ts,
  watched by Silverware Table, Layout and Toolbar apiece), the room a bar
  docked at an edge takes (room.ts), the content's zoom (contentscale.ts), the
  editor's area and the sheet's (editorarea.ts, sheetarea.ts). One watcher,
  signals read by every plugin; the CSS variables stay for CSS that reads them.

### E. Editing surfaces

- A field that edits markdown (a grid's cell, the peek's content) registers
  with the core, and so does a companion of an editor (Silverware Toolbar's
  bar, today `COMPANION_ATTRIBUTE`); Silverware Toolbar asks the core for the
  surface focused instead of finding it in the DOM (shared/editor.ts
  `surfaceOf`). Kept keys (keptkeys.ts) stay in shared/: pure once
  `listCommands` comes from the bridge.

### F. Services of the plugins to each other

- A registry: a plugin offers its API under its name (`offer("icons", api)`),
  another asks for it and is told as it comes and goes (`watch("icons", …)`).
  Typed by the offering plugin's public types. Replaces the Lua handovers
  between our plugins: Silverware Icons, Editor, Assets, Layout, Table's
  `tables` and `onWrite` (*API changes* P3).

### G. Formulas' registries

- **Custom functions and sources, one registry**: the formulas' engine
  (shared/formulas/) moves into the core, its registries with it, so a
  function defined once is every plugin's and meets one engine of one version.
  **In a file beside the core's** (`silverware-core-formulas.js`, imported on
  first use, as Chart.js beside the chart's): 6,300 lines a user with only the
  toolbar never loads; one URL, so still one instance.
- **The plugins take the formulas from the core alone**, never from
  shared/formulas: the engine tells its values by class (`FormulaError`,
  `TimeValue`, shared/formulas/values.ts; `instanceof` in custom.ts,
  criteria.ts, evaluate.ts), and a second copy's classes would not be told.
  shared/table (the model) has no classes and stays bundled in each plugin
  and in the formulas' file; the isolation tests forbid importing
  shared/formulas once it moved.
- **Definitions anew once per load**: the core's API page resets the
  registries as Space Lua loads (`customFunctionsAnew`), before the plugins'
  pages; a plugin's API page stops resetting them (each of six resets its own
  today, `resetDefinitions`).
- Conditional formatting's conditions join it when the database shares them
  (docs/silverware-database-conditional-formatting.md).

### H. The index

- **The settled index** (Silverware Database's host/silverbullet/settledindex.ts:
  the last reading kept while SilverBullet's index queue is busy, changes told
  early and whole): moved into the core, read by Silverware Tags and Table too.

### I. The page's look

- The editor's look sampled once per load (shared/silverbullet/editorsample.ts,
  shared/editorlook.ts: today Silverware Database and Layout each render and
  read their sample) and kept as a signal, read again as a theme changes.

### Weighed and left out

- **A write queue across plugins** (every page write through the core):
  `replanOpenPage` covers the open page, and no race between two plugins'
  writes is known. Taken up only if one is reproduced.
- **The configuration page's writes** (shared/configpage.ts, 6 plugins, each
  its own block): the same; each plugin writes only its block.
- **Pure code** stays in shared/ and bundled: markdown and its parser
  (lezer), yaml, the page writer, the table model, elements, clipboard,
  shadow DOM helpers, keys, kept keys, menu slots, the formula field's
  helpers. No instance to share; each bundle takes only what it imports.
- **Silverware Icons and Silverware Editor stay plugins**, offering their APIs
  through the registry: optional, released on their own, the editor's
  CodeMirror (700 kB) a file of its own loaded on use. Merging them into the
  core is weighed again once the registry is in place.
- **No store of the plugins' state.** A plugin's module is never evaluated
  again on a reload of Space Lua (probe 2), so its own state lives in its
  module (the database's `keptParts`, its places' UI: docs/silverware-preact.md).
  The core holds only state that is the plugins' together.
- **Undo** stays each plugin's.

## API changes

Weighed for what they bring; each changes only with the step that needs it.

### Public

- **P1. `silverware.formulas`** (the core's API page): `defineFunctions` and
  `defineSource`, one registry for Silverware Table's and Database's formulas,
  defined once. `silverware.table.defineFunctions` and `defineSource` stay,
  as aliases. Brings: a user's function works in a database (`#NAME?` today).
- **P2. Custom views (Silverware Database)** keep `render(host, element)` and
  `update()` / `destroy()`: framework-free on purpose (a user writes a view in
  plain JS or any framework; only DOM elements and callbacks cross the
  contract). Added: `host.kept`, a view's own state kept through a write of
  the block and a redraw by SilverBullet. `HELPERS` keep their contract and
  the DOM they give (docs/silverware-preact.md, *Custom views*). Weighed and
  left for the board's checkpoint: `update(snapshot)`, breaking.
- **P3. The Lua handovers between our plugins go**: `silverware.icons.api`,
  `silverware.editor.api`, `silverware.assets.api`, `silverware.layout.api`
  are handed from Lua to JS for the other plugins; once every plugin takes them
  from the registry they are removed, **a breaking change** of those plugins'
  Space Lua API (`!`, a major, said in their changelogs). `silverware.table.tables`
  and `onWrite` stay (documented for scripts), the registry beside them.
- Settings, the DOM marks, the overlays' classes, and each plugin's other Space
  Lua API do not change.

### Internal

- **I1. One binding of SilverBullet** (B): `Platform` made once; the plugins'
  `host/silverbullet/` keep what is theirs.
- **I2. Dialogs** `dialogs.open({ look, title, content, … })` with `content` a
  vnode or a node, a handle to close it; shared/dialog.ts goes.
- **I3. Menus** `menus.open({ anchor, look, entries })`, from
  shared/popupmenu.ts; the callers' own placing and closing goes.
- **I4. Side panels** `panels.open({ look, kind, content })`.
- **I5. Watchers to signals**: watchmark.ts, `watchOverWindow`,
  `watchSidePanel` go; the attributes stay. `applyLayers` keeps the layers
  that are no overlay.
- **I6. The settled index** read from the core (H).

## Releases

- The first release with the core: the core 1.0.0, each plugin a minor (it
  needs the core, installed with its update: probe 4; nothing of a space
  changes), except where P3 or a snapshot makes it a major.
- **Formula features become the core's releases**: a formula function added
  is a minor of the core, and a plugin needing it refuses until the core is
  updated. Releases of the core and the plugins go together.

## Risks

- **One point of failure**: the core broken stops every plugin. Its tests are
  the strictest; the gate keeps a plugin from half starting.
- **A user's versions apart**: updated one by one, a plugin may need a newer
  core; the gate says so and how.
- **Load order**: the core's API page first of ours; Space Lua loaded again
  hands the bridge again (registrations replace, never add).
- **The branch is long**: kept green at each step; `main` meanwhile gets only
  what is apart (the offline note).
- **Themes**: overlays drawn with the plugins' classes and structure, kept by
  DOM snapshots; a change of a class or of structure is a decision and a major.

## Decided

- 2026-11-25: one core for what needs one instance; `shared/` for the rest.
  Preact lives in the core (docs/silverware-preact.md).
- 2026-11-25: the version gate in Lua in each plugin's API page, before its
  bundle; a plugin refused starts nothing, its API stubs say why and how.
- 2026-11-25: the core's version is its API's; no second number.
- 2026-11-25: a second side panel goes on top of the first (a stack, as
  dialogs and menus).
- 2026-11-25: the DOM marks stay (CSS and users' styles select them); only
  their watchers move to the core's signals.
- 2026-11-25: what must be one per window or one version for every plugin is
  the core's; shared/ holds pure code and state meant to be each plugin's own,
  listed; a test of shared/'s module-level state keeps the line (*Where code
  goes*). The measure of the plan is the cleanest code to maintain at its end,
  not how soon Preact comes: the services stay as planned, the formulas'
  engine in the core.
- 2026-11-25: SilverBullet is a host kept apart: its knowledge in bindings
  (`host/silverbullet/` of each plugin and of the core, shared/silverbullet/),
  checked by a test of markers; the core is host-free outside its binding.
- 2026-11-25: storage: markdown stays the format. A plugin with a model of its
  own has a store with a contract; a plugin over the document works through
  the reader and the page writer's parts, on structure, not offsets; every
  write of a page's text goes through the writer (editing tools apart);
  settings through `Platform.settings`. No store added where the text is the
  model (*Storage*).
- 2026-11-25: Safari is not tested; it is met when a user reports a problem.
- 2026-11-25: custom views stay framework-free (only DOM and callbacks cross
  their contract).
