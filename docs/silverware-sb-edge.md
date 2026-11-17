# SilverBullet's edge (3.0): what it breaks in Silverware, and the fix for both versions

Plan, started 2026-11-17 (branch `fix/sb-edge`). Takes in the earlier plan for tool pages under `Library/` (2026-11-13, `docs/silverware-library-prefix.md`, removed).

> **For an agent reading this plan:** the fix keeps code for SilverBullet 2.12.1 and older beside the new, each piece marked `SB-2.12-COMPAT` (see *Cleanup*). Once the cleanup's condition holds (a SilverBullet release with these changes is out and Silverware stops supporting the ones before), tell the user that the cleanup is due and what it removes, before or alongside any other work on these files. Do not do it unasked: dropping support for a SilverBullet version is the user's decision.

## Goal

Every plugin works on SilverBullet 2.12.1 (the latest release, the user's Docker, `npm run test:ui:sb`) and on its edge build (the next release, 3.0, `npm run test:ui:sb:edge`), for as long as both are in use. One code for both wherever it can be; where it cannot, the old version's code is marked so it can be deleted in one pass (*Cleanup*).

**Where a fix goes** (the user's rule, 2026-11-17): a plugin depends on no behaviour of SilverBullet's directly. What allows for SilverBullet goes in the plugin's SilverBullet binding (its init page's Lua, `host/silverbullet/`, Silverware Tags' `space/silverbullet.ts`, Silverware Layout's `behaviour.ts` answering a `GridHost` hook); its core, modules and shared code stay generic (a hook, an optional method), their comments saying what they allow for, not which SilverBullet does it.

## Sources

- **Read SilverBullet's `main` on GitHub** (`gh` is not installed on this machine; `curl` works): a file as `https://raw.githubusercontent.com/silverbulletmd/silverbullet/main/<path>` (spaces as `%20`), a commit with its files and diff as `https://api.github.com/repos/silverbulletmd/silverbullet/commits/<sha>`, recent commits as `…/commits?sha=main&since=<ISO date>`. Downloaded JSON goes to the scratchpad, read with `node`.
- **Not in the local fork**: `d:\git\silverbullet` (origin `damesene/silverbullet`) stops at 2026-11-06 and has no remote for SilverBullet's own repository. Do not conclude from the fork that this plan is wrong.
- Key files: `docs/CHANGELOG.md` (section *Edge (3.0 edition)*), `docs/ADR/012 Tooling Lives in Library.md`, `docs/Tool Page.md`, `docs/Theming/Upgrading Existing Styles.md`, `plug-api/lib/tool_pages.ts`, `client/config_management/config_page.ts`, `config_block.ts`, `managed_edit.ts`, `client/workbench/libraries/library_names.ts`.
- **An edge build to run**: `npm run test:ui:sb:edge` (on Windows SilverBullet's release `edge`, downloaded into `.cache/silverbullet/`; elsewhere the image in `scripts/silverbullet/edge.mjs`). CI runs it daily (`edge-tests.yml`).

## SilverBullet's changes (edge, to 2026-11-16)

### Tool pages under `Library/` (ADR 12, 2026-11-09)

| Commit | What |
| --- | --- |
| `96540c35` | tool pages (the new name of meta pages) told by location (`Library/*`), not by tags |
| `d9b44893` | "meta" renamed "tool" in the UI and the APIs (`index.toolPages`; `index.metaPages` kept as an alias) |
| `f342459d` | scripts and styles loaded from `/.tooling` (one request), not from the index |
| `02066207` | libraries install under `Library/`, repositories under `Library/Repository/` |
| `33629a72` | Std drops its bare `meta` tags |
| `5555c196` | configuration moves to `Library/Config` (breaking) |

- **`space-lua` and `space-style` blocks run only on pages under `Library/`.** A block elsewhere is shown, never runs, and gets a lint warning.
- **Tool pages are told by location alone**: a page whose name starts with `Library/` (`isToolPage`). A bare `meta` tag means nothing any more; `meta/…` tags keep finding libraries, templates and repositories.
- **`CONFIG` becomes `Library/Config`.** The server renames an existing `CONFIG.md` to `Library/Config.md` when a space starts. `[[CONFIG]]` links still resolve. A page written as `CONFIG` afterwards is an ordinary content page: its blocks never run.
- **Every block on `Library/Config` runs in a boot pass** first (only configuration calls work), then again normally. The Configuration Manager's block is written as `-- managed-by: configuration-manager` followed by `-- boot: true`; SilverBullet adds the boot line itself (`managed_edit.ts` `withBootMarker`) and still finds the block by the marker alone.
- **Loading no longer waits for the index.** `space-lua` / `space-style` objects are indexed only for tool pages; on a fresh client a script querying the index while Space Lua loads sees nothing (`index:ready` tells when the first index is done).
- **Styles are ordered as scripts**: priority first (none counting as 0; unprioritized styles used to load before all others), then page name, then position.

### Other changes that may reach us

- **Themes** (`7fbf12e3`): a visual refresh; `data-sb-scheme` on `html` (`data-theme` kept, deprecated); a few variables removed (none of them used here, checked 2026-11-17); plain `html { … }` rules now apply in dark themes too.
- **Markup bar on desktop** (`7fbf12e3`): a formatting bubble over selected text and a ⋮ handle beside the line under the mouse. May overlap our controls (the table's +, the toolbar, a grid's handles).
- **Widgets compose everywhere** (`${…}` and widgets inside table cells, transclusions, query results).
- **Merged definitions**: `codeWidget.define`, `command.define`, `slashCommand.define`, `syntax.define` and others merge repeated definitions with the same name instead of replacing them.
- `page-lua` fenced blocks removed (`218682bf`); `editor.posAtDOM` added (`04d1ea23`).

## Findings

What the edge UI tests and probes showed, each with its fix (or why there is none). Filled as found. Edge build probed: `2.12.0-324-g84c9542f` (2026-11-16).

- **First run, before any fix (2026-11-17)**: Silverware Database's tests all failed (their views' `space-lua` page outside `Library/`, never run nor indexed), Silverware Assets' settings tests (saved into `CONFIG`, a content page there). Fixed by the settings page and the tests' pages under `Library/` (below); with them, 36 of 553 failed, against 0 of 553 on 2.12.1.
- **`index.toolPages` exists on edge** (a probe's `${index.toolPages and "yes" or "no"}`), so the init pages choose `Library/Config` there. The server renames `CONFIG.md` to `Library/Config.md` as it starts (its log says so).
- **Writing `Library/Config` and `editor.reloadConfigAndCommands()` applies a setting at once** on edge (probe: `config.get` gives the new value; `/.tooling` has it): `reloadConfigAndCommands` is `reloadTooling` there, scripts fetched anew from the server.
- **The text's width**: edge pads `.cm-content` 28 px left and 20 px right (2.12.1: 20 and 20), so the text is 752 px at `--editor-width: 800px` (2.12.1: 760), a table widget 754 px with its 1 px border. Silverware Layout's tests had 760 fixed: they measure it now (`textWidthOf` in its `ui-tests/helpers.ts`, checked against the text's line).
- **A file deleted or renamed**: edge's index plug indexes it after it is gone (`indexDocument` fails reading it, logged as an error). SilverBullet's own; Silverware Assets' tests let that error pass.
- **`${…}` evaluated before the page's table is there**: edge may evaluate an expression once early; `silverware.table.evaluate` gives `nil` and its `#REF!` then, as it should, and a script must take that (the formulas test's sum did not: `ipairs(nil)`). Nothing to change in Silverware Table.
- **Settings saved run the init pages again** (edge's `reloadConfigAndCommands` is `reloadTooling`: every script run anew in a fresh Lua environment; 2.12.1 loaded the configuration alone). Whatever a plugin did after its save with the bridge it held (the one of before, from the old environment) is stale: Silverware Toolbar's dialog saves and restarts through the bridge handed over last (`current.bridge`). And a toolbar started anew after the dialog gave the page its selection back missed it (the same selection made again tells the document nothing): the selection watcher tells a selection already there as it starts (`SelectionWatcher.start`). One code for both versions.
- **Loading no longer waits for the index**: the tests acted before the first index was complete (a rename followed no links, grids and settings measured before the editor was built anew). `scripts/silverbullet-loaded.ts` `loaded()` waits for it now (`client.fullIndexCompleted`, edge's `clientSystem.afterIndexCompleted`), and Assets', Tags' and Database's helpers call it. Tags' `addPages` writes through the client and waits for the index queue (files written on disk were found one after another).
- **An embed is drawn as a Lua directive's block** (`.sb-inline-content.sb-lua-directive-block` in a `span.sb-lua-wrapper`), its content drawn anew in the same frame after the first drawing: Silverware Assets offers a frame again where SilverBullet's drawing in it (its `.content`) is another than it was offered with (`host/silverbullet/assets.ts`). One of no image, video, audio or object is styled as an embedded page's card (padding, ground, corners, `::before` "↳ <path>", which set the frame's width): Assets' style page takes all of it off its frames (`[data-swa-type]`). Tables in such a block get SilverBullet's card look (striped rows, header, padding, an id's weight): Silverware Assets XLSX's sheet rules weigh more (`:is(#sb-main, html) … :not(#swa-xlsx-none)`), below a cell's own inline look.
- **SilverBullet takes an Alt+press in a widget at the widget's element** (capture, `widget_util.ts`): in a grid's cell edited it left the cell and showed the grid's markdown. Silverware Layout's grids hand it to the field first where the host says so (`GridHost.handsAltPressToField`, SilverBullet's answer in `behaviour.ts`), the field doing it by `TextEditor.altPress` (shared/editor.ts, Silverware Editor's CodeMirror).
- **Tables are a card clipped** (`.sb-table-widget { overflow: clip; border; border-radius; box-shadow }`, also in the fork after 2.12.1): Silverware Table's style page makes its box scroll sideways (`overflow-x: auto`) and its full screen's rules important (border, overflow, no corners or shadow).
- **A table's selection handles after a touch** (reported by the user, 2026-11-17): the one on the first row under the header lay half under the header (held, z-index 3, opaque on edge), and one on the table's bottom edge in a whole row's middle (`swt-at-mid`, as a spreadsheet's app puts them, on 2.12.1 too) was cut by the table's clipped box. The handles there are over the header (`swt-under-head`) and inside the table's edges in a row's or column's middle as at its corners (`overlays.ts` `placeHandles`).
- **The index's tags** (probe): a paragraph's hashtag has `parent` `paragraph` (2.12.1: `page`), a heading's is a `tag` object too (a table row's still not). Silverware Tags reads `paragraph` as `page` and each record once (`tagRecordsOf`).
- **The navigator after a click on a row that can be dragged**: the focus left on the page's body (its filter field given back only for a click it takes for opening nothing, which a view's `onSelect` returning `false` is not taken for), so the view's keymap (F2) reached nothing. Silverware Tags gives the focus back to the filter field of the navigator pressed in (`refocusNavigator`, `space/silverbullet.ts`). Worth reporting to SilverBullet.
- **The text's padding is uneven** (28 px left, 20 right): Silverware Layout's text edges and middle leave each side's padding out (`host/widgets.ts`), its tests measure the text's middle so.
- **A button's font is the browser's** (13.33 px) where SilverBullet's no longer gives it the text's: Silverware Database's row ✕ kept its size at a smaller font; it inherits the row's font.
- **Silverware Toolbar's docked items overflow by 2 px on edge** (its fonts): its touch test scrolled them to the end and measured after; it scrolls back before measuring.
- **The markup bar's selection bubble beside Silverware Toolbar** (probe, edge on desktop): a selection shows both, SilverBullet's `.sb-selection-bubble` above it and our toolbar by it (where 2.12.1 shows ours alone, at the same place). No test fails; it is a choice for the user (see *Open*). The ⋮ line handle (`.sb-line-handle`) beside a table stands 17 px left of the table's row grip, not over it.

## The fix

### Settings page

- **Which page**: one place decides, shared by every plugin: `Library/Config` where SilverBullet has tool pages, else `CONFIG`. Told by a capability, not by which page exists (a fresh edge space has neither): `index.toolPages` exists only where SilverBullet tells tool pages by location (`d9b44893`, the same day as `5555c196`). The init page's Lua decides it once and hands it to the bridge (`configPage`), so `src/` holds no test of SilverBullet's version.
- `shared/configpage.ts`: the name from the bridge instead of `CONFIG_PAGE`; messages say "the configuration page" or its name.
- The init pages' `saveConfigPage` (Table, Toolbar, Tags, Database, Layout, Assets): the page and its file (`<page>.md`) from that one value; the notification names it.
- **A `CONFIG` left on edge**: not read, not written.
- New managed block: write `-- boot: true` after the marker where tool pages exist, as SilverBullet writes it.

### Tool pages

- A shared helper `isToolPage(name)` (`Library/` prefix) next to `isMetaTag` in `shared/pages/tags/names.ts`. A page is SilverBullet's own when it is a tool page **or** has a meta tag: the tag still marks them in 2.12.1, the location on edge.
- Silverware Tags: `readCatalog` (`hideMeta`), `metaPages`, the guard in `controller.ts`, the Pages module, the workspace's meta / tags split.
- Silverware Database: `host/silverbullet/pages.ts` the same.
- Name in the UI: keep "meta pages" while 2.12.1 is the release; "tool pages" once a release has it. The setting's key stays (`protectMeta`).

### Docs

- "in a `space-lua` block of a page under `Library/` (your configuration page, say)" wherever a library page says where to put one (Table, Chart, Database).
- Where settings are kept: "your configuration page (`Library/Config`; `CONFIG` in SilverBullet 2.12 and before)".
- No `@` in what a space installs.

### CLAUDE.md

- Root, "Verified in SilverBullet": the index note holds for 2.12.1; on edge a fresh client has none while Space Lua loads.
- Root, `configpage.ts` under shared/: the configuration page's name comes from the bridge.

## Open

- **Reported by the user on edge (2026-11-17)**: (1) an XLSX file's preview and full view look wrong, as if styles leaked into them (striped rows, dark header cells), kept so in the preview made of it (Regenerate preview did not help); the side panel shows it right. (2) SilverBullet's own "↳ sample.xlsx" heading above ours (its embed card's `::before`: fixed for every file in Silverware Assets' style page, not yet deployed then). (3) A task's checkbox no longer grows and shrinks with the font zoom. (1) and (2) fixed (see *Findings*: the embed's card, the XLSX sheet's weight; checked by a probe, a preview and a full view drawn right). (3) not found yet: in a page's text on edge the box grows with the zoom (a probe: 13.3 px at 18 px, 16.3 px at 22 px, `0.7407em` of Layout's rule over the browser's 13.33 px control font, as SilverBullet's own box is 13.3 px at 18 px there); where the user saw it (a grid's cell, a database's peek, a setting) to be asked.
- **Silverware Toolbar and SilverBullet's selection bubble** (edge): both show by a selection. Either Silverware Toolbar hides SilverBullet's bubble while it is on (a style rule on `.sb-selection-bubble`, perhaps a setting), or the docs tell users to turn it off (`markupBar.selectionBubble`, Workbench > Configuration). The user's decision.
- Whether the boot pass runs users' `config.set("silverware.…")` lines before our `config.define`. Probe on edge.
- What Silverware Tags shows for pages tagged `meta/template` outside `Library/` on edge.
- Style order: whether a user's override of our variables still wins.
- `codeWidget.define` merging: Silverware Chart reads `config.get({ "codeWidgets", language })` before defining.
- `config.persist(path, value)` (edge) could replace our writer for values the Configuration Manager reads.

## Cleanup

**When:** a SilverBullet release has these changes (3.0), and the user decides Silverware no longer supports the releases before it (2.12.1 and older). Until then everything below stays. Check it whenever this plan, `shared/configpage.ts`, an init page's `saveConfigPage`, `isToolPage` / `isMetaTag`, or the UI tests' SilverBullet version is touched: if such a release is out, remind the user that this cleanup is waiting.

**How to find it:** every piece of code, test, style or doc kept only for 2.12.1 carries the mark `SB-2.12-COMPAT` in a comment (in a library page, where a comment would show, the item below names it instead). `git grep -n SB-2.12-COMPAT` lists them all; each file holding one is named in the list below (`scripts/sb-compat.test.ts`, in `verify`, fails where one is not). Remove the code each mark covers, then the mark, then its item here.

**What it removes** (one item per piece, added with its fix):

- **The choice of the configuration page** (settings saved where SilverBullet keeps them): in each init page, `local configPage = index.toolPages and "Library/Config" or "CONFIG"` becomes `"Library/Config"` (or the bridge's `configPage` goes, the name fixed in `shared/configpage.ts`): `silverware-assets/silverware-assets-init.md`, `silverware-database/silverware-database-init.md`, `silverware-layout/silverware-layout-init.md`, `silverware-table/silverware-table-init.md`, `silverware-tags/silverware-tags-init.md`, `silverware-toolbar/silverware-toolbar-init.md`. In `shared/configpage.ts` `CONFIG_PAGE` becomes `"Library/Config"`; in `shared/configpage.test.ts` the test of the default page reads `Library/Config`.
- **The UI tests' configuration file**: `configFile` in `scripts/silverbullet-servers.ts` gives `Library/Config.md` alone; `scripts/silverbullet.mjs` writes `Library/Config.md` before the server starts, not `CONFIG.md`.
- **The meta tag as a mark of SilverBullet's pages**: `isSilverBulletPage` in `shared/pages/tags/names.ts` goes, its callers take `isToolPage(name)` alone (Silverware Tags' `catalog.ts` `silverBulletPages` and `metaPages`, `controller.ts`' guard; Silverware Database's `host/silverbullet/pages.ts` `referablePages`); the meta-tag case in `shared/pages/tags/tags.test.ts` goes. Decide then what `meta/…` tags still do in Silverware Tags (SilverBullet keeps them for templates, libraries, repositories), and rename "meta pages" to "tool pages" in its UI and docs (the setting's key `protectMeta` stays).
- **The library pages' notes for 2.12** (a library page holds no comment, so no mark: found by the phrase): `git grep -n "2.12 and before" -- "silverware-*/silverware-*.md"`. "your configuration page (`Library/Config`; `CONFIG` in SilverBullet 2.12 and before)" becomes "your `Library/Config`" (or stays "your configuration page"), "a page under `Library/` (any page in SilverBullet 2.12 and before)" loses its parenthesis, Silverware Database's references lose "in SilverBullet 2.12 and before also the pages tagged `meta`…".
- **This plan's own scaffolding**: `scripts/sb-compat.test.ts` and the mark's rule in the root CLAUDE.md.

**After it:** `test:ui:sb` moved to a release with these changes, the 2.12.1 scenarios dropped; a release per plugin, MINOR or PATCH (nothing a space has breaks: a space on the newer SilverBullet is already on `Library/Config`), each changelog saying SilverBullet 2.12 and older are no longer supported; this plan marked done, its decisions moved to the plugins' CLAUDE.md where they still hold.
