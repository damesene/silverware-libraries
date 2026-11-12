# Silverware Database

Databases in the spirit of Notion: one item one page, its properties the page's frontmatter, shown by a ```` ```silverware-database ```` code block in table, list, board, calendar and timeline views. Prefix `swd-`, settings and API under `silverware.database` (`defineViews`, `defineTypes`, `defineConverters` on the API page). On `main` since PR #13 (`feat/database`) was merged, listed in REPO.md; still growing.

- The plan, the probes' results, every step's decisions and what each review left open: [docs/silverware-database.md](../docs/silverware-database.md) (*Layers*, *The pages store*, *Probes*, then the dated sections). Read the relevant section before changing a part.
- Conditional formatting: planned, nothing built ([docs/silverware-database-conditional-formatting.md](../docs/silverware-database-conditional-formatting.md): Silverware Table's `conditions/` domain shared, one evaluation for every view).
- User docs and the API for views and types of your own: `silverware-database.md`; its examples are run by `src/docs.test.ts`.

## Layers (decided 2026-11-07)

The database knows neither SilverBullet nor pages. `src/isolation.test.ts` checks by folder, in the order `model`, `domain`, `views`, `converters`, `modules`, `core`, `store`, `host` (then src/'s root files, the entry): each imports only itself and the folders before it.

- `views/`, `converters/` and `modules/` may import the core's **types only** (`import type`), never its code; they are written against `ViewHost` / `ModuleHost` / `ConverterDefinition`.
- **Converters** (`core/converter.ts`, `converters/builtin/`): text selected read as items and the properties they need; what is made of it is the core's (`createDatabase(name, properties, items)`, one transaction). Only they (and the host) read markdown (`shared/markdown/`). A converter of the user's is given `CONVERTER_HELPERS` (`converters/helpers.ts`): `readBlocks` and the rest the built-in ones read with.
- `shared/pages/` (the page writer) only from `store/pages/`, `host/` and the root; `shared/platform.ts` only from core, store, host, root; other shared UI only from what draws (views, modules, core, host).
- No `frontmatter`, `silverbullet` nor `shared/pages/` in model, domain, views, converters, modules or core; no SilverBullet index names (`lastModified`, `itags`, `PAGE_KEYS`…) in `store/`: the store asks the platform (`Index.reservedKeys`, `documentDates`, `tasks`; `Space.validateName`), the binding (`host/silverbullet/`) answers.
- **An item is an `ItemKey`, opaque**: held, compared, given back, never made or read outside the store. That an item is a page is the pages store's alone.

## Invariants

- **Silverware Layout's provider** (`registerLayout` in index.ts, `host/silverbullet/layout.ts`): where the init page hands over `silverware.layout.api` (`bridge.layout`), the places (`.swd-place`) are registered with it; its entries are lines of the block under the name `layout` (`layout.width: 1200`), read from the text the place was drawn for (`shown.current`, synchronously) and written as the place writes its block (`writeBlock`). A place over the window is marked `data-silverware-over-window`: Silverware Layout stands back. Set no width on `.swd-place`.

- **The page writer (`shared/pages/`) is the one place that writes a page's text**, a block's state too (its `codeBlocks` part). The pages store reads the index and writes only through the writer, each page only where it is still as read.
- **Writes are transactions** (`DatabaseStore.plan` then `apply`, core/changes.ts), applied document by document (SilverBullet writes no pages together; a rename is a page written and another deleted) and reported: what was written, what was left and why (`cause`: changed, refused, missing, version). Undo is the core's (core/history.ts), not the editor's.
- A revision is of the content read (hashes), not a time, so the index catching up with a write never makes a change stale.
- **A view's state is the core's** (core/place.ts), kept in the block as `<view>.<key>` lines, its keys and forms in one place (`core/statekeys.ts`): filter, sort, Group by, Color by, visible properties (`hiddenProperties`, or `shownProperties` for a view declaring `properties: { hiddenByDefault: true }`: calendar, timeline). Views read results (`host.listing`, `host.look`), never the state's form. *Apply to all views* is core/applyall.ts.
- **Modules** (`core/module.ts`): `{ name, label, description, settings, start(host) }`, started where `silverware.database.modules.<name>.enabled`; they give `placeMenu` (by slot, shared/menuslots.ts), `placeDrawn`, `openItem`, `stop`, and reach each other by `offer`/`offered`. Built-in: properties (the schema's dialog), peek, fullscreen (`modules/builtin.ts`).
- **Icons go through Silverware Icons**: `shared/icons.ts` `iconsOf` reads `silverware.icons.api` (handed over by the binding) or gives a stand-in saying it is needed; the core passes `host.icons` and draws a user's icon (an emoji, `lucide:house`) by `ItemLooks.ownIcon` (core/look.ts); picked through Silverware Icons' picker too (the shared emoji picker went on 2026-11-10). See docs/silverware-icons.md.
- Settings dialog writes its own CONFIG block (`-- managed-by: silverware-database`): the Configuration Manager rewrites its block from its schema, which views' open-ended settings are not in.
- Store, writer and core are made once per window (`keptParts` in index.ts), so Undo survives a reload of Space Lua; modules are made anew.

## How a database is kept (the pages store)

- Root page `<folder>/db-<id>` (frontmatter `tags: db-root`, `_database: { id, name, properties }`), found by its id, not its name. Items are its direct subpages tagged `db` (a subpage of an item is no item), `_database.rank` their order by hand. User properties at the frontmatter's top level so a query reads them bare.
- An item's name is its page's name; renamed by SilverBullet's `index.renamePageCommand` (links followed), the root with its folder by `renamePrefixCommand` (prefix ending in `/`) then the page.
- Property keys are made with `_`, not `-` (a dash reads as subtraction in a query).
- A date and time is written quoted (the index turns an unquoted one into `…T14:30:00.000Z`); a date alone stays as written.

## Gotchas

- **SilverBullet's widget cache** gives back an element rendered for the same text, still holding state it wrote since: an element that wrote, went out and came back is drawn anew from the text it was rendered for (`backAfterWriting` in index.ts).
- **A press beside a block on its line** puts the cursor in the block (its markdown shown): taken with its mouseup and click (`pressBeside`); Alt still shows the markdown. SilverBullet's own widget menu and Copy buttons are hidden by the style page.
- **The index is cleared while a page is reindexed** (plugs/index/queue.ts `indexFile`): queries between saw the item gone (the peek closed, rows flickered). `host/silverbullet/settledindex.ts` keeps the last reading while the index queue is busy (`indexIdle`, `mq:emptyQueue:indexQueue`) and tells changes early and again whole (`IndexChange.early`); the store lets a page it wrote go only once the index has it as written.
- **An empty Lua table arrives in JS as `{}`**, not `[]`: the platform makes lists of what Lua hands over (`listOf` in host/silverbullet/platform.ts).
- Keys typed in the peek: SilverBullet takes keys from fields of ours unless `keydown`/`keyup`/`keypress` are stopped at our element.
- **What a place lays over the page is in the body while it shows** (`liftOut` in views/float.ts: an editor's panel, the names offered under a field, a tool's menu), at the shared layers, its look by `.swd-lifted`: in the page it was in CodeMirror's scroller (a stacking context, z-index 0) under the other plugins' controls, and in a cell being edited (z-index 1) under a table's held header (2026-11-12). An editor's panel leaves a mark (`FLOAT_HOME_SELECTOR`) where it was and goes with it (its cell drawn anew); a menu goes back into its tool's box as it closes. So a test finds an open menu or panel in the document, not in the place.
- Undo keeps a transaction whose undo could not put back what only it holds (`heldBack` in core/history.ts); a removed page it cannot make again comes back as `Recovered/<name>` (`DatabaseStore.recoverRemoved`).

## Verified in SilverBullet (2.12.1, 2026-11-07, probes and the binding's first use)

- Page objects carry every frontmatter key with its YAML type; a missing key is `nil` (a query comparing it fails, so comparisons are the store's). The page object's own keys (`name`, `ref`, `lastModified`, `created`, `tags`, …) overrule the frontmatter's: why the database's data is under `_database`.
- A code widget's `render` runs per block as the page opens and again only when its text changes; an element made in JS is the same element after scrolling out and back. `page:index` can come a moment before a query gives the page.
- Events: another page written gives `file:changed`, `page:saved`, `page:index`; a rename is no event of its own (saved, deleted, indexed), so a rename outside the database is another item.
- `yaml.parse` makes an unquoted date a JS `Date` and `yaml.stringify` escapes JSON values: the binding reads and writes the block itself, in JS.

## Tests

- Unit tests and the playground (`/database.html`) run over the memory store; `store/contract.ts` is the suite every store passes (memory and pages).
- `ui-tests/` run against SilverBullet only (code widgets). The test servers start at port 3010 (scripts/silverbullet-servers.ts), which a local SilverBullet on 3010 collides with: stop it or set `SW_SB_FIRST_PORT`.
