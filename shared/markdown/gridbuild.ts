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
 * with it); an empty range: the block it is in. None in the frontmatter or a grid (a grid is no block to put into one)
 */
export function blocksIn(text: string, from: number, to: number, grids: readonly Grid[] = []): TextBlock[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return parseBlocks(text)
    .filter((node) => (hi === lo ? node.from <= lo && lo <= node.to : node.from < hi && node.to > lo))
    .filter((node) => !grids.some((grid) => node.from < grid.to && node.to > grid.from))
    .map((node) => ({ from: node.from, to: node.to, item: isItem(node) }));
}

/** Blocks' texts joined as they were apart in the text: a blank line between, none between items of one list where none was */
function joined(text: string, blocks: readonly TextBlock[]): string {
  let out = "";
  blocks.forEach((block, i) => {
    if (i > 0) {
      const before = blocks[i - 1]!;
      const tight = before.item && block.item && !/\n[ \t]*\r?\n/.test(text.slice(before.to, block.from));
      out += tight ? "\n" : "\n\n";
    }
    out += text.slice(block.from, block.to).replace(/\r\n/g, "\n");
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
  return `<grid${writeAttributes(attributes)}>\n${cells.map((cell) => `<column>\n\n${cell}${cell ? "\n" : ""}\n</column>\n`).join("")}</grid>`;
}

/** The cells a mode makes of blocks, and the grid's attributes */
export function cellsOf(text: string, blocks: readonly TextBlock[], mode: GridMode, columns: number): { readonly cells: string[]; readonly attributes: Attributes } {
  if (mode === "gallery") return { cells: blocks.map((block) => joined(text, [block])), attributes: { columns: String(columns) } };
  const cells: string[] = [];
  let at = 0;
  for (const count of splitCounts(blocks.length, columns)) {
    cells.push(joined(text, blocks.slice(at, at + count)));
    at += count;
  }
  return { cells, attributes: {} };
}

/** The edit putting a run of blocks into a grid: their range replaced, a blank line kept before and after it (a grid cannot run on from a paragraph's line) */
export function gridOfBlocks(text: string, blocks: readonly TextBlock[], mode: GridMode, columns: number): { readonly from: number; readonly to: number; readonly insert: string } | undefined {
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
      // Items of one list split into two cells: one list again (as `put into grid` read them)
      const last = parts[i - 1]!.items.at(-1);
      const first = part.items[0];
      const oneList = last?.kind === "item" && first?.kind === "item" && last.list === first.list;
      out += oneList ? "\n" : "\n\n";
    }
    out += part.text;
  });
  return out;
}
