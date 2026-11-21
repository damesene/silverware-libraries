// What AutoFill writes: the cells dragged over, from the cells selected, line
// by line (a column filled down or up, a row filled right or left).
import type { ModelCell, TableModel } from "../../../shared/table/model.ts";
import { EMPTY_CELL, withCellAt } from "../../../shared/table/ops.ts";
import { seriesFor } from "./registry.ts";

/** A cell of the markdown's table: its row (the header 0) and column */
export type Cell = { readonly row: number; readonly column: number };

/**
 * A line filled: the cells selected in it in order, and the cells dragged
 * over, nearest first (`backward`: before the selected ones, dragged up or left)
 */
export type FillLine = { readonly sources: readonly Cell[]; readonly targets: readonly Cell[]; readonly backward: boolean };

export type FillCells = {
  /** A copy of a cell another part makes (a formula, its references moved), or undefined: the cell is a value */
  readonly claim: (cell: ModelCell, from: Cell, to: Cell) => ModelCell | undefined;
  /** A cell written over the cell there: its content and its formula with it, the name there staying (ModelHost.cellWrittenOver) */
  readonly placed: (cell: ModelCell, over: ModelCell) => ModelCell;
};

/** A cell's text as AutoFill reads it */
export function cellValue(cell: ModelCell): string {
  return cell.content.trim();
}

/**
 * The cells a line's targets get, in their order. Where a selected cell is a
 * copy another part makes (a formula), the selected cells repeat as copies;
 * else their values go on with the first series that fits them (numbers,
 * dates, days…), or repeat.
 */
export function fillLine(table: TableModel, line: FillLine, cells: FillCells): ModelCell[] {
  const at = (cell: Cell) => table.rows[cell.row - 1]?.cells[cell.column] ?? EMPTY_CELL;
  const { sources, targets, backward } = line;
  const k = sources.length;
  if (k === 0) return targets.map((target) => ({ ...at(target), content: "" }));
  // The selected cell a target takes, as the selection repeats: nearest first, going away from it
  const sourceOf = (j: number) => (backward ? sources[k - 1 - (j % k)]! : sources[j % k]!);
  const value = (content: string): ModelCell => ({ content, attributes: EMPTY_CELL.attributes });
  if (sources.some((s) => cells.claim(at(s), s, s) !== undefined)) {
    return targets.map((target, j) => {
      const source = sourceOf(j);
      const copy = cells.claim(at(source), source, target) ?? value(cellValue(at(source)));
      return cells.placed(copy, at(target));
    });
  }
  const { next } = seriesFor(sources.map((s) => cellValue(at(s))));
  return targets.map((target, j) => cells.placed(value(next(backward ? -1 - j : k + j)), at(target)));
}

/** The table with every line filled */
export function filled(table: TableModel, lines: readonly FillLine[], cells: FillCells): TableModel {
  let result = table;
  for (const line of lines) {
    fillLine(table, line, cells).forEach((cell, j) => {
      const target = line.targets[j]!;
      result = withCellAt(result, target.row, target.column, cell);
    });
  }
  return result;
}
