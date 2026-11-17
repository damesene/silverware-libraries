// The blank lines of a cell's markdown as the editor shows them (docs/silverware-layout-grid.md, *Blank lines*): the
// editor shows each blank line of a page as a line of its own; the host's rendering of a cell (SilverBullet's
// markdownToHtml, 2.12.1, probed 2026-11-14) keeps those between paragraphs (as line breaks) and drops those next to a
// block (a list, a heading, a table, a code block) and between a loose list's items; in a quote alike, its blank lines
// its marks alone (`>`: kept as line breaks but between a loose list's items, probed 2026-11-17). The blank lines
// before a place in the markdown are found here, its lines read as markdown's parser reads them (shared/markdown/
// parse.ts: a quote's marks, a list item's, none in a code block); what the host drew of them is the drawing's
// (ui/cellparts.ts `spaceBefore`). Pure.
import { lineIndexAt, type MarkedLine } from "../../../../shared/markdown/lines.ts";

/**
 * The blank lines right before the line a place is on, the nearest first (`caretOn`: where a caret goes on one). In a
 * quote a blank line is one of its marks alone, the editor showing it as an empty line of the quote. One counts for a
 * place in a quote as deep or shallower (a deeper quote's last empty line, before the place, ends that quote), not for
 * a place deeper: a blank line shallower than the place's quote lies before that quote, its own. An empty item's line
 * (its marker alone) is none.
 * Read back from that line over them alone, not the text before: a cell's every line is asked for as it is drawn
 */
export function blankLinesAbove(lines: readonly MarkedLine[], at: number): readonly MarkedLine[] {
  const index = lineIndexAt(lines, at);
  // (The quotes the place is in on its line: those whose marks are before it)
  const depth = lines[index]!.quotes.filter((quote) => quote < at).length;
  const above: MarkedLine[] = [];
  for (let i = index - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (!line.empty || line.item || line.quotes.length < depth) break;
    above.push(line);
  }
  return above;
}

/**
 * Where a caret put on a blank line goes: past its last quote's mark (a quote's empty line, `>`: what is typed there
 * stays in the quote), else at its start (the spaces a line of white space holds not taken: four would make what is
 * typed a code block)
 */
export const caretOn = (line: MarkedLine): number => (line.quotes.length ? line.quotes.at(-1)! + 1 : line.from);
