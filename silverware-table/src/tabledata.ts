// A table as data for what is outside Silverware Table: another plugin
// (`silverware.table.tables`) or a definition of the user's (the context of
// custom menu entries). Its name and its columns' names are given, as who
// calls it reads them (the entry from the metadata, a module through its
// host), so this reads no metadata.
import { columnKey, columnName } from "./columns.ts";
import { errorCodeIn } from "./formulas/index.ts";
import { type Table, unescapeCell } from "./markdown.ts";
import { withoutTags } from "./tags.ts";

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

/** `table` (at `from`…`to` of its text) as data; `name` its name, `fixedName` a column's name apart from its header (none: the header's) */
export function tableData(table: Table, place: { readonly from: number; readonly to: number }, name: string | undefined, fixedName: (column: number) => string | undefined): TableData {
  const header = table.rows[0]?.cells ?? [];
  return {
    ...(name ? { name } : {}),
    from: place.from,
    to: place.to,
    columns: header.map((cell, i) => {
      const shown = columnName(cell);
      return { name: fixedName(i) ?? shown, key: columnKey(shown) };
    }),
    // (An error as it shows, `#REF!`: its `#` escaped in the markdown so it is no hashtag, cellResult)
    rows: table.rows.slice(1).map((row) => row.cells.map((cell) => {
      const text = unescapeCell(withoutTags(cell)).trim();
      return errorCodeIn(text) ?? text;
    })),
  };
}
