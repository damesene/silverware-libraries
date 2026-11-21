// A table as data for what is outside Silverware Table: another plugin
// (`silverware.table.tables`) or a definition of the user's (the context of
// custom menu entries). Read off the model: its cells' content (no hidden tag,
// no escape), its columns' headers and own names; its name is given, as who
// calls it reads it (the entry from the metadata, a module through its host).
import { columnKey, columnName } from "../../shared/table/columns.ts";
import { errorCodeIn } from "../../shared/formulas/index.ts";
import type { TableModel } from "../../shared/table/model.ts";
import { modelColumnName } from "../../shared/table/names.ts";

/** A table as data: its name, its place in the text, its columns, its body's cells */
export type TableData = {
  readonly name?: string;
  readonly from: number;
  readonly to: number;
  // Each column's name (its fixed one, else its header's) and the key SilverBullet's index gives it
  readonly columns: readonly { readonly name: string; readonly key: string }[];
  // The body's cells as they show (hidden tags left out), row by row; no metadata row
  readonly rows: readonly (readonly string[])[];
};

/** `table` (at `from`…`to` of its text) as data; `name` its name */
export function tableData(table: TableModel, place: { readonly from: number; readonly to: number }, name: string | undefined): TableData {
  return {
    ...(name ? { name } : {}),
    from: place.from,
    to: place.to,
    columns: table.columns.map((column, i) => {
      const shown = columnName(column.header);
      return { name: modelColumnName(table, i) ?? shown, key: columnKey(shown) };
    }),
    // (An error as it shows, `#REF!`: a formula's result, whichever form it was written in, cellResult)
    rows: table.rows.map((row) => row.cells.map((cell) => {
      const text = cell.content.trim();
      return errorCodeIn(text) ?? text;
    })),
  };
}
