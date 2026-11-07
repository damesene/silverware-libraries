import { describe, expect, it } from "vitest";
import { typeNamed, typeOfTag } from "./index.ts";
import { choiceIndex, LIST_NAME_RE, listFormula, listNameFor, listNames, listOfValues, readChoiceList, writeChoiceList } from "./choicelists.ts";
import type { TypeTable } from "./type.ts";

const choice = typeNamed("choice")!;
const tableOf = (lists: Record<string, readonly string[]>, values: readonly string[] = []): TypeTable => ({
  list: (name) => lists[name],
  values: () => values,
});
const STATUS = tableOf({ status: ["open", "in progress", "done"] }, ["done", "open", "Open", "later"]);
const paramsOf = (tag: string) => typeOfTag(tag)!.params;

describe("choice lists", () => {
  it("are JSON lists of texts, anything else none", () => {
    expect(readChoiceList(writeChoiceList(["a b", "c|d", 'say "hi"']))).toEqual(["a b", "c|d", 'say "hi"']);
    expect(readChoiceList("[1, 2]")).toBeUndefined();
    expect(readChoiceList("open|done")).toBeUndefined();
    expect(readChoiceList(undefined)).toBeUndefined();
  });

  it("may be made by a formula, told by its leading =, which no JSON list starts with", () => {
    expect(listFormula(" =@projects ")).toBe("=@projects");
    expect(listFormula(writeChoiceList(["=a"]))).toBeUndefined();
    expect(listFormula(undefined)).toBeUndefined();
    expect(readChoiceList("=@projects")).toBeUndefined();
  });

  it("take a formula's values in its order, empty ones and repeats (whatever their case) left out, the first kept", () => {
    expect(listOfValues(["Beacon", "", "atlas", " Atlas ", "BEACON", "TRUE", "2"])).toEqual(["Beacon", "atlas", "TRUE", "2"]);
  });

  it("are named strictly: lower case ASCII, words joined by single dashes, starting with a letter", () => {
    for (const name of ["status", "task-status", "q2-plan"]) expect(LIST_NAME_RE.test(name)).toBe(true);
    for (const name of ["Status", "stav-úkolu", "2nd", "a--b", "a-", "a_b", ""]) expect(LIST_NAME_RE.test(name)).toBe(false);
  });

  it("are listed from the column types' data by name", () => {
    expect(listNames(new Map([["choice.status", "[]"], ["other.x", "1"], ["choice.task-status", "[]"]]))).toEqual(["status", "task-status"]);
  });

  it("get a name from their column's name, diacritics dropped, not one taken", () => {
    expect(listNameFor("Stav úkolu", [])).toBe("stav-ukolu");
    expect(listNameFor("Status", ["status"])).toBe("status-2");
    expect(listNameFor("2026 Plan", [])).toBe("plan");
    expect(listNameFor("#", [])).toBe("list");
  });

  it("find a value whatever its case", () => {
    expect(choiceIndex(["open", "In progress"], " in PROGRESS ")).toBe(1);
    expect(choiceIndex(["open"], "closed")).toBe(-1);
  });
});

describe("#choice", () => {
  it("names a list after its dash, in any case; a name that is no list's name is no choice type", () => {
    expect(paramsOf("choice")).toEqual({ name: undefined });
    expect(paramsOf("choice-task-status")).toEqual({ name: "task-status" });
    expect(paramsOf("choice-Status")).toEqual({ name: "Status" });
    expect(typeOfTag("choice-stav-úkolu")).toBeUndefined();
    expect(typeOfTag("choice-a--b")).toBeUndefined();
  });

  it("checks a value against its list, whatever its case; without a list, or without its table, checks nothing", () => {
    expect(choice.check("In Progress", paramsOf("choice-status"), STATUS)).toBeUndefined();
    expect(choice.check("later", paramsOf("choice-status"), STATUS)).toBe('"later" is not one of the choices of status');
    expect(choice.check("later", paramsOf("choice-Status"), STATUS)).toBeDefined();
    expect(choice.check("later", paramsOf("choice-other"), STATUS)).toBeUndefined();
    expect(choice.check("later", paramsOf("choice"), STATUS)).toBeUndefined();
    expect(choice.check("later", paramsOf("choice-status"))).toBeUndefined();
  });

  it("has an icon of its own for a column of a list, its type's for #choice alone", () => {
    expect(choice.iconFor!(paramsOf("choice"))).toBeUndefined();
    const listed = choice.iconFor!(paramsOf("choice-status"))!;
    expect(listed).toMatch(/^<svg viewBox="0 0 24 24"[^>]*>.+<\/svg>$/);
    expect(listed).not.toBe(choice.icon);
  });

  it("ranks a value by its place in the list, one not in it after them all; without a list none", () => {
    expect(["done", "open", "in progress", "later"].map((v) => choice.rank!(v, paramsOf("choice-status"), STATUS))).toEqual([2, 0, 1, 3]);
    expect(choice.rank!("done", paramsOf("choice"), STATUS)).toBeUndefined();
  });

  it("offers its list's values in order, without one the column's values each once, sorted", () => {
    expect(choice.choices!(paramsOf("choice-status"), STATUS).map((c) => c.value)).toEqual(["open", "in progress", "done"]);
    expect(choice.choices!(paramsOf("choice"), STATUS).map((c) => c.value)).toEqual(["done", "later", "open"]);
  });
});
