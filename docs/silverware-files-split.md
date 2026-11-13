# Silverware Files: split out of Silverware Layout

Plan of 2026-11-13, agreed with the user; to be started in a new session. Nothing of it is built yet. Branch: `docs/layout-assets` (all of Layout's grid and files work lives there, not on `main`; nothing of it is released).

## Why

Silverware Layout does two unrelated things now:

1. **The page's layout**: the text's width, widgets' widths by the handle and its guides, the font size and zoom, columns (grids: `/grid`, a cell edited in place, Put into grid, a cell's menu).
2. **Files embedded and linked**: how an embedded file shows (original, preview, card), a link's icon and its menu, the side panel and the enlarged view, a link written as an embed and back, a card's size and date, the Media tab.

The second does not belong under "Layout": a user looking for "show a PDF as a card" does not look there. Decided with the user:

- **A plugin of its own, Silverware Files** (prefix `swf-`, settings and Space Lua API under `silverware.files`). "Media" was rejected: any file, a zip too, not only images and video. "Attachments", "Documents", "Embeds" were weighed and dropped (*Names*).
- **Now, before any release**: nothing of it is released, so the settings (`silverware.layout.assets`) and the API (`silverware.layout.api.assets`) are renamed without a migration. After a release it would be a breaking change.
- **"Files" everywhere**: the code's "assets" (`src/assets/`, `shared/assets.ts`, `Asset…`, `swl-asset-…`, docs/silverware-layout-assets.md) is the earlier name and is renamed to files throughout (*Renames*). Nothing named "asset" is left in Silverware Files.

## Names

| Weighed | Why not |
| --- | --- |
| Silverware Media | sounds like images and video; a zip, a PDF are files too (the user's objection) |
| Silverware Attachments | long; "attached" suggests a file of one page, while a file is the space's, linked from anywhere |
| Silverware Documents | SilverBullet's own term for a file that is no page, but a user reads it as Word or PDF, and it mixes with pages |
| Silverware Embeds | the plugin also decorates plain links to files (their icon, their menu) |
| **Silverware Files** | chosen: plain, clear, fits an image, a PDF and a zip |

## What goes where

**Silverware Layout keeps**: text width, widgets' widths (the handle, guides, `shared/layout.ts`, `room`, `anchor`), font size and zoom, grids (`src/grid/`: drawing, editing in place, caret and selection carried into the field, Ctrl+Z in it, tasks toggled in a cell, `/grid`, Put into grid, the cell's menu, the embedded page's grid, indexing), the grid's part of SilverBullet's "markdown as written" mode (grids hidden), the Page layout dialog (Page width, Font, Guides, a Markdown tab with the grids' box alone).

**Silverware Files takes**: everything in `silverware-layout/src/assets/` (types, actions, views, card, menu, panels, settings, the Media tab), SilverBullet's host of it (`host/silverbullet/assets.ts`: widgets found, links found, a file's meta, the embed written, link ↔ embed), its part of the "markdown as written" mode (files hidden, a click on a link placing the cursor alone, the text pointer), its own settings window (the former Media tab and its Markdown boxes), its library page (the *Media* section of Layout's), its style page (the asset rules of Layout's).

