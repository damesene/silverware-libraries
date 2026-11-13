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
| Silverware Layout | `silverware-layout/` | `swl-` | `silverware-layout/CLAUDE.md`, docs/silverware-layout.md, docs/silverware-layout-font-size.md, docs/silverware-layout-grid.md, docs/silverware-layout-assets.md, docs/silverware-assets-split.md (the assets to a plugin of their own: next) |

docs/ holds each plugin's plan and decision log; a plugin's library page (`silverware-<name>.md`) is its user documentation.

## Commands

```sh
npm install
npm run build        # every plugin's bundle (silverware-<name>/silverware-<name>.js), the icon sets' data, the shared CSS blocks
npm run verify       # before a commit: tsc --noUnusedLocals, vitest, check-build (bundles and generated files match their sources, each plugin's version has its changelog entry)
npm test             # vitest
npm run test:ui:install  # once: Playwright's Chromium
npm run test:ui      # Playwright against the playground (port 8010)
npm run test:ui:sb   # the same tests against a real SilverBullet (Docker; on Windows its release downloaded into .cache/silverbullet/); options after -- (-g, --ui)
npm run playground   # http://localhost:8000/ (table), /toolbar.html, /tags.html, /database.html, /icons.html; HOST=0.0.0.0 for a phone in the local network
npm run deploy -- <space folder>   # copy every plugin into a local space's Library/damesene/
```

`test:ui:sb`'s servers start at port 3010 (`SW_SB_FIRST_PORT` moves them): a local SilverBullet on 3010 collides with them.

## A plugin's shape

- `silverware-<name>/`: `silverware-<name>.md` (library page: user docs only, `version:` in its frontmatter; its `files:` install the rest beside it), `CHANGELOG.md` (the repository's, not installed), `-init.md` (settings `config.define`, the JS loaded and its bridge, commands, events), `-api.md` (the `-- priority: 50` Space Lua API, before the user's scripts), `-style.md` (the CSS), the built `silverware-<name>.js` (committed: SilverBullet runs no build), `src/`, `ui-tests/` (`helpers.ts` of its own).
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

## Versions and changelogs

