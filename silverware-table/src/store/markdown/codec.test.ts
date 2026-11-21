import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { followColumnMeta } from "../../testing/markdownops.ts";
import { describe, expect, it } from "vitest";
import { withColumnType } from "../../columntypes/registry.ts";
import { findTables, parseTable, serializeTable, type Table } from "../../markdown.ts";
import { columnValues, metaValue, withColumnValues, withMetaSort, withMetaValue } from "../../meta.ts";
import { attributeIn, type ModelCell, type TableModel, withAttributeIn } from "../../model/model.ts";
import { duplicateRow, insertColumn, withContentAt, withHeader } from "../../model/ops.ts";
import { reorderRows, setCell } from "../../testing/markdownops.ts";
import { cellTags } from "../../tags.ts";
import { withTagValue } from "../../tagvalues.ts";
import { HASHTAGS_KEY, headerText, withHeaderText } from "../../columns.ts";
import { decode, decodeCell, encode, encodeCell, plainMarkdown } from "./codec.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = readFileSync(join(here, "../../../../playground/sample.md"), "utf8");

// Tables of every form the codec reads: hidden tags in cells and headers, names, hashtags, escapes, a metadata row
// with the table's and its columns' attributes (one naming no column), padding, an indent, quotes in values
const FORMS = [
  "| Name | Qty |\n|---|---|\n| Pear | 3 |\n| apple | 10 |",
  "| Item <meta core.n='item'> | Price #currency-usd | Note #x #y |\n|:---|--:|:-:|\n| Pear <meta core.n='pear' core.cn='p'> | 12 <meta formulas.f='=B3*2'> | a \\| b |\n| Fig | 3 <meta core.cn='fig'> <meta other='x'> | |",
  "| A | B |\n|---|---|\n| 1 | 2 |\n| <meta core.table core.name='t' core.-c-b.sort='desc' widths.-c-gone.size='9' note='say &quot;hi&quot;'> |",
  "| Name  | Qty |\n| ----- | --- |\n| Pear  | 3   |\n| apple | 10  |",
  "  | A |\n  |---|\n  | 1 |",
  "| Qty | Qty |\n|---|---|\n| 1 | 2 |\n| <meta core.table filters.-c-qty:2.condition='&gt;1'> |",
];

const md = (table: Table) => serializeTable(table);
const sampleTables = findTables(SAMPLE).map((range) => parseTable(range.text));

/** The model with one cell changed */
function withCell(model: TableModel, row: number, column: number, change: (cell: ModelCell) => ModelCell): TableModel {
  return { ...model, rows: model.rows.map((r, i) => (i !== row - 1 ? r : { ...r, cells: r.cells.map((c, j) => (j === column ? change(c) : c)) })) };
}

