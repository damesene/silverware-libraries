# Look compare tests: one markdown, every surface alike

Status: steps 1 to 3 built (2026-11-17, `silverware-editor/ui-tests/look/surfaces.spec.ts`, see *What it found*), more blocks 2026-11-18 (see *Known differences*); step 4
and kind 2 not. The user's question: screenshot tests, a few, that catch what was
found by hand again and again (a task's box in the peek, a number's colour and room in a grid's field, a table not a
card while edited), without going red for what does not matter (the peek's padding moving it a few pixels) and without
old screenshots to refresh all the time.

## What breaks today and why tests miss it

The same markdown is drawn by five surfaces, by three plugins and SilverBullet:

| Surface | Drawn by |
| --- | --- |
| The page | SilverBullet's editor (its live preview) |
| A grid's cell | SilverBullet's `markdownToHtml`, our rules on it (Silverware Layout's style page) |
| A grid's cell edited | Silverware Editor's field (a shadow root: SilverBullet's rules do not reach it) |
| A database's peek | Silverware Editor's field, read only until read, in the body (none of the page's rules) |
| A database's peek edited | the same field, the caret in it |

Each follows the page by other means (rules of ours with the theme's variables, a sample of the page's rendering
read: `shared/editorlook.ts`), and SilverBullet's look changes between versions (2.12.1, edge). The UI tests check
behaviour, and a few properties one by one (`grid.spec.ts`' lists and look tests); nothing compares the surfaces
as a whole.

## Two kinds of test, one now

1. **Surfaces against each other** (this plan's work): the same markdown drawn on the five surfaces in one run,
   compared with each other, the page the reference. No stored screenshot: a SilverBullet that changes its look
   changes the page and what follows it alike, and the test stays green; it goes red only where a surface parts from
   the page. Run against both SilverBullets (the release, edge) as every UI test is, nothing kept per version.
2. **Before and after against stored screenshots** (later, if wanted): a few scenes, against the release alone
   (2.12.1 does not change; edge changes weekly and would be red all the time), made and compared in one environment
   only (CI's Linux in Docker: Windows draws fonts otherwise), refreshed only by an explicit command
   (`--update-snapshots`), never by a run. Not before 1 has run a while.

## 1. Surfaces against each other

### The fixture

One markdown, each part a block of its own, short lines (no line wraps on any surface):

- a bullet list (two items, one nested), a numbered list, a task list (open, done)
- a table (header, two rows)
- a paragraph with a hashtag, a wiki link and a bold word
- a quote, a fenced code block
- an image (`PIXEL_PNG`-like, sized), a file's preview (Silverware Assets, where the run has it)

Written as the page's text, as a grid's cell's (`<grid>` of one cell), and as an item's content (a database of one
item); the peek opened on it.

### What is compared, per block

Blocks are matched by their text, not by where they are: each surface's block is found (the page's lines by their
text, a cell's and a field's elements by theirs) and read relative to its own top left corner, so a surface's padding,
margin or place on the screen never counts.

**Measurements** (the assertions, each failing with its name and both values):

- where each line's text starts after its marks (a bullet's, a number's, a task's box), px from the block's left
- the marks' colour, a done task's decoration, a box's size, corners and colours
- a table's corners, border, shadow; its header's and cells' font size, weight, padding, colour and ground
- a hashtag's colour, ground, corners; a link's colour
- a quote's bar, a code block's ground and corners

Tolerances where layout rounds: 2 px for places, sizes rounded to a pixel (an em of 16.77 px is 13.33 or 13.31 by the
surface). A property the page does not have (2.12.1 draws no card) compared as it is: none on every surface.

**Pixels** (informative at first): each block cropped to its own box, the five crops compared with the page's by
`pixelmatch` (Playwright's own), a threshold for anti-aliasing and a share of differing pixels allowed (1 to 2 %),
the crops and their difference attached to the report side by side. Not failing the test until a few weeks show it
steady: half a pixel of a text's place differs between surfaces and may light up whole glyphs. Made steady by:

- the same width for every surface's block (the grid's column, the peek's width, the page's text width set equal)
- what changes masked or hidden: the caret (`caret: "hide"`), the selection, Silverware Layout's handles and grips,
  a file's "…", Silverware Toolbar's bar; animations off
- the field's marks drawn (the caret on a line of its own, outside every block)

### Where it lives

A spec of its own, `silverware-editor/ui-tests/look/surfaces.spec.ts` (Silverware Editor is what the grid's field and
the peek share; the folder makes it a CI job of its own by `scripts/ui-test-groups.mjs`), its helpers beside it
(`look/helpers.ts`: the fixture, find a block on a surface, measure it, crop it). It needs Layout, Database and Assets
in the space, as the test servers have (every plugin deployed). Mouse project only; a phone's layout is another
question.

### What it found (2026-11-17), and what was done

Run first on edge and the release, the measurements told what the eye had missed:

- **A task's text 4 px further than the page's, a nested item's 7 px nearer**: SilverBullet lays a list's marks out in
  columns (`--editor-column`, set on its editor's content; a bullet's `- ` 2, a number's `1. ` 3, a task's `[ ] ` 4, an
  indent its own), our rules in ems. Now both in its columns (Silverware Editor's `COLUMN`, `LIST_COLUMNS`; Silverware
  Layout's style page), `1ch` where SilverBullet sets none (2.12.1); Silverware Database hands the page's
  `--editor-column` to its peek, which hangs outside the editor.
- **The peek's table in 18 px** where the page's is in 13.5 and 15.8 px: its look's sample read in the editor's content,
  where SilverBullet's rules for a rendered block's table do not reach. Now read in a database's place in the page.
- **A table's line on 2.12.1**, which draws no card: `--ui-surface-border-color` is set there for other things. The
  card's line now only where the theme gives cards corners (`--ui-radius-xl`).
- **A number's colour on 2.12.1** a step off (its markup's grey against its bullets'): colours read alike within two
  steps of a channel.
- **A task's box in a grid's cell** (the user saw it, zoomed, 2026-11-17): placed by its own font's line (an input's),
  high as the font grows, and at its room's left where the page centres it in the columns of its `[ ]`. Now as the
  page's, the column and the line read where the text is (registered custom properties); the test measures the box
  against its text both ways, and runs every surface again at this device's zoom (Silverware Layout's, 30 px).
- **The peek's lines 3 px further apart than the page's** at that zoom (its field's own `line-height: 1.5`, the page's
  1.4): the pixels showed it, the lines' spacing is measured since. Now the page's line.
- **The pixels**: first compared pixel by pixel, then by blocks, both told crops alike to the eye apart (10 to 90 %:
  text a pixel over, smoothed otherwise). Now as Playwright's comparison (pixelmatch's) tells them: the crops laid
  over each other where they match best within 3 px, a pixel differing only where none within one of it in the other
  has ink near its own; with the browser's text on whole pixels (`--disable-font-subpixel-positioning` and others,
  `test.use`). Alike crops differ in 0 to 2 % (a table narrower in the peek); a known difference shows (2.12.1's box
  3 px lower at the zoom: 12 %). Past 5 % a block is a **warning**: the test passes, the run tells it
  (`scripts/ui-tests-summary.ts`: GitHub's yellow warning on the run and the pull request, the job summary's
  *Warnings*; a yellow line in the console locally).

### More blocks (decided with the user 2026-11-18)

What Silverware Editor 1.1.0 draws as the page does (code blocks, rules, quotes, highlights) and what Silverware Assets
draws on every surface had no comparison; added to the fixture, measured where a property tells it, cropped where the
shape does:

| Block | Measured (fails) | Cropped (warns) |
| --- | --- | --- |
| Headings 1 to 3 | font size, weight, colour; the space under each | no |
| Inline: bold, italic, code, `==highlight==`, a link | each word's weight, style, font, colour, ground, line | no |
| A quote (two lines) | where its text starts, its colour, its lines' spacing | yes (its bar) |
| A fenced code block (`csharp`) | where its text starts, its font, its ground, a keyword's weight, a string's colour, its lines' spacing | yes (the card, the colours) |
| `---` | the space between the lines above and under it | no (its line in no crop: one pixel) |
| Files (Silverware Assets): an image's preview and card, a link to it | a preview's size, corners, shadow; a card's height, corners, line, its icon's size; a link's icon's size | yes, all three in one |

A full image is left out (the image at the text's width, `assets.spec.ts` measures it); a PDF later, a test of its
own (pdf.js draws late, its pixels would only tell noise), DOCX and XLSX in their own plugins' tests. A run: about 18 s
per SilverBullet (9 s before), the window as tall as the markdown (the page's editor draws only the lines in view).

### Known differences (2026-11-18), to mend

Found by the blocks above on 2.12.1 and edge; each a measurement left out for its surfaces (`KNOWN` in the spec, its
reason beside it), taken out as it is mended. Decided with the user: the test first, then the mending plugin by
plugin; a grid's rendered cell stays SilverBullet's rendering (not Silverware Editor read-only: it would lose what only
SilverBullet renders, `${…}`, queries, code widgets, and add an editor per cell).

| Plugin | Surfaces | What differs |
| --- | --- | --- |
| Silverware Editor | grid edited, peek | ~~a strong text's weight, code's font, inline code's ground, a code block's inset, headings' sizes, the space round headings~~ (read from the page, docs/silverware-look-fixes.md, 2026-11-18); a rule's line 1 px on edge (its editor's, not its rules': the field keeps 2.12.1's) |
| Silverware Assets | grid, grid edited, peek, peek edited | ~~a preview 6 px higher; in a field a preview not zoomed with the text, a link's icon in the text's colour~~ (2026-11-18, docs/silverware-look-fixes.md) |
| Silverware Layout | grid | ~~headings' colour; a quote's colour, ground and indent; code's font and inset, no highlighting; bold; the space round headings~~ (2026-11-18, docs/silverware-look-fixes.md); a rule's line 1 px on edge, as in the fields |

Silverware Editor's are read from the page as its look already is (`shared/editorlook.ts`, `EditorLook`): what differs
between SilverBullet's versions is the page's to tell, not a number of ours.

### Steps

1. The fixture and the five surfaces opened from it, each block found on each (a test that only finds them).
2. The measurements of lists and tasks (what `grid.spec.ts`' *lists drawn and in its field alike* does for two
   surfaces), then tables, hashtags, links, quotes and code; that test and *a cell's field draws a task's box…* moved
   into it or left as they are (decided then: no test twice).
3. Pixel crops attached, informative (`test.info().attach`), compared with a tolerance, no failure.
4. After a few weeks of green runs on both SilverBullets, pixel differences failing the test. Until then a warning
   past 5 % (built 2026-11-17).

### Cost

About a day for steps 1 and 2, half a day for 3. A run: five surfaces of one page, about 10 s per SilverBullet.

## Context for whoever builds it

Read first: the root `CLAUDE.md` (*Working rules*: interaction tests run in parallel, no pause nor retry of a test's
own, a lock only with the user's permission; *Commands*), `silverware-editor/CLAUDE.md` (the field, its look),
`silverware-layout/CLAUDE.md` (*Grids*, *What a cell renders looks as the theme draws the page*),
`silverware-database/CLAUDE.md` (*The peek's content field*), docs/silverware-sb-edge.md (what differs on edge).

**Decided with the user (2026-11-17)**: surfaces against each other first, the page the reference; separate runs for
the release and edge (as every UI test: `npm run test:ui:sb`, `npm run test:ui:sb:edge`); few tests; pixels
informative until steady; stored screenshots (kind 2) only after the user approves them, for the release alone.

**Where the tests' helpers are**: no plugin's `ui-tests/` imports another's; each has its own `helpers.ts`.
Silverware Editor has no `ui-tests/` yet: the new folder gets a `helpers.ts` of its own, made as
`silverware-layout/ui-tests/helpers.ts` is (its `test` fixture with `space.open(pages, open, files)`: pages written
into the worker's space under a folder of the test, the page opened, `loaded(page)` and `watchReloads(page)` of
`scripts/silverbullet-loaded.ts` waited for, CONFIG put back after; `silverbulletServer`, `configFile` of
`scripts/silverbullet-servers.ts`). Take over what it needs, no import across plugins:

- a grid drawn: Layout's `gridsDrawn(page)` (SilverBullet's custom syntax becomes active a moment after the page
  loads: the page loaded again until the grid stays)
- a grid's cell edited: a click on its text in `#sb-main .swl-grid-cell`, the field `#sb-main .swl-grid-editor`
  (Layout's `cellField`), Silverware Editor's CodeMirror in its `shadowRoot` (`.cm-content`, its state
  `cmTile.view.state`: Layout's `fieldState`)
- a database: its root page `<page>/db-<id>` and items under it (Database's `root(id, name)`, `item(status, rank)`;
  `TASKS` in `silverware-database/ui-tests/database.spec.ts` is an example), shown by a block
  ```` ```silverware-database ```` with `id:` and `view: list`
- its peek: a click on the item's name (`.swd-list-name`); the field `.swd-peek .swd-peek-body`, read only until its
  content is read (Database's `fieldReady`). Silverware Editor is loaded when the browser is idle: a peek opened
  before has a plain `<textarea>`; Database's tests close and open it again until `.cm-content` shows
  (`expect(…).toPass`, see *in the peek's editor an item's images are drawn…*)
- the peek edited: a click in its field, the caret then put on a line outside every block (the fixture's last line)
- an image file beside the pages: `space.open`'s third argument (Layout's `PIXEL_PNG`)

**Reading a surface**: the page is SilverBullet's (`#sb-main .cm-content .cm-line`, a table `.sb-table-widget`),
its classes differ between the release and edge (edge's lines `sb-line-li`, `cm-list-bullet`, `sb-list-mark-slot`):
find a block by its text and measure by text ranges (`document.createRange()` on the text node, `getClientRects`) and
computed styles, never by SilverBullet's class names alone. A field's nodes are in its shadow root (a `TreeWalker`
on `root.shadowRoot`). `silverware-layout/ui-tests/grid.spec.ts`' *a cell's lists drawn and in its field alike* does
this for two surfaces: start from it.

**Known differences of the environments**: the release in the test servers draws in a monospace font (a number's
"1." and its space wider than its room), edge in a proportional one; edge draws tables as a card (`--ui-radius-xl`), the release
not; sizes in em round differently by surface (13.33 against 13.31 px). The test servers start at port 3010
(`SW_SB_FIRST_PORT=3050` where a SilverBullet of your own is there).

**Running**: `npm run test:ui:sb -- silverware-editor/ui-tests/look` and the same with `:edge`; both before a
commit, and `npm run verify` (run from `D:\` on this machine: vitest finds no tests from `d:\`). A test that fails
beside others is a race: `--repeat-each 10` brings it out.

## Open

- Whether the page itself is the reference for a grid's rendered cell where SilverBullet's own rendering (a widget's)
  differs from its editor's live preview: decided 2026-11-17 for lists (the editor's), to be confirmed per block.
- Files' previews: drawn by Silverware Assets on every surface already (`assets.spec.ts`); in the fixture only if the
  run has the viewers (PDF, DOCX, XLSX), else left out.
