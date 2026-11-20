import { describe, expect, it } from "vitest";
import { findTables, locateByShape, parseMetaRow, parseTable, serializeTable, type Table, writtenMeta } from "./markdown.ts";
import { columnValues, followColumnMeta, metaName, metaSort, withColumnValues, withMeta, withMetaSort, withMetaValue } from "./meta.ts";
import { sameTableName, validateTableName } from "./namerules.ts";
import { columnAfterMove, deleteColumn, insertRow, moveColumn, setCell } from "./ops.ts";

const md = (t: ReturnType<typeof parseTable>) => serializeTable(t);

describe("metadata row", () => {
  it("is read from a last row holding only <meta …>", () => {
    const table = parseTable(`| A | B |\n|---|---|\n| 1 | 2 |\n| <meta core.table sort='A:desc' note='x'> | |`);
    expect(table.rows.map((r) => r.cells)).toEqual([["A", "B"], ["1", "2"]]);
    expect(writtenMeta(table)).toEqual({ sort: "A:desc", note: "x" });
  });

  it("reads values in quotes too, as tables written before apostrophes have them, and keeps that row until its metadata changes", () => {
    const source = `| A | B |\n|---|---|\n| 1 | 2 |\n| <meta core.table core.name="prices" note="say &quot;hi&quot;" who='O&#39;Brien' x="it&apos;s"> |`;
    const table = parseTable(source);
    expect(writtenMeta(table)).toEqual({ "core.name": "prices", note: 'say "hi"', who: "O'Brien", x: "it's" });
    expect(md(table)).toBe(source);
    expect(md(withMeta(table, "core.name", "costs"))).toContain(`<meta core.table core.name='costs' note='say "hi"' who='O&#39;Brien' x='it&#39;s'>`);
  });

  it("keeps a row's order, the table's attributes and its columns' among each other, those set since after them", () => {
    const table = parseTable(`| A |\n|---|\n| 1 |\n| <meta core.table core.-c-a.sort='asc' core.name='x' filters.-c-a.condition='&gt;1'> |`);
    expect(writtenMeta(table)).toEqual({ "core.-c-a.sort": "asc", "core.name": "x", "filters.-c-a.condition": ">1" });
    expect(Object.keys(writtenMeta(table))).toEqual(["core.-c-a.sort", "core.name", "filters.-c-a.condition"]);
    const changed = withMeta(withMeta(table, "core.name", "y"), "themes.name", "slate");
    expect(md(changed)).toContain(`<meta core.table core.-c-a.sort='asc' core.name='y' filters.-c-a.condition='&gt;1' themes.name='slate'>`);
  });

  it("accepts <meta …/> and a row with fewer cells", () => {
    expect(parseMetaRow(`| <meta core.table sort='A:asc'/> |`)).toEqual({ sort: "A:asc" });
  });

  it("is not a metadata row with other content or elsewhere", () => {
    expect(parseMetaRow(`| <meta core.table sort='A:asc'> | x |`)).toBeUndefined();
    expect(parseMetaRow("| meta |")).toBeUndefined();
    const middle = parseTable(`| A |\n|---|\n| <meta core.table sort='A:asc'> |\n| 1 |`);
    expect(middle.meta).toBeUndefined();
    expect(middle.rows).toHaveLength(3);
  });

  it("round-trips byte for byte", () => {
    const text = `| A | B |\n|---|---|\n| 1 | 2 |\n|<meta core.table   sort='A:desc' >| |`;
    expect(md(parseTable(text))).toBe(text);
    expect(md(setCell(parseTable(text), 1, 0, "9"))).toBe(`| A | B |\n|---|---|\n| 9 | 2 |\n|<meta core.table   sort='A:desc' >| |`);
  });

  it("stays the last row when rows are added", () => {
    const table = parseTable(`| A |\n|---|\n| 1 |\n| <meta core.table sort='A:asc'> |`);
    expect(md(insertRow(table, table.rows.length))).toBe(`| A |\n|---|\n| 1 |\n| |\n| <meta core.table sort='A:asc'> |`);
  });

  it("does not widen columns or break alignment", () => {
    const text = `| Name  | Qty |\n| ----- | --- |\n| Pear  |   3 |\n| <meta core.table sort='Qty:desc'> |`;
    const table = parseTable(text);
    expect(table.padded).toBe(true);
    expect(md({ ...setCell(table, 1, 0, "Fig"), padded: true })).toBe(
      `| Name | Qty |\n| ---- | --- |\n| Fig  | 3   |\n| <meta core.table sort='Qty:desc'> |`,
    );
  });

  it("escapes values and drops a row left without attributes", () => {
    const table = withMeta(parseTable("| A |\n|---|\n| 1 |"), "sort", 'a|b "c" >d:asc');
    const text = md(table);
    expect(text).toBe(`| A |\n|---|\n| 1 |\n| <meta core.table sort='a\\|b "c" &gt;d:asc'> |`);
    expect(writtenMeta(parseTable(text))).toEqual({ sort: 'a|b "c" >d:asc' });
    expect(md(withMeta(parseTable(text), "sort", undefined))).toBe("| A |\n|---|\n| 1 |");
  });

  it("counts in the rendered shape, so the table is still found", () => {
    const text = `x\n\n| A |\n|---|\n| 1 |\n| <meta core.table sort='A:asc'> |\n`;
    expect(locateByShape(text, 0, { rows: 3, columns: 1 })?.from).toBe(findTables(text)[0]!.from);
  });
});