- Each plugin has a version, `version: X.Y.Z` in its library page's frontmatter ([semantic versioning](https://semver.org), three numbers, from 1.0.0), and a `CHANGELOG.md` in its folder, the newest entry first. `check-build` (scripts/versions.mjs) fails where the version is not `X.Y.Z` or the changelog's newest entry is not that version.
- Why it matters: SilverBullet updates an installed library only when its library page's text changed (`share.install` compares a hash of that text), and only then downloads its `files:`. A change of a bundle or of another page alone reaches no space that has the library already; a release changes the version line, so the update takes every file. A merged change may still reach users before its release, whenever its library page's text changed for another reason.
- **Never bump a version or write a changelog entry without the user's confirmation.** Propose a release when the user asks, or when one is due: a coherent change finished (its fixes done, `verify` and the UI tests passing) that users should get, such as a bug they see fixed or a feature done. Propose it once, with the new version and the entry drafted, and wait.
- Which number: MAJOR for a change that breaks what a space has (the commits marked `!`: settings, the Space Lua API, a theme's selectors or variables, stored markdown); MINOR for a new feature; PATCH for fixes and small improvements only. A change in `shared/` releases each plugin it reaches, each by its own number.
- The entry is drafted from the commits since the plugin's last release: `git log <scope>-v<last>..HEAD -- silverware-<name>/ shared/`.
- **An entry** is `## X.Y.Z (YYYY-MM-DD)` and a short list, clear to a reader without context: breaking changes first (`**Breaking:**`, what breaks and what to do), then the main features, a line each; fixes and small improvements summed up in a line or two where they are many and minor. Written for users: no internals, no commit hashes, no `@` mentions.
- **A release is the last commit of a feature branch**, `chore(<scope>): release X.Y.Z`: the version line and the changelog entry, nothing else. A commit added to the branch after it means the release is redone, so it stays last and covers it.
- **Tags**: once the branch's PR is merged (a merge commit keeps the release commit in `main`), the release commit is tagged `<scope>-vX.Y.Z` (`table-v1.2.0`) and the tag pushed, both with the user's confirmation. Tags are never deleted or moved.
- A plugin's version is not a version of its settings' model (`silverware.toolbar.version`, its migrations): those change on their own.

## shared/

Bundled into each plugin (nothing is shared at run time); its classes by a base the caller gives.

- CSS of what shared/ draws is a template per part (`menu.css`, `segments.css`, `diffview.css`, `icons.css`; `__base__` the plugin's base), written by `scripts/sharedstyles.mjs` into each style page using it between `/* <shared-…> */` marks; check-build fails where a block differs. Edit the template, never a page's block.
- `pages/` is the page writer, the one place that knows how anything is written in a page (Silverware Tags and Silverware Database write through it, never a page's text themselves). `platform.ts` is interfaces only (`Platform = { editor, space, index, ui, settings }`): each plugin's binding makes it.
- `markdown/` reads markdown as SilverBullet's parser does, pure: its blocks by lezer's parser (`@lezer/markdown`, SilverBullet's version), known only to `parse.ts`, which gives a tree of its own (`MarkdownNode`; bundled only where it is imported: keep it out of what reads a line alone), the lines a selection touches and fenced code (`lines.ts`), a line's hashtags, mentions, wiki links and attributes (`inline.ts`, which `pages/tags/scan.ts` reads hashtags by in the lines of `parse.ts`' blocks), a task's line and its attributes written back (`task.ts`), a line's block (`blockline.ts`: `readLine`, what Silverware Toolbar's Turn into reads) and a text's blocks as a tree (`blocks.ts`: `readBlocks`, what a converter of Silverware Database reads), a tag's HTML attributes (`attributes.ts`), an embed's alt, size and metadata (`embed.ts`: SilverBullet's first two `|` segments, the metadata in a third; written by the page writer's `embeds` part) and Silverware Layout's grids (`grid.ts`: `readGrids`, line by line by the rules of SilverBullet's custom syntax, which lezer here does not know; written by the page writer's `grids` part). It writes no page: that is `pages/`.
- `yaml/`: YAML's scalars (`scalar.ts`) and the few nested forms a plugin writes (`tree.ts`), pure; `pages/` and `markdown/` stand on it.
- `clipboard.ts`: text (and HTML) onto the clipboard from a menu or a button, by the copy command where a page over http has no Clipboard API.
- `configpage.ts`: settings in the CONFIG page. Tables (the toolbar's favourites) go in a plugin's own block, not the Configuration Manager's: it reads no table back (`parseLuaLiteral`) and rewrites its block from what it read on any save, so a table there would be lost (its source, 2026-10-26: `ui/use_config_editor.ts`, `configuration.ts`).
- `icons.ts` / `iconref.ts`: how a plugin draws and picks its user's icons (Silverware Icons' API or a stand-in) and how a value is written (`<set>:<name>` or text); see silverware-icons/CLAUDE.md.
- `overwindow.ts`: what a plugin shows over the whole window (a full screen, a sheet, a database's peek) is marked `data-silverware-over-window` on its element, so the others stand back without knowing whose it is (Silverware Toolbar shows none then); `watchOverWindow` tells when one shows and when the last ends. **Controls placed by where the pointer is** (a table's +, a chart's toolbar) stand back from another plugin's (`overWindowOf` of the node under the pointer): their widget may lie under it, and coordinates alone found it there. **Layers**: every z-index laying something over the page is one of `shared/layers.ts` (`LAYERS`, the one place they are set; each plugin sets them as CSS variables as it starts, `applyLayers`, its style page's rules taking `var(--sw-layer-control)` or a step `calc(… + 1)` for its own order within a layer); a sheet over part of the window (a database's peek) is over the other plugins' controls, its own panels over it, dialogs over all. `shared/layers.test.ts` fails on a number of a page's own (30 and over).
- `elements.ts` `el(...)`: a plugin's own elements in one synchronous expression; no reactive library (weighed, docs/ui-without-framework.md).

## Verified in SilverBullet (applies to every plugin)

- **SilverBullet after 2.12.1 (edge, 2026-11-09) runs `space-lua` / `space-style` only on pages under `Library/` and moves CONFIG to `Library/Config`**: what that breaks here, the fix for both versions, and a cleanup to remind the user of once the old versions are dropped, in docs/silverware-library-prefix.md. Read it before touching `shared/configpage.ts`, an init page's `saveConfigPage`, or how a plugin tells SilverBullet's own pages (`isMetaTag`).

- A new `space-lua` block is not active until Space Lua is reloaded; an inline `${(function() … end)()}` needs none (how the probes were run).
- **Space Lua blocks are in the index** (`plugs/index/space_lua.ts`, 2026-10-22): `index.tag "space-lua"` gives each block with `ref` `Page@position` and `script`, no `page`; queried from an API page while Space Lua loads it has every block, so a refused definition can name the pages calling the API. `editor.flashNotification(message, type, { timeout = 0, actions = { { name, run } } })` stays until closed, a button per action (`client/plugos/syscalls/editor.ts` of main).
- **`_CTX` is a `${…}`'s own** (2.12.1, 2026-11-05): `_CTX.currentPage` is set in the expression, `nil` in a function defined on another page that it calls. As a page is opened from another, the editor's page is the new one while its text is still the old page's.
- A JS object or function handed to Lua and back to JS is the same object, its methods callable synchronously (verified for Silverware Table's API and Silverware Icons'). `js.importFromSpace` gives the same module on each load of Space Lua, and a bundle's `import.meta.url` is the space's, so files beside it load by `new URL("./file.js", import.meta.url)`.
