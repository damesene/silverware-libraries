# Silverware Layout: where the page's text stands

Decided with the user 2026-11-22. The page's text (the editor's column) stands centred in its pane, as SilverBullet has it, or at the pane's left. A side panel of ours (Silverware Assets' file panel, Silverware Database's peek) lies over the right of the page: with the text at the left, what is under it is seen beside it.

## Decided

- **A setting of Layout's, the text's alignment**, beside the text's width and alike: all pages' (`silverware.layout.textAlign`), a page's own (`_layout.align` in its frontmatter), the page's own first, else all pages', else centred. Three values:

  | Value | In the dialog | What it does |
  | --- | --- | --- |
  | `center` (the default) | Centred | as now |
  | `left` | Left | the text at the pane's left, always |
  | `left-with-panel` | Left while a panel is open | centred; at the left while a side panel is open, centred again as it closes |

  Only `left-with-panel` follows a panel: with `center` or `left`, a panel opened or closed changes nothing.
- **Nothing is narrowed**: the text keeps its width, a widget its own; a panel lies over the page as before. Only where the text stands changes.
- **A panel open is told by a mark on its element** (`shared/sidepanel.ts`, `data-silverware-side-panel`, beside the `data-silverware-over-window` it has already): Silverware Assets' side panel and Silverware Database's peek carry it. Layout watches whether one is in the page (`watchSidePanel`, the watcher `overwindow.ts` stands on too: `shared/watchmark.ts`); no plugin knows another. Decided over a room at the window's right (`shared/room.ts`' variable, planned first): a variable holds one value, and two panels open at once (a file's and an item's) would take it back as the first closed.
- **Moved, not jumped**: SilverBullet centres the text by `margin: auto`, which no transition moves. Layout gives the content an explicit left margin instead (`--swl-text-margin`: centred, half of what its box leaves beside it, measured as it is placed; `0` at the left), eased out over a short time (0.24 s, quick off and long to settle: the user found 0.15 s of `ease` too even, 2026-11-22) as the alignment changes, never as the window is resized.
- **The page's title and the notifications go with the text**: SilverBullet places both by the text's width, centred; with the text at the left, they are at its left too. The host marks them (the style page names no SilverBullet element).
- **A wide widget with the text at the left**: a widget wider than the text grows from the text's left edge to the right alone, whatever its alignment would do centred (a centred one would grow past the pane's left edge). Nothing is written: back in the middle, it is centred again. The widgets' rules read the text's left margin from a variable of Layout's instead of taking the text as centred.
- **The dialog**: the tab Page width becomes **Page** (there is a tab Alignment already, the widgets'), a section Alignment under the width, All pages and This page, each a pick list: All pages' first choice *Centred (default)*, This page's *Same as all pages (…)* naming what that is.
- A narrow pane (a phone, under `minPaneWidth`): no alignment, the text the pane's width as now.

## Steps

1. The model and the core: the setting, `_layout.align` read and written (through the page writer, as the width), which alignment applies.
2. `shared/sidepanel.ts` (and `shared/watchmark.ts` under it and `overwindow.ts`): Silverware Assets' side panel and Silverware Database's peek marked.
3. The host: the text's left margin and its move, the title and the notifications, a panel watched where the alignment follows it.
4. The widgets' rules with the text at the left.
5. The dialog: the tab Page, the row Alignment.
6. Tests (unit; UI in SilverBullet: a page's own and all pages', a panel opened and closed, a wide grid and its handle dragged with the text at the left), the library pages, releases (Layout, Assets, Database), the user's check.

Steps 1 to 6 done 2026-11-22 but the releases and the user's check. The UI tests open a side panel as an element marked so (the contract), not through Silverware Assets or Database, whose own tests do not run Layout.