describe("stored sorting", () => {
  const base = parseTable("| Name | Qty | Qty |\n|---|---|---|\n| a | 1 | 2 |");

  it("is stored as an attribute of its column", () => {
    const sorted = withMetaSort(base, { column: 0, direction: "desc" });
    expect(sorted.meta).toEqual({ "core.-c-name.sort": "desc" });
    expect(metaSort(sorted)).toEqual({ column: 0, direction: "desc" });
    // Another column: the attribute of the first goes
    expect(withMetaSort(sorted, { column: 1, direction: "asc" }).meta).toEqual({ "core.-c-qty:1.sort": "asc" });
    expect(withMetaSort(sorted, undefined).meta).toEqual({});
  });

  it("adds the occurrence for duplicate column names", () => {
    const second = withMetaSort(base, { column: 2, direction: "asc" });
    expect(second.meta).toEqual({ "core.-c-qty:2.sort": "asc" });
    expect(metaSort(second)).toEqual({ column: 2, direction: "asc" });
  });

  it("names a column with only hashtags in its header by its empty key", () => {
    const typed = parseTable("| Name | #stars |\n|---|---|\n| a | 3 |");
    const sorted = withMetaSort(typed, { column: 1, direction: "desc" });
    expect(sorted.meta).toEqual({ "core.-c-.sort": "desc" });
    expect(metaSort(sorted)).toEqual({ column: 1, direction: "desc" });
    expect(withMetaSort(sorted, undefined).meta).toEqual({});
  });

  it("is ignored when its column is gone or its direction is not one", () => {
    expect(metaSort(withMeta(base, "sort.missing", "asc"))).toBeUndefined();
    expect(metaSort(withMeta(base, "sort.qty:3", "asc"))).toBeUndefined();
    expect(metaSort(withMeta(base, "sort.name", "up"))).toBeUndefined();
  });
});

