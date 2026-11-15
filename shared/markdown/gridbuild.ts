// A grid built from a page's blocks and taken apart again (docs/silverware-layout-grid.md, *Building a grid from the
// page*): the blocks a selection touches (a paragraph, each item of a list, a task, a heading, a table, code, a
// quote, an image's line), put into cells by a mode (`gallery`: a cell each, N to a row; `split`: in order, cut into N
// columns by their number), and a grid's cells put back one under another in their order (the inverse of both). Its
// cells moved, one added, one taken out. What the page writer's `grids` part writes; pure, on the text. Blocks are
// read by parse.ts (lezer's parser, as SilverBullet's), so this is apart from grid.ts, which reads a line at a time.
import { type Attributes, writeAttributes } from "./attributes.ts";
import type { Grid } from "./grid.ts";
import { type MarkdownNode, parseBlocks } from "./parse.ts";

export type GridMode = "gallery" | "split";

/** A block of the text: where it is, and whether it is a list's item (items one after another stay one list) */
export type TextBlock = { readonly from: number; readonly to: number; readonly item: boolean };

const isItem = (node: MarkdownNode) => node.kind === "item";

/**
 * The blocks a range of the text touches, at the text's top level (a list's items each, what is nested in an item
 * with it; a paragraph's lines each, as the editor shows them apart: `1⏎2` two blocks as `1⏎⏎2` is, the user's word,
 * 2026-11-14); an empty range: the block it is in. None in the frontmatter or a grid (a grid is no block to put into one)
 */
export function blocksIn(text: string, from: number, to: number, grids: readonly Grid[] = []): TextBlock[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return parseBlocks(text)
    .filter((node) => !grids.some((grid) => node.from < grid.to && node.to > grid.from))
    .flatMap((node): TextBlock[] => (node.kind === "paragraph" ? linesOf(text, node.from, node.to) : [{ from: node.from, to: node.to, item: isItem(node) }]))
    .filter((block) => (hi === lo ? block.from <= lo && lo <= block.to : block.from < hi && block.to > lo));
}

/** A paragraph's lines, each a block of its own (its empty ones none) */
function linesOf(text: string, from: number, to: number): TextBlock[] {
  const lines: TextBlock[] = [];
  let at = from;
  for (const line of text.slice(from, to).split("\n")) {
    const end = at + line.replace(/\r$/, "").length;
    if (line.trim()) lines.push({ from: at, to: end, item: false });
    at += line.length + 1;
  }
  return lines;
}

/** Blocks' texts joined as they were apart in the text: a line break where only one was between them (a paragraph's lines, a list's items), else a blank line */
function joined(text: string, blocks: readonly TextBlock[]): string {
  let out = "";
  blocks.forEach((block, i) => {
    if (i > 0) {
      const before = blocks[i - 1]!;
      const tight = !/\n[ \t]*\r?\n/.test(text.slice(before.to, block.from));
      out += tight ? "\n" : "\n\n";
    }
    // (From its line's start where only spaces lie before it: an indented code block's first line keeps its indent)
    const lineStart = text.lastIndexOf("\n", block.from - 1) + 1;
    const start = /^[ \t]*$/.test(text.slice(lineStart, block.from)) ? lineStart : block.from;
    out += text.slice(start, block.to).replace(/\r\n/g, "\n");
  });
  return out;
}

/** How N columns take K blocks in order: by their number, the first ones one more where they do not divide */
export function splitCounts(blocks: number, columns: number): number[] {
  const n = Math.max(1, Math.min(columns, blocks));
  const base = Math.floor(blocks / n);
  return Array.from({ length: n }, (_, i) => base + (i < blocks % n ? 1 : 0));
}

/** A grid's text of cells (each its markdown) and attributes, in the form the page writer writes a cell: a blank line around its content */
export function gridText(cells: readonly string[], attributes: Attributes = {}): string {
  return `<grid${writeAttributes(attributes)}>\n${cells.map((cell) => `<cell>\n\n${cell}${cell ? "\n" : ""}\n</cell>\n`).join("")}</grid>`;
}

/** A grid's number of columns as it is put together: a count, or `auto` (a gallery's: as many as fit) */
export type GridColumns = number | "auto";
// A split asked for columns as many as fit: cut into this many
const SPLIT_FIT = 2;

/** The cells a mode makes of blocks, and the grid's attributes */
export function cellsOf(text: string, blocks: readonly TextBlock[], mode: GridMode, columns: GridColumns): { readonly cells: string[]; readonly attributes: Attributes } {
  if (mode === "gallery") return { cells: blocks.map((block) => joined(text, [block])), attributes: { columns: String(columns) } };
  const cells: string[] = [];
  let at = 0;
  for (const count of splitCounts(blocks.length, columns === "auto" ? SPLIT_FIT : columns)) {
    cells.push(joined(text, blocks.slice(at, at + count)));
    at += count;
  }
  return { cells, attributes: {} };
}

