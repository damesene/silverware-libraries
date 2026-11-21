import { describe, expect, it } from "vitest";
import { escapeCell, parseTable, serializeTable, type Table } from "../markdown.ts";
import { followColumnMeta } from "../meta.ts";
import * as markdown from "../testing/markdownops.ts";
import { decode, encode } from "../store/markdown/codec.ts";
import { cellTags } from "../tags.ts";
import { attributeIn, type TableModel } from "./model.ts";
import * as ops from "./ops.ts";

// A table with what every row and cell may hold: hidden tags, a row's name, an escape, a metadata row
const TABLE = parseTable(
  [
    "| Item | Qty | Note |",
    "|:--|--:|---|",
    "| Pear <meta core.n='pear'> | 3 <meta formulas.f='=1+2'> | a \\| b |",
    "| Fig | 10 | |",
    "| Plum | 7 <meta core.cn='seven'> | x |",
    "| <meta core.table core.name='fruit' widths.-c-qty.size='90'> |",
  ].join("\n"),
);

/** The model's operation written back, as markdown */
const written = (change: (model: TableModel) => TableModel, table: Table = TABLE) => serializeTable(encode(change(decode(table)), table));
/** Today's operation on the markdown, as markdown */
const md = (table: Table) => serializeTable(table);

describe("the model's operations, written back as the markdown's are", () => {
  it("rows inserted, deleted, duplicated, moved and reordered: each other row as it was written", () => {
    expect(written((m) => ops.insertRow(m, 2))).toBe(md(markdown.insertRow(TABLE, 2)));
    expect(written((m) => ops.insertRow(m, 99))).toBe(md(markdown.insertRow(TABLE, 99)));
    expect(written((m) => ops.deleteRow(m, 2))).toBe(md(markdown.deleteRow(TABLE, 2)));
    expect(written((m) => ops.duplicateRow(m, 2))).toBe(md(markdown.duplicateRow(TABLE, 2)));
    expect(written((m) => ops.moveRow(m, 1, 3))).toBe(md(markdown.moveRow(TABLE, 1, 3)));
    expect(written((m) => ops.moveRows(m, 1, 2, 2))).toBe(md(markdown.moveRows(TABLE, 1, 2, 2)));
    expect(written((m) => ops.reorderRows(m, [3, 1, 2]))).toBe(md(markdown.reorderRows(TABLE, [3, 1, 2])));
  });

  it("columns inserted, deleted and moved, their attributes with them", () => {
    expect(written((m) => ops.insertColumn(m, 1))).toBe(md(markdown.insertColumn(TABLE, 1)));
    expect(written((m) => ops.moveColumn(m, 0, 2))).toBe(md(markdown.moveColumn(TABLE, 0, 2)));
    expect(written((m) => ops.moveColumns(m, 0, 1, 1))).toBe(md(markdown.moveColumns(TABLE, 0, 1, 1)));
    expect(written((m) => ops.withAlign(m, 2, "center"))).toBe(md(markdown.setAlign(TABLE, 2, "center")));
    // The width goes with its column
    const moved = ops.moveColumn(decode(TABLE), 1, 0);
    expect(attributeIn(moved.columns[0]!.attributes, "widths", "size")).toBe("90");
    // A column deleted: its attributes kept as written by the codec, which cannot tell it from one that may come back (a
    // view's); the write's column map says it went, and the core's write step takes them off
    const deleted = encode(ops.deleteColumn(decode(TABLE), 1), TABLE);
    expect(deleted.meta).toHaveProperty("widths.-c-qty.size", "90");
    expect(followColumnMeta(TABLE, deleted, (c) => (c === 1 ? undefined : c > 1 ? c - 1 : c)).meta).not.toHaveProperty("widths.-c-qty.size");
  });

  it("a cell's content set keeps its attributes, as a value kept with the cell's tags", () => {
    expect(written((m) => ops.withContentAt(m, 2, 2, "a | c"))).toBe(md(markdown.setCell(TABLE, 2, 2, escapeCell("a | c"))));
    // (The content written with the cell's tags as they were)
    expect(written((m) => ops.withContentAt(m, 3, 1, "8"))).toBe(md(markdown.setCell(TABLE, 3, 1, ["8", ...cellTags(TABLE.rows[3]!.cells[1]!)].join(" "))));
    const model = decode(TABLE);
    expect(ops.withContentAt(model, 3, 1, "7")).toBe(model);
  });

  it("a header set, a new column named past the others", () => {
    expect(written((m) => ops.withHeader(m, 2, "Notes"))).toBe(md(markdown.setCell(TABLE, 0, 2, "Notes")));
    const empty = parseTable("| A |  | Column 2 |\n|---|---|---|\n| 1 | 2 | 3 |");
    expect(ops.newColumnName(decode(empty))).toBe(markdown.newColumnName(empty));
  });

  it("changes nothing where there is nothing to change: the same table", () => {
    const model = decode(TABLE);
    for (const same of [ops.deleteRow(model, 0), ops.deleteRow(model, 9), ops.moveRow(model, 1, 1), ops.moveColumn(model, 0, 9), ops.withHeader(model, 0, "Item"), ops.withAlign(model, 1, "right"), ops.reorderRows(model, [1, 2])]) {
      expect(same).toBe(model);
    }
    expect(ops.deleteColumn(decode(parseTable("| A |\n|---|\n| 1 |")), 0).columns).toHaveLength(1);
  });
});
