# Silverware Assets: split out of Silverware Layout

Plan of 2026-11-13, agreed with the user; to be started in a new session. Nothing of it is built yet. Branch: `docs/layout-assets` (all of Layout's grid and assets work lives there, not on `main`; nothing of it is released).

## Why

Silverware Layout does two unrelated things now:

1. **The page's layout**: the text's width, widgets' widths by the handle and its guides, the font size and zoom, columns (grids: `/grid`, a cell edited in place, Put into grid, a cell's menu).
2. **Files embedded and linked**: how an embedded file shows (original, preview, card), a link's icon and its menu, the side panel and the enlarged view, a link written as an embed and back, a card's size and date, the Media tab.

The second does not belong under "Layout": a user looking for "show a PDF as a card" does not look there. Decided with the user:

- **A plugin of its own, Silverware Assets** (prefix `swa-`, settings and Space Lua API under `silverware.assets`).
- **Now, before any release**: nothing of it is released, so the settings (`silverware.layout.assets`) and the API (`silverware.layout.api.assets`) move without a migration. After a release it would be a breaking change.
- **"Asset" stays the code's word** (`shared/assets.ts`, `AssetType`, `AssetAction`, `Asset`, `AssetRegistry`, `AssetDecorator`, `AssetHost`): the plugin is named as its code already is, so the move renames little (*Renames*).

## The name

Weighed with the user on 2026-11-13 (the decision is theirs, "assets" their leaning):

| Name | For | Against |
| --- | --- | --- |
| **Silverware Assets** (chosen) | broad: covers a file of the space, a file of the web, later an embedded page or a player, so it outlives the plugin's growth; known from Logseq (its `assets/` folder of embedded files); the code's word already, so little to rename | a developer's word to some users (web and games: bundled images and fonts) |
| Silverware Assets | plain to anyone | less broad: a site's player or a map is no file |
| Silverware Media | — | sounds like images and video alone; a zip, a PDF are not (the user's objection) |
| Silverware Attachments | a note app's word (Obsidian) | long; "attached" suggests one page's file, while an asset is the space's |
| Silverware Documents | SilverBullet's own word for a file that is no page | read as Word or PDF; mixes with pages |
| Silverware Embeds | — | the plugin also decorates plain links (their icon, their menu) |

What is hard to rename later, so chosen for growth now: the settings' keys (`silverware.assets`), the API (`silverware.assets.api`: types registered as types, never by a kind of file; the asset's kinds `file`, `web`, later `page` in the contract already, a new one added, nothing renamed), the plugin's folder and library page (`Library/damesene/silverware-assets`: renamed, a space would install it anew). The metadata written into pages (`{ view: icon }`) names no plugin.

## What goes where

**Silverware Layout keeps**: text width, widgets' widths (the handle, guides, `shared/layout.ts`, `room`, `anchor`), font size and zoom, grids (`src/grid/`: drawing, editing in place, caret and selection carried into the field, Ctrl+Z in it, tasks toggled in a cell, `/grid`, Put into grid, the cell's menu, the embedded page's grid, indexing), the grid's part of SilverBullet's "markdown as written" mode (grids hidden), the Page layout dialog (Page width, Font, Guides, a Markdown tab with the grids' box alone).

**Silverware Assets takes**: everything in `silverware-layout/src/assets/` (types, actions, views, card, menu, panels, settings, the Media tab), SilverBullet's host of it (`host/silverbullet/assets.ts`: widgets found, links found, a file's meta, the embed written, link ↔ embed), its part of the "markdown as written" mode (assets hidden, a click on a link placing the cursor alone, the text pointer), its own settings window (the former Media tab and its Markdown boxes), its library page (the *Media* section of Layout's), its style page (the asset rules of Layout's).