/** The edit putting a run of blocks into a grid: their range replaced, a blank line kept before and after it (a grid cannot run on from a paragraph's line) */
export function gridOfBlocks(text: string, blocks: readonly TextBlock[], mode: GridMode, columns: GridColumns): { readonly from: number; readonly to: number; readonly insert: string } | undefined {
  if (!blocks.length) return undefined;
  const { cells, attributes } = cellsOf(text, blocks, mode, columns);
  const from = blocks[0]!.from;
  const to = blocks.at(-1)!.to;
  return { from, to, insert: spaced(text, from, to, gridText(cells, attributes)) };
}

/** A block's text put in a range: a blank line before it where a line with text is just above, after it where one is just below */
function spaced(text: string, from: number, to: number, insert: string): string {
  const lineAbove = text.slice(0, from).replace(/\r?\n$/, "").split("\n").pop() ?? "";
  const above = from > 0 && text.slice(0, from).endsWith("\n") && lineAbove.trim() ? "\n" : "";
  const rest = text.slice(to);
  const below = /^\r?\n[ \t]*\S/.test(rest) ? "\n" : "";
  return above + insert + below;
}

/** A grid's cells one under another, in their order (row by row), each cell's markdown as written: the grid taken apart */
export function ungridded(grid: Grid): string {
  // Each cell's content, and what lies between the cells in the grid's body (a line written there by hand), in order
  const texts: string[] = [];
  let at = grid.bodyFrom;
  for (const cell of grid.cells) {
    texts.push(grid.body.slice(at - grid.bodyFrom, cell.from - grid.bodyFrom).trim(), cell.content);
    at = cell.to;
  }
  texts.push(grid.body.slice(at - grid.bodyFrom).trim());
  const parts: { readonly text: string; readonly items: readonly MarkdownNode[] }[] = texts
    .map((content) => content.replace(/\r\n/g, "\n"))
    .filter((content) => content.trim())
    .map((content) => ({ text: content, items: parseBlocks(content) }));
  let out = "";
  parts.forEach((part, i) => {
    if (i > 0) {
      // Items of one list split into two cells: one list again (as `put into grid` read them); a cell ending in a line of
      // text and the next starting with one: a line break between (a paragraph's lines put into cells), as before
      // they were put there (two paragraphs a blank line apart come back a line break apart: the grid keeps no more)
      const before = parts[i - 1]!;
      const last = before.items.at(-1);
      const first = part.items[0];
      const oneList = last?.kind === "item" && first?.kind === "item" && last.list === first.list;
      const lineOfText = (node: MarkdownNode | undefined, of: string) => node?.kind === "paragraph" && !of.slice(node.from, node.to).trim().includes("\n");
      out += oneList || (lineOfText(last, before.text) && lineOfText(first, part.text)) ? "\n" : "\n\n";
    }
    out += part.text;
  });
  return out;
}

/** How blocks moved into a grid are put there: `together` all in one cell, `each` a cell each */
export type MoveMode = "together" | "each";

/**
 * Where in a grid blocks moved go: new cells before its `at`-th cell (as many as it has: after the last), or into its
 * `cell`-th cell at an offset of its content (a block's start, as the cell's rendering marks it; past its end: at its end)
 */
export type GridPlace = { readonly kind: "cells"; readonly at: number } | { readonly kind: "cell"; readonly cell: number; readonly at: number; readonly was?: string };

// A grid's or a cell's own line, which moved into a cell would end it
const GRID_LINE = /^<\/?(grid|cell)(\s[^>]*)?>\s*$/im;

/**
 * Blocks of the text moved into a grid of it, as one edit: taken out of where they are (their lines, the blank lines
 * round them left as one), put into the grid by a mode at a place; why not, as text. The grid lies before or after them
 * (none of them in a grid: `blocksIn`)
 */
export function movedIntoGrid(text: string, blocks: readonly TextBlock[], grid: Grid, mode: MoveMode, place: GridPlace): { readonly text: string } | { readonly problem: string } {
  if (!blocks.length) return { problem: "no block to move there" };
  const from = blocks[0]!.from;
  const to = blocks.at(-1)!.to;
  if (from < grid.to && to > grid.from) return { problem: "the text moved takes in the grid it goes into" };
  const contents = mode === "each" ? blocks.map((block) => joined(text, [block])) : [joined(text, blocks)];
  if (contents.some((content) => GRID_LINE.test(content))) return { problem: "the text moved has a grid's or a cell's line of its own" };
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const into = intoGrid(text, grid, contents, place, nl);
  if (!into) return { problem: "that cell changed since it was drawn" };
  const out = outOfText(text, from, to, nl);
  // (The later edit first: the earlier's place stays as it was read)
  const [first, second] = into.from > out.from ? [into, out] : [out, into];
  const once = text.slice(0, first.from) + first.insert + text.slice(first.to);
  return { text: once.slice(0, second.from) + second.insert + once.slice(second.to) };
}

