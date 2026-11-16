# Grid and assets: a round of fixes (2026-11-14)

The user's list of 2026-11-14 (branch `feat/editor`), fixed one by one, each its own commit; then a review of what was
not reviewed yet, its findings fixed; then every UI test once, at the end (not during the work: a test of the one
thing in doubt alone, isolated). What is not reproduced is not forced: said at the end, for the user to test again.

## How to work here (for after a compaction)

- Conversation in Czech; the repository in English. Commits one line, Conventional Commits, no AI trailer, each with
  its bundles built (`npm run build`, then `npm run verify` from `D:\` passing).
- The local SilverBullet the user looks at: the fork's build on 3010 (background task), its space
  `C:/Users/sliva/AppData/Local/Temp/claude/c5d418ac92c22714/ccd2e357-ac17-4391-bf5e-392416192085/scratchpad/space`;
  deploy there after each visible step: `npm run deploy -- "<that path>"` (the page loaded twice to see it).
- UI tests: `$env:SW_SB_FIRST_PORT = '4100'; npm run test:ui:sb -- <paths>` (PowerShell); all of them at the end only.
- Probes: Playwright scripts in the session's scratchpad, `import { chromium } from "file:///d:/git/silverbullet-libraries/node_modules/playwright/index.mjs"`,
  against http://localhost:3010/GridEdit (a grid: "## Plans" … in the first cell, "Right column" in the second;
  "After." below) or /test-image (grids with PDFs and images). A probe that changes a page puts its text back through
  SilverBullet's editor (`document.querySelector("#sb-main .cm-content").cmTile.view.dispatch(...)`); never write a
  page on disk while SilverBullet has it open. A drag: its start dispatched as a `DragEvent` in the page (a selection
  is not dragged headless), its drop the browser's own by CDP `Input.dispatchDragEvent` (`dragOperationsMask` 17 for
  copy and move; a synthetic `DataTransfer`'s dropEffect stays "none").
- Machine pitfalls: a shell heredoc mangles backslashes (`\n` in a string): write Python or scripts with the Write
  tool, or edit with the Edit tool. Vitest from `D:\` (a lowercase drive letter finds no tests).
- Where things are: the grid `silverware-layout/src/grid/` (`grids.ts`, `drag.ts` the drag of text, `ui/celleditor.ts`
  a cell edited, `ui/cellpoint.ts` a point of a cell in its markdown, `ui/view.ts`, `ui/dividers.ts`), SilverBullet's
  side in `src/host/silverbullet/` (`behaviour.ts`, `dom.ts`, `cursor.ts`, `grid.ts`); the editor
  `silverware-editor/src/` (`codemirror.ts`, `livepreview.ts`); Silverware Assets `silverware-assets/src/`
  (`decorate.ts`, `ui/moremenu.ts`, the contract `shared/assets.ts`). Plugins depend on SilverBullet's behaviour only
  through their host (the user's rule).

## The list

1. **A drag within a grid mostly copies** (sometimes it moves; into the page's editor it moves). Expected: always a move.
   Suspects: the browser's own drag of a rendered selection (`dragstart` target a text node: `gridOf` reads its
   element?), `effectAllowed`, the drop on the cell edited or on the grid's own focus; to probe.
2. **Borders while dragging a divider or the grid's handle**: as a cell edited shows the grid's lines
   (`.swl-grid:has(> .swl-grid-editing)` in the style page), the same while a column's divider or the grid's width is
   dragged.
3. **A click anywhere in a column edits it**: a shorter column (cells of a row stretch to the row's height, its content
   does not) is edited only by a click on its content; a click below it should edit it too, the caret after its last
   character.
4. **A click under the last line of a cell edited flickers**: the field shows the rendering for a moment, then the
   markdown. And images are not drawn in the field at all: drawn as the page's editor draws them (the markdown only
   where the caret is), where that can be done cleanly; not worth a hack.
5. **An image in a grid whose click action is Original**: the click shows the whole grid's markdown.
6. **Copy image** in an image's menu (Silverware Assets): an asset's type registering items of its own in the menu,
   generally (a contract where there is none); the source image copied to the clipboard.
7. **Copy markdown** in every asset's menu: the embed's whole markdown, its metadata too.
8. **Review** of what was not reviewed (since `ec5fec4`: the drag, the cursor kept out, this round), its findings fixed.
9. **Every UI test**, then the report: what was not reproduced, for the user to test again.

## Status

(Updated as each is done: its commit, or why not.)

1. Done, `5890aa3`: a drag from a rendered cell moved already (probed with a real drag: CDP `Input.setInterceptDrags`); a selection made by a drag over the rendering opens the cell's field with it, and a drag from the field wrote the target at once but the field's own cell only as the field was left (looked a copy, two writes). Now the field's cell is written in the same edit. UI test: `mouseDrag` in grid.spec.ts.
2. Done, `eb6dae3`: the grid's lines while a divider (`data-swl-dragging`) or its width (the handle marks the widget `data-swl-resizing`, generic) is dragged. Noticed for the review: a divider dragged back to even wrote `columns="2"` (expected none).
3. Done, `aaedb7f`: cells stretch to their row (`align-items: stretch`); a click under all of a cell's rendering puts the caret after its last character (`endAt`, ui/cellpoint.ts). UI test written (run at the end).
4. Done: the flicker (`726a8aa`: a press under a cell's field keeps the field, its caret at the end; the field was left and opened again before d48e902 kept a press beside the field); images in the field (`4e22eb9` the editor's `image` option, drawn where the plugin says, markdown where the caret is; `3be1530` Layout's `GridHost.images` from SilverBullet's host: a space's image by its path, a URL as written; another file stays markdown, Silverware Assets' to draw).
5. Not reproduced: an image shown as the original in a cell, clicked, edits its cell (no grid's markdown shown); fixed by `d48e902` (every press in a grid the grid's, its focus its own): the user could not reproduce it either (2026-11-14).
6. and 7. Done: `Copy image` a built-in action of the menu alone (`AssetAction.gesture: false`, the contract: an action out of the click's choices; the image drawn on a canvas, a PNG on the clipboard; HTTPS or localhost only), `Copy markdown` in every embed's and link's menu (the markdown as the page has it now).
8. Review done (code-review, high, ec5fec4..c4be916), its ten findings fixed: `b6042d5` (the arrows left to a wrapped line's rows and an open completion; a drop under a short column's text at its end; a cell's text taken out only where the drop was taken; `withMarksAround` no longer takes two formats' ends nor a word's own `_`; the images' resolver asked alongside the page's text), `210cff2` (an image's size as its markdown says, its press the editor's), `60f9d08` (Copy markdown at once while the click allows it, a link's by a clipboard item of the text to come; Copy image of an SVG of no size).
9. Every UI test: against SilverBullet 477 passed, 2 failed, 3 skipped. Both fixed: a grid's lines while dragged had the borders' gap and padding, which moved the columns under the pointer and put a divider's snap off (`e232173`: a ring and a line in each gap, the layout kept); a link's menu listed in a test (`2e65832`). Also found: a divider let go at even widths wrote `columns="2"` (`ae09187`). Run again: Layout and Assets 91 passed (2 skipped), the playground 299 passed (201 skipped: SilverBullet's alone).
