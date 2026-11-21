# Silverware Table: drawing tables ourselves (an idea, measured)

Status (2026-11-22): an idea with a prototype of SilverBullet's side, measured; nothing of Silverware Table built.
Whether it goes on depends on SilverBullet's maintainers taking a hook for it (*Next*).

## Why

Silverware Table decorates the tables SilverBullet draws. After every edit SilverBullet draws the whole table anew
(`client/codemirror/syntax/table.ts`: its widget is compared by the table's text), from markdown, every row; the
core then finds the new table again in the page's text (`data-pos`, its shape), enhances it, and largeTables takes the
rows out of view. Drawing the table ourselves would mean:

- **Virtualization done right**: only the rows in view ever built, not built and taken out again.
- **An edit as a change in place**: a write updates the cells it changed; the table, its selection, menus, cell editor
  and scroll stay. Most UI bugs were in surviving a table drawn anew (silverware-table/CLAUDE.md, *Gotchas*).
- **No pairing with SilverBullet's DOM**: the table drawn from the model, no `data-pos` (which may be stale), no
  finding a rendered table by its shape, no SilverBullet DOM assumptions in `dom.ts` for tables.

## Where a save's time goes (measured 2026-11-21)

A 2000-row table, largeTables on, a box of 600 px, a cell saved (Silverware Table 1.4.0's code):

- **Playground**: about 250 ms, of which about 50 ms layout, style and paint. The host drawing the whole table about
  110 ms plus 27 ms parsing its HTML (the playground's stand-in for SilverBullet's renderer); Silverware Table's
  enhancing about 75 ms (`applyView` over every row, also those out of the document); the write itself 15 to 20 ms.
- **SilverBullet without Silverware Table** (the fork with silverbulletmd/silverbullet#2257, a 2000-row table capped
  by a space style): a cell changed in the page's text shown after about 245 ms, the table drawn whole (22,126
  elements in the page).

## The prototype (SilverBullet's side)

Fork branch `damesene/silverbullet:proto/block-renderer` (on the fix of #2257), not proposed upstream:

- `syntax.renderBlock("Table", { render, update, destroy })` (Space Lua, kept in the configuration as
  `syntax.define` keeps its extensions): a space's renderer of a built-in block, drawn where the cursor is not in it.
- A generic `blockRendererPlugin` (`client/codemirror/widgets/block_renderer.ts`) hides the block's source and puts
  the renderer's element in its place; a changed source calls `update` with the element drawn before (CodeMirror's
  `updateDOM`), which keeps it; `render` draws it anew where `update` cannot. SilverBullet's table plugin leaves a
  table with a renderer alone.
- What stays SilverBullet's: the source shown where the cursor is in the table, static HTML (export), query results'
  tables, read-only mode.

Measured with a minimal renderer in JS (a box of 600 px, only the rows in view, changed rows patched) on the same
2000-row table: a cell changed in the page's text shown after 126 to 150 ms (245 ms with SilverBullet's table),
2,604 elements in the page, the element kept (`update`), the arrow keys entering and leaving the table's source as
with SilverBullet's table. The rest of those 126 to 150 ms is SilverBullet's own work on any change of the page
(decorations walking the whole syntax tree, incremental parsing, indexing), not the renderer's.

## Open

- **SilverBullet's maintainers**: a hook for built-in blocks is a design change of theirs; an issue with these numbers
  first, after #2257 (the hidden source lines) is decided.
- **A cell's content**: links, hashtags, images, tasks and `${…}` in cells are SilverBullet's rendering today; drawn by
  us, each cell's inline markdown through SilverBullet's renderer (only the rows in view, kept by the cell's text),
  and links followed as `shared/links.ts` follows them. Tasks and live expressions in cells to be checked.
- **SilverBullet without the hook** (2.12.1 and any release before it): the decorating kept as a second path (code
  kept for the old versions, as docs/silverware-sb-edge.md marks such code) or the renderer required; to decide.
- **Virtualizing against the page's scroll** (no box): rejected for decorating (estimated heights moved the page);
  as the renderer we would give the table's height (measured rows kept by their text, the others estimated), with a
  risk of small jumps where rows wrap. A box first.
- What largeTables, sticky, longText and the adapter become with tables drawn by us.

## Next

1. silverbulletmd/silverbullet#2257 merged or answered.
2. An issue in SilverBullet proposing the hook, with the numbers above.
3. Only then a plan of Silverware Table's side, ordered by the code (a minimal renderer measured before the rest).
