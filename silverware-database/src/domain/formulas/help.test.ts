import { describe, expect, it } from "vitest";
import type { Database, Item, ItemKey, Property } from "../../model/database.ts";
import { formulaCompletion, formulaFunctionHelp, formulaPreview, formulaTypedProblem, propertyReference } from "./help.ts";

const property = (key: string, label: string, type: string, params: Record<string, unknown> = {}): Property => ({ key, label, type, params, readonly: type === "formula" });
const item = (name: string, values: Item["values"]): Item => ({ key: name.toLowerCase() as ItemKey, name, values, rank: undefined, revision: "1" });
const DB: Database = { id: "shop", name: "Shop", properties: [property("qty", "Quantity", "number"), property("unit_price", "Unit price", "number"), property("hours", "Hours", "number")] };
const ITEMS = [item("Pear", { qty: 3, unit_price: 2.5, hours: 1 }), item("Fig", { qty: 4, unit_price: 0, hours: 3 })];

describe("a formula property's field", () => {
  it("offers the functions as a name is typed, the formula's = written or not", () => {
    const offered = formulaCompletion(DB, "SU", 2)!;
    expect(offered.choices.map((one) => one.label)).toContain("SUM");
    expect(offered).toMatchObject({ from: 0, to: 2 });
    expect(formulaCompletion(DB, "=SU", 3)).toMatchObject({ from: 1, to: 3 });
    expect(offered.choices.find((one) => one.label === "SUM")).toMatchObject({ insert: "SUM(", kind: "function" });
  });

  it("offers the properties in [@ by their labels, the item's name first, written by their keys", () => {
    const offered = formulaCompletion(DB, "=[@", 3)!;
    expect(offered.choices.map((one) => one.label)).toEqual(["Name", "Quantity", "Unit price", "Hours"]);
    expect(offered.choices.map((one) => one.kind)).toEqual(["property", "property", "property", "property"]);
    const unit = formulaCompletion(DB, "=[@un", 5)!;
    expect(unit.choices.map((one) => one.insert)).toEqual(["unit_price]"]);
    expect(propertyReference(DB.properties[1]!)).toBe("[@unit_price]");
  });

  it("gives the function the caret is in, its argument marked", () => {
    const help = formulaFunctionHelp("ROUND([@qty], ", 14)!;
    expect(help.syntax).toMatch(/^ROUND\(/);
    expect(help.syntax.slice(help.argument!.from, help.argument!.to)).toMatch(/digits/i);
    expect(formulaFunctionHelp("[@qty]", 3)).toBeUndefined();
  });

  it("says why a formula cannot be: it does not read, or it reads outside the database; nothing typed is no problem", () => {
    expect(formulaTypedProblem("=[@qty]*(")).toMatch(/^the formula/);
    expect(formulaTypedProblem("=prices!A1")).toMatch(/only its own items/);
    expect(formulaTypedProblem("  ")).toBeUndefined();
    expect(formulaTypedProblem("[@qty]*2")).toBeUndefined();
  });

  it("gives an item's result over the whole database, an error with why", () => {
    expect(formulaPreview(DB, ITEMS, "share", { formula: "=[@hours]/SUM([hours])" }, ITEMS[1]!)).toEqual({ value: 0.75 });
    // (A property saved already: its params replaced by those typed)
    const saved: Database = { ...DB, properties: [...DB.properties, property("each", "Each", "formula", { formula: "=1" })] };
    expect(formulaPreview(saved, ITEMS, "each", { formula: "=[@qty]/[@unit_price]" }, ITEMS[0]!)).toEqual({ value: 1.2 });
    expect(formulaPreview(saved, ITEMS, "each", { formula: "=[@qty]/[@unit_price]" }, ITEMS[1]!)).toMatchObject({ value: "#DIV/0!", problem: { code: "#DIV/0!" } });
    expect(formulaPreview(DB, ITEMS, "none", {}, ITEMS[0]!)).toEqual({ value: null });
  });
});
