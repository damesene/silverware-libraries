# Silverware Icons: plan

A plugin of its own, **Silverware Icons** (`silverware-icons/`, prefix `swi-`,
API `silverware.icons`): sets of icons other plugins show and offer to pick
from, the user's icon beside an action or an item in the colors of the page
(monochrome), not only an emoji. Asked by the user on 2026-11-10: emoji are
fine, but their colors often do not fit; the icons must be usable outside the
toolbar, and a set must be easy to add or replace.

## Decided (with the user, 2026-11-10)

1. **A plugin of its own**, not a part of the toolbar: Silverware Toolbar and
   Silverware Database use it (later others), none of them needing it
   installed (see *Without Silverware Icons*).
2. **Sets are data, files of their own**, beside the bundle:
   `silverware-icons-lucide.js`, `silverware-icons-emoji-search.js`; the plugin's code
   knows no set by name, a manifest the build writes lists them (*The sets*).
3. **Lucide** is the first set of icons (ISC; 24×24, stroke 2, round caps and
   joins, `currentColor`: the grammar the plugins' own icons are drawn in,
   silverware-toolbar/src/icons.ts).
4. **An icon of a set of icons is written `<set>:<name>`** wherever a plugin
   keeps one: `icon = "lucide:house"` in CONFIG, `icon: lucide:house` in a
   page's frontmatter. Plain text, read by Lua and queries. **An emoji is
   written as itself** (`icon = "🏠"`), as now: a set of characters' value is
   its character, so nothing written today changes and no emoji has the form
   of a reference.
5. **Emoji move into Silverware Icons**, as its set `emoji` (the data
   scripts/emoji.mjs makes now, the picker of shared/emoji.ts): one copy of
   their data instead of one per plugin, one picker, one list of the last used.
   A breaking change (see *What changes for a space*).
6. **Picking**: one picker, a tab per set (*Icons*, *Emoji*), opened on the
   tab used last; a search within the tab; the set's groups as a filter.
   Typing a character into a field stays.
7. **A set's groups as a filter, its look by how many there are**: up to
   `ROW_GROUPS` (10) a row of icons over the search, as the emoji picker has
   them now (emoji: 9 groups); more, a dropdown of their names beside the
   search (Lucide: 43 categories). A rule of the picker, not a choice of a set:
   no set is an exception anywhere. All of a set's groups are offered; none is
   picked by hand.
8. **Replacing a set is prepared for, not built**: a reference names its set,
   so a set gone shows its references as missing (never rewritten). Lucide's
   own renames are followed (its aliases); a set taking another's names
   (`replaces`) can be added when it is needed, the written form allowing it.

## The plugin

```
silverware-icons/
  silverware-icons.md          library page: what it is, the sets, a set of your own; `files:` the pages and files below
  silverware-icons-api.md      `-- priority: 50`: silverware.icons (`api`: the JS API object; defineSets, resetDefinitions)
  silverware-icons-style.md    the picker's CSS (swi-), the icon box (`swi-icon`), the stand-in (`swi-missing`)
                               (no init page: nothing to set and nothing to start, the API page imports the JS)
  silverware-icons.js          the bundle: the manifest, registry, drawing, picker
  silverware-icons-lucide.js           a set's icons: names, nodes, aliases (what drawing needs)
  silverware-icons-lucide-search.js    its keywords and groups (what the picker needs)
  silverware-icons-emoji-search.js     emoji (moved from the toolbar's and the database's; a character needs no drawing data)
  src/
    index.ts                   the API object, one per module (js.importFromSpace gives the same module on each load of Space Lua)
    set.ts                     the shape of a set and its checks (built-in and the user's alike)
    registry.ts                the manifest's sets and the user's, loaded as first needed; a reference resolved (aliases)
    draw.ts                    an icon's markup; placeholders filled
    picker.ts                  the picker (moved from shared/emoji.ts, over sets)
```

### The sets

- **The manifest** (written by the build into the bundle, as data): each
  built-in set's `name`, `label` (its tab), `kind`, `license` and its files.
  So the tabs and `text()` know every set before any file is loaded; adding a
  set is its data script and its entry in the build's list, nothing in `src/`.
- **A set's data**, split by who needs it:
  - for drawing (loaded as an icon of the set is first drawn): `icons` by
    name, each `nodes` (kind svg) or `text` (kind text), `aliases`;
  - for picking (loaded as its tab first opens): each icon's `label`,
    `keywords`, `groups`, and the set's `groups` (`id`, `label`, `icon`: a
    value of this set).
  Rendering one favourite at every start of SilverBullet then loads no search
  data. Emoji are one file: a character needs no drawing data, so their file
  is the picker's alone.
