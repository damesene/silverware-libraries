// A page's grids (Silverware Layout's columns, docs/silverware-layout-grid.md): where each is, its attributes, its
// cells and where their markdown is. Pure, on the page's text, line by line: SilverBullet reads a grid by a custom
// syntax (`syntax.define`, its block parser), which lezer's parser here does not know, so the same rules are kept by
// hand:
//
// - a grid opens at a line `<grid …>` alone (nothing before it on the line), where a block may start: not within a
//   fenced code block, not running on from a paragraph's line (a block parser of SilverBullet's custom syntax cannot
//   interrupt a paragraph);
// - it ends at the first line `</grid>` after it, wherever that is (SilverBullet's parser counts no nesting and looks
//   into no fenced code within); none: no grid (SilverBullet's parser takes none either);
// - within it a cell is the lines between `<column …>` and `</column>`, each alone on its line (a `</column>` in a
//   fenced code block within the cell does not close it); one left open runs to the grid's end. Lines between cells
//   belong to none.
//
// A cell's content is its lines without the blank ones at its start and end: blank lines around it are what other
// renderers need to read it as markdown (an HTML block runs to the next blank line), not the cell's.
import { type Attributes, readAttributes } from "./attributes.ts";
import { closesFence, fenceOf } from "./lines.ts";

/** One cell of a grid: its lines in the page, and its content's */
export type GridCell = {
  // From its `<column>` line's start to its `</column>` line's end (left open: the grid's body's end)
  readonly from: number;
  readonly to: number;
  // Between its two lines: from the line after `<column>` to the start of the line closing it (`</column>`, or
  // `</grid>` where it is left open), that line's line break before it included
  readonly innerFrom: number;
  readonly innerTo: number;
  // Whether it has its `</column>` (else it runs to the grid's end)
  readonly closed: boolean;
  // Its content: its lines without the blank ones at its start and end, where they are in the page
  readonly contentFrom: number;
  readonly contentTo: number;
  readonly content: string;
  readonly attributes: Attributes;
};

/** One grid of a page */
export type Grid = {
  // From its `<grid>` line's start to its `</grid>` line's end
  readonly from: number;
  readonly to: number;
  // Its text between those two lines (without the line break before `</grid>`)
  readonly bodyFrom: number;
  readonly bodyTo: number;
  readonly body: string;
  readonly attributes: Attributes;
  readonly cells: readonly GridCell[];
};

