# Silverware Layout and Silverware Assets: where the branch stands, what is next

Written 2026-11-14 so that a new session can start from here. Branch `docs/layout-assets` (90 commits past `main`, all pushed; nothing of it released). The design and decisions of each part are in its own plan, kept up to date: [silverware-layout-grid.md](silverware-layout-grid.md) (the grid: columns, dividers, edges, blank lines, Put into grid), [silverware-assets.md](silverware-assets.md) (the files: views, cards, links, menus, previews, which embed a widget is), [silverware-assets-split.md](silverware-assets-split.md) (Assets split out of Layout: all its steps done), [silverware-layout.md](silverware-layout.md) (widths, font, guides). This file says what is left and how to work.

## Done on the branch (in short)

- **Silverware Layout**: the grid (`<grid>`/`<column>`, a cell edited in place, its caret and selection carried, Ctrl+Z, tasks, `/grid`, Put into grid with its modes, a cell's "…" menu, embedded pages' grids, indexing); column widths dragged by a divider between columns, snapping to ratios and to the page text's edges, guides shown; a grid's edges dragged alone (its place kept as `shift` beside `width`; Alt: both ways) in place of the width handle's bar; grips for every handle (the user's choice); blank lines of a cell kept as the editor shows them, a click on one placing the caret there; an empty cell a line high; Put into grid taking a paragraph's lines as blocks each.
- **Silverware Assets** (new plugin, prefix `swa-`, `silverware.assets`, command `Silverware Assets: Settings`): embedded files as the original, a preview or a card; links to files with their icon and menu; link ↔ embed; side panel and enlarged views; the settings window (Assets, Markdown tabs; a preview's size for all files and per type; an original PDF's height); the markdown-as-written mode (`shared/syntaxmode.ts`); which embed a widget of the editor is (SilverBullet's `posAtDOM` first, marked `SILVERBULLET-INTERNAL`, `src/host/silverbullet/editorposition.ts`; else the text around it; else the run of widgets drawn).
- A review of the whole branch (2026-11-14) and its findings fixed; the isolation tests check Assets' layers and its use of Layout through its API alone.

## Left before the merge

1. **Fix: the Page layout dialog closes when another plugin saves the configuration.** Saving in Silverware Assets' settings makes SilverBullet load the configuration again, Silverware Layout starts again and the dialog open goes. Seen in a UI test (`silverware-assets/ui-tests/assets.spec.ts`, the markdown-as-written test reopens it), worked round there, not fixed. Recommended to the user; not started.
2. **SilverBullet after 2.12.1 (edge)**: [silverware-library-prefix.md](silverware-library-prefix.md) plans the change for every plugin (scripts only under `Library/`, CONFIG moved to `Library/Config`). Silverware Assets' init page has its own `saveConfigPage` writing `CONFIG`: add Assets to that plan. The grid and the assets were never tried on edge.
3. **Releases** (on the user's word only, the last commits of the branch, root `CLAUDE.md` *Versions*):
   - Silverware Assets 1.0.0: its entry (`silverware-assets/CHANGELOG.md`, dated 2026-11-13) predates the settings window, previews' sizes, the PDF's height and the click on a PDF's preview: redraft it and its date, then ask.
   - Silverware Layout: 1.0.0 now; propose 1.1.0 (a MINOR: the grid and everything around it, grips, Put into grid; nothing a space has breaks, the assets never being released in Layout), its entry drafted from `git log layout-v1.0.0..HEAD -- silverware-layout/ shared/` (check the tag's name first: `git tag -l`).
   - `shared/` changed for other plugins too (the page writer's grid cells, `shared/layout.ts`' new optional members, `shared/popupmenu.ts`, `shared/markdown/embed.ts`): their bundles were rebuilt; whether any of them needs a release of its own, ask.
4. **The PR to `main`**, merged on GitHub (the user's way), then the tags (`assets-v1.0.0`, `layout-v1.1.0`), each with the user's confirmation.

## Waiting on others

- **The user's pull request to SilverBullet**: a position on an embed's widget (`inline_content.ts`, `lua_widget.ts`). Once in a release: Silverware Assets reads it where it is there (`editorposition.ts`, the one place to change), `posAtDOM` kept for the versions before.

## Proposed, not started (the user's word needed)

- **`posAtDOM` for the other plugins** (after this branch's merge, a branch of its own; the grid could come here): Silverware Chart writes the first of two identical charts (a bug), Silverware Database refuses a block written twice with one out of view, Silverware Table's `data-pos` goes stale; the helper moved to `shared/silverbullet/` (marked `SILVERBULLET-INTERNAL`, the same comment), each plugin's host using it first, its answer checked against the text.
- **A PDF's page**: `![[doc.pdf|||{ page: 3 }]]`, the viewer's URL given `#page=3` (Chrome, Edge, Firefox), in the original and the preview; a menu item "Show page…". Not on a phone without a PDF viewer (a card there).

## Decided, not to do now

- **A PDF's height by a handle**: left (the user: an image cannot be deformed, so a second handle fits nothing but a PDF); the height is the settings' (`heights.embed`, the settings window) or the embed's own (`|640x900`).
- **A preview widened by the handle**: never (its size is the settings').
- **A grid anchored at the text's start**: tried, worse; a grid grows both ways (Alt on an edge line).
- **Marks for how a grid's cells were apart** (`<column line>`): dropped; taken apart, a cell ending in a line of text and the next starting with one are a line break apart.

## Open questions (the user's)

- A gallery keeping its columns on a phone (or a grid asking so), or its cells under one another as now.
- The names of the grid's attributes to come (`gap`, a column's `span`, `align`).
- A centred file (as a widget) besides one at the text's start; the names of the settings' keys and the card's fields (docs/silverware-assets.md, *Open*).

## Known, small

- A grid drawn watches for its element to come into the page up to 30 s (`whenConnected` in `src/grid/grids.ts`): one observer a drawing that never comes in. Bounded; left.
- The column dividers on a touch screen have no UI test of their own (the user to try them on a tablet).
- SilverBullet 2.12.1 draws the medium of two identical embeds (`![[a.png]]` twice) in one of their widgets alone (its widget cache, keyed by the text): SilverBullet's, nothing of ours.

## Later (the plans' backlogs)

- The grid: attributes (`gap`, `span`, `align`), a grid in a grid, a grid exported (`renderHtml`), a grid's tasks and items indexed, several images uploaded into a grid at once (a phone's camera too).
- The files: paste and drop, an embedded page as a type of its own, a real PDF preview (pdf.js), a video's first frame, types and renderers from Space Lua, actions `open` and `embed`, a long press on a touch screen.

## How to work

- **The user's SilverBullet**: the fork's native build on port 3010 (LAN `10.10.0.5:3010`), its space `C:/Users/sliva/AppData/Local/Temp/claude/c5d418ac92c22714/ccd2e357-ac17-4391-bf5e-392416192085/scratchpad/space` (find a running one: `Get-CimInstance Win32_Process -Filter "Name='silverbullet.exe'"`). Deploy after each visible change: `npm run deploy -- <that space>` (fine while it runs), the user reloads twice. Start it, where it is not running: `SB_DISABLE_SERVICE_WORKER=1 SB_RUNTIME_API=0 d:/git/silverbullet/target/debug/silverbullet.exe <space> -p 3010 -L 0.0.0.0 --single` (a background task). Its CONFIG is written only while it is stopped.
- **A scratch SilverBullet for probes**: `./.cache/silverbullet/2.12.1/silverbullet.exe <scratchpad>/grid-space -p 3062 --single`, the plugins deployed into it, Playwright scripts outside the repository (`file:///D:/git/silverbullet-libraries/node_modules/playwright/index.mjs`; `chromium.launch({ channel: "chromium" })` has the browser's PDF viewer, the default headless shell has none). After a deploy, load a page twice before trusting what it runs.
- **UI tests** against SilverBullet: `$env:SW_SB_FIRST_PORT = "3100"; npm run test:ui:sb -- silverware-layout/ui-tests silverware-assets/ui-tests` (PowerShell); a filter with `|` or `'` breaks on Windows: run the folder and read the output. The playground: `npx playwright test silverware-layout/ui-tests`. Before each commit: `npm run build`, `npm run verify` (from `D:\` in PowerShell).
- **Shell**: a heredoc in Git Bash mangles `\` (and `\n` in string literals): edit text with backslashes with the editor tools, or a Python file written by the Write tool.
- **Working style the user asked for**: the conversation in Czech, the repository in English; commit each change on its own (one line, Conventional Commits, no co-author), the bundles built from its own changes; tests for anything fragile; deploy to the user's SilverBullet after a visible change; propose, don't decide, where it is the user's (UX, names, releases).