**Shared by both, in `shared/`**: the popup menu (`silverware-layout/src/ui/popupmenu.ts` → `shared/popupmenu.ts`, its base given as the shared menu's is: `swl` / `swf`), the files' contract (`shared/assets.ts` → `shared/files.ts`), the new contract of markdown rendered outside the editor (`shared/rendered.ts`, below), the embed codec and page writer parts (`shared/markdown/embed.ts`, `pages/parts.ts` `embeds`/`links`: unchanged, already shared).

## The one place they meet: markdown rendered outside the editor

Files must find each file and link a grid draws in its cells, and **where it is in the page's text**: it writes there (a view chosen, a width dragged, Show as a link) and the same file may be there twice (a grid drawn before SilverBullet's widget above it once took the grid's image for the other: fixed by places, docs/silverware-layout-assets.md step 8). Today Files reads it from the grid's HTML (`data-swl-rendered`, `data-swl-pos`, `data-swl-end` on a cell, SilverBullet's `data-pos` in it, `span[data-swl-embed]` places, a MutationObserver on `data-swl-pos`). Across two plugins that would be an agreement in HTML, broken silently by a change on either side.

**Decided (the user's idea, 2026-11-13): the grid offers it by an API**, as `shared/layout.ts` is offered. The grid knows exactly what it drew (it reads the cell's markdown, renders it, knows each element's place).

```ts
// shared/rendered.ts: markdown rendered outside SilverBullet's editor (a grid's cells), what was drawn there and where
export const RENDERED_VERSION = 1;

/** A file embedded or linked, as drawn outside the editor */
export type RenderedItem = {
  readonly kind: "embed" | "link";
  readonly element: HTMLElement;   // its medium (<img>, <video>, <audio>, <object>) or the place drawn for a file SilverBullet's HTML draws none of; a link's <a>
  readonly target: string;         // as written in the page
  readonly position: number;       // where its text starts in the page's text
};

export type Rendered = {
  readonly version: number;
  /** What is drawn outside the editor now */
  items(): readonly RenderedItem[];
  /** The ranges of the page's text drawn outside the editor (their embeds are no widget of SilverBullet's: Files counts SilverBullet's widgets among the others alone) */
  ranges(): readonly { readonly from: number; readonly to: number }[];
  /** Told as items are drawn, drawn anew, or given their places later (a grid drawn while the editor's text was still the page before); the function given back stops it */
  onChange(listener: (items: readonly RenderedItem[]) => void): () => void;
};

/** The API as handed over (`silverware.layout.api.rendered`), where it is of this version; else a stand-in: nothing drawn, nothing told */
export function renderedOf(given: unknown): Rendered;
```

- **Layout provides it**: the grid builds the items as it draws a cell (each element with SilverBullet's `data-pos` plus the cell's offset in the page; the places for a PDF and a zip it draws itself, `host/silverbullet/undrawn.ts`, become its own business), and calls the listeners as it draws, draws anew (`refresh`) and as positions become known (`markPlaces`). `silverware.layout.api.rendered`, beside the widgets' registry and versioned apart.
- **Files consumes it**: its SilverBullet host takes `items()` and `onChange` instead of reading the grid's HTML; it still frames each medium in an element of its own (its `swf-frame`) to decorate it. Without Layout (or a Layout of another version): the stand-in, Files decorates SilverBullet's widgets alone (without Layout there are no grids).
- **Load order**: Files' init page takes `silverware.layout.api` as Silverware Table does (Layout's API page has `-- priority: 50`); it may come after Files started, so Files asks for it again as Space Lua loads again, as Table re-registers.
- **The handle**: Files registers its `LayoutProvider` (a medium's width, `room` for one in a cell, `anchor`) through `silverware.layout.api`, as Table, Chart and Database do. Without Layout, files without the handle. `room` needs the cell: `RenderedItem` could carry it (`room: HTMLElement`) so Files knows no cell; decide in step 1.
- **A test across both**: Files' UI tests run with both plugins (the test servers deploy every plugin): a medium in a grid found by its place, its view written to its own embed (the bug once fixed), its width dragged within the cell. A break of the contract fails there by name.

## Renames

| Now (Silverware Layout) | Then (Silverware Files) |
| --- | --- |
| `silverware-layout/src/assets/**` | `silverware-files/src/**` (its own `model/`, `core/`, `ui/`, `builtin/`, `host/`, `host/silverbullet/`) |
| `shared/assets.ts`: `Asset`, `AssetType`, `AssetAction`, `ASSETS_VERSION`, `assetsOf` | `shared/files.ts`: `FileRef` (the union by `kind`: file, web, later page), `FileType`, `FileAction`, `FILES_VERSION`, `filesOf` |
| `AssetRegistry`, `AssetDecorator`, `AssetHost`, `DrawnEmbed`, `assetProvider`, `silverBulletAssetHost` | `FileRegistry`, `FileDecorator`, `FileHost`, `DrawnEmbed`, `fileProvider`, `silverBulletFileHost` |
| `silverware.layout.assets` (CONFIG, Layout's own block) | `silverware.files` (Files' own block, marker `-- managed-by: silverware-files`) |
| `silverware.layout.api.assets` | `silverware.files.api` |
| `silverware.layout.syntaxMode.hideWidgets` | `silverware.layout.syntaxMode.hideGrids` (Layout) and `silverware.files.syntaxMode.hideFiles` (Files) |
| `silverware.layout.syntaxMode.clickPlacesCursor` | `silverware.files.syntaxMode.clickPlacesCursor` |
| CSS `swl-asset-*`, `swl-asset-frame`, `swl-asset-link-icon`, `swl-asset-menu-icon`, `swl-asset-peek`, `swl-asset-popover`, `swl-media-*` | `swf-*` (`swf-frame`, `swf-link-icon`, `swf-menu-icon`, `swf-peek`, `swf-popover`, `swf-settings-*`) |
| attributes `data-swl-asset`, `data-swl-asset-view`, `data-swl-asset-target`, `data-swl-asset-widget`, `data-swl-asset-link`, `data-swl-embed`, `data-swl-syntax-shown` (files' part), `data-swl-syntax-clicks` | `data-swf-*` (`data-swl-width`, `data-swl-anchor-start`, `data-swl-in-room` stay Layout's: Layout sets them on Files' frames as on any widget) |
| the Media tab of Page layout | `Silverware Files: Settings`, a dialog of Files' own (`shared/dialog.ts`), tabs *Files* (the former Media tab) and *Markdown* (hide files, a click places the cursor) |
| docs/silverware-layout-assets.md | docs/silverware-files.md (its decisions and steps kept, "Layout" read as "Files" where it is the files' part) |
| Layout's library page, section *Media* | `silverware-files/silverware-files.md` |

The actions' names (`open-tab`, `peek`, `popover`) and the views (`icon`, `preview`, `embed`, the key `view` in an embed's metadata) stay: they are written in pages and settings, and are not "assets".

## Steps

Each step: `npm run build`, `npm run verify` (run from `D:\` in PowerShell: vitest reports "no tests" from Git Bash's `/d/`), the UI tests of what it touches (`SW_SB_FIRST_PORT=3100 npm run test:ui:sb -- <folder>`: the user's SilverBullet is on 3010), a review of the diff without UI tests, a commit (one line, Conventional Commits, no co-author), the user told which step of how many; after a step a user can see, a deploy to the user's SilverBullet (*Working*).

1. **The rendered contract, in one plugin still.** `shared/rendered.ts` as above, with its tests (the stand-in, the version). Layout's grid provides it (`src/grid/`: items per cell as drawn, positions by `data-pos` plus the cell's offset, listeners on draw, refresh and `markPlaces`); `silverware.layout.api.rendered`. The files' SilverBullet host (`host/silverbullet/assets.ts`) takes it instead of `[data-swl-rendered]`, `data-swl-pos`, `span[data-swl-embed]` and its MutationObserver on `data-swl-pos`; `renderedPosition`, `RENDERED_MEDIA`, `renderedRanges` go. Decide whether `RenderedItem` carries the cell (`room`) or Files asks Layout's handle otherwise. All of today's UI tests pass unchanged (`assets.spec.ts` "the same image outside a grid and in it", the drag in a cell, a PDF and a zip in cells, a link's icon in a cell). This is the riskiest step: do it first, alone.
2. **The popup menu to `shared/`.** `src/ui/popupmenu.ts` → `shared/popupmenu.ts`, its classes by the base given (`swl` for Layout's, `swf` later); its CSS a template in `scripts/sharedstyles.mjs` if it draws more than the shared menu does (today its holder box is `.swl-menu` in Layout's style page). Layout's grid and files use it from there.
3. **The new plugin's frame.** `silverware-files/` with `silverware-files.md` (library page, `version: 1.0.0`? see *Versions*), `CHANGELOG.md`, `-init.md`, `-api.md` (priority 50: `silverware.files.api`), `-style.md`, `CLAUDE.md`, `src/`, `ui-tests/` (`helpers.ts` of its own, from Layout's: `space.open` with files, `PIXEL_PNG`, `gridsDrawn`), its isolation test. Added to the lists of `scripts/build.mjs` (which also runs the versions' check, scripts/versions.mjs, for each plugin listed), `scripts/deploy.mjs` and `scripts/sharedstyles.mjs` (base `swf`; checked 2026-11-13: these three list the plugins by name, `scripts/ui-test-groups.mjs` finds every plugin's `ui-tests/` by itself), `REPO.md` (a `#meta/library/remote` block), the root `CLAUDE.md`'s table (`silverware-files/`, `swf-`). It builds and loads, doing nothing yet.
4. **Move the code** with `git mv` (history kept): `src/assets/**` and `host/silverbullet/assets.ts` (and its tests) into `silverware-files/src/`, renamed as in *Renames*; `shared/assets.ts` → `shared/files.ts`. Files' `index.ts` (its binding: the bridge, the host, the registry, `api`, the decorator, the settings), its init page's bridge (what the files' host uses today: `getText`, `getCurrentPage`, `replaceRange`, `readPage`, `writePage`, `listPages`, `flash`, `getConfig`, `saveConfigPage`, `documentMeta`, `getUiOption`), its `LayoutProvider` registered through `silverware.layout.api` (as Table's init page does), the rendered contract taken from `silverware.layout.api.rendered`. Layout's `index.ts` loses the files' wiring (`assetRegistry`, `AssetDecorator`, `assetProvider`, `app.dialogTabs`'s Media tab, `api.assets`).
5. **Styles.** The asset rules of `silverware-layout-style.md` (frames, the "…", the card, its icon as a button, the link's icon, the menu's holder, the peek, the popover, the Media tab, the hidden-in-markdown rules for files, the text pointer) move to `silverware-files-style.md` as `swf-`; Layout keeps the widget-width rules that size Files' frames (`[data-swl-width]`, `[data-swl-in-room]`, the preview's `fit-content` rule: check which of these name an asset's attribute and give Files' frame what they need by Layout's own marks).
6. **The markdown-as-written mode split.** Layout's `host/silverbullet/syntaxmode.ts` keeps the grids' part (its root mark hides `.swl-grid-widget`); Files gets its own (files hidden, a click on a link placing the cursor alone, the text pointer, the settings held after a save until the configuration gives them). Each watches SilverBullet's `markdownSyntaxRendering` itself (`getUiOption`). Layout's Markdown tab keeps one box (*Hide grids*); Files' settings window has *Hide files* and *A click on a link only places the cursor*.
7. **Files' settings window** (`Silverware Files: Settings`): the Media tab (`mediatab.ts`, renamed) and the Markdown boxes, saved in Files' own CONFIG block; a command, and Silverware Toolbar's action list finds it as any command.
8. **Tests.** Unit tests moved with their code; both isolation tests (Files imports no Layout code, only `shared/`; Layout imports no Files code). UI tests: `assets.spec.ts` → `silverware-files/ui-tests/files.spec.ts` (with the cross-plugin cases of *The one place they meet*), Layout's `grid.spec.ts` stays; `link-touch.spec.ts` moves to Files. Both suites against SilverBullet 2.12.1 and the playground pass.
9. **Docs.** docs/silverware-layout-assets.md → docs/silverware-files.md (*Renames*); docs/silverware-layout-grid.md's mentions of the assets read "Silverware Files"; Layout's library page loses *Media* (a line pointing to Silverware Files), Files' library page gets it (with the settings window, the Markdown boxes, links' icons and menu, cards, the side panel); both plugins' `CLAUDE.md`; this plan marked done. The memory's notes of the grid's design and the files' plan updated.
10. **The user's SilverBullet.** Deploy both (`npm run deploy -- <space>`; the deploy script copies every plugin), and the user installs nothing new: deploy writes `Library/damesene/silverware-files*`. Reload twice. Then the user tries it.

Then, before the branch is merged and on the user's word only: the releases (*Versions*).

## Versions

- Never a version or a changelog entry without the user's confirmation (root `CLAUDE.md`). `check-build` (scripts/versions.mjs) fails where a plugin's version is not `X.Y.Z` or its changelog's newest entry is not that version: the new plugin needs both from step 3. Ask the user in step 3: Files starting at `1.0.0` with an entry "First release" written then, or how they want it; propose, do not decide.
- Layout's release (before the merge, the user's decision): its grid, its widths' `room` and `anchor`, Put into grid, the cell's menu; the files gone to their own plugin. Its version by the root `CLAUDE.md`'s rules (a MINOR: a new feature; nothing a space has breaks, as the files were never released in Layout).

## Working (for the new session)

- The repository's rules: root `CLAUDE.md`, `silverware-layout/CLAUDE.md`. The conversation in Czech, everything in the repository in English. Commit after each step (one line), never push unless asked, never to `main`.
- **The user's SilverBullet**: the fork's native build on port 3010, its space a scratchpad folder of an earlier session (find it by `Get-CimInstance Win32_Process -Filter "Name='silverbullet.exe'"`, its command line). To deploy: stop it, `npm run deploy -- <its space>`, start it again: `SB_DISABLE_SERVICE_WORKER=1 SB_RUNTIME_API=0 d:/git/silverbullet/target/debug/silverbullet.exe <space> -p 3010 -L 0.0.0.0 --single` (a background task). The memory note *Local SilverBullet* has the rest.
- **UI tests** against SilverBullet: `$env:SW_SB_FIRST_PORT = "3100"; npm run test:ui:sb -- <folder>` (PowerShell; its servers would start on 3010 otherwise). The release 2.12.1 is downloaded into `.cache/silverbullet/` by the script. A grid is drawn once SilverBullet's custom syntax is active: `gridsDrawn` loads the page again until it is and holds a moment.
- **A scratch SilverBullet** for probes: `.cache/silverbullet/2.12.1/silverbullet.exe <a scratch space> -p 3062 --single`, the plugins deployed into it, Playwright scripts outside the repository (`file:///D:/git/silverbullet-libraries/node_modules/playwright/index.mjs`).
- **Shell**: a heredoc in Git Bash mangles `\` (and `\u00a0`): write scripts and code with the editor tools or a Python file, never through a heredoc when the text has backslashes. Vitest from `D:\` in PowerShell.
