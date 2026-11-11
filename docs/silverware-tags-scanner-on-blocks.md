# The tag scanner on markdown's blocks (plan)

Talked through with the user on 2026-11-11. Nothing built yet.

## Why

Markdown's structure over several lines is read in two places of `shared/`, and they disagree:

* **`readBlocks`** (shared/markdown/blocks.ts, what Silverware Database's converters read): a tree of items with
  what is under them, paragraphs, quotes, fenced code, tables, headings holding their sections.
* **The tag scanner** (shared/pages/tags/scan.ts, what Silverware Tags and the page writer find, rename and remove
  tags by): line by line, its own state over lines: within a list, a paragraph of hashtags alone (the page's tag
  line), indented code.

Where they differ now: a line right under a list's item, not indented and with no blank line between, is the item's
text going on for the scanner (a lazy continuation, as SilverBullet reads it) and a paragraph of its own for
`readBlocks`; indented code (four spaces after a blank line) is known to the scanner alone. Each line's block is
already shared (`readLine`, fences of `lines.ts`); what holds over lines is not.

So `readBlocks` is to read what the scanner needs, as SilverBullet reads it, and the scanner is to walk its tree: one
reading of markdown's structure for every plugin, the converters getting the same.

## A parser of our own, kept to what is needed

Weighed on 2026-11-11: SilverBullet's own parser (`markdown.parseMarkdown` through its API) would agree with it
exactly, but it is asynchronous and only in SilverBullet, while Silverware Toolbar reads synchronously and the tests and
the playground run without it; `@lezer/markdown`, which SilverBullet builds on, lacks SilverBullet's own extensions
(attributes, hashtags, a task's state of its own: in its client's code) and would grow every bundle. So `readBlocks`
stays ours, and grows only by what a probe (step 1) shows SilverBullet reading otherwise. **Decided by the user
(2026-11-11): no dependence on SilverBullet's parser**, not even as a second way for the tag scanner where it runs in
SilverBullet: a plugin depends on no place it runs in; SilverBullet is the measure of right in the probes, never a part
of the code. Not a whole CommonMark: each
deviation kept on purpose is said in a comment where it is made (as an item's children by indentation are now).

## `readBlocks` is a public API

A user's converter is given it (`HELPERS.readBlocks`, silverware-database.md *Converters*). What step 2 adds to a
block (a quote's `children`, a block `code` of indented code) is new; what it changes (a line going on a paragraph or
an item lazily, part of it now) changes what a converter reads. Each such change is written on the library page with
the step making it.

## The risk, and how it is held

The scanner decides what renaming or removing a tag rewrites in the user's pages. Its results (each hashtag's name,
`from`, `to`, `context`) must stay the same, or differ only where SilverBullet's index reads otherwise, each such
difference checked in SilverBullet and named in this plan. Until the switch is done the scanner of today stays as a
test's reference, and a comparison runs the old and the new over many pages (generated: every pair of some 80 line
kinds, random pages of 2 to 7 lines, LF and CRLF, with and without a frontmatter), as the review of 2026-11-11 did.

## Steps

1. **Probes in SilverBullet** (2.12.1, the local one): pages of the cases below written through its API, its index's
   `tag` objects read. First of all: whether a tag object says where it is (a field such as `parent`: page,
   paragraph, item, task, table, header); without it there is no measure of right, and this plan is talked over again
   before step 2. The probes are what is right where the old and the new scanner differ.
   * A paragraph's lazy continuation (a line not indented under a paragraph, under a list's item, under a quote).
   * Indented code: after a blank line, after a paragraph (none: the paragraph goes on), in a list.
   * Quotes holding a list, a fence, a table, a heading.
   * The page's tag line: lines of hashtags alone at the body's start, broken by a blank line, by other text.
   * Headings indented 1 to 6 spaces; setext headings; a marker alone (`-`, `#`) with CRLF.
   * HTML blocks (`<div>` over several lines, a comment over several lines): whether a hashtag in them is a tag. Where
     SilverBullet reads none and the scanner one, renaming a tag rewrites text in HTML: then they are read as blocks
     of their own too (step 2).
2. **`readBlocks` reads what it lacks**, only where step 1 found SilverBullet reading otherwise, a commit each, each
   tested by the probes' cases and written on the library page:
   * a) lazy continuation: a line going on a paragraph, a list's item;
   * b) indented code: a block `code` of its own, as fenced code is;
   * c) quotes holding blocks: a quote's `children`.

   The converters' tests show what changes for them (a line right under a task already goes into its body: no change
   expected there).
3. **The comparison** (a test, the scanner of today copied beside it as its reference): the new scanner, still the
   old, must give the same on every page; this step lands the harness and the reference only.
4. **The scanner walks `readBlocks`' tree**: a hashtag's context from its block (a task, an item, a heading, a table,
   a paragraph; the page's tag line the first paragraph's lines of hashtags alone), its place from its block's lines
   and the line's marks (`inlineMarks`). Its state over lines goes. The comparison passes, its differences only those
   step 1 found right.
5. **The reference goes** (the plan is not done while it is there), the comparison kept as a test of the probes'
   cases; CLAUDE.md (shared/) and silverware-tags/CLAUDE.md say what the scanner reads by.

A commit a step, each reviewed; unit tests (the UI tests at the user's word); deployed to the local SilverBullet.