const OPEN = /^<grid(\s[^>]*)?>\s*$/;
const CLOSE = /^<\/grid>\s*$/;
const CELL_OPEN = /^<column(\s[^>]*)?>\s*$/;
const CELL_CLOSE = /^<\/column>\s*$/;
// Lines a block may follow at once: a heading, a closing fence and the like end their block by themselves
const ENDS_BLOCK = /^(#{1,6}(\s|$)|<\/grid>\s*$|(\*\s*){3,}$|(-\s*){3,}$|(_\s*){3,}$)/;

type TextLine = { readonly from: number; readonly to: number; readonly text: string };

/** A text's lines, each without its line break (a CR before it left out too) */
function lines(text: string): TextLine[] {
  const out: TextLine[] = [];
  let at = 0;
  for (;;) {
    const end = text.indexOf("\n", at);
    const stop = end < 0 ? text.length : end;
    out.push({ from: at, to: stop, text: text.slice(at, stop).replace(/\r$/, "") });
    if (end < 0) break;
    at = end + 1;
  }
  return out;
}

const blank = (line: TextLine | undefined) => line !== undefined && line.text.trim() === "";

/** The grids of a text, in order */
export function readGrids(text: string): Grid[] {
  const all = lines(text);
  const grids: Grid[] = [];
  let fence: string | undefined;
  // Whether the line before may be followed by a block: the text's start, a blank line, a block ended by its line
  let blockMayStart = true;
  for (let i = 0; i < all.length; i++) {
    const line = all[i]!;
    if (fence !== undefined) {
      if (closesFence(line.text, fence)) fence = undefined;
      blockMayStart = fence === undefined;
      continue;
    }
    const open = blockMayStart ? OPEN.exec(line.text) : null;
    if (open) {
      const end = all.findIndex((one, j) => j > i && CLOSE.test(one.text));
      if (end >= 0) {
        grids.push(grid(text, all, i, end, open[1] ?? ""));
        i = end;
        blockMayStart = true;
        continue;
      }
    }
    fence = fenceOf(line.text);
    blockMayStart = fence === undefined && (blank(line) || ENDS_BLOCK.test(line.text));
  }
  return grids;
}

const OPEN_LINE = "<grid>\n";

/**
 * A grid's cells as its body alone holds them (what SilverBullet hands a custom syntax's renderer: the lines between
 * `<grid …>` and `</grid>`, so no attributes), their places counted from the body's start
 */
export function readGridBody(body: string): readonly GridCell[] {
  const grid = readGrids(`${OPEN_LINE}${body}\n</grid>`)[0];
  if (!grid) return [];
  const shift = OPEN_LINE.length;
  return grid.cells.map((cell) => ({
    ...cell,
    from: cell.from - shift,
    to: Math.min(cell.to - shift, body.length),
    innerFrom: cell.innerFrom - shift,
    innerTo: Math.min(cell.innerTo - shift, body.length),
    contentFrom: cell.contentFrom - shift,
    contentTo: cell.contentTo - shift,
  }));
}

/** The grid from the line `open` to the line `close` */
function grid(text: string, all: readonly TextLine[], open: number, close: number, attributes: string): Grid {
  const first = all[open]!;
  const last = all[close]!;
  const bodyFrom = Math.min(first.to + 1, last.from);
  const bodyTo = Math.max(bodyFrom, last.from - 1);
  const cells: GridCell[] = [];
  let cell: { line: TextLine; index: number; attributes: string } | undefined;
  let fence: string | undefined;
  for (let j = open + 1; j < close; j++) {
    const line = all[j]!;
    if (!cell) {
      const m = CELL_OPEN.exec(line.text);
      if (m) cell = { line, index: j, attributes: m[1] ?? "" };
      continue;
    }
    if (fence !== undefined) {
      if (closesFence(line.text, fence)) fence = undefined;
      continue;
    }
    if (CELL_CLOSE.test(line.text)) {
      cells.push(cellOf(text, all, cell, j, line.to, true));
      cell = undefined;
      continue;
    }
    fence = fenceOf(line.text);
  }
  if (cell) cells.push(cellOf(text, all, cell, close, bodyTo, false));
  return {
    from: first.from,
    to: last.to,
    bodyFrom,
    bodyTo,
    body: text.slice(bodyFrom, bodyTo).replace(/\r$/, ""),
    attributes: readAttributes(attributes),
    cells,
  };
}

/** A cell from its `<column>` line to the line `end` (its `</column>`, or the grid's closing line where it is left open) */
function cellOf(text: string, all: readonly TextLine[], cell: { line: TextLine; index: number; attributes: string }, end: number, to: number, closed: boolean): GridCell {
  const innerTo = all[end]!.from;
  const innerFrom = Math.min(cell.line.to + 1, innerTo);
  // The content: the lines between, the blank ones at either end left out
  let first = cell.index + 1;
  let last = end - 1;
  while (first <= last && blank(all[first])) first++;
  while (last >= first && blank(all[last])) last--;
  const contentFrom = first <= last ? all[first]!.from : innerFrom;
  const contentTo = first <= last ? all[last]!.to : innerFrom;
  return {
    from: cell.line.from,
    to,
    innerFrom,
    innerTo,
    closed,
    contentFrom,
    contentTo,
    content: text.slice(contentFrom, contentTo).replace(/\r\n/g, "\n").replace(/\r$/, ""),
    attributes: readAttributes(cell.attributes),
  };
}
