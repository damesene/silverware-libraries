import { describe, expect, it } from "vitest";
import { isEmpty, validatePropertyKey } from "../../model/database.ts";
import { TypeRegistry } from "./registry.ts";
import type { PropertyType } from "./type.ts";

const types = new TypeRegistry();
const type = (name: string) => types.named(name)!;

describe("property keys", () => {
  it("are what Space Lua reads bare: lower case letters, digits and _, starting with a letter", () => {
    for (const key of ["status", "due_date", "q3"]) expect(validatePropertyKey(key), key).toBeUndefined();
    for (const key of ["due-date", "Due", "3d", "_database", "", "name"]) expect(validatePropertyKey(key), key).toBeDefined();
  });
  it("tell an empty value", () => {
    expect([null, "", [], undefined, 0, false, "x"].map((value) => isEmpty(value))).toEqual([true, true, true, true, false, false, false]);
  });
});

describe("the built-in types", () => {
  it("are the first seven, in their order", () => {
    expect(types.all().map((one) => one.name)).toEqual(["text", "number", "checkbox", "date", "select", "multi-select", "url"]);
  });

  it("read typed text as their values, or say why not", () => {
    expect(type("number").parse("2,5", {})).toEqual({ value: 2.5 });
    expect(type("number").parse("3 kg", {})).toEqual({ problem: '"3 kg" is no number' });
    expect(type("number").parse(" ", {})).toEqual({ value: null });
    expect(type("checkbox").parse("Yes", {})).toEqual({ value: true });
    expect(type("checkbox").parse("maybe", {})).toHaveProperty("problem");
    expect(type("date").parse("2026-11-10", {})).toEqual({ value: "2026-11-10" });
    expect(type("date").parse("2026-02-30", {})).toHaveProperty("problem");
    expect(type("multi-select").parse("a, b, a,", {})).toEqual({ value: ["a", "b"] });
    expect(type("url").parse("https://silverbullet.md", {})).toEqual({ value: "https://silverbullet.md" });
    expect(type("url").parse("javascript:alert(1)", {})).toHaveProperty("problem");
  });

  it("say why a value kept does not read as them, an empty one always reading", () => {
    const options = { options: ["Todo", "Doing", "Done"] };
    expect(type("select").validate("Doing", options)).toBeUndefined();
    expect(type("select").validate("Later", options)).toBe('"Later" is none of its options');
    expect(type("multi-select").validate(["Todo", "X", "Y"], options)).toBe('"X", "Y" are none of its options');
    expect(type("number").validate("12", {})).toBe("no number");
    for (const one of types.all()) expect(one.validate(null, options), one.name).toBeUndefined();
  });

  it("show and sort their values", () => {
    const options = { options: ["Todo", "Doing", "Done"] };
    const order = ["Done", "Later", "Todo", "Doing"].sort((a, b) => type("select").sortKey!(a, options).localeCompare(type("select").sortKey!(b, options)));
    expect(order).toEqual(["Todo", "Doing", "Done", "Later"]);
    expect(type("multi-select").text(["a", "b"], {})).toBe("a, b");
    expect(type("checkbox").text(true, {})).toBe("true");
  });

  it("take an empty value as reading, whatever the type", () => {
    for (const one of types.all()) for (const empty of [null, "", []]) expect(one.validate(empty, {}), `${one.name} ${JSON.stringify(empty)}`).toBeUndefined();
  });

  it("show a value that does not read as they are as it is kept, never blank", () => {
    expect(type("number").text("12 pcs", {})).toBe("12 pcs");
    expect(type("text").text(2026, {})).toBe("2026");
    expect(type("date").text("soon", {})).toBe("soon");
    expect(type("multi-select").text(["a", "b"], {})).toBe("a, b");
  });

  it("refuse what reads two ways or would be lost in typing", () => {
    expect(type("number").parse("1,000", {})).toHaveProperty("problem");
    expect(type("number").parse("1,5", {})).toEqual({ value: 1.5 });
    expect(type("url").parse("www.example.com", {})).toEqual({ value: "https://www.example.com" });
    expect(type("url").parse("https:foo", {})).toHaveProperty("problem");
    expect(type("multi-select").validate(["a", "a"], { options: ["a"] })).toBe("an option twice");
    expect(type("multi-select").validateParams!({ options: ["a, b"] })).toBeDefined();
    expect(type("select").validateParams!({ options: ["a, b"] })).toBeUndefined();
  });

  it("check a select's options", () => {
    expect(type("select").validateParams!({ options: ["a", "b"] })).toBeUndefined();
    expect(type("select").validateParams!({ options: ["a", "a"] })).toBe("its options repeat one");
    expect(type("select").validateParams!({ options: "a, b" })).toBe("its options are no list of texts");
  });
});

describe("the registry", () => {
  it("puts a type defined of a built-in name in its place, the others after", () => {
    const registry = new TypeRegistry();
    const mine: PropertyType = { name: "date", label: "My date", validate: () => undefined, text: String, parse: (text) => ({ value: text }) };
    const stars: PropertyType = { name: "stars", label: "Stars", validate: () => undefined, text: String, parse: (text) => ({ value: text }) };
    registry.define([stars, mine]);
    expect(registry.all().map((one) => one.label)).toEqual(["Text", "Number", "Checkbox", "My date", "Select", "Multi-select", "URL", "Stars"]);
    registry.define([]);
    expect(registry.named("date")!.label).toBe("Date");
    expect(registry.named("stars")).toBeUndefined();
  });
});
