# A page embedded in a grid's cell (proposal)

Status: not done; the user's decision (2026-11-17). Written while fixing a cell's blank lines (branch
`fix/layout-grid-blank-before-list`), where it was first handled and then taken out to be decided on its own.

## The problem

A grid's cell is rendered by SilverBullet's `markdownToHtml(text, { expand = true, annotationPositions = true })`
(the init page's `renderMarkdown`). With `expand`, a page embedded in the cell (`![[Notes]]`, and an image of no file,
`![logo](Notes)`, alike) is expanded where it stands, in the line holding it: a paragraph, a heading, a task's text.
Its elements carry `data-pos` offsets **of the embedded page's text**, not of the cell's.

SilverBullet 2.12.1, probed 2026-11-17, a cell `![[Notes]]\n\n- a` with Notes `Some text\n\n- x\n- y`:

```html
<span class="p"><span class="p">Some text</span><br><ul data-pos="11"><li data-pos="11"><span class="p" data-pos="13">x</span></li>…</ul></span><br>
<ul data-pos="12"><li data-pos="12"><span class="p" data-pos="14">a</span></li></ul>
```

`11`, `13`, … are Notes' offsets; `12`, `14` the cell's. SilverBullet knows which is which: its
`client/markdown_renderer/inline.ts` `expandMarkdown` parses the embedded page from that page's own text and passes
its `sourceOffset` on (for task refs), but the HTML says nothing of it.

The grid reads every `data-pos` as the cell's, so:

- **Blank lines** (`ui/view.ts` `keepBlankLines`): an embedded element may stand for one of the cell's lines; a blank
  line is put into the embedded page and the cell's own block gets none (seen in the probe above).
- **A click** in the embedded page (`ui/cellpoint.ts` `offsetInCell`) opens the cell's field with the caret at the
  other page's offset, somewhere unrelated in the cell.
- **A task's box** in the embedded page (the host's `ownTasks` enables every box; `grids.ts` `toggleTask`) toggles
  whatever task of the cell is at that offset, or says it found none.
- **What the cell drew** (`drawn.ts`, for Silverware Assets): an image or a link of the embedded page is matched
  with the cell's embed or link near that offset.

All of these were as wrong before; rare in practice (a page embedded in a cell, with blank lines, tasks or clicks there).

## Options

1. **In SilverBullet (cleanest).** The renderer annotates no positions inside a transclusion's expansion, or marks the
   expansion (an element round it with its embed's offset and target). A small change where the knowledge is; the
   grid would then need nothing but to honour the mark. Reaches only the versions that have it: 2.12.1 keeps the problem.
2. **In Silverware Layout's SilverBullet host, a stop-gap.** Done once on the branch, then taken out (commits
   `33b6c339`, `daa0f4b5`, `43ef77b1`, `c0ff3f12`; and in `shared/markdown/embed.ts`, `0a504c8e`, `be3cdd61`): the host
   puts an image of no file before and after each page embed in the text it renders, and in the HTML puts what lies
   between them in `<span data-swl-embedded="<target>" data-pos="<embed's offset>">` with no `data-pos` inside; the grid
   reads that element as one place (a point in it at the embed, its tasks left to SilverBullet, its media none of the
   cell's). It worked on 2.12.1, all of it in the host, removable once option 1 is out. Against it: a new element in a
   cell's DOM (a theme or another plugin sees it), and the HTML changed by textual replacements (it would be redone on
   the DOM if kept: the marks found as elements, what lies between them wrapped).
3. **Embedded pages rendered apart.** The cell rendered without expanding, each embed rendered alone and put in. Not
   cleaner: `markdownToHtml` expands transclusions and Lua expressions together (`expand`), so a cell's `${…}` would go
   too, and each embed costs a render of its own.
4. **Guessed in the grid from the HTML's structure** (an element inside an inline one): tried and dropped; wrong for an
   embed in a heading or a task, where only blocks are round it.
5. **Left as it is** until SilverBullet has option 1.

Recommendation: option 1 as a pull request to SilverBullet; meanwhile option 5, or option 2 redone on the DOM and kept
plainly as a stop-gap, by the user's choice.

## The pull request to SilverBullet (outline)

- Where: `client/markdown_renderer/inline.ts` `expandMarkdown` (the transclusion expanded into the tree) and the HTML
  renderer's `annotationPositions`.
- What: the nodes of an expanded transclusion either lose their positions in the HTML, or the expansion is put in an
  element carrying the transclusion's own position (`data-pos` of the `![[…]]`) and a mark of what it is
  (`data-transclusion="<page>"`, say); its tasks keep their refs to their page.
- Why (for the PR): an HTML of a text with `annotationPositions` should give positions in that text; a renderer's
  caller mapping positions back (a click, an edit) is misled by another page's positions.
- Test: a text embedding a page, rendered with both options: no position past the text's own, the expansion marked.

## Related: an escaped embed

`\![[Notes]]` is shown by SilverBullet as `!` and a link (probed 2026-11-17: `<span class="escape">!</span><a … data-pos="2">`),
but `shared/markdown/embed.ts` reads it as an embed (`readEmbeds`) and as no link (`readLinks`). Fixed on the branch
(commits above) and taken out with the rest: a fix of `shared/` reaching Silverware Assets, Database and Tags, to be
decided and released on its own.