- **SVG icons are drawn from nodes**, Lucide's own `icon-nodes.json` form
  (`[tag, attrs]`, 24×24, stroke and fill as the set's defaults), as markup the
  plugin writes: the elements (`path`, `circle`, `rect`, `line`, `polyline`,
  `polygon`, `ellipse`) and attributes (geometry, `fill`, `stroke*`,
  `transform`, `opacity`) allowed listed, values escaped; `style`, `href` and
  `on*` never. Not as a protection from a user's set (`defineSets` already runs
  the user's JS), but so a set of any source (a converted font, a copy from a
  site) cannot break the page it is drawn in, and every set is drawn alike.
  Labels and names go in as text only.
- **Checked as the plugins check definitions** (`set.ts`): a set that is wrong
  refused whole, said in a notification naming it; an icon that is wrong left
  out, said once.
- **The user's sets**: `silverware.icons.defineSets(js.importFromSpace(…))` in
  Space Lua, as `defineFormats` / `defineActions`: replaced as Space Lua loads
  again; a built-in set's name replaced in place. One file (drawing and
  picking data together): the split is for the built-in sets' size.

### The API other plugins get

The plugins draw icons as markup (`innerHTML`: the toolbar's `Action.icon` in
core/bar.ts, core/popup.ts, modules/gestures.ts, settings/dialog.ts; its own
icons through `ownIconHtml` in core/favorites.ts and core/controller.ts;
snippets' `swb-glyph`) and as elements (the database's `itemIcon` in
core/look.ts, views/icons.ts `ownIcon`/`propertyIcon`). So the API gives
markup, which an element takes too:

```ts
type Icons = {
  readonly version: number;
  // Its markup now, in `<base>-icon` (sized 1em, on the line): an emoji as text; a set's icon its SVG where its set
  // is loaded, else a placeholder `<span class="swi-icon" data-swi-icon="lucide:house">` of the same size, which the
  // plugin fills once the set is (below); a reference no set has: a stand-in, its title why
  markup(value: string, base: string): string;
  // As text (a tooltip, a screen reader, a native <option>): an emoji itself, an icon its label (before its set's
  // picking data is loaded: its name)
  text(value: string): string;
  // The picker in `into` (the caller's panel); `picked(value)` told the value as written (an emoji's character,
  // `set:name`); `sets`: its tabs (none: all; the toolbar's Emoji action: ["emoji"], it writes into the page);
  // `shown` once its data is in (the caller places its panel again); `searchIcon` the caller's; gives a close
  pick(into: HTMLElement, options: { sets?: readonly string[]; picked(value: string): void; shown?(): void; searchIcon?: string }): () => void;
};
```

- **Placeholders are filled by Silverware Icons**, not by the plugins: as a set
  is loaded, the placeholders of its icons in the document are given their
  SVG (one pass over `[data-swi-icon]`), and while any set is loading a
  MutationObserver fills those added meanwhile, ended once none is left
  unfilled. So a plugin writes markup and knows nothing of loading. To check in
  step 2: the observer's cost in SilverBullet's editor (it is on only while a
  set loads, a moment at start).
- **How a plugin gets it**: the API page sets `silverware.icons.api` (one
  object per module). A plugin's init page hands it over in its bridge where
  it exists, as Silverware Chart takes Silverware Table's
  (silverware-chart-init.md); the API page has priority 50, the toolbar's init
  page 0 and the database's -10, so it is there first. JS functions and plain
  objects through Lua come back the same (verified for the table's API); an
  object whose methods JS calls is checked in step 2.
- **`shared/icons.ts`** holds the type, `isReference(value)` (pure, by its
  form: `^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$`) and `iconsOf(given)`: the API
  given where its `version` is the one shared/icons.ts was written for, else
  the stand-in below (a plugin and Silverware Icons are updated apart). A
  plugin calls `iconsOf(…)` once and uses what it gets; nothing in a plugin
  asks whether Silverware Icons is installed. Each consumer's isolation test
  (as silverware-chart/src/isolation.test.ts) refuses an import of
  `silverware-icons/src`.
- **The plugins' own rules for a value stay theirs**, each also taking a
  reference whole: the toolbar's `iconOf` (any text of up to MAX_ICON
  graphemes: "H1", "✎"; a reference one), the database's `validateIcon` (one
  grapheme, in its pure domain, run as the store reads frontmatter; a
  reference too). Neither asks whether a set is loaded or installed, so no
  value read is ever dropped for it.
- **Where the database gets it**: the binding (host/silverbullet) hands
  `Icons` to the core with the platform (a field `icons` of shared/platform.ts
  `UserInterface`, its stand-in in the memory platform and the playground), so
  core/look.ts, views/icons.ts and the properties' dialog draw and pick
  through it.

