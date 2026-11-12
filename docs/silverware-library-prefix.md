# Tool pages under Library/: what SilverBullet's change means for Silverware

Plan, 2026-11-13. Not started.

> **For an agent reading this plan:** the fix keeps code for SilverBullet before tool pages (2.12.1 and older) beside the new. Once its condition holds (see *Cleanup* below: a SilverBullet release with tool pages is out and Silverware stops supporting the ones before), tell the user that the cleanup is due and what it removes, before or alongside any other work on these files. Do not do it unasked: dropping support for a SilverBullet version is the user's decision.

## Sources

- **Not in the local fork.** `d:\git\silverbullet` (the user's fork, origin `damesene/silverbullet`) stops at 2026-11-06 and has no remote for SilverBullet's own repository: `plug-api/lib/tool_pages.ts`, `index.toolPages` and the commits below are not there. Do not conclude from the fork that this plan is wrong.
- **Read SilverBullet's `main` on GitHub** (`gh` is not installed on this machine; `curl` works): a file as `https://raw.githubusercontent.com/silverbulletmd/silverbullet/main/<path>` (spaces as `%20`), a commit with its files and diff as `https://api.github.com/repos/silverbulletmd/silverbullet/commits/<sha>`, recent commits as `…/commits?sha=main&since=<ISO date>`. Downloaded JSON goes to the scratchpad, read with `node`.
- The key files: `docs/ADR/012 Tooling Lives in Library.md`, `docs/CHANGELOG.md` (section *Edge*), `docs/Tool Page.md`, `docs/Repository.md`, `plug-api/lib/tool_pages.ts`, `client/config_management/config_page.ts`, `config_block.ts`, `managed_edit.ts`, `client/workbench/libraries/library_names.ts`.
- **Line numbers** in this plan are of this repository on 2026-11-13 (branch `feat/table-insert-dots`, after `e571227`); find the code by the names given with them.
- **An edge build** to run: SilverBullet's release `edge` (`https://github.com/silverbulletmd/silverbullet/releases/tag/edge`). `npm run test:ui:sb` downloads a fixed release into `.cache/silverbullet/` (see its script); the fork's own build crashes in these tests, so it is no substitute.

## SilverBullet's change

Decided in ADR 12 "Tooling Lives in Library" (`docs/ADR/012 Tooling Lives in Library.md`, 2026-11-09) and made on SilverBullet's `main` the same day. It is in the **edge builds only**: no release has it yet (our UI tests run against 2.12.1). The forum thread "Proposal: hardcode Library/ prefix to mean meta" (started 2026-10-25) announced it.

The commits (silverbulletmd/silverbullet):

| Commit | What |
| --- | --- |
| `96540c35` | tool pages (the new name of meta pages) told by location (`Library/*`), not by tags |
| `d9b44893` | "meta" renamed "tool" in the UI and the APIs (`index.toolPages`; `index.metaPages` kept as an alias) |
| `f342459d` | scripts and styles loaded from `/.tooling` (one request), not from the index |
| `02066207` | libraries install under `Library/`, repositories under `Library/Repository/` |
| `33629a72` | Std drops its bare `meta` tags |
| `5555c196` | configuration moves to `Library/Config` (breaking) |
| `c9a2ffa9`, `41d124f1` | docs, ADR 12 |
| `237ef6a2` | a docs link fixed |

What changes for a space:

- **`space-lua` and `space-style` blocks run only on pages under `Library/`.** A block elsewhere is shown, never runs, and gets a lint warning (`lint.inactiveBlocks`, on by default).
- **Tool pages are told by location alone**: a page whose name starts with `Library/` (`plug-api/lib/tool_pages.ts` `isToolPage`; `Library` alone, `LibraryNotes/x` and `CONFIG` are not). A bare `meta` tag means nothing any more; `meta/…` tags keep finding libraries, templates and repositories. Std's pages under `Library/` no longer carry `meta`.
- **`CONFIG` becomes `Library/Config`** (`CONFIG_PAGE_NAME`). The server renames an existing `CONFIG.md` to `Library/Config.md` when a space starts, and logs it. `[[CONFIG]]` links still resolve by name. A page written as `CONFIG` afterwards is an ordinary content page: its blocks never run.
- **Every block on `Library/Config` runs in a boot pass** first (a restricted environment where only configuration calls work), then again normally. Other blocks opt in with `-- boot: true`. The Configuration Manager's block is now written as `-- managed-by: configuration-manager` followed by `-- boot: true`, and SilverBullet adds the boot line after the marker of a managed block that lacks it (`managed_edit.ts` `withBootMarker`). It still finds the block by the marker alone (`findManagedBlock`: the first line, trimmed, starts with it), as `shared/configpage.ts` does.
- **Loading no longer waits for the index.** `space-lua` / `space-style` objects are still indexed, but only for tool pages. On a fresh client a script that queries the index while Space Lua loads sees empty results; the `index:ready` event tells when the first index is done.
- **Styles are ordered as scripts**: priority first, highest first, none counting as 0 (unprioritized styles used to load before all others), then page name, then position on the page.
- **Repositories** live under `Library/Repository/`. Pages under `Repositories/` are not migrated and count as content; users delete them and add the repository again.

## What it means for Silverware

### 1. Settings are written to `CONFIG` (high)

Every settings dialog writes the space's configuration page as the Configuration Manager does, and the name is fixed:

- `shared/configpage.ts`: `CONFIG_PAGE = "CONFIG"`, read in `saveConfigPage`, and its sync-conflict message names CONFIG.
- Each init page's bridge writes, syncs and indexes it by name: `space.writePage("CONFIG", text)`, `sync.performFileSync("CONFIG.md")`, `mq.send("indexQueue", "CONFIG.md")`, and its failure notification says "saved in CONFIG": `silverware-table-init.md` (`saveConfigPage`, line 512), `silverware-toolbar-init.md` (112), `silverware-tags-init.md` (101), `silverware-database-init.md` (97), `silverware-layout-init.md` (76).

On edge, after the migration, this makes a new root `CONFIG` page whose blocks never run: the dialog seems to save, and nothing applies, silently. On a fresh edge space (no configuration page yet) it does the same.

### 2. Meta pages are told by the `meta` tag (high)

`shared/pages/tags/names.ts` `isMetaTag` (`meta` and under it) is how two plugins tell SilverBullet's own pages:

- **Silverware Tags**: *Hide and protect meta pages* (`core/catalog.ts` `readCatalog` `hideMeta`, `metaPages`; the guard in `core/controller.ts:61` that leaves a meta page alone), the meta / tags switch of the workspace (`ui/workspace.ts`), the Pages module (`modules/pages.ts`), the panel, the cleanup.
- **Silverware Database**: the pages a Reference may name leave out pages with a meta tag (`host/silverbullet/pages.ts:41`); its library page promises "Meta pages (libraries, CONFIG, templates) are not offered".

On edge Std's pages and `Library/Config` carry no `meta` tag: Silverware Tags would show and change them (rename or remove tags in a library page), and a Reference would offer them.

### 3. The docs tell users to put `space-lua` in any page (medium)

Silverware Table's library page: "in a `space-lua` block of any page" (lines 167, 779, 877, 1031), "your [[CONFIG]], say" (562). Silverware Chart (131) and Silverware Database (125) say "a `space-lua` block" without a place. On edge such a block outside `Library/` does not run, and the user's functions, types, menu entries or formats are quietly missing (with a lint warning on that page).

### 4. "CONFIG" in the user docs (low)

Silverware Table, Toolbar, Tags, Database, Layout and Icons name `CONFIG` / `[[CONFIG]]` where settings are kept. The link still resolves on edge, but the page is `Library/Config` there.

### 5. Definition mistakes name the calling pages from the index (low)

`defineFunctions`, `defineTypes`, `defineSeries`, `defineConditions`, `defineFormats`, `defineMenuEntries` (Silverware Table) and the other plugins' definitions name the pages calling the API by `index.tag "space-lua"` while Space Lua loads (root CLAUDE.md, "Verified in SilverBullet"). On edge a fresh client has no index then: the notification names no page. Blocks are indexed only on tool pages, which is where they run, so on a client that has its index the list is right.

### 6. Style order (to check)

Our style pages (`silverware-*-style.md`) and users' themes may rely on the old order (unprioritized styles first). On edge an unprioritized user style and ours both count as 0 and are ordered by page name: `Library/damesene/…` against, say, `Library/Personal/Styles`. Check whether a user's override of our variables still wins.

### Not affected

- Our pages install as `Library/damesene/<name>`: their blocks run.
- `REPO.md` names no path; SilverBullet decides where a repository is kept (`Library/Repository/<name>`, `library_names.ts`).
- Our blocks of our own in the configuration page (the toolbar's `-- managed-by: silverware-toolbar`) hold only `config.set` calls, which the boot pass allows.

## The fix

Both SilverBullet versions must work: 2.12.1 (released, the user's Docker) and edge (later releases).

### Settings page

- **Which page**: one place decides, shared by every plugin: `Library/Config` where SilverBullet has tool pages, else `CONFIG`. Told by a capability, not by which page exists (a fresh edge space has neither): `index.toolPages` exists only where SilverBullet tells tool pages by location (`d9b44893`, the same release as `5555c196`). The init page's Lua decides it once and hands it to the bridge (`configPage`), so `src/` holds no test of SilverBullet's version.
- `shared/configpage.ts`: the name from the bridge instead of `CONFIG_PAGE`; messages say "the configuration page" or its name.
- The init pages' `saveConfigPage`: the page and its file (`<page>.md`) from that one value; the notification names it.
- **A `CONFIG` left on edge** (written by an older Silverware after the migration, or by hand): not read, not written. Optional: say so once, so the user moves what is in it.
- New managed block: write `-- boot: true` after the marker where tool pages exist, as SilverBullet writes it (it adds the line itself on its next save; we add it so the two never differ). Keep the line where it is: `withConfigSettings` already keeps every line it does not set.
- Unit tests: `configpage.ts` with either name, a block with and without the boot line; each plugin's settings test (`silverware-table/src/settings.test.ts` reads `CONFIG` by name).

### Tool pages

- A shared helper `isToolPage(name)` (`Library/` prefix, as SilverBullet's) next to `isMetaTag` in `shared/pages/tags/names.ts`. A page is SilverBullet's own when it is a tool page **or** has a meta tag: the tag still marks templates and libraries outside `Library/` in 2.12.1, the location marks them on edge.
- Silverware Tags: `readCatalog` (`hideMeta`), `metaPages`, the guard in `controller.ts`, the Pages module, the workspace's meta / tags split (pages under `Library/` among the meta side). Unit tests with a page under `Library/` without tags.
- Silverware Database: `host/silverbullet/pages.ts` the same; its test (`pages.test.ts`) gets a `Library/Config` page without tags.
- Name in the UI: keep "meta pages" while 2.12.1 is the release; switch to "tool pages" (SilverBullet's word) once a release has it. The setting's key stays (`protectMeta`): renaming it would break what a space has.

### Docs

- "in a `space-lua` block of a page under `Library/` (your `Library/Config`, say; `CONFIG` before SilverBullet's tool pages)" wherever a library page says where to put one (Table, Chart, Database).
- Where settings are kept: "your configuration page (`Library/Config`; `CONFIG` in SilverBullet 2.12 and before)".
- README: check the command that adds a repository on edge (the Libraries manager moved to the Workbench), and tell users who added ours under `Repositories/` to add it again.
- No `@` in what a space installs (shared/librarypages.test.ts).

### CLAUDE.md

- Root, "Verified in SilverBullet": the index note (Space Lua blocks are in the index while Space Lua loads) holds for 2.12.1; on edge a fresh client has none then, and blocks are indexed only on tool pages.
- Root, `configpage.ts` under shared/: the configuration page's name comes from the bridge.

## Commits and releases

One branch (`fix/library-prefix`), split:

1. `fix: settings saved to Library/Config where SilverBullet keeps them there`: `shared/configpage.ts`, every init page, tests. Reaches Table, Toolbar, Tags, Database, Layout.
2. `fix(tags): SilverBullet's tool pages under Library/ left alone as meta pages`.
3. `fix(database): pages under Library/ not offered as references`.
4. `docs: space-lua blocks and settings under Library/`: library pages, README.
5. `docs: CLAUDE.md notes for tool pages under Library/`.

Each with `npm run build` and `npm run verify`. Releases are proposed after, per plugin: PATCH (fixes and docs; nothing a space has breaks, the settings' keys and values stay).

## Testing

- Unit tests as above (both page names, a tool page without tags).
- UI tests against 2.12.1 (`npm run test:ui:sb`) must pass unchanged.
- Against edge: `test:ui:sb` takes a SilverBullet release downloaded into `.cache/silverbullet/`; check whether the edge release (`releases/tag/edge`) runs there, and how the script picks its release. The fork's own build crashes in these tests, so it is no substitute. A scenario per fix: a setting saved from the dialog applies after a reload; Silverware Tags leaves `Library/Std/…` alone with protection on.
- By hand on edge, in a scratch space with a `CONFIG` page: the server migrates it, a setting saved from each plugin's dialog lands in `Library/Config` and applies.

## Open

- Whether `index.toolPages` is the best capability to test, or `system.getVersion()` gives something to compare on edge. Probe on edge.
- Whether the boot pass runs our users' `config.set("silverware.…")` lines before our `config.define` (same as CONFIG's pre-pass before: likely fine). Probe on edge.
- What Silverware Tags shows for pages tagged `meta/template` outside `Library/` on edge: SilverBullet counts them as content, we would still keep them apart by tag. Decide whether to follow SilverBullet there.
- Style order (6 above).

## Cleanup

**When:** a SilverBullet release has tool pages (ADR 12), and the user decides Silverware no longer supports the releases before it (2.12.1 and older). Until then everything below stays. Check it whenever this plan, `shared/configpage.ts`, an init page's `saveConfigPage`, `isToolPage` / `isMetaTag`, or the UI tests' SilverBullet version is touched: if a release with tool pages is out, remind the user that this cleanup is waiting.

**What it removes:**

- **The choice of the configuration page**: the init pages' test of `index.toolPages` and the `CONFIG` branch; `Library/Config` written directly (or through `config.persist` for the values the Configuration Manager reads, if adopted by then). The bridge's `configPage` and the name passed into `shared/configpage.ts` can go with it, back to one constant.
- **Tests of the old name**: the `CONFIG` cases in `shared/configpage.ts`' tests and in each plugin's settings test.
- **The notice about a `CONFIG` left over** (if it was made): by then the server's migration has long run.
- **The meta tag as a mark of SilverBullet's pages**: `isMetaTag` in Silverware Tags' hiding and protection and in Silverware Database's references, where it only covered 2.12.1; `isToolPage` alone, as SilverBullet does. Decide then what `meta/…` tags still do in Silverware Tags (they keep their meaning in SilverBullet: templates, libraries, repositories).
- **Wording**: "meta pages" becomes "tool pages" in Silverware Tags' UI and docs (the setting's key `protectMeta` stays: renaming it breaks what a space has, or needs a migration and a MAJOR release).
- **Docs**: "(`CONFIG` in SilverBullet 2.12 and before)" and "`CONFIG` before SilverBullet's tool pages" in the library pages and README; `[[CONFIG]]` links become `Library/Config`.
- **CLAUDE.md**: the root's 2.12.1 note on Space Lua blocks in the index while Space Lua loads; whatever this plan added for both versions.
- **UI tests**: `test:ui:sb` moved to a release with tool pages (`.cache/silverbullet/`), the 2.12.1 scenarios of the old page dropped.
- **This plan**: marked done, its decisions moved to the plugins' CLAUDE.md where they still hold.

A release after the cleanup: MINOR or PATCH per plugin (nothing a space has breaks: a space on the newer SilverBullet is already on `Library/Config`), with a line in each changelog that SilverBullet 2.12 and older are no longer supported.

## Related, not part of this

Also in SilverBullet's edge changelog, worth a look later:

- `config.persist(path, value)` writes one value into the managed block of `Library/Config` and reloads: could replace our own writer for values the Configuration Manager reads (not for the toolbar's tables, which live in a block of their own).
- `object.update` changes objects where they are written, table cells included.
- `index:ready` for work that needs the whole index.
- "Potentially breaking: `codeWidget.define`, `syntax.define` and others now merge repeated definitions": check Silverware Chart's and Database's `codeWidget.define` (Chart reads `config.get({ "codeWidgets", language })` before defining).
