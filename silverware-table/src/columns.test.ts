import { describe, expect, it } from "vitest";
import { columnIdOf, columnKey, findColumn, followColumn, matchColumns, sameColumnId } from "./columns.ts";

describe("columnKey", () => {
  it("keys a column as SilverBullet's index does", () => {
    expect(columnKey("Unit price")).toBe("unit_price");
    expect(columnKey("unit_price")).toBe("unit_price");
    expect(columnKey("Price / kg")).toBe("price_kg");
    expect(columnKey("a__b")).toBe("a_b");
    // Letters with diacritics are not A-Z either
    expect(columnKey("Množství")).toBe("mno_stv_");
    expect(columnKey("Cena (Kč)")).toBe("cena_k_");
  });

  it("leaves hashtags out, as SilverBullet's index does", () => {
    expect(columnKey("Price #euro")).toBe("price");
    expect(columnKey("#stars Rating")).toBe("rating");
    expect(columnKey("Score #percent10")).toBe("score");
    expect(columnKey("Two #euro #bold")).toBe("two");
    // Not a hashtag: no space before the #
    expect(columnKey("C#")).toBe("c_");
  });

  it("drops markdown emphasis and escapes first", () => {
    expect(columnKey("**Qty**")).toBe("qty");
    expect(columnKey("A \\| B")).toBe("a_b");
  });
});

describe("matchColumns: where columns went, an edit not saying", () => {
  const moves = (before: readonly string[], after: readonly string[]) => before.map((_, column) => matchColumns(before, after)(column));

  it("pairs a column with the one of its name, wherever it is now", () => {
    expect(moves(["Q1", "Q2", "Q3"], ["Q1", "Q3"])).toEqual([0, undefined, 1]);
    expect(moves(["A", "B"], ["X", "A", "B"])).toEqual([1, 2]);
    expect(moves(["Name <meta core.n='n'>", "Qty"], ["Qty", "Label <meta core.n='n'>"])).toEqual([1, 0]);
  });

  it("pairs a renamed header by its place, where no other took it", () => {
    expect(moves(["Name", "Qty"], ["Name", "Amount"])).toEqual([0, 1]);
    expect(moves(["A", "B", "C"], ["A", "X", "C"])).toEqual([0, 1, 2]);
  });

  it("pairs headers sharing a name by their place: an edit renumbers their occurrences", () => {
    // Renamed into a name another column has: the occurrences shift, the places do not
    expect(moves(["Qty", "Price"], ["Price", "Price"])).toEqual([0, 1]);
    expect(moves(["Qty", "Qty"], ["Qty", "Qty"])).toEqual([0, 1]);
  });

  it("finds no column for one gone where another took its place", () => {
    expect(moves(["A", "B", "C"], ["A", "C"])).toEqual([0, undefined, 1]);
    expect(moves(["A"], [])).toEqual([undefined]);
  });
});

describe("columns by name", () => {
  const headers = ["Name", "Qty", "Unit price", "qty"];

  it("finds a column by any spelling of its key, and duplicates by occurrence", () => {
    expect(findColumn(headers, { name: "unit_price", nth: 1 })).toBe(2);
    expect(findColumn(headers, { name: "UNIT PRICE", nth: 1 })).toBe(2);
    expect(findColumn(headers, { name: "Qty", nth: 2 })).toBe(3);
    expect(findColumn(headers, { name: "Qty", nth: 3 })).toBeUndefined();
    expect(findColumn(headers, { name: "Nope", nth: 1 })).toBeUndefined();
  });

  it("finds a column by its key ending in _ (a header ending in a letter with a diacritic, or a sign)", () => {
    const czech = ["Název", "Množství", "Price €"];
    expect(findColumn(czech, { name: "mno_stv_", nth: 1 })).toBe(1);
    expect(findColumn(czech, { name: "price_", nth: 1 })).toBe(2);
    expect(findColumn(czech, { name: "n_zev", nth: 1 })).toBe(0);
    expect(findColumn(["a b"], { name: "a__b", nth: 1 })).toBe(0);
    // Not a key: as a header names it, its emphasis dropped
    expect(findColumn(["_Draft_"], { name: "_Draft_", nth: 1 })).toBe(0);
    // What the key of a column with such a header is, as metadata and formulas write it
    expect(findColumn(czech, columnIdOf(czech, 1)!)).toBe(1);
  });

  it("names a column by its key, with whether others share it", () => {
    expect(columnIdOf(headers, 2)).toEqual({ name: "unit_price", nth: 1, shared: false });
    expect(columnIdOf(headers, 3)).toEqual({ name: "qty", nth: 2, shared: true });
    expect(columnIdOf(headers, 9)).toBeUndefined();
  });

  it("follows a column through a rename, a move and a delete", () => {
    const id = { name: "qty", nth: 1 };
    expect(followColumn(headers, ["Name", "Count", "Unit price", "qty"], id)).toEqual({ name: "count", nth: 1, shared: false });
    const moved = ["Name", "qty", "Unit price", "Qty"];
    expect(followColumn(headers, moved, id, (c) => (c === 1 ? 3 : c === 3 ? 1 : c))).toEqual({ name: "qty", nth: 2, shared: true });
    expect(followColumn(headers, ["Name", "Unit price", "qty"], id, (c) => (c === 1 ? undefined : c > 1 ? c - 1 : c))).toBeNull();
    expect(followColumn(headers, headers, { name: "Nope", nth: 1 })).toBeUndefined();
    expect(sameColumnId({ name: "Unit price", nth: 1 }, { name: "unit_price", nth: 1 })).toBe(true);
  });
});
