import { describe, expect, it } from "vitest";
import type { Database, Item, ItemKey, Property } from "../../model/database.ts";
import { formulaErrorsSaid, formulaProblemOf, withFormulaValues } from "./calculate.ts";
import { cellText } from "./model.ts";
import { validateFormula } from "./validate.ts";

const property = (key: string, label: string, type: string, params: Record<string, unknown> = {}): Property => ({ key, label, type, params, readonly: type === "formula" });
const formula = (key: string, label: string, text: string, resultType?: string) => property(key, label, "formula", { formula: text, ...(resultType ? { resultType } : {}) });
const item = (name: string, values: Item["values"]): Item => ({ key: name.toLowerCase() as ItemKey, name, values, rank: undefined, revision: "1" });
const database = (...properties: Property[]): Database => ({ id: "tasks", name: "Tasks", properties });

const ITEMS = [item("Pear", { qty: 3, price: 2.5, hours: 1 }), item("Fig", { qty: 4, price: 1, hours: 3 })];
const valuesOf = (key: string, db: Database, items: readonly Item[] = ITEMS) => withFormulaValues(items, db).items.map((one) => one.values[key]);

describe("a database's formulas", () => {
  it("say a spill's why without a table's Show result, which a database has not", () => {
    const db = database(property("qty", "Qty", "number"), formula("all", "All", "=[qty]"));
    const { problems, items } = withFormulaValues(ITEMS, db);
    expect(problems.get(items[0]!.key)?.all?.detail).toMatch(/reduce it to one \(SUM, COUNTA, TEXTJOIN, TAKE…\)$/);
  });

  it("keep each calculated item's errors with it, said as how many of the items give one and the error most give", () => {
    const db = database(property("qty", "Qty", "number"), property("price", "Price", "number"), formula("each", "Each", "=[@qty]/[@price]"));
    const items = [...ITEMS, item("Kiwi", { qty: 1, price: 0 }), item("Lime", { qty: "x", price: 1 }), item("Plum", { qty: 2, price: 0 })];
    const calculated = withFormulaValues(items, db).items;
    expect(formulaProblemOf(calculated[2]!, "each")?.code).toBe("#DIV/0!");
    expect(formulaProblemOf(calculated[0]!, "each")).toBeUndefined();
    // (An item as kept, not calculated: none)
    expect(formulaProblemOf(items[2]!, "each")).toBeUndefined();
    expect(formulaErrorsSaid(calculated, "each")).toMatch(/^3 of 5 items give an error: .*zero/);
    expect(formulaErrorsSaid(calculated.slice(0, 3), "each")).toMatch(/^1 of 3 items gives an error/);
    expect(formulaErrorsSaid(calculated.slice(2, 3), "each")).toMatch(/^The item gives an error/);
    expect(formulaErrorsSaid(calculated.slice(0, 2), "each")).toBeUndefined();
  });

  it("calculate each item's own values, and the whole database's", () => {
    const db = database(property("qty", "Qty", "number"), property("price", "Price", "number"), property("hours", "Hours", "number"), formula("total", "Total", "=[@qty]*[@price]"), formula("share", "Share", "=[@hours]/SUM([hours])"));
    expect(valuesOf("total", db)).toEqual([7.5, 4]);
    expect(valuesOf("share", db)).toEqual([0.25, 0.75]);
    // (Every other value as it was)
    expect(withFormulaValues(ITEMS, db).items[0]!.values.qty).toBe(3);
  });

  it("read a property by its key whatever its label, and by its label; the item's name as name", () => {
    const db = database(property("qty", "Quantity ordered", "number"), formula("by_key", "By key", "=[@qty]+1"), formula("by_label", "By label", "=[@Quantity ordered]+1"), formula("named", "Named", '=[@name]&"!"'));
    expect(valuesOf("by_key", db)).toEqual([4, 5]);
    expect(valuesOf("by_label", db)).toEqual([4, 5]);
    expect(valuesOf("named", db)).toEqual(["Pear!", "Fig!"]);
  });

  it("read another formula property's results; a cycle is its error, said why", () => {
    const db = database(property("qty", "Qty", "number"), formula("double", "Double", "=[@qty]*2"), formula("quad", "Quad", "=[@double]*2"), formula("a", "A", "=[@b]"), formula("b", "B", "=[@a]"));
    expect(valuesOf("quad", db)).toEqual([12, 16]);
    const { items, problems } = withFormulaValues(ITEMS, db);
    expect(items[0]!.values.a).toBe("#CYCLE!");
    expect(problems.get(items[0]!.key)?.a?.code).toBe("#CYCLE!");
    expect(problems.get(items[0]!.key)?.a?.detail).toMatch(/its own result/);
  });

  it("give an error its code as the value and why apart; none for a value that is no error", () => {
    const db = database(property("qty", "Qty", "number"), formula("ratio", "Ratio", "=[@qty]/0"), formula("ok", "Ok", "=[@qty]"));
    const { items, problems } = withFormulaValues(ITEMS, db);
    expect(items.map((one) => one.values.ratio)).toEqual(["#DIV/0!", "#DIV/0!"]);
    expect(problems.get(items[0]!.key)).toEqual({ ratio: { code: "#DIV/0!", detail: expect.any(String) } });
  });

  it("give a result as its type keeps it, Auto as it is", () => {
    const db = database(property("qty", "Qty", "number"), formula("auto", "Auto", "=[@qty]>3"), formula("as_text", "As text", "=[@qty]*2", "text"), formula("when", "When", '=DATE(2026,11,22)+[@qty]', "date"));
    expect(valuesOf("auto", db)).toEqual([false, true]);
    expect(valuesOf("as_text", db)).toEqual(["6", "8"]);
    expect(valuesOf("when", db)).toEqual(["2026-11-25", "2026-11-26"]);
  });

  it("set every formula key, or take it off where there is no result: no value an item keeps under it is shown", () => {
    const kept = [item("Pear", { qty: 3, total: 99, empty: "kept" })];
    const db = database(property("qty", "Qty", "number"), formula("total", "Total", "=[@qty]"), property("empty", "Empty", "formula", {}));
    expect(withFormulaValues(kept, db).items[0]!.values).toEqual({ qty: 3, total: 3 });
  });

  it("read a value of each type as formulas read a cell: a point, TRUE and FALSE, a list with commas, a moment to the second", () => {
    expect([cellText(2.5), cellText(true), cellText(false), cellText(["a", "b"]), cellText(null), cellText("2026-11-08T14:30:05.123"), cellText("2026-11-08")]).toEqual(["2.5", "TRUE", "FALSE", "a, b", "", "2026-11-08 14:30:05", "2026-11-08"]);
    const db = database(property("done", "Done", "checkbox"), property("tags", "Tags", "multi-select"), formula("score", "Score", '=IF([@done],1,0)'), formula("first", "First", '=MID([@tags],1,1)'));
    const items = [item("A", { done: true, tags: ["x", "y"] }), item("B", { done: false, tags: [] })];
    expect(valuesOf("score", db, items)).toEqual([1, 0]);
    // (An empty result no value: its key taken off)
    expect(valuesOf("first", db, items)).toEqual(["x", undefined]);
  });

  it("has no total rows: a formula reading the database's whole body is an item's as any", () => {
    const db = database(property("qty", "Qty", "number"), formula("names", "Names", "=COUNTA(CHOOSECOLS([#Data],1))"), formula("sum", "Sum", "=SUM([qty])"));
    expect(valuesOf("names", db)).toEqual([2, 2]);
    expect(valuesOf("sum", db)).toEqual([7, 7]);
  });

  it("give formulas each value as it is, never guessed from text: a checkbox a logical value, a text a text, any number", () => {
    const db = database(
      property("done", "Done", "checkbox"),
      property("code", "Code", "text"),
      property("tiny", "Tiny", "number"),
      formula("auto", "Auto", "=[@done]"),
      formula("ticked", "Ticked", "=[@done]", "checkbox"),
      formula("code_text", "Code text", '=[@code]&"!"'),
      formula("length", "Length", "=LEN([@code])"),
      formula("tiny_twice", "Tiny twice", "=[@tiny]*2"),
    );
    const items = [item("A", { done: true, code: "007", tiny: 1e-7 })];
    const values = withFormulaValues(items, db).items[0]!.values;
    expect([values.auto, values.ticked, values.code_text, values.length, values.tiny_twice]).toEqual([true, true, "007!", 3, 2e-7]);
  });

  it("keep a moment a formula gives as the database keeps one, with a T, Auto or not", () => {
    const db = database(property("at", "At", "datetime"), formula("auto", "Auto", "=[@at]+1"), formula("as_moment", "As moment", "=[@at]+1", "datetime"));
    const values = withFormulaValues([item("A", { at: "2026-11-08T14:30:05.123" })], db).items[0]!.values;
    expect([values.auto, values.as_moment]).toEqual(["2026-11-09T14:30:05", "2026-11-09T14:30:05"]);
  });

  it("calculate a formula reading outside the database (written by hand) as its error, saying it comes later, and so the formulas reading it", () => {
    const db = database(formula("price", "Price", "=prices![price]"), formula("double", "Double", "=[@price]*2"));
    const { items, problems } = withFormulaValues([item("A", {})], db);
    expect([items[0]!.values.price, items[0]!.values.double]).toEqual(["#REF!", "#REF!"]);
    expect(problems.get(items[0]!.key)?.price).toEqual({ code: "#REF!", detail: "its formula reads the table prices: a database's formulas read only its own items for now" });
  });

  it("refuse a formula that does not parse, or reads outside the database, saying why", () => {
    expect(validateFormula("=[@qty]*2")).toBeUndefined();
    expect(validateFormula("[@qty]*2")).toBeUndefined();
    expect(validateFormula("=SUM(")).toMatch(/^its formula: /);
    expect(validateFormula("=SUM(prices![price])")).toBe("its formula reads the table prices: a database's formulas read only its own items for now");
    expect(validateFormula("=COUNTA(@tasks[name])")).toBe("its formula reads @tasks: a database's formulas read only its own items for now");
  });
});
