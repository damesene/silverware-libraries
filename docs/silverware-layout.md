# Silverware Layout: plan

Proposed 2026-11-11, nothing built. A new plugin for a page's layout, starting with widths: the width of a page's text, and the width of each widget (a table, a database, a chart; images later) on its own, wider or narrower than the text, as Confluence's tables are. Prefix `swl-`, settings and API under `silverware.layout`.

**Responsibilities**: a widget's plugin draws the widget; Silverware Layout lays the page out, widgets' boxes included. A widget's plugin keeps Silverware Layout's entries for it in its own markdown without understanding them, and tells Silverware Layout how its widgets are found. Without Silverware Layout installed nothing of the layout shows: widgets are as wide as the text, the stored entries stay unused.

## What it does (first version)

- **A widget's width**: a handle at the widget's right edge (shown on hover, as Confluence's bar beside a table). **A widget is always centred on the text column**, wider or narrower than the text: dragging the right edge by `d` changes the width by `2d`.
- **What is stored is the width wanted**, shown as much of it as there is room for: `min(width, the editor pane)`. The widget has that width and its content fills it (a chart drawn larger, a table's columns wider in proportion); in a narrower window (a phone) it is as wide as the pane, its content scaled down the same way. Nothing is written when the window changes.
- **Guides** (as Confluence's): the text's width (no width stored) and the user's own widths (by default 900 px, 1200 px and *Full width*, the pane less 40 px, stored as `full`). A drag snaps to each within a few pixels, so several tables on a page are easily made alike. **The guides are a setting** (`silverware.layout.guides`), as many as the user wants, edited in the dialog's Guides tab. A guide is a shortcut to a width: what is stored is the width, so changing a guide later changes no widget. (Named presets until 2026-11-12, then guides: see *Steps*.)
- **Reset**: a double-click on the handle, or *Text width*, takes the stored width off: the widget follows the text again.
- **Live while dragging, written once**: every frame of a drag is only shown; the width is written on release, one edit, one undo step (writing during the drag would make SilverBullet render the widget anew under the pointer). A change with no release (arrow keys on the focused handle) is written after a short pause (debounce, ~400 ms), the last value only. The Page layout dialog shows what is set at once and writes on Save (built 2026-11-12: a dialog's Save, as the plugins' settings, rather than a write per number typed).
- **A page's text width**: set in the Page layout dialog (command `Silverware Layout: Page layout`), not by dragging in the editor: *Default* or a width of its own, set by a slider marked with the guides or typed, a number with a unit switch (two joined buttons, `px` by default or `%` of the pane, as radio buttons). Stored in the page's frontmatter. Save writes, Cancel puts the page back without asking; Esc, × or a press beside it ask where changes would be lost.
- **The default text width** for pages without their own: a setting (`silverware.layout.textWidth`, px or %), shown in the same dialog. Empty: the theme's own (`--editor-width`, 800 px in SilverBullet's theme, or what the user's Space Style sets).
- **Off on a narrow screen**: where the editor's pane is narrower than a setting (`silverware.layout.minPaneWidth`, by default 600 px, SilverBullet's own breakpoint for phones), Silverware Layout lays nothing out: every widget is as wide as the text (a widget set narrower than the text too), the page's own text width is not applied, no handle shows. What is stored stays and applies again on a wider screen (a phone turned, a window widened); the pane is watched (`ResizeObserver`), nothing is written.

## Where things are stored

- **A widget's layout is kept by the widget's plugin, not understood by it.** Silverware Layout hands over a flat map of its own keys and their values as text (`width: "1100"`); the plugin owning the widget stores each key as it is, apart from its own under the name `layout`, in its own form, and gives the map back as stored:
  - Silverware Table: its table metadata, owner `layout` (`layout.width`, the core's metadata names as for any owner);
  - Silverware Chart: a comment, `%% layout.width: 1100`;
  - Silverware Database: a line of its block, `layout.width: 1100`;
  - images later: decided then (SilverBullet's own image syntax may hold a width).
- Silverware Layout never reads or writes a widget's text.
- **A page's layout is in its frontmatter**, one key holding a map, written through the page writer (`shared/pages/`):

  ```yaml
  _layout:
    width: 1100
  ```

  Not `layout:`: pages from static site generators (Jekyll, Hugo) use `layout: post`. `_layout` follows `_database`.

## The contract between Silverware Layout and a widget's plugin

Silverware Layout knows no widget by name or format. A plugin offering widgets registers a **layout provider** through Silverware Layout's public API, as Silverware Toolbar and Silverware Database take Silverware Icons' (`silverware.layout.api` set on the API page, priority 50; each widget plugin's init page hands `silverware.layout and silverware.layout.api` to its JS; `nil` where Silverware Layout is not installed: nothing registered, nothing else changes).

In `shared/layout.ts` (written 2026-11-11, reviewed against `shared/icons.ts`), in short:

```ts
/** Silverware Layout's keys (`width`) and values, as text whose meaning is Silverware Layout's */
type LayoutEntries = Readonly<Record<string, string>>;
/** Entries changed in one write; null takes a key off (reset) */
type LayoutChanges = Readonly<Record<string, string | null>>;

type LayoutProvider = {
  readonly name: string; // who it is: registered again under it, it replaces the one before
  readonly selector: string; // its widgets' own outer elements as rendered (`.sb-table-widget`)
  read(element: Element): LayoutEntries; // synchronous, {} where none
  write(element: Element, changes: LayoutChanges): Promise<string | undefined>; // one edit; why not, as text
  seen?(element: Element): { top: number; bottom: number } | undefined; // optional: what is seen of it, not its box
};

/** silverware.layout.api, or the stand-in without it */
type Layout = {
  readonly version: number;
  register(provider: LayoutProvider): () => void;
};

/** The API as the init page hands it over, where it is there and of LAYOUT_VERSION; else a stand-in laying nothing out */
function layoutOf(given: unknown): Layout;
```

- As `shared/icons.ts` for Silverware Icons: the version this file is written for (`LAYOUT_VERSION`) and `layoutOf`, which takes what the init page handed over and gives the API, or a stand-in whose `register` does nothing. A widget's plugin calls it once, registers its provider, and never asks whether Silverware Layout is there. Silverware Layout's API object is made with the same `LAYOUT_VERSION`. Its comments carry the rules a provider keeps (the box's width is Silverware Layout's in the page's flow, `data-silverware-over-window` out of it).
- **Keys are bare in the API** (`width`); a provider keeps them apart from its own under the name `layout`, in its own form: Silverware Table as the metadata owner `layout` (its core makes `layout.width`), Silverware Chart `%% layout.width: 1100`, Silverware Database `layout.width: 1100`. A key with the prefix in the API would be stored `layout.layout.width` by Silverware Table's metadata names, or taken apart by it, which is understanding it.
- **Values are text**: a table's metadata, a comment, a block's line all keep text, so a number would come back as text from one and a number from another. Silverware Layout reads its values itself (`1100`, `full`, later `16:9`).
- **The name is the provider's identity**: Space Lua loaded again runs the widget plugins' init pages again, while Silverware Layout's API is the same object (`js.importFromSpace` gives the same module): a provider registered under a name already there replaces it, so nothing is registered twice.
- **No `shape` yet**: every widget now is a block. It comes, optional and `block` by default, with the first widget laid out another way (an image), changing no provider written before.
- The keys and their values are Silverware Layout's vocabulary alone (`width` now; `aspect` of a chart or an image later), so a new key needs no change in any widget plugin.
- **`read` is synchronous**: the plugin has the widget's source parsed as it renders it (Silverware Table's cached `parseTable`, a code widget's block text), so Silverware Layout can lay the widget out before the browser paints it.
- **The provider writes through its own pipeline**: Silverware Table's `write` (one `replaceRange`; with the metadata setting off it writes nothing and says why, and the width holds for the view only), Silverware Database's place state, Silverware Chart's format.
- Built-in providers of Silverware Layout itself (images, later) implement the same interface.

## How a width is shown

- **Silverware Layout alone shows it.** A `MutationObserver` on the editor's content (`.cm-content`) sees each element a provider's selector matches as SilverBullet renders it (anew after every edit of it); its callback runs before the browser paints, so the widget is shown once at its width, never first at the text's (probe 3: not one frame at the text's width).
- What is styled is **the element the provider's selector matches**, the widget's own outer element (`.sb-table-widget`, `.swc-widget`): `data-swl-width` and `--swl-width` on it, `width: min(var(--swl-width), 100cqw - 40px)`, centred by negative margins, passing its line where it is wider (the rule as probe 1 tried it, below). Never CodeMirror's line holding it: CodeMirror keeps a line's attributes as its decorations say and takes off any other at its next update of the line (probe 3). The pane's width is CSS's (`100cqw` of SilverBullet's `#sb-editor` container), not measured.
- So **while a widget is in the page's flow, its element's width is Silverware Layout's**: the provider does not set its `width`, `max-width` or margins, nor replace its `style` attribute whole (Silverware Layout's variable is in it). Part of the contract. What the widget lays out inside its box stays its own (Silverware Table sets its `<table>`'s and `<col>`s' widths, a table wider than its box scrolling in it, its `max-height` and CSS variables on the widget: none of them a width of the box).
- **Out of the page's flow, Silverware Layout stands back.** A plugin showing a widget over the window marks it with the shared `data-silverware-over-window` (`shared/overwindow.ts`), already done: Silverware Table's and Silverware Database's full screen mark the widget itself, Silverware Table's sheet view marks its board and moves the tables into it (setting their `left`, `top`, `width` on the grid). Silverware Layout's rule applies only to a widget in `.cm-content` neither marked nor in a marked element (`:not([data-silverware-over-window], [data-silverware-over-window] *)`), whichever comes first, its mark or the plugin's; its handle is not shown there either. A plugin taking a widget out of the flow some new way marks it the same.
- A drag sets the same variable, so a frame of a drag is what will be stored.
- The widget's content follows its box by itself: Silverware Table's column widths are stored as pixels of the box the table had (`widths.box`, docs/silverware-table-column-resize.md, *Later: the table's room*), a wider box widens the columns in proportion; Chart.js redraws to its container's width.

## Later: a widget's height

A chart's or an image's height is kept as an **aspect ratio** (`layout.aspect`), never in pixels: on a phone the widget is narrower and its height follows, so nothing is cut or stretched. A table's or a database's height is its content's.

## Layers (silverware-layout/src/)

As the other plugins, checked by an isolation test:

- `model/`: the entries' keys and values, guides.
- `domain/`: pure: the width a drag gives (the shown width is CSS's), snapping to the guides and the text width, the debounce of a value.
- `core/`: the provider registry, the handle and its drag (`shared/drag.ts`), the dialog (`shared/dialog.ts`), which widget is hovered. Knows no provider.
- `host/silverbullet/`: the binding: the observer of the editor's content, whether the pane is narrower than `minPaneWidth` (a `ResizeObserver`: a container query's size cannot be a setting), the page's frontmatter (through `shared/pages/`), `--editor-width` for the page open, events (`editor:pageLoaded`, `editor:pageModified`).
- Pages: `silverware-layout.md` (user docs), `-init.md` (settings, commands), `-api.md` (priority 50, `silverware.layout.api`), `-style.md`.

## The page's text width

- **How SilverBullet uses `--editor-width`** (its source, main, 2026-11-11): declared on `:root` (theme.scss, 800 px); read by `.cm-content` (`max-width`, the text), the top bar's `.main .inner` (top.scss, so the page's name lines up with the text), `.sb-notifications` (placed over the text column), Vim's bottom panel, and the top bar's margins in a window without a title bar. `--sb-editor-pane-width` (set on the root by `top_bar.tsx` in some modes, empty in the probes) is not used: the pane's width is `100cqw` (probe 1). The editor column is a container (`sb-editor-col`) whose query for headings' markers is fixed at 800 px ("query sizes cannot use vars").
- **Decided by probe 2**: the variable is set on the root as an inline style, important: `document.documentElement.style.setProperty("--editor-width", "1100px", "important")`, and taken off (`removeProperty`) on a page without a width of its own or a default. Where all of SilverBullet reads it (the top bar and the notifications are outside `#sb-main`), and an inline important declaration wins over any stylesheet's, a theme's or Space Style's `!important` included: a page's own width wins over the user's default, as it should. Nothing of SilverBullet's beyond the variable it declares for themes. Not a rule of our own on `.cm-content` and the top bar: more of SilverBullet's selectors, the notifications and Vim's panel left behind.
- The default setting of Silverware Layout, where empty, leaves the theme's or the user's value alone (no inline style at all).
- Read from the page's meta (`editor.getCurrentPageMeta()._layout.width`) on `editor:pageLoaded` and when Space Lua loads (the page open then), and again when the frontmatter changes (a width typed by hand applies at once); written from the dialog only.
- A widget without a width follows the text, so a wider page widens its widgets too.

## Interplay with what exists

- **The table's last-column handle** makes the table wider than its box (it scrolls sideways). Silverware Layout's handle sits outside the widget's box (in the gutter, as in Confluence), the table's on the table's edge: one widens the room, the other the table inside it. To be tried in the playground before deciding.
- **Silverware Table, Database and Chart** each get a provider: a selector, `read`, `write`, the `layout.*` entries kept in their markdown. Nothing else of theirs changes.
- **Silverware Toolbar**: no change (it may later offer *Page layout…* as an action).

## Probes before building

1. ~~A block widget wider than `.cm-content`~~: done, it works (*Probe 1: done* below).
2. ~~How to set the text width~~: done (*Probe 2: done* below). Its checks become the plugin's first UI test once the plugin exists (a Playwright spec against SilverBullet: unit tests see no layout).
3. ~~A widget styled in a `MutationObserver` callback as SilverBullet renders it anew~~: done, it works (*Probe 3: done* below).
4. ~~A frontmatter key `_layout` with a map~~: done, no problem (*Probes 4 and 5: done* below).
5. ~~Whether a Space Style block is active before Space Lua loads~~: done, it is not (*Probes 4 and 5: done* below).

## Probe 1: done (2026-11-11, SilverBullet 2.12.1, Chromium)

A page with text, a table (Silverware Table), a chart (Silverware Chart's code widget), 30 more paragraphs and a table far down; each check run without the style and with it, at panes 1600, 1000 and 700 px wide, and compared. The style, injected on the widget's block (probe 3 moved it to the widget's own element):

```css
.cm-content > <the widget's block> {
  --w: min(1200px, 100cqw - 40px);
  width: var(--w);
  max-width: none;
  margin-left: calc((100% - var(--w)) / 2);
  margin-right: calc((100% - var(--w)) / 2);
  box-sizing: border-box;
}
```

**It works, with nothing but that CSS.**

- **The widget's block** is the child of `.cm-content` holding the widget: a table's widget is that child itself (`.sb-table-widget`), a code widget sits in a line of its own (`div.cm-line.sb-fenced-code-iframe` › `.sb-lua-wrapper` › the widget). Probe 1 styled the block; probe 3 found the widget's own element is the one to style.
- **The pane's width needs no measuring**: `#sb-editor` is a size container (`container-type: inline-size; container-name: sb-editor-col`, SilverBullet's main.scss, since 2.11), so `100cqw` in the page is the editor pane's width, followed live as the window or a side panel changes, by CSS alone. `--sb-editor-pane-width` is not set in this mode (empty), so it is no use.
- Widths: at 1600 px the table and the chart are 1200 px, centred on the text column (text 800 px); at 1000 and 1300 px they are the pane less 40 px; at 620 px 580 px. 400 px: centred exactly (the table's centre is the text's). No sideways scroll of the page or of `.cm-scroller` at any width.
- **CodeMirror is not disturbed**: a click in the text above and below a table and above a chart puts the cursor where it does without the style; ArrowDown across a table gives the same lines; a shift+click selection from above a table to below it is the same; CodeMirror's height map matches the DOM exactly (0 px off at five lines through the page after jumping to its end and back).
- **The widened part is used as the rest**: a click on a cell left of the text column (outside `.cm-content`'s box) and on one right of it selects the cell, the cursor not moved, no markdown shown; Silverware Table's grips and toolbar sit at the widened table's edges; Silverware Table's columns and Chart.js follow the wider box by themselves.
- Seen on the way, not Silverware Layout's: a press 12 px above a table's header, over the line of text above it, on a column border inserts a column, without the style too (Silverware Table's column + sits there). Widening a table moves its borders, so the places such a press hits move.
- A chart keeps its height (300 px): a wider chart is wider, not taller. Its aspect is a later key (*Later: a widget's height*).

Probe 3 changed where the style goes: on the widget's own element, not its block (*Probe 3: done*). The fallback where `#sb-editor` were no container any more: `cqw` then measures the small viewport, so a widget would pass a pane narrowed by a side panel; a `ResizeObserver` setting the pane's width as a variable would replace it.

## Probe 3: done (2026-11-11, SilverBullet 2.12.1, Chromium)

Probe 1's page and rule. A script in the page did what Silverware Layout would: marked each widget's element, or its block, and every frame (`requestAnimationFrame`, before paint) checked each widget shown: marked, and 1200 px wide. Seven steps, each run in every variant: a letter typed in the paragraph above the table (its edit taking in the table's first line), the table's text edited, a cell written by Silverware Table (click, type, Enter), the chart's data edited, the cursor into the chart and out, the page scrolled to its end and back, the window resized. About 600 frames each.

- **Marked once, nothing keeps the mark**: after any step the widgets were shown at the text's width (some 70 to 110 frames per step), whatever the mark (a class, a `data-` attribute, an inline style).
- **Marked by a `MutationObserver` on `.cm-content`**: **not one frame** at the text's width, in all three forms, both widgets, every step. The observer's callback runs before the frame is painted. Silverware Table's own observer and write pipeline undisturbed (the cell was written).
- **Why the mark goes**: a widget rendered anew is a new element (a table after any edit of its text, a chart after an edit of its block, either after the cursor was in it, or after it was scrolled out of CodeMirror's viewport and back). And a **code widget's block is CodeMirror's `cm-line`**: the same element after an edit elsewhere on the page, but CodeMirror took our class, attribute and style off it, as it updates a line's attributes from its decorations. A table's widget is the block itself, CodeMirror's widget DOM, which it leaves alone.
- **So the style goes on the widget's own element** (what the provider's selector matches), not the line: the chart's `.swc-widget` 1200 px wide inside its line of 760 px, centred, the line's height in CodeMirror's height map right (302 px), no sideways scroll; a click on the chart left and right of the text column keeps the chart shown (no markdown), its menu at its corner; a click below it puts the cursor on the next line. Marked by the observer: not one frame at the text's width, and **marked again only where the widget was rendered anew** (8 times in the seven steps, against 33 on the block: no tug with CodeMirror). Marked once: the chart's mark kept through the edits elsewhere.
- Nothing loops: the observer's callbacks stop when the page is still (39 over the run).

## Probe 2: done (2026-11-11, SilverBullet 2.12.1, Chromium)

Two pages, `Wide` (`_layout: { width: 1100 }` in its frontmatter) and `Plain` (none), linked to each other; a `space-lua` block listening to `editor:pageLoaded` (and run as Space Lua loads) read `editor.getCurrentPageMeta()._layout.width` and set the width through a JS module of the space, as Silverware Layout would. Three ways of setting it: inline on the root, inline on the root as important, a stylesheet of our own appended last (`html:root { --editor-width: … !important }`). Three themes: SilverBullet's default (800 px), the user's own theme (`html { --editor-width: 97% }`, no `!important`; its fonts and sizes too), and SilverBullet's Space Style docs' example (`html { --editor-width: 1400px !important }`). Pane 1600 px. Every frame (`requestAnimationFrame`) recorded which page was shown and the text's width.

- **Who wins**: inline important and the stylesheet won against all three themes. Plain inline lost against the `!important` example (the text stayed 1400 px), won against the others. Chosen: **inline important**, which no stylesheet's declaration beats, where ours relies on specificity (`html:root`).
- **A page without a width keeps the theme's**: `Plain` was 800 px by default, **97% (1537 px) with the user's theme**, 1400 px with the example: nothing set, nothing overridden. A percentage is a width SilverBullet takes, so a page's or the default's width may be one too (decided).
- **What follows the variable**: the text (`.cm-content`), the top bar's page name (`#sb-top .main .inner`, same width and left edge as the text), the notifications (placed over the text column: left 270 px for 1100 px text). Vim's panel and the top bar in a window without a title bar read the same variable (SilverBullet's source), not measured. The headings' container query (800 px) is on the editor pane's width, not the text's: unaffected.
- **Changing pages**: `editor:pageLoaded` is dispatched after the editor shows the new page (`content_manager.ts`: `setState`, then the event, not awaited), and Space Lua's listener still set the width **before the next frame was painted** (about 5 ms ahead): not one frame of the old width, every theme, every way, both directions. With the CPU slowed 4× and 6×: **one frame** (16 ms) of the old width per change, the width set 6 to 32 ms after the page showed. Acceptable.
- **Opening the app** (a load or reload of the window): the page shows about 1.3 s (79 of 150 frames) at the theme's width before Space Lua has loaded and set it, then takes its own. The same wait every Silverware plugin has before it starts (Silverware Table's tables are enhanced only then). Not avoidable from a plugin: SilverBullet puts no page name in the DOM (only `data-theme` and `data-markdown-syntax-rendering` on the root), so no CSS of ours can know the page before our code runs. Found after: SilverBullet does put a page's `pageDecoration.cssClasses` (frontmatter) on `<body>`, in `refreshCurrentPageMeta`, before the page's text is shown (`content_manager.ts`), so CSS could know a page by a class of its own, if that CSS is active before Space Lua (*Open*).
- Probe 4 in part: `editor.getCurrentPageMeta()` gives the frontmatter's `_layout` map as written (`width` a number).

## Probes 4 and 5: done (2026-11-11, SilverBullet 2.12.1, Chromium)

**Probe 4, the `_layout` key.** `Wide`'s frontmatter `_layout: { width: 1100 }`:

- The index has it: `query[[from index.tag "page" where name == "Wide"]][1]._layout.width` is `1100`, `_layout` a table, `where _layout` finds the page. `editor.getCurrentPageMeta()._layout.width` too (probe 2).
- No warning: the editor's linter, run by an edit of the page, marks nothing on `Wide`; on a control page with broken YAML (`broken: [1, 2`) it marks an error (`cm-lintPoint-error`), so it ran. SilverBullet has no schema for pages; a tag's schema of the user's that forbids other keys (`additionalProperties = false`) would refuse `_layout` as any other key (as `_database`), not ours to change.

**Probe 5, CSS before Space Lua on opening the app.** A Space Style block (`html { --probe-style-loaded: 1 }` and `body.swl-probe-wide { --editor-width: 1100px !important }`), `Wide` with `pageDecoration: { cssClasses: [swl-probe-wide] }`, Space Lua setting nothing (only recording when it ran). The app opened on `Wide`, three times, each frame recorded:

- The page shows at about 165 ms, **Space Lua runs at about 1,470 ms, Space Style is active at about 1,490 ms**: after Space Lua, not before. So no CSS of a plugin's (a Space Style block) shows anything earlier than its Space Lua does: the default text width as CSS would gain nothing.
- `pageDecoration.cssClasses` was not on `<body>` after opening (the page's meta as first loaded has no decoration yet); following a link to `Wide` it was, and the CSS gave 1100 px from the first frame, as Space Lua's listener does (probe 2).
- So the idea is dropped: the text width stays set from Space Lua (`editor:pageLoaded`). On opening the app, the page shows at the theme's width until Space Lua has loaded (about 1.3 s here), as every plugin's work waits for it. Accepted.

## Steps

1. Probes (above), results added here: all done.
2. ~~`shared/layout.ts`~~: done (2026-11-11), with its test.
3. ~~Silverware Layout: the plugin's shape, the registry, the page's text width with the dialog and the default setting~~: done (2026-11-12), version 0.1.0, not in REPO.md yet. What building it found:
   - **The width of a page opened is handed over by the init page's Lua** (`pageLoaded(page, width)`, `editor.getCurrentPageMeta()`), set synchronously: read from JS through the bridge (each call a promise) it showed the page at the old width for frames. The text is read right after as well (the meta is the index's, which may lag behind a write). Measured in the UI test: the width set about 20 ms after the click, before the new page's first frame; on a busy machine one frame late (as probe 2 found).
   - Taking a page's width off takes `_layout` with it where it held nothing else (the writer left `_layout: {}`).
   - The unit switch is `segmentedControl` in shared/controls.ts. It shares the menu's segmented entry's classes and CSS, moved from shared/menu.css into `shared/segments.css` (written into every style page with the menu, and Silverware Layout's); the menu keeps drawing its own buttons, as they are menu items (`menuitemradio`, the menu's keys), the control a radio group.
   - The bundle is about 110 kB: the page writer brings lezer's markdown parser. Left so: the writer is the one place writing a page.
   - UI tests (silverware-layout/ui-tests/): the text and the top bar at a page's width, a link followed both ways (at most one late frame), the dialog's % saved and Default taking `_layout` off, the slider snapping, Cancel, the default saved into CONFIG, the guides saved, a narrow pane, a width typed in the frontmatter.
   - **The presets became guides, and the dialog was redesigned** (the user, 2026-11-12: the dialog was not clear, and guides of their own as Confluence's were missing). See *Guides and the dialog* below.
4. ~~Widths shown, the handle, drag and snapping, against a fake provider in the playground~~: done (2026-11-12). What building it found:
   - `host/silverbullet/widgets.ts` (since `host/widgets.ts`, any host's: see *Any host*) lays widgets out: a MutationObserver on `.cm-content` (childList only: the marks it sets cause no records), each added element a provider's selector matches given `data-swl-width` and `--swl-width` from `read`; every widget again as the providers change. The style page's rule sizes them (`!important`: SilverBullet's and the plugins' own rules size these elements too), off under `data-swl-narrow` on the root (the pane narrower than `minPaneWidth`) and out of the page's flow.
   - `ui/handle.ts`, the handle: the plugin's own element in the body (no press of it reaches the editor), placed by the hovered widget's right edge. A widget is drawn anew after each write (a new element): the handle finds it again where it was (its middle, `elementFromPoint`) before any press, and follows a while after a write; else a drag started from a detached element's width, 0.
   - Snapping: the text's width (none kept), each preset of pixels, `full` (the pane less 40 px), within 8 px; a preset in % is no widget width (a widget's is px or `full`).
   - **No preset button** (the user, 2026-11-12, seeing it in SilverBullet: the bar alone is enough): the presets are where a drag snaps, the bar's tooltip naming the one a width is. The bar is **quiet until the pointer is on it**, as Silverware Table's + (grey, a dashed outline, no accent color), the accent while hovered, focused or dragged. **The bar is 120 px at most, centred on the part of the widget in view** (the scroller, below SilverBullet's top bar), placed again as the page scrolls (the user, 2026-11-12: a tall table's bar was out of view): one measure of the scroller per placing. **What is seen of a widget is its plugin's to say** (`LayoutProvider.seen`, optional, added 2026-11-12 after the user saw the bar over nothing): Silverware Table holds a tall table's header in view and hides the rows scrolled under it, so a table nearly scrolled out showed its bar from the view's top, over the hidden rows; the table's provider says it is seen from its held header down. Optional, so the contract's version stays 1.
   - **Touch** (2026-11-12; it matters on a tablet, a phone's pane being under `minPaneWidth`): a touch on a widget shows its handle (passive, the tap still the widget's plugin's), a touch elsewhere hides it; the bar is dragged by a finger as by a mouse (`touch-action: none`), two taps take the width off; on a coarse pointer the bar takes a finger beside it too (a wider target than it looks). UI test touch.spec.ts.
   - Playground `layout.html`: an editor as SilverBullet's (`#sb-editor` a size container, `.cm-content` with `--editor-width`), a table widget, a code widget in a line of its own, a provider keeping entries in memory and drawing a widget anew when written, "Refuse writes" (as a table with its metadata setting off), "Table over the window". UI tests `widgets.spec.ts` (`@playground`): drag, written once, drawn anew centred; snapping and a double click; the preset button; Esc; a refused write said and held; a code widget passing its line; over the window and a narrow pane.
   - **Guides and the dialog** (2026-11-12, confirmed by the user before building):
     - `silverware.layout.guides`: a list of widths, px or `full`, no names (by default 900 px, 1200 px, Full width); the text's width is always a guide. A guide is a whole number of 200 to 10000 px (`validateGuide`). Replaces `presets` (never released).
     - While a bar is dragged each guide shows as a quiet dashed line each side, over the editor's visible height, under the widgets (inside `.cm-scroller`, z-index -1: CodeMirror's scroller is a stacking context, so a line lies over the page's background and under every widget, as Confluence's; checked in SilverBullet 2.12.1). The guide snapped to is solid and a little stronger; its label at the line's top, a row lower where it would touch the label left of it (the user, 2026-11-12: the text's width and 900 px had theirs over each other). Guides wider than the pane less 40 px are not shown.
     - The dialog, at the window's top right without darkening the page (the text width shows as it is set): tabs *Page* and *Guides*. Page: *This page* (Default | Own) and *All pages* (Theme | Own), each a slider marked with the guides and snapping to them (12 px, 1 %), a number typed straight in and px | %. The slider is never disabled: moving it or typing makes the row Own (the user's wish), starting where the text is now. Guides: a row a width typed straight in, × out, *+ Add guide*, *Full width* a box; sorted ascending only as the tab is shown, never under the user's typing. On a phone (480 px and narrower) the dialog takes the screen, the slider over the number, bigger targets.
     - The guides are saved in Silverware Layout's own block of CONFIG (`withConfigSettings`, marker `-- managed-by: silverware-layout`): the Configuration Manager reads no table back and rewrites its block on any save.
5. Providers: Silverware Table first (it has the box and the column widths to follow), then Database, then Chart. Each a change in its own plugin, with its UI tests.
   - ~~Silverware Table~~: done (2026-11-12). The provider is the table's core's (`core/layoutprovider.ts`: an integration with another plugin, as `onWrite` is, naming no module), registered where the init page hands over `silverware.layout.api` (`bridge.layout`). `read` takes the table's metadata as rendered (`renderedMeta`: its metadata row's `<meta>`, synchronously, as the table's look is read before layout), owner `layout`; `write` is the core's write (one edit), refused with the metadata setting off (said; the width then held for the view). Found in SilverBullet: **a widget's element is put into the page before its content** (the table widget's `span`, then its `<table>`), so Silverware Layout lays a widget out again as content comes into it; read at the first moment, a table had no metadata row yet and showed at the text's width. UI test (silverware-layout/ui-tests/table.spec.ts): a table dragged wider, `layout.width` in its metadata, drawn anew at its width with no frame at the text's width, a double click taking it off.
   - ~~Silverware Database~~: done (2026-11-12). Found later in SilverBullet (the user, 2026-11-12): a database wider than the text was cut off at the text's width, a scrollbar under it: SilverBullet shows a Lua block's output in a box of the text's width with `overflow: auto`. Silverware Layout's style lets a widget laid out out of every box within its line (`overflow: visible` by `:has`); the UI test checks its right end is seen. The provider is the binding's (`registerLayout` in index.ts, `host/silverbullet/layout.ts`): selector `.swd-place`; `read` from the text the place was drawn for (`shown.current`: `readBlock`, lines `layout.<key>`), `write` as the place writes its block (`writeBlock` through the page writer). UI test database.spec.ts: as the table's.
   - ~~Silverware Chart~~: done (2026-11-12). The entries are the chart's model's (`ChartModel.layout`), written by its format as it can: Mermaid `%% layout.<key>: <value>` after its `chart.*` comments. A format that drops them (a custom one) refuses the write, said, so a width is never silently lost. The provider is the controller's, selector `.swc-widget` (the widget the init page makes), `read` from the chart drawn in it, `write` into its block as found in the page now. UI test chart.spec.ts: as the table's, Chart.js drawing as wide as the box.
6. ~~**Any host**~~ (2026-11-12, the user: Silverware Layout could be carried out of SilverBullet, kept apart from it by one place, for keeping it up over time): what it asks of a page is a `PageHost` (src/host/page.ts: its content, editor, pane, view, guides' layer, how its text's width is shown), SilverBullet's in `host/silverbullet/dom.ts`, the one place naming its elements and `--editor-width`. Silverware Layout marks the page itself (src/host/marks.ts: `data-swl-content`, `data-swl-editor`, `--swl-pane-width`, `data-swl-narrow`, `data-swl-font-size`), and its style page's rules read only those: no `.cm-content`, `#sb-main .cm-editor` nor `100cqw` (the pane's width given as a variable, measured as its content box, as the container's units had it). `app.ts` is Silverware Layout over a `PageHost` and a `LayoutStore` (settings, a page's own width, this device's zoom); `index.ts` SilverBullet's binding. `isolation.test.ts` fails on a name of SilverBullet's page outside its host, in code or in the style page's rules; `app.test.ts` runs the app over plain elements. The themes' color variables (`--root-color`, `--ui-accent-color`, `--ui-font`) every plugin's UI reads are kept: another host defines them.
7. ~~**Guides in %**~~ (2026-11-12, the user: the same px / % switch as a page's width): a guide is px (200 to 10000), a percent of the editor's pane (10 to 100, `"80%"`) or `full`, typed in its row of the Guides tab with the unit switch (the number converted as it is switched). A widget snapped to a % guide keeps the percent (`layout.width: 80%`, the plugins keep it as any value of theirs, unread), so in another window it is still at the guide; its CSS is that share of `--swl-pane-width`, at most the pane less its gutter (weighed with the user: kept in px it would leave the guide in another window). Guides in px and in % at the same width show one line, as two of the same width did.
8. ~~**The dialog in tabs**~~ (2026-11-13, the user: the Page tab of four sliders had grown unclear): tabs *Page width* (This page, All pages), *Font* (All pages, This device with *Ctrl + scroll zooms here*), *Guides*. Each row its name where it holds (this page, all pages, this device), a slider, the value typed and ↺; without a value of its own the field is empty, the value it follows its placeholder, and a note says which (*Uses all pages' width*). The switches Default/Own and Theme/Own went: moving a slider or typing already made a row its own. *Text width* is called *Page width* everywhere it shows (the tab, the guide of a drag): *editor width*, SilverBullet's own word, would read as the editor's pane, which % and Full width are of.
9. Later: aspect ratios (charts, images), images, more page layout.

## Decided (2026-11-11)

- Responsibilities: a widget's plugin draws it and keeps the `layout.*` entries opaque; Silverware Layout alone shows them, finding widgets by their providers' selectors. Without it, no layout.
- The width stored is the width wanted, shown clamped to the pane; heights later as aspect ratios.
- Writes on release, debounce only where there is no release.
- Widget plugins register with `silverware.layout.api`, and work as before where it is not installed.
- The page's key is `_layout`.
- A widget is always centred; guides as Confluence's, snapped to while dragging; the guides a setting, as many as the user wants (presets with names until 2026-11-12).
- A table with the metadata setting off stores no width: it holds until the table is rendered anew.
- Off below a pane width (a setting, 600 px by default).
- A page's text width: `--editor-width` inline on the root, important, from `editor:pageLoaded` (probe 2); nothing set where neither the page nor the default has one.
- A page may have its own text width (`_layout.width`), the global setting is its default (confirmed 2026-11-11). Both set from Space Lua; on opening the app they, and widgets' widths, show once Space Lua has loaded (probes 2 and 5: no CSS of a plugin's is earlier).
- A page's text width and the default text width are pixels or a percentage of the pane (`_layout: { width: 1100 }` or `{ width: "90%" }`; SilverBullet takes either, the user's theme sets `97%`).
- Silverware Layout styles the widget's own element (the provider's selector), marked by its `MutationObserver`, never CodeMirror's line (probe 3). In the page's flow that element's width is Silverware Layout's alone; out of it (marked `data-silverware-over-window`: full screen, the sheet view) Silverware Layout stands back.
- The dialog offers a width as a number with a unit switch beside it, px by default, switched to % by a click. The switch is **two joined buttons side by side, `px` and `%` as their icons, working as radio buttons** (one pressed, `aria-pressed`). `shared/menu.ts` has that look already as a menu's `segmented` entry (Silverware Database's sort direction, ↑ ↓): it becomes a control of `shared/controls.ts` beside `switchControl` (`segmentedControl`), sharing the menu entry's classes and one CSS template, `shared/segments.css` (shared rule: a second user moves it to shared/, generic). The menu draws its own buttons still: they are menu items, the control a radio group.

## Open

Nothing.
