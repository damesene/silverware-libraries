# Markdown's blocks read by lezer, the tag scanner on them (plan)

Talked through with the user on 2026-11-11; this replaces the first version of the plan (a parser of our own grown
by probes), the same day. **Done on 2026-11-11** (branch `refactor/tag-scanner-on-blocks`); what was found on the way
is under *Found while building* at the end.

## Why

Markdown's structure over several lines is read in two places of `shared/`, and they disagree:

* **`readBlocks`** (shared/markdown/blocks.ts, what Silverware Database's converters read): a tree of items with
  what is under them by indentation, paragraphs, quotes, fenced code, tables, headings holding their sections.
* **The tag scanner** (shared/pages/tags/scan.ts, what Silverware Tags and the page writer find, rename and remove
  tags by): line by line, its own state over lines.

Neither reads markdown as SilverBullet does where it gets hard: a line going on a paragraph or an item lazily, a
quote holding a list or a fence, indented code, a list's item starting with a blank line, HTML and comments. The
scanner decides what renaming or removing a tag rewrites in a user's pages, so where it is wrong it rewrites text
that holds no tag or misses one.

## Decided (2026-11-11)

* **lezer's markdown parser** (`@lezer/markdown`, the version SilverBullet builds on: 1.7.2), bundled, not a parser of
  our own. SilverBullet's parser is lezer's with extensions; the blocks over lines (lists, quotes, code, paragraphs,
  headings, tables, HTML, comments) are lezer's own. Its extensions that make blocks are few and ours are written
  where needed (a task of a state of its own); none of its code is copied. A plugin still depends on no place it runs
  in: lezer is a library, synchronous, run by the tests and the playground as by SilverBullet.
* **One file knows lezer**: `shared/markdown/parse.ts`, giving a tree of its own (`MarkdownNode`: a kind, a span,
  children, each leaf's lines without its containers' markers). lezer's node names, its cursor and its version stay
  there; what reads the tree (`readBlocks`, the scanner) is tested on the tree, and lezer can be updated or replaced
  in one file. The tree has only the kinds and fields something reads.
* **Bundled where it is read**: Silverware Tags (the scanner) and Silverware Database (its converters, and the page
  writer's scanner). Not lazily loaded: it would make `readBlocks` asynchronous for 19 kB (gzip) of two plugins.
  Silverware Toolbar reads a line alone (`readLine`), which moves to a file of its own so lezer stays out of its
  bundle (the build shows it).
* **No compatibility kept where it keeps a wrong reading** (the user, 2026-11-11: nobody is known to use the API
  yet). `readBlocks`' `Block` changes where it read otherwise than SilverBullet: a quote holds blocks, an item's text
  is its first paragraph (lines going on lazily included), indented code is code, HTML and comments are blocks of
  their own. Each change is said on the library page; the commit is marked `!`.

## What SilverBullet reads (its source, main of 2026-11-06, and 2.12.1)

* A hashtag is a `Hashtag` node wherever inline text is parsed: paragraphs, headings, tables' cells, tasks, HTML
  blocks' text, a comment's body (parsed as markdown), footnotes.
* Its context, `plugs/index/tags.ts` `hashtagParent` (main): within a `Task` task, within a `ListItem` item, within
  a `Table` table, within an ATX heading header, within a paragraph holding hashtags alone page, else paragraph.
  2.12.1 knew task, item and page only. The scanner keeps main's, as it does now; a hashtag of no context there
  (HTML, a setext heading, a footnote) stays found (renaming it is what its user sees as a tag), its context the
  nearest the scanner has.
* A `Task` is the leaf directly in a `ListItem` whose text starts with `[state]`
  (`client/markdown_parser/extended_task.ts`): only the task's own text is the task's; a paragraph or a list under it
  is an item's.
* The page's tags (`plugs/index/frontmatter.ts`): a paragraph directly under the document, its hashtags up to the
  first text holding anything but spaces (none then) or a line break with more after it (those before).

## Steps

1. This plan.
2. **`readLine` in a file of its own** (`shared/markdown/blockline.ts`): no change of behaviour, the toolbar's import
   moved.
3. **`parse.ts` and `readBlocks` on it**: the tree, a task's state by `shared/markdown/task.ts`, a CRLF's `\r` read
   as a space (offsets kept); `readBlocks`' `Block` as decided, the tasks converter on it, the library page.
4. **The scanner walks the tree**: a hashtag's context from its leaf and the containers around it, the page's tags
   by SilverBullet's rule; its state over lines goes. Run against the scanner of today over generated pages (every
   pair of some 80 line kinds, random pages of 2 to 7 lines, LF and CRLF, with and without a frontmatter: a script
   outside the repository, as the review of 2026-11-11 did); each difference is SilverBullet's reading (lezer's) or
   a fix, and becomes a test.
5. CLAUDE.md (shared/, Silverware Tags) say what markdown is read by.

A commit a step, each reviewed and deployed to the local SilverBullet; unit tests after each, every test (UI too)
at the end.

## Found while building (2026-11-11)

* **A CRLF is read as LF**, the places mapped back to the text given: lezer took a `\r` for text, so a marker alone
  (`-\r`) was none, and a table's line of dashes with `\r` after it none (SilverBullet's own table reads it the same
  way: its regex is lezer's). Read as a space first, which broke tables.
* **A line's text** is taken off its containers' markers as CommonMark does, outermost first (a quote's `>`, an item's
  marker on its first line and its content's indentation after), tabs to the next multiple of four. Reading the
  quote markers lezer marks (the first way) kept a list item's indentation on a lazy line in a quote and could not
  give an item's own lines, which `readBlocks`' `body` is made of.
* **A marker comment** (`<!--` with `#` or `/` after it, a baked section's `<!--#lua …-->`, `<!-- #c` too) holds no
  markdown, as SilverBullet's html_block.ts reads it; another comment's body is read as markdown (its hashtags tags).
* **An item's text** is the paragraph it starts with, lines going on it lazily included, as SilverBullet names an item
  (plugs/index/item.ts); none where it starts with another block, its body then all it holds. A paragraph of an item
  starting with a state that is not its first block is a task to SilverBullet; to `readBlocks` a paragraph, its state
  in its text.
* **The scanner against the old one** (some 110,000 generated pages): every kind of difference is lezer reading as
  SilverBullet does where the old scanner read otherwise: a fence indented four spaces is code, a fence in a quote
  ends with the quote, a line indented four after a heading or a rule is code, an item starting with a blank line
  holds only what is indented under it, a numbered list starting at 2 goes on the paragraph above, a table needs its
  line of dashes, a heading ends a task's text, HTML runs to its blank line, a setext heading is a heading, a page's
  tag line is a paragraph's hashtags before any other text (frontmatter.ts). The new scanner gives the same on a page
  with LF and with CRLF.
* **The scanner's review**: a page's tag line is read element by element as frontmatter.ts does, an element where
  text would be (emphasis, code, a link, a wiki link, an attribute, a hard line break; lezer's inline elements and
  `inline.ts`' marks) ending it with no page tags (`#a\n*x*`); raw HTML (pre, script, style, a tag alone) and a link's
  definition (`[top]: #a`) hold no hashtags, as SilverBullet keeps them raw; block-level HTML's (a div's) do.
* **Known, kept**: a line's marks are read one line at a time, so a span of inline code over two lines is not one (the
  old scanner read so too); a URL without brackets is no element to the tag line (lezer has none: SilverBullet's
  NakedURL is its own).
