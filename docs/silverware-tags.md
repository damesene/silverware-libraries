# Silverware Tags: plan

Status: decided on 2026-10-31, built on the branch `silverware-tags` (not
merged). *Status and next* at the end says what is done.

## The request

A tag manager for SilverBullet: tags changed in bulk, renamed (merged where
the new name is taken), given to a page or to many pages at once, to every
page under a node of the page hierarchy, removed. Page tags are written into
the frontmatter; a rename changes the tags of items and tasks too. A plugin of
its own, built on the principles of Silverware Table and Toolbar: a core that
knows no module, modules turned off not loaded, SilverBullet behind an
abstraction of its own, room for more operations.

## What SilverBullet offers (its source, main `0a9d1369`, 2026-10-16)

- **Page tags** (`plugs/index/frontmatter.ts` `extractFrontMatter`): the
  frontmatter's `tags` (a list, or a string `a, b`, `a b`, `#a #b`; a leading
  `#` dropped) and the hashtags of a paragraph directly under the document that
  holds nothing but hashtags (its lines up to the first that holds anything
  else). Those are a page's `tags`.
- **Tag objects** (`plugs/index/tags.ts` `indexTags`): one `tag` object per tag
  and context of a page, `{ name, page, parent }`, `parent` `page` (the page's
  tags and a hashtag in any paragraph), `item`, `task`; data blocks and tables
  their own (`data.ts`, `table.ts`: a table header's hashtags tag the table).
  Queried from Space Lua as `query[[from index.tag "tag"]]`; the collection
  also holds objects tagged `#tag`, so `t.tag == "tag"` is checked (as the
  navigator's Tags view does, `client/navigator/views/tags.ts`).
- **A hashtag** is `tagRegex` (`client/markdown_parser/constants.ts`) parsed
  inline wherever a `#` starts one (`regexParser` in `parser.ts`): no space
  needed before it, not in code, links, URLs, HTML tags, entities.
  `#<several words>` is a tag of several words. `/` is allowed after the first
  character, so `#project/alpha` is a tag: the hierarchy is a convention, which
  SilverBullet shows nowhere (only `removeTagsPrefix` in frontmatter.ts knows a
  prefix).
- **Pages**: `space.listPages()`, `space.readPage`, `space.writePage` (indexed
  after it, as any change of a file); the page hierarchy is the folders in a
  page's name (`Projects/Alpha/Plan`).
- **Writing**: `index.patchFrontmatter` (since 03/2025) edits the frontmatter
  through YAML (dumped anew: comments and the form of other keys may change);
  `object.update` (main since 2026-10-15, marked wip, not in 2.12.1) edits a
  page's frontmatter only, not its tag lines.
- **No rename of tags**: SilverBullet renames pages (with their links), not
  tags.

## Decisions

1. **Silverware Tags**: folder `silverware-tags/`, settings and API under
   `silverware.tags`, CSS prefix `swg-`, commands `Silverware Tags: …`.
2. **Page tags go into the frontmatter**: added to its `tags` (a key made where
   there is none, the frontmatter too); removed from the frontmatter and from
   the page's tag lines (a line left empty goes). The form a page has is kept
   (a list stays a list, a string a string); new: a block list, as
   SilverBullet's own YAML writes it.
3. **A rename changes every occurrence**: the frontmatter, the tag lines,
   hashtags in paragraphs, items, tasks, tables. Renaming into a tag that
   exists merges them (a page's frontmatter keeps one). With *its subtags*
   `project` → `work/project` renames `project/alpha` → `work/project/alpha`
   too.
4. **Our own edits of the text, not SilverBullet's YAML**: the frontmatter is
   edited where its `tags` is (minimal edits, the rest as written), so a page
   keeps its comments and formatting. A form it does not edit (a list over
   several lines in brackets) is left alone, and the preview says so.
5. **Hashtags found by our own scanner** (pure, synchronous, tested), as
   SilverBullet's parser finds them: not in the frontmatter (read apart), fenced
   code, inline code, wiki links, a link's target, URLs, HTML tags, entities,
   `${…}`, `\#`. Behind an interface (`TagScanner`), so SilverBullet's parser
   (`markdown.parseMarkdown`) could take its place.
6. **Every change across pages is previewed**: what changes on each page
   (lines before and after), what is skipped and why; nothing is written until
   *Apply*. One page edited in its own dialog (the page's tags) is written at
   once.
7. **Undo**: the last changes (this session) can be undone, page by page,
   where the page is still as written (else that page is said to be changed
   since and left). A change of the page open in the editor is one edit of the
   editor (Ctrl+Z works too).
8. **The page open in the editor** is changed through the editor
   (`editor.replaceRange`, one minimal edit), never by writing its file:
   SilverBullet keeps its copy and would write a conflict.
9. **Which pages hold a tag** comes from SilverBullet's index (fast); the
   pages are then read and edited as they are. A page the index has not caught
   up with is not found; the preview shows what was found.
10. **Tags are case sensitive**, as SilverBullet's index keeps them.

## Design

### Layers

```text
silverware-tags/
  silverware-tags.md   library page: docs, config.define, the Lua that loads the JS and hands over the bridge, commands, CSS
  silverware-tags.js   the bundle
  src/
    index.ts           entry: init(bridge), the commands' functions
    bridge.ts          the SilverBullet API used (Bridge), settings, modules' names
    modules.ts         the modules in their order, created only when on
    tags/              the domain (pure, no DOM, no SilverBullet)
      names.ts         tag names: valid, as a hashtag (#a, #<a b>), the hierarchy (parent, within, renamed)
      scan.ts          TagScanner: the hashtags of a page's body, each with its place and context (page line, paragraph, item, task, table)
      frontmatter.ts   the frontmatter's tags: read with their places, added, removed, renamed in the page's own form
      edit.ts          the edits of a page's text: rename, remove, add to the page, remove from the page
      tree.ts          the tags as a tree by "/" with counts
    space/             the abstraction of SilverBullet's space
      space.ts         Space: pages, tag uses (the index), read, write (only if unchanged), the page open, navigate
      silverbullet.ts  Space over the Bridge (the page open through the editor)
      memory.ts        Space over a map of pages (tests, the playground), its tag uses by the scanner
    core/
      operation.ts     Operation: a label, the pages it may change, its edit of a page's text
      plan.ts          Plan: an operation over its pages (each page's text before and after, skipped and why), applied (each page checked unchanged), undone
      history.ts       the changes applied this session, undone last first
      catalog.ts       the tags of the space (uses by page and context), read from the Space
      module.ts        TagsModule: what a module gives (commands, a tag's actions in the manager); ModuleHost: what the core gives it
      diff.ts          a page's change as lines before and after (the preview)
    ui/                the dialogs (shared/dialog.ts, base swg-dialog), made of Silverware Tags' own elements
      elements.ts      el()
      manager.ts       the Tag manager: a tree of tags with counts and a search, the tag picked: where it is used, the modules' actions
      preview.ts       a plan shown, Apply / Cancel, the progress
      chips.ts         tags typed as chips, with completion from the catalog
      pagetree.ts      pages as a tree by folder, with check boxes (a folder checks what is under it)
    modules/
      rename.ts        Rename (merge into a tag that exists; with its subtags)
      remove.ts        Delete a tag everywhere (with its subtags)
      assign.ts        Tag pages: pages picked in a tree (a folder: everything under it), tags added and removed; from the manager for a tag
      pagetags.ts      the tags of the page open: chips, saved at once
```

### Isolation

- The domain (`tags/`) knows neither SilverBullet nor the DOM: text in, text
  out; `space/` is the only part that knows how SilverBullet is reached, and
  only through the bridge the library page hands over (no internals).
- The core knows no module: modules give commands and actions on a tag; an
  action makes an `Operation`, which the core plans, previews, applies and can
  undo. A new operation (a module of its own, later the user's from Space Lua)
  needs no change of the core.
- A module turned off (`silverware.tags.modules.<name>.enabled`) is not
  created; the manager shows the actions of those on.

### UX

- **Tag manager** (`Silverware Tags: Manager`): left the tags as a tree by
  `/` (each with how many pages and objects use it; a search filters it),
  right the tag picked: its uses by kind (pages, items, tasks, …) and the
  pages, each opening it; its actions (Rename…, Delete…, Add to pages…).
- **Rename**: a field with the new name (the tags of the space offered), *with
  its subtags* where it has some; a name taken says it will merge. Then the
  preview.
- **Tag pages** (`Silverware Tags: Tag pages`): the pages as a tree by folder
  with check boxes, a search; a folder's box checks every page under it (its
  own page too); tags to add and tags to remove as chips. Then the preview.
- **Page tags** (`Silverware Tags: Page tags`): the page's tags as chips (×
  removes one), a field adding one (completion); Save writes it at once.
- **Preview**: the pages changed with their lines before and after, the
  pages skipped and why; *Apply* writes them one by one (progress), then a
  notification of what was done. *Undo* (`Silverware Tags: Undo`, and in the
  manager) undoes the last change.

### One window (decided 2026-10-31, replacing the UX above)

The first version had five dialogs, one over another (the manager, Rename,
Delete, the preview, Tag pages and Page tags apart): too many places for one
task. Now one window, nothing over it:

- **Views as tabs**: *By tag* (the core's) and the modules' (*By page*, the
  pages module's). Page tags is *By page* with the page open ticked; Tag pages
  is *By page*.
- **The tag's name is a field**: typed anew, what it would do is said under it
  (merging into a tag that exists), Enter reviews it; Esc puts it back.
- **By page as labels of mail**: the tags of the pages ticked, each with how
  many of them have it (`1/2`); × marks it to take off them all (struck
  through, ↺ keeps it), a field adds tags to them all.
- **The review in place of the view**: Back (or Esc) to the view as it was
  (`remember`), Apply writes and goes back (the view by page with its pages
  still ticked, nothing to change; a rename to its new name). An operation's
  option (its subtags) is a box in the review, the plan made anew by it.

### The Tags panel (decided 2026-10-31)

Browsing in SilverBullet's navigator, bulk changes in the window. The
navigator (`view.define`, in 2.12.1: its tag's source) draws a view of rows as
a tree by "/", with decorations, segments, keys and a drag onto a level
(`onMove`); its built-in space tree cannot be changed, and it selects one row
at a time, so ticking pages and the review stay in the window. The panel
module gives the rows and what is done with them (`PanelOffer`), the library
page's Lua makes the view of them: the JS knows nothing of the navigator. A
tag picked opens the window at it, F2 with its name's field focused, a tag
dropped on a level is renamed under it (its subtags with it) through the
rename module's offer, reviewed. A drop onto a name a tag has is refused by
the navigator itself (merging stays the window's).

### SilverBullet's own tags apart (decided 2026-10-31)

`meta` and the tags under it (`meta/library`, `meta/template/…`, `meta/api`)
mark SilverBullet's own pages; its tree keeps meta pages in a Meta segment
of their own (All and Pages leave them out). So do the panel (All, Page tags,
Tasks without them, Meta with them alone), the window (Tags | Meta) and By page
(no meta pages, their meta tags not offered to take off: a library's
`meta/library` is how it is installed).

### Hide and protect meta pages (decided 2026-10-31)

A setting, on by default (*Silverware Tags: Settings*, a dialog as the other
plugins have, of one height): SilverBullet's meta pages are out of everything,
their tags shown nowhere (a library's documentation writing `#VALUE!` is no
tag of the user's) and never changed: a rename of a tag they use too renames
it on every other page. Told by the index (a page whose own tag is `meta` or
under it) and, as a plan reads each page, by its text. Off: they show, their
tags apart (Meta), as above. Every change of the settings reloads: the
library page defines the panel's segments as it loads.

## Not now (possible later)

- The user's own operations from Space Lua (`silverware.tags.defineOperations`).
- Rules by folder (pages under `Projects/Alpha` get `#project/alpha` as they are
  made): writing pages in the background, as SilverBullet's templates do better.
- A tag's own page and color, aliases.
- SilverBullet's parser instead of the scanner (`markdown.parseMarkdown`, async).
- Tags of a selection of the page's objects (a task's tags in the manager).

## Status and next

- 2026-10-31: the plan; the domain, the space, the core, the modules, the
  dialogs, the library page, the playground (`/tags.html`) and the tests on the
  branch `silverware-tags`.
- Verified the same day in the local SilverBullet (main of 2026-10-16, by a
  script driving it, not the UI tests: ports 2955-3054 are reserved on this
  machine, so `npm run test:ui:sb` could not start its servers): the Lua bridge,
  the commands defined from `commandNames()`, the manager listing the index's
  tags, a rename applied (a table cell's tag too), Page tags written through the
  editor. A table row's and a heading's hashtags are in no `tag` object of the
  index (`plugs/index/tags.ts` takes only paragraphs, items and tasks): the
  rows' (`index.tag "table"`) and headings' (`index.tag "header"`) own `tags`
  are read too, else a rename missed them.
- Not verified: SilverBullet 2.12.1 (the release CI runs), the notification's
  Undo button there (its options came later), a phone.
- Hundreds of pages to a tag (the same day): pages read and written six at a
  time (each a call into SilverBullet), a progress dialog while a preview's
  pages are read and while a change is undone (shown after 300 ms), the
  preview's lines of a page made as it is opened (the first three open), the
  manager's pages a hundred at first (*Show all*), a notification naming three
  pages left alone and counting the rest, ten changes kept for Undo (each holds
  every page's text twice). Not measured in SilverBullet with that many pages.
- Next: the UI tests against SilverBullet in CI; the playground's toolbar page
  has no link to the tags playground (one in its header broke the toolbar's
  touch tests: the header's width on a phone).