### Without Silverware Icons

`iconsOf(undefined)`, written once in shared/icons.ts:
- `markup`: an emoji (any text) as text: what a space shows now still shows;
  a reference a stand-in (a dotted box), its title *Needs Silverware Icons*.
- `pick`: the picker's place says *Emoji and icons need Silverware Icons*, with
  where to install it from (its entry in REPO.md).
- `text`: the text itself, a reference its name (`house`).

Typing a character into a field works without it. The consumers' library
pages say what needs Silverware Icons.

Done in step 4: shared/icons.ts (`referenceOf`, `isReference`, `ICONS_VERSION`,
`Icons`, `PickOptions`, `iconsOf` and the stand-in, `escapeMarkup`, which
Silverware Icons' drawing uses too), shared/icons.css (the `<base>-icon` box and
`<base>-icon-missing`, written by scripts/sharedstyles.mjs into the style pages
of the plugins as they move onto it, `shared-icons` marks). The stand-in's
note is styled in place: without Silverware Icons none of its CSS is there.

## The picker

- Its markup and CSS are Silverware Icons' (`swi-*`, its style page), one look
  wherever it opens; the caller's panel sets its colors and size through CSS
  variables on `into` (the toolbar's panel, the database's popover). The
  `shared-emoji` template of scripts/sharedstyles.mjs and its blocks in the
  toolbar's and the database's style pages go. What stays shared is the icon
  box and the stand-in (`<base>-icon`, a template written into each consumer's
  style page, as the menu's).
- A tab per set (its `label`), the one used last open first (localStorage
  `silverware.icons.lastSet`, per browser, a convenience); `sets` narrows
  them (one: no tabs).
- The search (shared/search.ts `findByWords`: labels, keywords, groups'
  labels), arrows and Enter, as the emoji picker has them.
- Groups: a row of icons (up to ROW_GROUPS) or a dropdown (more), *All* first.
  In *All* Lucide's icons are one grid by name (an icon in several categories
  shown once); emoji keep Unicode's order in their groups as now.
- The last used, of every set, first: localStorage `silverware.icons.recent`;
  the two lists of now, `silverware.toolbar.recentEmoji` (toolbar
  modules/emoji.ts) and `silverware.database.recentEmoji` (database
  views/popover.ts), read into it once (the toolbar's first, then the
  database's not in it yet) and removed.
- A set's picking data loaded as its tab first opens (an SVG set's drawing
  data with it: its grid is drawn at once); its place shown meanwhile, `shown`
  called once it is in.
- Lucide's *All*, its 2046 icons, drawn in about 106 ms in the playground
  (Chrome on a laptop, 2026-11-10), the emoji picker's order of cost: no
  windowing of the grid.
- Done in step 3: silverware-icons/src/picker.ts, its CSS in the style page,
  `api.pick`; playground/icons.html (the picker in a panel, the icon picked
  drawn as the plugins draw it) and silverware-icons/ui-tests/ (the picker on
  the playground, `@playground`; the API from Space Lua against
  SilverBullet). shared/emoji.ts stays until the toolbar and the database
  move off it (steps 5, 6).

## Data