describe("attributes of columns", () => {
  const base = parseTable("| Name | Qty | Qty |\n|---|---|---|\n| a | 1 | 2 |");
  const filtered = withColumnValues(base, "filters", "condition", new Map([[0, "=a|b"], [2, ">1"]]));

  it("are read and written by column, others left as they are", () => {
    expect(filtered.meta).toEqual({ "filters.-c-name.condition": "=a|b", "filters.-c-qty:2.condition": ">1" });
    expect(columnValues(filtered, "filters", "condition")).toEqual(new Map([[0, "=a|b"], [2, ">1"]]));
    const named = withMeta(filtered, "core.name", "fruit");
    expect(writtenMeta(withColumnValues(named, "filters", "condition", new Map([[1, "x"]])))).toEqual({ "core.name": "fruit", "filters.-c-qty:1.condition": "x" });
    // Unchanged: the same table
    expect(withColumnValues(filtered, "filters", "condition", new Map([[0, "=a|b"], [2, ">1"]]))).toBe(filtered);
    // Written in the metadata row, the | escaped, and read back
    const text = md(filtered);
    expect(text).toContain(`<meta core.table filters.-c-name.condition='=a\\|b' filters.-c-qty:2.condition='&gt;1'>`);
    expect(columnValues(parseTable(text), "filters", "condition")).toEqual(new Map([[0, "=a|b"], [2, ">1"]]));
  });

  it("follow their columns through rename, move and delete, whatever they are for", () => {
    const both = withMetaSort(filtered, { column: 2, direction: "desc" });
    const renamed = followColumnMeta(both, setCell(both, 0, 2, "Price"), (c) => c);
    expect(renamed.meta).toEqual({ "filters.-c-name.condition": "=a|b", "filters.-c-price.condition": ">1", "core.-c-price.sort": "desc" });
    const moved = followColumnMeta(both, moveColumn(both, 2, 0), (c) => columnAfterMove(c, 2, 0));
    expect(moved.meta).toEqual({ "filters.-c-name.condition": "=a|b", "filters.-c-qty:1.condition": ">1", "core.-c-qty:1.sort": "desc" });
    expect(metaSort(moved)).toEqual({ column: 0, direction: "desc" });
    const deleted = followColumnMeta(both, deleteColumn(both, 2), (c) => (c === 2 ? undefined : c));
    expect(deleted.meta).toEqual({ "filters.-c-name.condition": "=a|b" });
  });

  it("follow their columns' names where the edit does not say how columns moved: a column gone keeps them as written", () => {
    // A calculated table made anew without its column Q2: the others' stay on theirs, Q2's wait for it
    const quarters = withColumnValues(parseTable("| Q1 | Q2 | Q3 |\n|---|---|---|\n| 1 | 2 | 3 |"), "widths", "size", new Map([[0, "80"], [1, "90"], [2, "100"]]));
    // (Made anew from the table, its metadata row with it, as a recalculation does)
    const remade = (from: Table, text: string): Table => ({ ...parseTable(text), meta: from.meta });
    const without = followColumnMeta(quarters, remade(quarters, "| Q1 | Q3 |\n|---|---|\n| 1 | 3 |"));
    expect(columnValues(without, "widths", "size")).toEqual(new Map([[0, "80"], [1, "100"]]));
    expect(writtenMeta(without)["widths.-c-q2.size"]).toBe("90");
    // Back: its own again
    const back = followColumnMeta(without, remade(without, "| Q1 | Q2 | Q3 |\n|---|---|---|\n| 1 | 2 | 3 |"));
    expect(columnValues(back, "widths", "size")).toEqual(new Map([[0, "80"], [1, "90"], [2, "100"]]));
    // A header renamed where it is: its column's still
    const renamed = followColumnMeta(quarters, setCell(quarters, 0, 1, "Second"));
    expect(columnValues(renamed, "widths", "size")).toEqual(new Map([[0, "80"], [1, "90"], [2, "100"]]));
    // Renamed into another column's name: by place, not onto that column
    const twice = followColumnMeta(quarters, setCell(quarters, 0, 0, "Q3"));
    expect(writtenMeta(twice)).toEqual({ "widths.-c-q3:1.size": "80", "widths.-c-q2.size": "90", "widths.-c-q3:2.size": "100" });
  });

  it("leave tables alone that have none, and those the edit set", () => {
    const edited = setCell(base, 1, 0, "b");
    expect(followColumnMeta(base, edited, (c) => c)).toBe(edited);
    const set = withMetaSort(base, { column: 1, direction: "asc" });
    expect(followColumnMeta(base, set, () => undefined)).toBe(set);
  });
});

describe("table names", () => {
  it("takes names that formulas can write before !", () => {
    expect(validateTableName("prices")).toBeUndefined();
    expect(validateTableName("price_list2")).toBeUndefined();
    expect(validateTableName("_x")).toBeUndefined();
    expect(validateTableName("2prices")).toBeDefined();
    expect(validateTableName("price list")).toBeDefined();
    expect(validateTableName("ceník")).toBeDefined();
    // Read as a cell or a value
    expect(validateTableName("A1")).toBeDefined();
    expect(validateTableName("ab12")).toBeDefined();
    expect(validateTableName("TRUE")).toBeDefined();
    expect(validateTableName("ABCD1")).toBeUndefined();
  });

  it("reads and writes a table's name in its metadata row, compared ignoring case", () => {
    const table = parseTable("| A |\n|---|\n| 1 |");
    const named = withMetaValue(table, "core", "name", "prices");
    expect(serializeTable(named)).toBe(`| A |\n|---|\n| 1 |\n| <meta core.table core.name='prices'> |`);
    expect(metaName(parseTable(serializeTable(named)))).toBe("prices");
    expect(metaName(withMeta(table, "core.name", "A1"))).toBeUndefined();
    expect(serializeTable(withMetaValue(named, "core", "name", undefined))).toBe(serializeTable(table));
    expect(sameTableName("Prices", "prices")).toBe(true);
  });
});