type Edit = { readonly from: number; readonly to: number; readonly insert: string };

/** A cell's text whole, as the page writer writes one: a blank line before and after its content */
const cellOf = (content: string, nl: string) => `<cell>${nl}${nl}${content.replace(/\n/g, nl)}${nl}${nl}</cell>`;

/** The edit of a grid putting contents at a place: new cells, or one cell's content with them added */
function intoGrid(text: string, grid: Grid, contents: readonly string[], place: GridPlace, nl: string): Edit | undefined {
  const cells = grid.cells;
  // A cell's text whole, its `</cell>` written where it was left open
  const whole = (cell: Grid["cells"][number]) => (cell.closed ? text.slice(cell.from, cell.to) : `${text.slice(cell.from, cell.to).replace(/\s+$/, "")}${nl}</cell>`);
  if (place.kind === "cells") {
    const added = contents.map((content) => cellOf(content, nl)).join(nl);
    const before = cells[Math.max(0, place.at)];
    if (before) return { from: before.from, to: before.from, insert: added + nl };
    const last = cells.at(-1);
    if (!last) return { from: grid.bodyFrom, to: grid.bodyFrom, insert: added + nl };
    // (After its `</cell>` line, its line break included; one left open closed first)
    if (!last.closed) return { from: last.from, to: last.to, insert: whole(last) + nl + added };
    const end = /^\r?\n/.exec(text.slice(last.to))?.[0].length ?? 0;
    return end ? { from: last.to + end, to: last.to + end, insert: added + nl } : { from: last.to, to: last.to, insert: nl + added };
  }
  const cell = cells[place.cell];
  const content = cell?.content.replace(/\r\n/g, "\n");
  // (Its offset is of its content as it was drawn: another content now, the offset none of it)
  if (!cell || content === undefined || (place.was !== undefined && place.was.replace(/\r\n/g, "\n").trim() !== content.trim())) return undefined;
  const moved = contents.join("\n\n");
  let next: string;
  if (!content.trim()) next = moved;
  else if (place.at <= 0) next = `${moved}\n\n${content.replace(/^(?:[ \t]*\n)+/, "")}`;
  else if (place.at >= content.replace(/\s+$/, "").length) next = `${content.replace(/\s+$/, "")}\n\n${moved}`;
  else next = `${content.slice(0, place.at).replace(/\s+$/, "")}\n\n${moved}\n\n${content.slice(place.at).replace(/^(?:[ \t]*\n)+/, "")}`;
  // (Between its two lines, as `replaceCell` writes it: a blank line before and after; one left open closed)
  return { from: cell.innerFrom, to: cell.innerTo, insert: nl + next.replace(/\n/g, nl) + nl + nl + (cell.closed ? "" : `</cell>${nl}`) };
}

/** What a line starts, as far as lines run on: a list's item, a line of text, or anything else (a heading, a fence, a quote, a tag's line, code, a table) */
function lineKind(line: string): "item" | "text" | "other" {
  if (/^[ \t]*([-*+]|\d+[.)])[ \t]/.test(line)) return "item";
  if (!line.trim() || /^( {4}|\t)/.test(line) || /^[ \t]*(#{1,6}([ \t]|$)|```|~~~|>|<|\|)/.test(line)) return "other";
  return "text";
}

/**
 * The edit taking a run of blocks out of the text: their lines whole. What was round them runs on (a line break) only
 * where it did and the lines on both sides and the first taken out are one kind, lines of text or a list's items (a
 * paragraph's line or an item taken out of it); else a blank line between, as a heading or a grid needs one after a
 * paragraph's line
 */
function outOfText(text: string, from: number, to: number, nl: string): Edit {
  const lineStart = text.lastIndexOf("\n", from - 1) + 1;
  const end = text.indexOf("\n", to);
  const before = text.slice(0, lineStart);
  const after = end < 0 ? "" : text.slice(end + 1);
  // (The line before kept as it ends, its spaces too: two are a line break)
  const kept = before.replace(/\r?\n(?:[ \t]*\r?\n)*$/, "");
  const rest = after.replace(/^(?:[ \t]*\r?\n)+/, "");
  const blank = /\n[ \t]*\r?\n$/.test(before) || /^[ \t]*\r?\n/.test(after);
  const kind = lineKind(text.slice(lineStart, text.indexOf("\n", lineStart) < 0 ? text.length : text.indexOf("\n", lineStart)));
  const runsOn = !blank && kind !== "other" && lineKind(kept.slice(kept.lastIndexOf("\n") + 1)) === kind && lineKind(rest.split("\n")[0]!) === kind;
  const between = !kept ? "" : !rest ? (end < 0 ? "" : nl) : runsOn ? nl : nl + nl;
  return { from: kept.length, to: text.length - rest.length, insert: between };
}

