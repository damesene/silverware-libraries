// The model's own names: a line's (a column's own, apart from its header; a
// row's) and a body cell's, the core's attributes (`CORE`) at the column, the
// row, the cell. Formulas refer by them (`pear[price]`, `prices!vat`), so they
// move with their cells and references never need rewriting. How a store
// keeps them is its own (Silverware Table's markdown: a hidden tag in the
// cell, `<meta core.n='pear'>`).
import { attributeIn, attributesAt, CORE, NO_ATTRIBUTES, type TableModel, withAttributeIn, withAttributesAt } from "./model.ts";

/** The core's keys of names: a line's (a column's own, a row's), a cell's */
export const LINE_NAME_KEY = "n";
export const CELL_NAME_KEY = "cn";

/** A named row: its name as written, its row (of the body: the first 1) */
export type RowName = { readonly name: string; readonly row: number };

/** A named body cell: its name as written, its row (the body from 1) and column */
export type CellNameAt = { readonly name: string; readonly row: number; readonly column: number };

/** A model's column's own name, a row's (`row` from 1), a body cell's: the core's attributes there */
export function modelColumnName(model: TableModel, column: number): string | undefined {
  return attributeIn(attributesAt(model, { column }) ?? NO_ATTRIBUTES, CORE, LINE_NAME_KEY);
}

export function modelRowName(model: TableModel, row: number): string | undefined {
  return attributeIn(attributesAt(model, { row }) ?? NO_ATTRIBUTES, CORE, LINE_NAME_KEY);
}

export function modelCellName(model: TableModel, row: number, column: number): string | undefined {
  return attributeIn(attributesAt(model, { row, column }) ?? NO_ATTRIBUTES, CORE, CELL_NAME_KEY);
}

/** A model with a column's, a row's or a cell's name set (undefined: unnamed); the core's attribute, written by a store where it keeps names */
export function withModelName(model: TableModel, at: { readonly column: number; readonly row?: undefined } | { readonly row: number; readonly column?: number }, name: string | undefined): TableModel {
  const key = at.row !== undefined && at.column !== undefined ? CELL_NAME_KEY : LINE_NAME_KEY;
  return withAttributesAt(model, at, (attributes) => withAttributeIn(attributes, CORE, key, name || undefined));
}

/** A model's named rows, in their order (rows from 1, as the markdown's body) */
export function modelRowNames(model: TableModel): RowName[] {
  return model.rows.flatMap((r, i) => {
    const name = attributeIn(r.attributes, CORE, LINE_NAME_KEY);
    return name ? [{ name, row: i + 1 }] : [];
  });
}

/** A model's named body cells, in their order (rows from 1) */
export function modelCellNames(model: TableModel): CellNameAt[] {
  return model.rows.flatMap((r, i) =>
    r.cells.flatMap((cell, column) => {
      const name = attributeIn(cell.attributes, CORE, CELL_NAME_KEY);
      return name ? [{ name, row: i + 1, column }] : [];
    }),
  );
}
