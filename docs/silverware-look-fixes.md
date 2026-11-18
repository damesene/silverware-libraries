# The surfaces' look mended to the page's

Status: planned 2026-11-18; Silverware Editor's part built the same day (branch `fix/editor-page-look`: all its
entries out but a rule's spaces on edge, below); the files' part the same day (`fix/assets-surfaces-look`, below);
Silverware Layout's to come. What `silverware-editor/ui-tests/look/surfaces.spec.ts`
found when its blocks grew (docs/silverware-look-compare.md, *Known differences*), mended plugin by plugin, each a
branch and a pull request of its own taking its entries out of the test's `KNOWN`.

## Decided with the user (2026-11-18)

- A grid's rendered cell stays SilverBullet's rendering (not Silverware Editor read-only: it would lose `${…}`, queries
  and code widgets, and add an editor per cell). What differs there is Silverware Layout's rules to mend.
- **What differs between SilverBullet's versions is read from the page, not a number of ours** (2.12.1's strong text is
  900, edge's code block inset 16 px, its headings 1.4 and 1.15 em): a sample of SilverBullet's editor (A, below),
  read as an editor is made.
- No cache of the sample at first: an editor is made by a press (a peek opened, a cell edited), the sample a few lines
  read once. Measured as it is built; a cache (keyed by the theme, the content's font size and column, cleared as the
  head's styles change) only if it takes more than about 2 ms. **Measured 2026-11-18** (2.12.1, a page of 400 lines):
  0.1 ms the median, 0.9 ms the most of 20: no cache.

## A: the page's editor's look, sampled

SilverBullet's editor draws a heading as a line `cm-line sb-line-h1` (its size, weight, padding) round a text
`sb-h1` (its colour), a strong text `sb-strong`, code `sb-code`, a fenced code block's lines `sb-line-fenced-code`, a
rule's line `sb-line-hr` (2.12.1 and edge alike, 2026-11-18; `client/style.ts`, `client/codemirror/editor_state.ts`,
`client/styles/editor.scss`). A few such lines are put beside the editor's content as a content of their own (its
class and its own style copied: a column, a zoom), hidden, read as computed and taken out at once, before the editor is
made: nothing drawn between, nothing jumps. Not in a database's place (a widget: inline code had no ground there), not
in the editor's content (CodeMirror reads its changes).

**Not read, left known**: a rule's line is a line high on 2.12.1 and 1 px on edge (its CodeMirror draws a line of no
text so, not its rules: nothing to read); the fields keep 2.12.1's, `KNOWN` tells edge's. A code block's text colour in
no language (SilverBullet's `--editor-code-color`) is not read: its language's parts and inline code have none of it.

- **Where it is known**: `shared/silverbullet/editorsample.ts` (SilverBullet's class names, the one place that knows
  them), giving `EditorLook`'s new parts: `heading1` to `heading3` (the line's and its text's), `strong`,
  `inlineCode`, `codeBlock` (its line: font, ground, inset), `rule` (its line, its spaces).
- **Who reads it**: Silverware Database's binding (`fieldLook`, beside the rendering's sample) and Silverware Layout's
  grid (`lookIn`, through its host: its core knows no SilverBullet).
- **What Silverware Editor draws by them** (`src/look.ts`): line classes and marks of its own to write them on
  (`swe-h1` to `swe-h6` lines, `swe-strong`, `swe-inline-code`; `swe-code-line`, `swe-hr` as they are), the look on the
  line or the mark alone: what is in it inherits it, what has a look of its own (a hashtag, a link) keeps it. So a
  heading's size, weight and colour, a strong text's weight and inline code's font and ground are no longer the
  highlight's on its spans (a span's own would outweigh the line's).
- **Sizes in em** (a font's of the text round it, the rest of the element's own font): a field's font zoomed while it
  is open (Silverware Layout's Ctrl+scroll) zooms them with it. A rule's line only where the page draws one (a border):
  else the editor's own line is kept.

## The parts

| Plugin | What | How | `KNOWN` entries it takes out |
| --- | --- | --- | --- |
| Silverware Editor | bold, code's font and inset, inline code's ground, headings' sizes, the space round headings and a rule | A, above | the fields' bold, inline code, code, return, headings, spaces |
| Silverware Assets | a preview 6 px higher; in a field not zoomed with the text; a link's icon in the text's colour | built 2026-11-18, each where it was: Silverware Assets' frame of its own drew its medium inline (a line's descent under it: now a block, as the page's frame has it); the peek is over the window, whose content's scale Silverware Layout keeps 1, while its text is the page's editor's size (Silverware Database's binding now hands the page's scale to its field with the font); the icon before a link's text was Silverware Editor's wrapper outside the link's colour (now its link's, a wiki link's or a markdown link's) | a file's preview, a link's icon |
| Silverware Layout | a rendered cell's headings, bold, code, quote, the spaces round headings and a rule | its style page's rules for a cell, by the theme's variables where they are, else A's sample | the grid's entries |

Each part: its test entries taken out, `npm run test:ui:sb` and `:edge` for the look folder and the plugin's own, a
release proposed once done.

## Silverware Layout: a rendered cell (2026-11-18)

- **A quote** (built): the theme's colours and ground (`--editor-blockquote-color`, `-background-color`,
  `-border-color`, on 2.12.1 and edge alike), its text after two of the page's columns, as the page's editor lays its
  `> ` out (`--editor-column`, else a character's width). Not sampled: SilverBullet sets a quote's indent on its line
  from its JavaScript, so a sample's line has none.
- **A code block highlighted** (decided with the user: A, Silverware Editor's highlighter through its API):
  SilverBullet's rendering highlights no code (`<pre data-lang="csharp">`, its lines between `<br>`s).
  - The contract (`shared/editor.ts`): `Editors.highlightCode?(code, language)`, the code's parts in order, each with
    the look it is drawn in (CSS properties; none: the text's own); none where the language is not known. Optional:
    an older Silverware Editor has none, and the code stays as SilverBullet renders it.
  - Silverware Editor: one table of the code's tokens' looks (`src/codemirror.ts`), its own highlight and this alike;
    CodeMirror and the language loaded first (a cell drawn before they are is highlighted once they are: its colours
    and weight alone change, not its room).
  - Silverware Layout's core asks its host once a grid is drawn (`GridHost.highlightCode?(grid)`); the binding
    (`host/silverbullet/`) knows SilverBullet's rendering: each `pre[data-lang]` not yet highlighted
    (`data-swl-highlighted`), its text read with its `<br>`s, its parts drawn as spans of their look between the same
    `<br>`s (the text's offsets as they were: a press in it still finds its markdown). A cell taken over unchanged
    keeps its highlighting.
- **Code's font and the rest** (headings' colour and size, bold, the space round headings and a rule, a code block's
  inset): by the theme's variables where they are; what is not, measured against the page as each is built.