**Shared by both, in `shared/`**: the popup menu (`silverware-layout/src/ui/popupmenu.ts` → `shared/popupmenu.ts`, its base given as the shared menu's is: `swl` / `swa`), the assets' contract (`shared/assets.ts`, as it is), the new contract of markdown rendered outside the editor (`shared/rendered.ts`, below), the embed codec and page writer parts (`shared/markdown/embed.ts`, `pages/parts.ts` `embeds`/`links`: unchanged, already shared).

## The one place they meet: markdown rendered outside the editor

Assets must find each file and link a grid draws in its cells, and **where it is in the page's text**: it writes there (a view chosen, a width dragged, Show as a link) and the same file may be there twice (a grid drawn before SilverBullet's widget above it once took the grid's image for the other: fixed by places, docs/silverware-layout-assets.md step 8). Today Assets reads it from the grid's HTML (`data-swl-rendered`, `data-swl-pos`, `data-swl-end` on a cell, SilverBullet's `data-pos` in it, `span[data-swl-embed]` places, a MutationObserver on `data-swl-pos`). Across two plugins that would be an agreement in HTML, broken silently by a change on either side.

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
  /** The ranges of the page's text drawn outside the editor (their embeds are no widget of SilverBullet's: Assets counts SilverBullet's widgets among the others alone) */
  ranges(): readonly { readonly from: number; readonly to: number }[];
  /** Told as items are drawn, drawn anew, or given their places later (a grid drawn while the editor's text was still the page before); the function given back stops it */
  onChange(listener: (items: readonly RenderedItem[]) => void): () => void;
};

/** The API as handed over (`silverware.layout.api.rendered`), where it is of this version; else a stand-in: nothing drawn, nothing told */
export function renderedOf(given: unknown): Rendered;
```

- **Layout provides it**: the grid builds the items as it draws a cell (each element with SilverBullet's `data-pos` plus the cell's offset in the page; the places for a PDF and a zip it draws itself, `host/silverbullet/undrawn.ts`, become its own business), and calls the listeners as it draws, draws anew (`refresh`) and as positions become known (`markPlaces`). `silverware.layout.api.rendered`, beside the widgets' registry and versioned apart.
- **Assets consumes it**: its SilverBullet host takes `items()` and `onChange` instead of reading the grid's HTML; it still frames each medium in an element of its own (its `swa-frame`) to decorate it. Without Layout (or a Layout of another version): the stand-in, Assets decorates SilverBullet's widgets alone (without Layout there are no grids).
- **Load order**: Assets' init page takes `silverware.layout.api` as Silverware Table does (Layout's API page has `-- priority: 50`); it may come after Assets started, so Assets asks for it again as Space Lua loads again, as Table re-registers.
- **The handle**: Assets registers its `LayoutProvider` (a medium's width, `room` for one in a cell, `anchor`) through `silverware.layout.api`, as Table, Chart and Database do. Without Layout, assets without the handle. `room` needs the cell: `RenderedItem` could carry it (`room: HTMLElement`) so Assets knows no cell; decide in step 1.
- **A test across both**: Assets' UI tests run with both plugins (the test servers deploy every plugin): a medium in a grid found by its place, its view written to its own embed (the bug once fixed), its width dragged within the cell. A break of the contract fails there by name.

## Renames

The code keeps "asset" (*Why*); what moves or is named after the plugin:

| Now (Silverware Layout) | Then (Silverware Assets) |
| --- | --- |
| `silverware-layout/src/assets/**` | `silverware-assets/src/**` (its own `model/`, `core/`, `ui/`, `builtin/`, `host/`, `host/silverbullet/`), names kept |
| `silverware-layout/src/host/silverbullet/assets.ts` (and its test) | `silverware-assets/src/host/silverbullet/assets.ts` |
| `shared/assets.ts` | stays, its doc comment naming Silverware Assets as its provider |
| `silverware.layout.assets` (CONFIG, Layout's own block) | `silverware.assets` (Assets' own block, marker `-- managed-by: silverware-assets`), the same keys inside (views, actions, card, heights, anchor, linkIcons) |
| `silverware.layout.api.assets` | `silverware.assets.api` |
| `silverware.layout.syntaxMode.hideWidgets` | `silverware.layout.syntaxMode.hideGrids` (Layout) and `silverware.assets.syntaxMode.hideAssets` (Assets) |
| `silverware.layout.syntaxMode.clickPlacesCursor` | `silverware.assets.syntaxMode.clickPlacesCursor` |
| CSS `swl-asset-*` (`swl-asset-frame`, `swl-asset-more`, `swl-asset-card*`, `swl-asset-icon`, `swl-asset-link-icon`, `swl-asset-menu-icon`, `swl-asset-peek`, `swl-asset-popover`, `swl-asset-panel-*`, `swl-asset-menu-holder`, `swl-asset-native-hidden`, `swl-asset-failed`, `swl-asset-pdf`), `swl-media-*`, `swl-syntax*` (the assets' part) | `swa-*` (`swa-frame`, `swa-more`, `swa-card*`, …, `swa-settings-*`) |
| attributes `data-swl-asset`, `data-swl-asset-view`, `data-swl-asset-target`, `data-swl-asset-widget`, `data-swl-asset-link`, `data-swl-syntax-shown` (the assets' part), `data-swl-syntax-clicks` | `data-swa-asset`, `data-swa-view`, `data-swa-target`, `data-swa-widget`, `data-swa-link`, `data-swa-syntax-shown`, `data-swa-syntax-clicks` (`data-swl-width`, `data-swl-anchor-start`, `data-swl-in-room` stay Layout's: Layout sets them on Assets' frames as on any widget; `data-swl-embed` becomes the grid's own, *The one place they meet*) |
| the Media tab of Page layout | `Silverware Assets: Settings`, a dialog of Assets' own (`shared/dialog.ts`), tabs *Assets* (the former Media tab; its "All files", per type rows kept) and *Markdown* (hide assets, a click places the cursor) |
| docs/silverware-layout-assets.md | docs/silverware-assets.md (its decisions and steps kept, "Silverware Layout" read as "Silverware Assets" where it is the assets' part) |
| Layout's library page, section *Media* | `silverware-assets/silverware-assets.md` |

The actions' names (`open-tab`, `peek`, `popover`) and the views (`icon`, `preview`, `embed`, the key `view` in an embed's metadata) stay: they are written in pages and settings.

## Steps

Each step: `npm run build`, `npm run verify` (run from `D:\` in PowerShell: vitest reports "no tests" from Git Bash's `/d/`), the UI tests of what it touches (`SW_SB_FIRST_PORT=3100 npm run test:ui:sb -- <folder>`: the user's SilverBullet is on 3010), a review of the diff without UI tests, a commit (one line, Conventional Commits, no co-author), the user told which step of how many; after a step a user can see, a deploy to the user's SilverBullet (*Working*).

1. **The rendered contract, in one plugin still.** `shared/rendered.ts` as above, with its tests (the stand-in, the version). Layout's grid provides it (`src/grid/`: items per cell as drawn, positions by `data-pos` plus the cell's offset, listeners on draw, refresh and `markPlaces`); `silverware.layout.api.rendered`. The assets' SilverBullet host (`host/silverbullet/assets.ts`) takes it instead of `[data-swl-rendered]`, `data-swl-pos`, `span[data-swl-embed]` and its MutationObserver on `data-swl-pos`; `renderedPosition`, `RENDERED_MEDIA`, `renderedRanges` go. Decide whether `RenderedItem` carries the cell (`room`) or Assets asks Layout's handle otherwise. All of today's UI tests pass unchanged (`assets.spec.ts` "the same image outside a grid and in it", the drag in a cell, a PDF and a zip in cells, a link's icon in a cell). This is the riskiest step: do it first, alone.
   **Done 2026-11-13**: `shared/rendered.ts` (`RenderedItem` carries its `room`, the cell, and its `style`); the grid takes what it drew as a cell is drawn (`src/grid/drawn.ts`: the host's media, the places for a PDF and a zip, links, each by its `data-pos`), matches them with the cell's markdown once the cell is placed (`readEmbeds`, `readLinks`: the item's target as written), and tells when it is in the page (`whenConnected`) and as places change (`markPlaces` says whether any did): `Grids.rendered`, `silverware.layout.api.rendered` (index.ts forwards to the grids once made). The assets' host takes `items()`/`onChange` (each medium framed once, its place and room as told last; links as told) and `ranges()`; `data-swl-rendered` and the reading of `data-swl-pos`/`data-swl-embed` are gone (the grid keeps `data-swl-pos` on its cells for itself). All of Layout's UI tests pass (55), unchanged.
2. **The popup menu to `shared/`.** `src/ui/popupmenu.ts` → `shared/popupmenu.ts`, its classes by the base given (`swl` for Layout's, `swa` later); its CSS a template in `scripts/sharedstyles.mjs` if it draws more than the shared menu does (today its holder box is `.swl-menu` in Layout's style page). Layout's grid and assets use it from there.
   **Done 2026-11-13**: `shared/popupmenu.ts` (`opensMenu(doc, { base }, trigger, menu, signal)`), its box `<base>-popup <base>-menu` (Layout's `.swl-popup` in its style page, the shared menu's look by the base); its CSS stays each plugin's (a small rule of the box's place: no template needed).
3. **The new plugin's frame.** `silverware-assets/` with `silverware-assets.md` (library page, its version: see *Versions*), `CHANGELOG.md`, `-init.md`, `-api.md` (priority 50: `silverware.assets.api`), `-style.md`, `CLAUDE.md`, `src/`, `ui-tests/` (`helpers.ts` of its own, from Layout's: `space.open` with files, `PIXEL_PNG`, `gridsDrawn`), its isolation test. Added to the lists of `scripts/build.mjs` (which also runs the versions' check, scripts/versions.mjs, for each plugin listed), `scripts/deploy.mjs` and `scripts/sharedstyles.mjs` (base `swa`; checked 2026-11-13: these three list the plugins by name, `scripts/ui-test-groups.mjs` finds every plugin's `ui-tests/` by itself), `REPO.md` (a `#meta/library/remote` block), the root `CLAUDE.md`'s table (`silverware-assets/`, `swa-`). It builds and loads, doing nothing yet.
   **Done 2026-11-13**: it builds and loads in SilverBullet 2.12.1 (its API `api`, `init`), doing nothing; version 1.0.0 with its entry (the user's choice). Its `ui-tests/helpers.ts` comes with its tests (step 8), its line in `scripts/sharedstyles.mjs` with its styles (step 5).
4. **Move the code** with `git mv` (history kept): `src/assets/**` and `host/silverbullet/assets.ts` (and its tests) into `silverware-assets/src/` (*Renames*: paths only, the code's names kept). Assets' `index.ts` (its binding: the bridge, the host, the registry, `api`, the decorator, the settings), its init page's bridge (what the assets' host uses today: `getText`, `getCurrentPage`, `replaceRange`, `readPage`, `writePage`, `listPages`, `flash`, `getConfig`, `saveConfigPage`, `documentMeta`, `getUiOption`), its `LayoutProvider` registered through `silverware.layout.api` (as Table's init page does), the rendered contract taken from `silverware.layout.api.rendered`. Layout's `index.ts` loses the assets' wiring (`assetRegistry`, `AssetDecorator`, `assetProvider`, `app.dialogTabs`'s Media tab, `api.assets`). The settings read from `silverware.assets`.
5. **Styles.** The asset rules of `silverware-layout-style.md` (frames, the "…", the card, its icon as a button, the link's icon, the menu's holder, the peek, the popover, the Media tab, the hidden-in-markdown rules for assets, the text pointer) move to `silverware-assets-style.md` as `swa-` (*Renames*); Layout keeps the widget-width rules that size Assets' frames (`[data-swl-width]`, `[data-swl-in-room]`; the preview's `fit-content` rule names an asset's view: give it to Assets' style page, or give Layout a mark of its own to read).
6. **The markdown-as-written mode split.** Layout's `host/silverbullet/syntaxmode.ts` keeps the grids' part (its root mark hides `.swl-grid-widget`); Assets gets its own (assets hidden, a click on a link placing the cursor alone, the text pointer, the settings held after a save until the configuration gives them). Each watches SilverBullet's `markdownSyntaxRendering` itself (`getUiOption`). Layout's Markdown tab keeps one box (*Hide grids*); Assets' settings window has *Hide embedded files* and *A click on a link only places the cursor*.
7. **Assets' settings window** (`Silverware Assets: Settings`): the Media tab (`mediatab.ts`) and the Markdown boxes, saved in Assets' own CONFIG block; a command, which Silverware Toolbar's action list finds as any command.
8. **Tests.** Unit tests moved with their code; both isolation tests (Assets imports no Layout code, only `shared/`; Layout imports no Assets code). UI tests: `assets.spec.ts` → `silverware-assets/ui-tests/assets.spec.ts` (with the cross-plugin cases of *The one place they meet*), Layout's `grid.spec.ts` stays; `link-touch.spec.ts` moves to Assets. Both suites against SilverBullet 2.12.1 and the playground pass.
9. **Docs.** docs/silverware-layout-assets.md → docs/silverware-assets.md (*Renames*); docs/silverware-layout-grid.md's mentions of the assets read "Silverware Assets"; Layout's library page loses *Media* (a line pointing to Silverware Assets), Assets' library page gets it (with the settings window, the Markdown boxes, links' icons and menu, cards, the side panel); both plugins' `CLAUDE.md`; this plan marked done. The memory's note of the grid and assets work updated.
10. **The user's SilverBullet.** Deploy both (`npm run deploy -- <space>`; the deploy script copies every plugin listed), so the space gets `Library/damesene/silverware-assets*`. Reload twice. Then the user tries it.

Then, before the branch is merged and on the user's word only: the releases (*Versions*).

## Versions

- Never a version or a changelog entry without the user's confirmation (root `CLAUDE.md`). `check-build` (scripts/versions.mjs) fails where a plugin's version is not `X.Y.Z` or its changelog's newest entry is not that version: the new plugin needs both from step 3. Ask the user in step 3: Assets starting at `1.0.0` with an entry written then, or how they want it; propose, do not decide.
- Layout's release (before the merge, the user's decision): its grid, its widths' `room` and `anchor`, Put into grid, the cell's menu; the assets gone to their own plugin. Its version by the root `CLAUDE.md`'s rules (a MINOR: a new feature; nothing a space has breaks, as the assets were never released in Layout).

## Working (for the new session)

- The repository's rules: root `CLAUDE.md`, `silverware-layout/CLAUDE.md`. The conversation in Czech, everything in the repository in English. Commit after each step (one line), never push unless asked, never to `main`.
- **The user's SilverBullet**: the fork's native build on port 3010, its space a scratchpad folder of an earlier session (find it by `Get-CimInstance Win32_Process -Filter "Name='silverbullet.exe'"`, its command line). To deploy: stop it, `npm run deploy -- <its space>`, start it again: `SB_DISABLE_SERVICE_WORKER=1 SB_RUNTIME_API=0 d:/git/silverbullet/target/debug/silverbullet.exe <space> -p 3010 -L 0.0.0.0 --single` (a background task). The memory note *Local SilverBullet* has the rest.
- **UI tests** against SilverBullet: `$env:SW_SB_FIRST_PORT = "3100"; npm run test:ui:sb -- <folder>` (PowerShell; its servers would start on 3010 otherwise). The release 2.12.1 is downloaded into `.cache/silverbullet/` by the script. A grid is drawn once SilverBullet's custom syntax is active: `gridsDrawn` loads the page again until it is and holds a moment.
- **A scratch SilverBullet** for probes: `.cache/silverbullet/2.12.1/silverbullet.exe <a scratch space> -p 3062 --single`, the plugins deployed into it, Playwright scripts outside the repository (`file:///D:/git/silverbullet-libraries/node_modules/playwright/index.mjs`).
- **Shell**: a heredoc in Git Bash mangles `\` (and `\u00a0`): write scripts and code with the editor tools or a Python file, never through a heredoc when the text has backslashes. Vitest from `D:\` in PowerShell.