- **Lucide** from `lucide-static` (devDependency, ISC; 1.71.0 the latest on
  2026-11-10): `icon-nodes.json` (2046 icons, 847 kB as published, 105 kB
  gzipped) and `tags.json` (the keywords; 358 kB as compact JSON). **Its
  categories and aliases are in no npm package** (checked 2026-11-10: not in
  lucide-static, lucide or `@lucide/lab`): they are in Lucide's repository,
  `icons/<name>.json` (`categories`, `aliases`: `{ name, deprecated, … }`) and
  `categories/<id>.json` (`title`, `icon`; 43 of them; an icon's category
  `$extends:<icon>` is that icon's categories, followed by the script; a
  category's icon is not always of that category). A script
  (`scripts/icons/lucide-meta.mjs`) reads them at the tag of the version
  installed and writes `scripts/icons/lucide-meta.json`, committed; the build
  reads it, so building and `check-build` need no network. Run again with each
  update of lucide-static; the build fails where an icon has no entry there or
  an entry names no icon (as scripts/emoji.mjs fails on a group's icon).
- **Emoji** from emojibase-data as now (scripts/emoji.mjs moved to
  scripts/icons/emoji.mjs, its output in the set's shape).
- The files minified (a path's node its `d` alone, the most of them) and
  checked by check-build as the emoji file is now (scripts/build.mjs,
  `iconFiles`; the manifest `silverware-icons/src/manifest.ts` with them).
- **Sizes** (measured 2026-11-10, Lucide 1.71.0): `silverware-icons-lucide.js`
  356 kB (92 kB gzipped), what a start pays for once where a favourite has an
  icon of it (the browser's cache after); `silverware-icons-lucide-search.js`
  370 kB (73 kB), as the picker's tab first opens;
  `silverware-icons-emoji-search.js` 141 kB (39 kB). Writing a path's node as
  its text saved 100 kB of the drawing file but 4 kB gzipped: smaller forms
  would not pay.

## The repository

- scripts/build.mjs (the library list, the set files written beside the
  bundle in place of the emoji loop), scripts/deploy.mjs (the library list),
  scripts/playground.mjs (the set files written at its start, in place of the
  emoji files), check-build.
- REPO.md: the entry; the toolbar's and the database's wording of "an emoji
  picker".
- `silverware-icons/ui-tests/` (a CI job of its own, by its folder:
  scripts/ui-test-groups.mjs); a playground page `/icons.html`.
- The UI tests that pick emoji (toolbar emoji.spec.ts, toolbar.spec.ts,
  touch.spec.ts, database database.spec.ts) need Silverware Icons deployed in
  the test space; a test of each consumer without it (the message).
- CLAUDE.md: the plugin's entry and layout; the toolbar's and the database's
  entries.

## What changes for a space

- **Silverware Toolbar** (its own icon of an item, of a snippet, of a gesture
  button's slot): a button *Choose…* by the field opens the picker; `iconOf`
  takes a reference whole; every icon a favourite has of its own goes through
  `markup` (`ownIconHtml`, the snippet's glyph). Its Emoji action opens the
  picker with `sets: ["emoji"]`.
- **Silverware Database** (an item's icon, a property's icon): the popover's
  and the properties' dialog's emoji picker (`emojiChoice`) is the Icons
  picker; `itemIcon`, `ownIcon` and `propertyIcon` draw through `markup`;
  `validateIcon` takes a reference (read in the store, store/pages/versions.ts,
  and checked in core.ts).
- **Breaking** (`feat(toolbar)!`, `feat(database)!`, and the announcement):
  without Silverware Icons installed, the toolbar's *Emoji* action and the
  database's icon pickers show the message instead of the picker. Values
  written (CONFIG, frontmatter) do not change. The files
  `silverware-toolbar-emoji.js` and `silverware-database-emoji.js` leave the
  library pages' `files:`; a space keeps them until deleted, unused.

## Steps

Each its commits, a review after each, docs (the library pages, CLAUDE.md,
this file) in step with the code, the local SilverBullet after each.

1. **The data**: scripts/icons/ (Lucide's meta, the sets' files split for
   drawing and picking, emoji moved in its shape), the manifest, the sizes
   measured, check-build.
2. **The plugin**: set.ts, registry.ts (aliases), draw.ts (placeholders
   filled), the API page and the init page, `defineSets`, the build, deploy
   and playground lists, REPO.md; unit tests; checked in the local
   SilverBullet that `silverware.icons.api` reaches another plugin's init page
   as the same object, its methods called synchronously, and what the
   observer costs.
3. **The picker**: shared/emoji.ts over sets into silverware-icons/src/picker.ts
   (tabs, groups' row or dropdown, the last used and the old keys read in),
   its CSS; `/icons.html` and its ui-tests/.
4. **shared/icons.ts**: the type, `isReference`, `iconsOf` (its version) and
   the stand-in, the icon box's CSS template; its tests.
5. **Silverware Toolbar** onto it (`markup` for its own icons and snippets,
   the picker in the item's, the snippet's and the slot's panels, `iconOf`;
   the Emoji action), its emoji file and the shared-emoji CSS gone; its
   isolation test; its tests, UI tests on both targets, with and without
   Silverware Icons.
6. **Silverware Database** onto it (`Icons` through the platform, items' and
   properties' icons drawn and picked); the same.
7. The library pages, the announcement.

## To verify

- Verified in the local SilverBullet (step 2, 2026-11-10): the API page's
  `silverware.icons.api` called from Lua (`markup`, `text`), the set's file
  loaded beside the bundle (`import.meta.url`, as the emoji file), Lucide's
  aliases followed (`lucide:home`). Still to see in step 5: the object handed
  to the toolbar through its bridge, called from its JS synchronously; the
  observer's cost while a set loads.
- Lucide's repository at the tag of 1.71.0 (seen on `main`, 2026-11-10:
  `icons/house.json` with `categories` and `aliases`, `categories/home.json`
  with `title` and `icon`).
- Which icons SilverBullet itself uses (Feather is thought; Lucide descends
  from it): only whether they look alike, nothing depends on it.
