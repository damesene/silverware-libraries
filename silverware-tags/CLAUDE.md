# Silverware Tags

A manager of the space's tags (prefix `swg-`, settings and API under `silverware.tags`). The plan, its decisions and what was checked in SilverBullet: [docs/silverware-tags.md](../docs/silverware-tags.md) (*Status and next* last). User docs: `silverware-tags.md`; the code pages: `-init.md` (settings, the bridge, commands, the Tags panel's `view.define`), `-api.md` (priority-50 `defineOperations`), `-style.md`.

## Mental model

- **One window, nothing opening over it** (decided 2026-10-31, replacing five stacked dialogs): views as tabs (*By tag*, the core's; *By page*, the pages module's; Cleanup), and a change's review shown in place of the view (Back / Esc, Apply).
- **The Tags panel** (the panel module) is for browsing, in SilverBullet's navigator; bulk changes stay in the window, because the navigator has no multi-row selection and its built-in space tree cannot be changed (`register` refuses a built-in name). The module offers rows and actions as data (`PanelOffer` in core/offers.ts; each module's `panelActions`); the init page's Lua turns them into the view's `actions`, `keymap` and `onMove`, knowing none of them. Only where `view.define` exists; the playground draws a list.
- **Every change across pages is an `Operation`**: planned (pages read, nothing written), reviewed (lines before and after, pages left alone and why), applied page by page only where a page is still as read, kept for Undo. Undo is an operation too (`undoOperation` in core/plan.ts), reviewed the same way.
- **Custom operations** (`silverware.tags.defineOperations`, src/custom.ts, modules/custom.ts): a user's JS gives `TagAction`s as data, the same shape the built-in modules give, so the core reviews, applies, undoes them and protects meta pages for them. Their HELPERS are the pure functions of `shared/pages/tags/`; `nameProblem` is kept as an alias of `validateName` for scripts.

## Invariants

- **The page writer (`shared/pages/`) is the one place that writes a page's text.** An operation says what changes in the writer's terms (`change(p, page)`: `p.tags.rename` / `merge` / `remove` / `add`; `p.editText` only for a custom operation's edit). `isolation.test.ts` fails if core, ui, modules, space or tags import the text-editing functions (`renameTags`, `applyEdits`, …); custom.ts alone hands them to a user's script.
- Isolation (`src/isolation.test.ts`): `tags/` (the pure domain: similar, query, tree) imports nothing outside it; core and ui import no module, nor `bridge.ts` / `space/silverbullet.ts`; modules import no other module, nor the bridge or `space/`. Modules reach each other only through offers (`host.offer` / `host.offered(name)`, contracts in core/offers.ts): the panel's drag renames through the rename module's offer.
- Each module gets its own host (`Controller.hostFor`). A module turned off (`silverware.tags.modules.<name>.enabled`) is not created. The writer's platform (`WritingPlatform` in space/space.ts) goes to the controller apart, so no module can reach it.
- Settings: any change is *Save and reload* (the init page defines the panel's segments as it loads).

## Meta pages

- `silverware.tags.protectMeta` (on by default, decided 2026-10-31): a meta page (tag `meta` or under it, `isMetaTag` in shared/pages/tags/names.ts, as SilverBullet's plug-api/lib/tags.ts) is out of the catalog (`catalogOf`'s `hideMeta`), and the plan's `Guard` (core/plan.ts, the writer's `leaveAlone`) leaves one alone as read, since the index may lag. So renaming `#auto` skips meta pages.
- Off: meta tags are shown apart, as SilverBullet's own tree does (its 2.12.1 segments: All and Pages without meta pages, Meta with them alone): panel segments All, Page tags, Tasks without them and Meta; the window's Tags | Meta; By page without meta pages.

## Gotchas

- **Table rows' and headings' hashtags are in no `tag` object** (`plugs/index/tags.ts` takes paragraphs, items and tasks only): the init page also reads `index.tag "table"` and `index.tag "header"` and their `tags`, else a rename missed them.
- **Hashtags are found in the blocks lezer's parser reads** (shared/pages/tags/scan.ts on shared/markdown/parse.ts, since 2026-11-11), so the bundle carries lezer (about 60 kB). A difference from what SilverBullet finds is a bug of `parse.ts` (its blocks) or `inline.ts` (a line's marks), not of the scanner: fix it there, with a test.
- Page tags are written into the frontmatter in the page's own form (a list of dash lines stays one, `a, b` a string); a page whose tags cannot be read safely is left alone and said in the review.
- F2 in the panel: the navigator focuses its own filter field after the key is handled, so the window takes the focus back for a moment (`keepFocus` in ui/workspace.ts).
- Hundreds of pages: the writer reads and writes six at a time (shared/pages/batch.ts), a progress dialog while a plan is read or undone, preview lines made as a page is opened, ten changes kept for Undo (`KEPT` in shared/pages/history.ts: each holds every page's text before and after).

## Verified in SilverBullet

- `view.define` (`presentation.mode = "tree"`, a count as decoration, segments, `keymap`, `onMove`) in 2.12.1's source (tag of 2026-10-12). A click returning `"navigator:expand"` opens a level.
- In the local SilverBullet (main, 2026-10-16/31, by a script): the bridge, commands from `commandNames()`, the tree, a click opening the window at the tag, F2, a drag onto a level reviewing the rename, a rename applied (a table cell's tag too), Page tags written through the editor, meta pages apart.
- SilverBullet renames pages, never tags. `index.patchFrontmatter` dumps the YAML anew (comments and other keys' form may change): why the writer edits the frontmatter's text itself.
- Not verified: a phone; the notification's Undo button in 2.12.1.

## Tests

- Unit tests in `src/**/*.test.ts` over `space/memory.ts` (a map of pages, its own writer: `writerOf`).
- Interactions in `ui-tests/` (helpers.ts: the playground `/tags.html`, or SilverBullet with the sample pages under `UiTags/`).