describe("the markdown codec", () => {
  it("writes back every table as it was read, the same table, byte for byte", () => {
    expect(sampleTables.length).toBeGreaterThan(5);
    for (const table of [...sampleTables, ...FORMS.map(parseTable)]) {
      expect(encode(decode(table), table)).toBe(table);
      // A model made anew from it (no object of it kept): the same markdown
      const model = decode(table);
      const anew: TableModel = { columns: model.columns.map((c) => ({ ...c })), rows: model.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c })) })), attributes: model.attributes };
      expect(md(encode(anew, table))).toBe(md(table));
    }
  });

  it("reads a column's header, hashtags, own name and metadata row's attributes; a row's name; a cell's content and tags", () => {
    const model = decode(parseTable(FORMS[1]!));
    expect(model.columns.map((c) => c.header)).toEqual(["Item", "Price", "Note"]);
    expect(model.columns.map((c) => c.align)).toEqual(["left", "right", "center"]);
    expect(attributeIn(model.columns[0]!.attributes, "core", "n")).toBe("item");
    expect(attributeIn(model.columns[1]!.attributes, "core", HASHTAGS_KEY)).toBe("#currency-usd");
    expect(attributeIn(model.columns[2]!.attributes, "core", HASHTAGS_KEY)).toBe("#x #y");
    expect(attributeIn(model.rows[0]!.attributes, "core", "n")).toBe("pear");
    expect(model.rows[0]!.cells.map((c) => c.content)).toEqual(["Pear", "12", "a | b"]);
    expect(attributeIn(model.rows[0]!.cells[0]!.attributes, "core", "cn")).toBe("p");
    expect(attributeIn(model.rows[0]!.cells[0]!.attributes, "core", "n")).toBeUndefined();
    expect(attributeIn(model.rows[0]!.cells[1]!.attributes, "formulas", "f")).toBe("=B3*2");
    expect(attributeIn(model.rows[1]!.cells[1]!.attributes, "", "other")).toBe("x");
    const meta = decode(parseTable(FORMS[2]!));
    expect(attributeIn(meta.attributes, "core", "name")).toBe("t");
    expect(attributeIn(meta.attributes, "", "note")).toBe('say "hi"');
    expect(attributeIn(meta.columns[1]!.attributes, "core", "sort")).toBe("desc");
    const shared = decode(parseTable(FORMS[5]!));
    expect(attributeIn(shared.columns[1]!.attributes, "filters", "condition")).toBe(">1");
    expect(attributeIn(shared.columns[0]!.attributes, "filters", "condition")).toBeUndefined();
  });

  describe("writes a change as the writers before the model wrote it", () => {
    const table = parseTable(FORMS[1]!);
    const model = decode(table);

    it("a cell's formula, into the tags it has", () => {
      const before = setCell(table, 2, 1, withTagValue(table.rows[2]!.cells[1]!, "formulas.f", "=A1"));
      const after = encode(withCell(model, 2, 1, (c) => ({ ...c, attributes: withAttributeIn(c.attributes, "formulas", "f", "=A1") })), table);
      expect(md(after)).toBe(md(before));
      const set = setCell(table, 1, 1, withTagValue(table.rows[1]!.cells[1]!, "formulas.f", "=B3*3"));
      expect(md(encode(withCell(model, 1, 1, (c) => ({ ...c, attributes: withAttributeIn(c.attributes, "formulas", "f", "=B3*3") })), table))).toBe(md(set));
    });

    it("a cell's content, its tags kept", () => {
      const before = setCell(table, 1, 1, ["14", ...cellTags(table.rows[1]!.cells[1]!)].join(" "));
      expect(md(encode(withCell(model, 1, 1, (c) => ({ ...c, content: "14" })), table))).toBe(md(before));
      // A | in it escaped
      const piped = setCell(table, 2, 0, "a \\| b");
      expect(md(encode(withCell(model, 2, 0, (c) => ({ ...c, content: "a | b" })), table))).toBe(md(piped));
    });

    it("a cell's content, the row's cells past its header's kept", () => {
      const wide = parseTable("| A | B |\n|---|---|\n| 1 | 2 | extra |");
      expect(md(encode(withCell(decode(wide), 1, 0, (c) => ({ ...c, content: "x" })), wide))).toBe(md(setCell(wide, 1, 0, "x")));
      // Every cell of the row made anew (cleared, pasted over), or a one-column table's: still the row's
      const read = decode(wide);
      const cleared = { ...read, rows: [{ ...read.rows[0]!, cells: read.rows[0]!.cells.map(() => ({ content: "", attributes: new Map() })) }] };
      expect(md(encode(cleared, wide))).toBe(md(setCell(setCell(wide, 1, 0, ""), 1, 1, "")));
      const single = parseTable("| A |\n|---|\n| 1 | x |");
      expect(md(encode(withCell(decode(single), 1, 0, () => ({ content: "2", attributes: new Map() })), single))).toBe("| A |\n|---|\n| 2 | x |");
    });

    it("a row's name in the cell holding it as that cell's content changes", () => {
      const second = parseTable("| A | B |\n|---|---|\n| 1 | 2 <meta core.n='two'> |");
      const read = decode(second);
      expect(attributeIn(read.rows[0]!.attributes, "core", "n")).toBe("two");
      const changed = encode(withCell(read, 1, 1, (c) => ({ ...c, content: "5" })), second);
      expect(md(changed)).toBe(md(setCell(second, 1, 1, ["5", ...cellTags(second.rows[1]!.cells[1]!)].join(" "))));
    });

    it("a cell's, a row's and a column's names, in the names' one tag", () => {
      // (As the writers of names before the model wrote them)
      const form = (from: string, to: string) => FORMS[1]!.replace(from, to);
      expect(md(encode(withCell(model, 2, 0, (c) => ({ ...c, attributes: withAttributeIn(c.attributes, "core", "cn", "fig1") })), table))).toBe(form("| Fig |", "| Fig <meta core.cn='fig1'> |"));
      expect(md(encode(withCell(model, 1, 0, (c) => ({ ...c, attributes: withAttributeIn(c.attributes, "core", "cn", undefined) })), table))).toBe(form("<meta core.n='pear' core.cn='p'>", "<meta core.n='pear'>"));
      const rowNamed = { ...model, rows: model.rows.map((r, i) => (i === 1 ? { ...r, attributes: withAttributeIn(r.attributes, "core", "n", "fig") } : r)) };
      expect(md(encode(rowNamed, table))).toBe(form("| Fig |", "| Fig <meta core.n='fig'> |"));
      const renamedRow = { ...model, rows: model.rows.map((r, i) => (i === 0 ? { ...r, attributes: withAttributeIn(r.attributes, "core", "n", "pear2") } : r)) };
      expect(md(encode(renamedRow, table))).toBe(form("core.n='pear' core.cn='p'", "core.n='pear2' core.cn='p'"));
      const columnNamed = { ...model, columns: model.columns.map((c, i) => (i === 1 ? { ...c, attributes: withAttributeIn(c.attributes, "core", "n", "price") } : c)) };
      expect(md(encode(columnNamed, table))).toBe(form("Price #currency-usd |", "Price #currency-usd <meta core.n='price'> |"));
    });

    it("a column's type, among its hashtags", () => {
      const typed = { ...model, columns: model.columns.map((c, i) => (i === 1 ? { ...c, attributes: withAttributeIn(c.attributes, "core", HASHTAGS_KEY, "#stars") } : c)) };
      expect(md(encode(typed, table))).toBe(md(setCell(table, 0, 1, withColumnType(table.rows[0]!.cells[1]!, "stars"))));
    });

    it("a header's own tags kept as its column changes: renamed, typed", () => {
      const tagged = parseTable("| Price #currency-usd <meta note='x'> | Qty |\n|---|---|\n| 1 | 2 |\n| <meta core.table widths.-c-price.size='90'> |");
      const read = decode(tagged);
      const typed = { ...read, columns: read.columns.map((c, i) => (i === 0 ? { ...c, attributes: withAttributeIn(c.attributes, "core", HASHTAGS_KEY, "#stars") } : c)) };
      expect(md(encode(typed, tagged))).toBe(md(followColumnMeta(tagged, setCell(tagged, 0, 0, withColumnType(tagged.rows[0]!.cells[0]!, "stars")))));
      const renamed = { ...read, columns: read.columns.map((c, i) => (i === 0 ? { ...c, header: "Cost" } : c)) };
      const written = md(encode(renamed, tagged));
      expect(written).toContain("| Cost #currency-usd <meta note='x'> |");
      expect(written).toContain("widths.-c-cost.size='90'");
    });

    it("a row's name typed into a cell written as typed, once: a copy of the row has none", () => {
      const plain = parseTable("| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |");
      const typed = withContentAt(decode(plain), 1, 0, "1 <meta core.n='x'>");
      expect(md(encode(typed, plain))).toBe("| A | B |\n|---|---|\n| 1 <meta core.n='x'> | 2 |\n| 3 | 4 |");
      expect(md(encode(duplicateRow(typed, 1), plain))).toBe("| A | B |\n|---|---|\n| 1 <meta core.n='x'> | 2 |\n| 1 | 2 |\n| 3 | 4 |");
    });

    it("plain markdown of a table made of the one read (edits held in) in that one's form: padded where it is", () => {
      const padded = parseTable("| Name  | Qty |\n| ----- | --- |\n| Apple | 1   |");
      const read = decode(padded);
      const held = { ...read, rows: [{ ...read.rows[0]!, cells: [read.rows[0]!.cells[0]!, { content: "5", attributes: new Map() }] }] };
      expect(plainMarkdown(held, [1], read)).toBe("| Name  | Qty |\n| ----- | --- |\n| Apple | 5   |");
    });

    it("a header typed written as typed: its hashtags where they were typed, in their order", () => {
      const plain = parseTable("| Price | B |\n|---|---|\n| 1 | 2 |");
      expect(md(encode(withHeaderText(decode(plain), 0, "Unit #usd price"), plain))).toBe(md(setCell(plain, 0, 0, "Unit #usd price")));
      const tagged = parseTable("| X #a #b | B |\n|---|---|\n| 1 | 2 |");
      expect(md(encode(withHeaderText(decode(tagged), 0, "X #b #a"), tagged))).toBe(md(setCell(tagged, 0, 0, "X #b #a")));
      // A type set from the menu: the hashtags kept where they are, the type's put at the end
      const middle = parseTable("| Price #euro total | B |\n|---|---|\n| 1 | 2 |");
      const read = decode(middle);
      const typedType = { ...read, columns: read.columns.map((c, i) => (i === 0 ? { ...c, attributes: withAttributeIn(c.attributes, "core", HASHTAGS_KEY, "#euro #number") } : c)) };
      expect(md(encode(typedType, middle))).toContain("| Price #euro total #number |");
    });

    it("a column's and the table's attributes, in the metadata row", () => {
      const plain = parseTable(FORMS[2]!);
      const read = decode(plain);
      const sorted = { ...read, columns: read.columns.map((c, i) => (i === 0 ? { ...c, attributes: withAttributeIn(c.attributes, "core", "sort", "asc") } : c)) };
      expect(md(encode(sorted, plain))).toBe(md(withColumnValues(plain, "core", "sort", new Map([[0, "asc"], [1, "desc"]]))));
      const named = { ...read, attributes: withAttributeIn(read.attributes, "core", "name", "u") };
      expect(md(encode(named, plain))).toBe(md(withMetaValue(plain, "core", "name", "u")));
      expect(metaValue(encode(named, plain), "core", "name")).toBe("u");
    });

    it("a column's attribute in the metadata row, its header as written: hashtags first, spaces, none at all", () => {
      const plain = parseTable("| #euro Price | Unit  price | #stars | Qty |\n|---|---|---|---|\n| 1 | 2 | 3 | 4 |");
      const read = decode(plain);
      const sized = { ...read, columns: read.columns.map((c) => ({ ...c, attributes: withAttributeIn(c.attributes, "widths", "size", "10") })) };
      expect(md(encode(sized, plain)).split("\n")[0]).toBe("| #euro Price | Unit  price | #stars | Qty |");
      expect(read.columns.map(headerText)).toEqual(["Price #euro", "Unit price", "#stars", "Qty"]);
    });

    it("a metadata row naming a column of a name others share without its number: as read while it means the same, named anew once a header changed", () => {
      const plain = parseTable("| Item | Item | Qty |\n|---|---|---|\n| a | b | c |\n| <meta core.table core.-c-item.sort='asc'> |");
      const read = decode(plain);
      const moved = { ...read, rows: [], columns: [read.columns[0]!, read.columns[2]!, read.columns[1]!] };
      expect(md(encode({ ...read, rows: [] }, plain)).split("\n").at(-1)).toBe("| <meta core.table core.-c-item.sort='asc'> |");
      expect(md(encode(moved, plain)).split("\n").at(-1)).toBe("| <meta core.table core.-c-item.sort='asc'> |");
      const renamed = { ...read, columns: read.columns.map((c, i) => (i === 1 ? { ...c, header: "Cost" } : c)) };
      expect(md(encode(renamed, plain)).split("\n").at(-1)).toBe("| <meta core.table core.-c-item.sort='asc'> |");
      const first = { ...read, columns: read.columns.map((c, i) => (i === 0 ? { ...c, header: "Cost" } : c)) };
      expect(md(encode(first, plain)).split("\n").at(-1)).toBe("| <meta core.table core.-c-cost.sort='asc'> |");
    });

    it("a metadata row read that would mean another column by the headers written: named anew (a fixed name's column renamed, a column of its key added)", () => {
      const fixed = parseTable("| Cost <meta core.n='price'> | Qty |\n|---|---|\n| 1 | 2 |\n| <meta core.table core.-c-cost.sort='asc'> |");
      const read = decode(fixed);
      const renamed = { ...read, columns: read.columns.map((c, i) => (i === 0 ? { ...c, header: "Amount" } : c)) };
      expect(columnValues(encode(renamed, fixed), "core", "sort")).toEqual(new Map([[0, "asc"]]));
      const keyed = parseTable("| Draft | Qty |\n|---|---|\n| 1 | 2 |\n| <meta core.table core.-c-_draft_.sort='asc'> |");
      const added = withHeader(insertColumn(decode(keyed), 2), 2, "(draft)");
      expect(columnValues(encode(added, keyed), "core", "sort")).toEqual(new Map([[0, "asc"]]));
    });

    it("rows moved, each as it was written; a header renamed, its column's attributes with it", () => {
      const plain = parseTable(FORMS[0]!);
      const read = decode(plain);
      const reversed = { ...read, rows: [...read.rows].reverse() };
      expect(md(encode(reversed, plain))).toBe(md(reorderRows(plain, [2, 1])));
      const meta = parseTable(FORMS[2]!);
      const model2 = decode(meta);
      const renamed = { ...model2, columns: model2.columns.map((c, i) => (i === 1 ? { ...c, header: "Total" } : c)) };
      expect(md(encode(renamed, meta))).toBe(md(followColumnMeta(meta, setCell(meta, 0, 1, "Total"))));
    });

    it("a column of the table read that no column of the model comes from: its metadata kept as written, for the write's step to say whether it went", () => {
      const meta = parseTable(FORMS[2]!);
      const read = decode(meta);
      // (A calculated table written anew without B, A made whole: the metadata of B kept, A's own written by its name)
      const without = { ...read, columns: [read.columns[0]!] };
      expect(encode(without, meta).meta).toMatchObject({ "core.-c-b.sort": "desc", "widths.-c-gone.size": "9" });
      // A column renamed comes from the one read: its metadata by its name now, none kept by the old
      const renamed = { ...read, columns: read.columns.map((c, i) => (i === 1 ? { ...c, header: "Total" } : c)) };
      expect(Object.keys(encode(renamed, meta).meta ?? {})).not.toContain("core.-c-b.sort");
    });

    it("the metadata of a column renamed by hand kept, but where the model set that attribute on a column: written whole", () => {
      const orphan = parseTable("| Cost | B |\n|---|---|\n| 1 | 2 |\n| <meta core.table core.-c-price.sort='asc' widths.-c-price.size='9'> |");
      const read = decode(orphan);
      expect(encode({ ...read, rows: [...read.rows] }, orphan).meta).toMatchObject({ "core.-c-price.sort": "asc", "widths.-c-price.size": "9" });
      const sorted = encode(withMetaSort(read, { column: 0, direction: "desc" }), orphan).meta;
      expect(sorted).toMatchObject({ "core.-c-cost.sort": "desc", "widths.-c-price.size": "9" });
      expect(Object.keys(sorted ?? {})).not.toContain("core.-c-price.sort");
      expect(Object.keys(encode(withMetaSort(read, undefined), orphan).meta ?? {})).not.toContain("core.-c-price.sort");
    });
  });

  describe("a cell read and written alone (a cell a hook gives)", () => {
    it("reads its content and every attribute, its row's name among them; written back as read where unchanged", () => {
      const raw = "Pear \\| x <meta core.n='pear' core.cn='p'> <meta formulas.f='=1+1'>";
      const cell = decodeCell(raw);
      expect(cell.content).toBe("Pear | x");
      expect(attributeIn(cell.attributes, "core", "n")).toBe("pear");
      expect(attributeIn(cell.attributes, "formulas", "f")).toBe("=1+1");
      expect(encodeCell(cell)).toBe(raw);
      expect(encodeCell({ ...cell, attributes: withAttributeIn(cell.attributes, "formulas", "f", "=2+2") })).toBe(withTagValue(raw, "formulas.f", "=2+2"));
      expect(encodeCell({ content: "a | b", attributes: withAttributeIn(new Map(), "formulas", "f", "=1") })).toBe("a \\| b <meta formulas.f='=1'>");
    });

    it("writes a cell written anew with its tags in today's form: one in double quotes in apostrophes", () => {
      const cell = decodeCell(`2 <meta formulas.f="=IF(A1&gt;1,&quot;big&quot;,&quot;&quot;)"> <meta core.cn='x'>`);
      expect(encodeCell({ ...cell, content: "big" })).toBe(`big <meta formulas.f='=IF(A1&gt;1,"big","")'> <meta core.cn='x'>`);
    });
  });
});
