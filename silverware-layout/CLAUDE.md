# Silverware Layout

The layout of a page: its text's width (the page's own, a default for every page) and widgets' widths (laid out and changed by their handle; Silverware Table registers its tables, Database and Chart are next) (prefix `swl-`, settings and API under `silverware.layout`). The plan, the probes' results and every decision: [docs/silverware-layout.md](../docs/silverware-layout.md) (*Steps* says what is done). User docs: `silverware-layout.md`; the code pages `-init.md` (settings, the bridge, the command, the events), `-api.md` (priority 50: `silverware.layout.api`), `-style.md`. Version 0.1.0, not listed in REPO.md until it is usable.

## Mental model

- **Responsibilities**: a widget's plugin draws its widget and keeps Silverware Layout's entries for it (`layout.*` in its own markdown) without understanding them; Silverware Layout alone gives them meaning and shows them. The contract is `shared/layout.ts` (`LayoutProvider`, `layoutOf`, `LAYOUT_VERSION`), as `shared/icons.ts` is Silverware Icons'.
- **The registry** (core/registry.ts): one provider per name, registered again it replaces (Space Lua loaded again runs the widget plugins' init pages again, and `api` is the same object: the module is imported once).
- **Widgets' widths** (host/silverbullet/widgets.ts, ui/handle.ts, put together by widgetlayout.ts for SilverBullet and the playground): the widget's own element gets `data-swl-width` and `--swl-width` as it is rendered (a MutationObserver on `.cm-content`), the style page's rule sizes it (centred, at most the pane less 40 px, `100cqw`), off under `data-swl-narrow` and out of the page's flow (`data-silverware-over-window`). The handle, a bar quiet until pointed at (as Silverware Table's +), 120 px at most and centred on the part of the widget in view (`pageView`: the scroller; what is seen of a widget its provider's optional `seen`, a table's held header), drags (written on release), snaps (text width, presets), takes a width off by a double click; no preset button (the user's choice).
- **The text's width**: the page's own (`_layout.width` in its frontmatter, px a number, % a text), else the default setting, else none (the theme's); none in a pane narrower than `minPaneWidth` (core/textwidth.ts). Set as `--editor-width` inline on the root, important (host/silverbullet/dom.ts): what SilverBullet's text, top bar and notifications read, winning over a theme's `!important`.

## Layers (src/isolation.test.ts)

- `model/`: widths (px or %, read from what a page or a setting holds) and settings, pure; imports nothing outside it.
- `core/`: the registry, which text width applies, a widget's width (read, dragged, snapped, named); the model and `shared/layout.ts` alone.
- `ui/`: the Page layout dialog and the handle (`HandleHost`: what it asks of whoever lays widgets out); the model and shared UI (dialog, controls, elements), never the host, the bridge or the page writer.
- `host/silverbullet/`: SilverBullet's page (dom.ts), the widgets laid out (widgets.ts), the page's `_layout` read and written through the page writer (page.ts), the writer's platform (platform.ts).
- `index.ts` ties them in SilverBullet, `widgetlayout.ts` the widgets and their handle (the playground's layout.ts too); `bridge.ts` is what the init page hands over.

## Gotchas

- **The width of a page opened is handed over by the init page's Lua** (`pageLoaded(page, width)`, from `editor.getCurrentPageMeta()`), set synchronously: read from JS, each call of the bridge is a promise answered later, and the page showed at the old width for frames. The text is read as well right after (`pageOpened`), as the meta is the index's, which may lag behind a write.
- `editor:pageModified` re-reads the frontmatter after 300 ms still (a width typed by hand); not while the dialog shows a width it is setting.
- The dialog shows what is set at once and writes on Save; Cancel puts the page back without asking, Esc, × or a press beside it ask where changes would be lost. Taking a page's width off takes `_layout` with it where it held nothing else (else `_layout: {}` stayed).
- The bundle is about 110 kB: the page writer (shared/pages/) brings lezer's markdown parser. The writer stays the one place writing a page.
- The unit switch is `segmentedControl` (shared/controls.ts), styled by `shared/segments.css` (the menu's segmented entry's look, the same classes).

## Tests

- Unit tests: `src/**/*.test.ts` (widths, settings, the registry, which width applies, `_layout` read and written through the page writer over an editor of memory).
- `ui-tests/layout.spec.ts` runs against SilverBullet only (`--editor-width` is SilverBullet's): a test's pages under `UiLayout/<test>/`, CONFIG put back after. A page written for a test is indexed a moment after it opens: wait for its `_layout` in the index (`waitForIndexedLayout`) before following a link to it. A link followed may show one frame at the page before's width on a busy machine (`LATE_FRAMES`).
- **SilverBullet puts a widget's element into the page first and its content after** (a table widget's `span`, then its `<table>`): a widget is laid out again as content comes into it (`layOutIn` looks at the widget around an added node), else a table's width read before its metadata row was there was none.
- A widget is drawn anew after each write (a new element): the handle finds it again where it was before any press (`place`), else it would drag a detached element (width 0). Playground tests measure a widget through `box()`, which waits for the new one.
- The handle leaves touch pointers alone for now.
- `widgets.spec.ts` runs on the playground (`layout.html`, tagged `@playground`); `layout.spec.ts` on SilverBullet.
- Page markers in a frame's text mislead: a page's Linked Mentions quote the other page; tell pages by their heading.
