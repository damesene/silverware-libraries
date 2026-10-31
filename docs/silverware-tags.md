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

```
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
