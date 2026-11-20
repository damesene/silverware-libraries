import { describe, expect, it } from "vitest";
import { decode } from "./store/markdown/codec.ts";
import { columnIdOf, columnKey, findColumn, headsOf } from "./columns.ts";
import {
  referencedColumn,
} from "./formulas/index.ts";
import { formulaCell, formulaOf, recalculate } from "./testing/formulas.ts";
import { parseMetaRow, parseTable } from "./markdown.ts";
import { validateName } from "./namerules.ts";
import { cellNamesIn, modelCellNames, modelRowNames, nameOf, rowNamesIn, withCellName, withName, withoutName } from "./names.ts";

describe("names in cells", () => {
  it("reads, writes and removes a cell's name, keeping its text", () => {
    expect(nameOf(`Unit price <meta core.n='price'>`)).toBe("price");
    expect(withoutName(`Unit price <meta core.n='price'>`)).toBe("Unit price");
    expect(withName("Unit price", "price")).toBe(`Unit price <meta core.n='price'>`);
    expect(withName(`Unit price <meta core.n='price'>`, "cost")).toBe(`Unit price <meta core.n='cost'>`);
    expect(withName(`Unit price <meta core.n='price'>`, undefined)).toBe("Unit price");
    expect(withCellName("", "vat")).toBe(`<meta core.cn='vat'>`);
    expect(nameOf("Unit price")).toBeUndefined();
  });

  it("reads names in quotes too, as cells written before apostrophes have them", () => {
    expect(nameOf('Pear <meta core.n="pear" core.cn="first">')).toBe("pear");
    expect(withName('Pear <meta core.n="pear" core.cn="first">', "fig")).toBe(`Pear <meta core.n='fig' core.cn='first'>`);
  });

  it("takes names formulas can write", () => {
    expect(validateName("price", "column")).toBeUndefined();
    expect(validateName("unit price", "column")).toContain("is not a column name");
    expect(validateName("B2", "column")).toContain("would read as a cell");
  });

  it("is not a metadata row when a last row holds only a named empty cell", () => {
    expect(parseMetaRow(`| <meta core.cn='vat'> | |`)).toBeUndefined();
    expect(parseMetaRow(`| <meta core.n='pear'> | |`)).toBeUndefined();
  });
});

describe("a column's fixed name", () => {
  const headers = headsOf([`Unit price <meta core.n='price'>`, "Qty", "Price"]);

  it("names the column whatever its header says, and is left out of its key as SilverBullet does", () => {
    expect(columnKey(headers[0]!.text)).toBe("unit_price");
    expect(findColumn(headers, { name: "price", nth: 1 })).toBe(0);
    expect(findColumn(headers, { name: "unit_price", nth: 1 })).toBe(0);
    expect(columnIdOf(headers, 0)).toEqual({ name: "price", nth: 1, shared: false });
    expect(referencedColumn(headers, "PRICE")).toBe(0);
  });

  it("comes before a column whose header has that key, which is then the second of the name", () => {
    expect(columnIdOf(headers, 2)).toEqual({ name: "price", nth: 2, shared: true });
    expect(findColumn(headers, { name: "price", nth: 2 })).toBe(2);
    const same = headsOf([`Price <meta core.n='price'>`, "Price"]);
    expect(columnIdOf(same, 1)).toEqual({ name: "price", nth: 2, shared: true });
    expect(findColumn(same, { name: "price", nth: 2 })).toBe(1);
    const after = headsOf(["Price", `Cost <meta core.n='price'>`]);
    expect(columnIdOf(after, 0)).toEqual({ name: "price", nth: 2, shared: true });
    expect(findColumn(after, { name: "price", nth: 2 })).toBe(0);
  });

  it("keeps a formula cell's name when its result is written again", () => {
    const table = parseTable(`| A |\n|---|\n| 2 |\n| ${formulaCell("0", "=A1*2", "double")} |`);
    const cell = recalculate(table).rows[2]!.cells[0]!;
    expect(cell).toBe(`4 <meta formulas.f='=A1*2'> <meta core.cn='double'>`);
    expect(formulaOf(cell)).toEqual({ formula: "=A1*2", value: "4" });
  });

  it("is what [name] reads, after the header is renamed too", () => {
    const table = parseTable(`| Cost <meta core.n='price'> | Total |\n|---|---|\n| 3 | ${formulaCell("", "=SUM([price])")} |`);
    expect(formulaOf(recalculate(table).rows[1]!.cells[1]!)!.value).toBe("3");
  });
});

describe("names on the model", () => {
  it("are those the markdown has: rows' and cells', as their rows (from 1) and columns", () => {
    const table = parseTable("| Item | Price |\n|---|---|\n| Pear <meta core.n='pear'> | 3 <meta core.cn='p3'> |\n| Fig | 2 |\n| x | 1 <meta core.n='last' core.cn='one'> |");
    const model = decode(table);
    expect(modelRowNames(model)).toEqual(rowNamesIn(table).map(({ name, row }) => ({ name, row })));
    expect(modelCellNames(model)).toEqual(cellNamesIn(table));
  });
});
