# silverware-libraries

**Silverware**: plugins (SilverBullet libraries) for [SilverBullet](https://silverbullet.md), installed straight from this repository (`REPO.md` lists them). What holds for the whole repository is here; each plugin's own context is in its folder's `CLAUDE.md`, loaded when you work there.

| Plugin | Folder | Prefix | Its context |
| --- | --- | --- | --- |
| Silverware Table | `silverware-table/` | `swt-` | `silverware-table/CLAUDE.md`, and in `src/`: `core/`, `features/`, `formulas/`, `columntypes/`, `conditions/`, `excel/`, `autofill/` |
| Silverware Toolbar | `silverware-toolbar/` | `swb-` | `silverware-toolbar/CLAUDE.md`, docs/silverware-toolbar.md |
| Silverware Tags | `silverware-tags/` | `swg-` | `silverware-tags/CLAUDE.md`, docs/silverware-tags.md |
| Silverware Chart | `silverware-chart/` | `swc-` | `silverware-chart/CLAUDE.md`, docs/silverware-chart.md |
| Silverware Database | `silverware-database/` | `swd-` | `silverware-database/CLAUDE.md`, docs/silverware-database.md |
| Silverware Icons | `silverware-icons/` | `swi-` | `silverware-icons/CLAUDE.md`, docs/silverware-icons.md (a library for the other plugins, nothing on its own) |

docs/ holds each plugin's plan and decision log; a plugin's library page (`silverware-<name>.md`) is its user documentation.

## Commands

```sh
npm install
npm run build        # every plugin's bundle (silverware-<name>/silverware-<name>.js), the icon sets' data, the shared CSS blocks
npm run verify       # before a commit: tsc --noUnusedLocals, vitest, check-build (bundles and generated files match their sources)
npm test             # vitest
npm run test:ui:install  # once: Playwright's Chromium
npm run test:ui      # Playwright against the playground (port 8010)
npm run test:ui:sb   # the same tests against a real SilverBullet (Docker; on Windows its release downloaded into .cache/silverbullet/); options after -- (-g, --ui)
npm run playground   # http://localhost:8000/ (table), /toolbar.html, /tags.html, /database.html, /icons.html; HOST=0.0.0.0 for a phone in the local network
npm run deploy -- <space folder>   # copy every plugin into a local space's Library/damesene/
```

`test:ui:sb`'s servers start at port 3010 (`SW_SB_FIRST_PORT` moves them): a local SilverBullet on 3010 collides with them.

## A plugin's shape

- `silverware-<name>/`: `silverware-<name>.md` (library page: user docs only; its `files:` install the rest beside it), `-init.md` (settings `config.define`, the JS loaded and its bridge, commands, events), `-api.md` (the `-- priority: 50` Space Lua API, before the user's scripts), `-style.md` (the CSS), the built `silverware-<name>.js` (committed: SilverBullet runs no build), `src/`, `ui-tests/` (`helpers.ts` of its own).
- Named `Silverware <Name>`, commands `Silverware <Name>: …`, settings and Space Lua API under `silverware.<name>` (one global `silverware`, `silverware = silverware or {}`); what a plugin's Lua blocks share that is not API under `silverware_internal.<name>`, so `silverware.<name>.` completes to the API alone. `config.define("silverware.<name>", …)`: SilverBullet splits a dotted key into nested objects (its `client/config.ts`).
- CSS classes, data attributes and CSS variables under the plugin's prefix.
- A plugin needs no other installed. One plugin uses another only through its public API handed over by its init page's Lua (Silverware Chart takes Silverware Table's `silverware.table.tables`; the toolbar and the database take `silverware.icons.api`), never through its code: each plugin's isolation test checks imports.
- The scripts (build, deploy) list the plugins; vitest, tsc and Playwright find every plugin's tests; CI runs each plugin's `ui-tests/` (and each area folder under it) as a job of its own (`scripts/ui-test-groups.mjs`).

## Working rules

- **A plan is always a file of its own in docs/** (`docs/silverware-<name>-<topic>.md`), never written into a CLAUDE.md: a CLAUDE.md says what the code is and how to work in it, not what is to be built.
- **Commit only when the user says so**; never push unless asked, never to `main`. A change spanning several fixes is split into commits, each with the bundles built from its own changes.
- **Every commit**: `npm run build`, then `npm run verify` passes. A stale committed bundle ships old code; check-build fails on it.
- **Commit messages**: [Conventional Commits](https://www.conventionalcommits.org), one line `<type>(<scope>): <description>`, imperative, lowercase, no period, no body, **no AI co-author trailer**. Types `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `chore`, `style`; scope the plugin (`table`, `toolbar`, `tags`, `chart`, `database`, `icons`), `playground`, or none for the repository. A change that breaks what a space has (settings, the Space Lua API, a theme's selectors or variables, stored markdown) is marked `!`: `feat(toolbar)!: …`. History before 2026-10-22 uses `Table Plus: …` / `Silverware: …` subjects.
- The conversation with the user is in Czech; everything in the repository (code, comments, docs, commits) is English.
- **A fix goes where it belongs**: a plugin's core gets generic mechanisms only (it knows no module by name, nor a module's classes or settings); a module's fix stays in the module.
- **Shared helpers first**: before writing a module's own version of something another does, look in the plugin's core and in `shared/`; when two need the same thing, it moves there, generic.
- **What SilverBullet runs is not touched for the playground**: no measuring, flags or checks for it in `src/` (the table's benchmark wraps methods from outside, playground/profile.ts).
- **A change to how something is used** (pointer, touch, menus, what survives a write) gets a scenario in its plugin's `ui-tests/`, and `npm run test:ui` passes before its commit (not part of `verify`). Splitting a plugin's tests into area folders is the user's decision: propose it (areas, counts, time saved) and wait.
- **No mentions in the pages a space installs** (library pages and their `files:`): SilverBullet reads `@name` as a mention wherever `@` follows no word character, `.`, `@`, `+` or `-` and lists the page in its Mention Inbox. Outside code write `\@`; in a code span or a fenced block it stays. `shared/librarypages.test.ts` fails on one; a test comparing a page's text uses `asInLibraryPage` (silverware-table/src/testing/librarypage.ts).
- A library page's examples are fenced `lua` / `js`, never `space-lua` / `space-style`: those would run in every space that installs it.
- A check of a value is `validate<What>`, giving why it does not hold as text, `undefined` where it does (Silverware Tags' helper `nameProblem` is kept as an alias for scripts). A result's `{ problem }` is data and keeps its name.
- Code style: match the surrounding code. Comments say why, in full sentences or fragments. Library pages are written for users: plain, specific, no internals.
- **Do not write a SilverBullet space's pages on disk while SilverBullet has it open**: it keeps its copy and writes a sync conflict into the page (it did, in CONFIG.md). Change pages through SilverBullet. Deploying library files (`npm run deploy`) is fine; reload the page twice after it (Space Lua sees the change on the second).
- Line endings are LF (`.gitattributes`); git normalizes CRLF from Windows editors on commit.
- On this machine a shell heredoc mangles backslashes: write scripts to a file, or use an editor tool, when the text has `\`.

## shared/

Bundled into each plugin (nothing is shared at run time); its classes by a base the caller gives.

- CSS of what shared/ draws is a template per part (`menu.css`, `diffview.css`, `icons.css`; `__base__` the plugin's base), written by `scripts/sharedstyles.mjs` into each style page using it between `/* <shared-…> */` marks; check-build fails where a block differs. Edit the template, never a page's block.
- `pages/` is the page writer, the one place that knows how anything is written in a page (Silverware Tags and Silverware Database write through it, never a page's text themselves). `platform.ts` is interfaces only (`Platform = { editor, space, index, ui, settings }`): each plugin's binding makes it.
- `markdown/` reads markdown as SilverBullet's parser does, pure and line by line: the lines a selection touches and fenced code (`lines.ts`), a line's hashtags, mentions, wiki links and attributes (`inline.ts`, which `pages/tags/scan.ts` reads hashtags by), a task's line and its attributes written back (`task.ts`), a line's block and a text's blocks as a tree (`blocks.ts`: `readLine`, what Silverware Toolbar's Turn into reads; `readBlocks`, what a converter of Silverware Database reads). It writes no page: that is `pages/`.
- `yaml/`: YAML's scalars (`scalar.ts`) and the few nested forms a plugin writes (`tree.ts`), pure; `pages/` and `markdown/` stand on it.
- `clipboard.ts`: text (and HTML) onto the clipboard from a menu or a button, by the copy command where a page over http has no Clipboard API.
- `configpage.ts`: settings in the CONFIG page. Tables (the toolbar's favourites) go in a plugin's own block, not the Configuration Manager's: it reads no table back (`parseLuaLiteral`) and rewrites its block from what it read on any save, so a table there would be lost (its source, 2026-10-26: `ui/use_config_editor.ts`, `configuration.ts`).
- `icons.ts` / `iconref.ts`: how a plugin draws and picks its user's icons (Silverware Icons' API or a stand-in) and how a value is written (`<set>:<name>` or text); see silverware-icons/CLAUDE.md.
- `elements.ts` `el(...)`: a plugin's own elements in one synchronous expression; no reactive library (weighed, docs/ui-without-framework.md).

## Verified in SilverBullet (applies to every plugin)

- A new `space-lua` block is not active until Space Lua is reloaded; an inline `${(function() … end)()}` needs none (how the probes were run).
- **Space Lua blocks are in the index** (`plugs/index/space_lua.ts`, 2026-10-22): `index.tag "space-lua"` gives each block with `ref` `Page@position` and `script`, no `page`; queried from an API page while Space Lua loads it has every block, so a refused definition can name the pages calling the API. `editor.flashNotification(message, type, { timeout = 0, actions = { { name, run } } })` stays until closed, a button per action (`client/plugos/syscalls/editor.ts` of main).
- **`_CTX` is a `${…}`'s own** (2.12.1, 2026-11-05): `_CTX.currentPage` is set in the expression, `nil` in a function defined on another page that it calls. As a page is opened from another, the editor's page is the new one while its text is still the old page's.
- A JS object or function handed to Lua and back to JS is the same object, its methods callable synchronously (verified for Silverware Table's API and Silverware Icons'). `js.importFromSpace` gives the same module on each load of Space Lua, and a bundle's `import.meta.url` is the space's, so files beside it load by `new URL("./file.js", import.meta.url)`.
