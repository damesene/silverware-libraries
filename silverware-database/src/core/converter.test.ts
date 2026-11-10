import { describe, expect, it } from "vitest";
import { type ConverterDefinition, ConverterRegistry, validateConverted, validateConverter } from "./converter.ts";

const converter = (name: string, label = name): ConverterDefinition => ({ name, label, read: () => undefined });

describe("Converters", () => {
  it("are checked: a name, a label, a read", () => {
    expect(validateConverter(converter("tasks"))).toBeUndefined();
    expect(validateConverter(converter("Tasks"))).toContain("is no converter's name");
    expect(validateConverter(converter("tasks", " "))).toBe('the converter "tasks" has no label');
    expect(validateConverter({ name: "tasks", label: "Tasks" } as ConverterDefinition)).toBe('the converter "tasks" has no read');
    expect(validateConverter({ ...converter("tasks"), description: 1 } as unknown as ConverterDefinition)).toContain("its description is no text");
    expect(validateConverter({ ...converter("tasks"), write: "x" } as unknown as ConverterDefinition)).toBe('the converter "tasks": its write is no function');
  });

  it("give what they read checked: a view named, its grouping a text", () => {
    expect(validateConverted({ properties: [], items: [], view: { name: "board", groupBy: "status" } })).toBeUndefined();
    for (const view of [{ name: "" }, { groupBy: "x" }, { name: "board", groupBy: 1 }, "board"]) expect(validateConverted({ properties: [], items: [], view }), JSON.stringify(view)).toContain("its view is no");
  });

  it("are offered built-in first, one of a built-in name in its place, the others after", () => {
    const registry = new ConverterRegistry([converter("tasks"), converter("list")]);
    const problems = registry.define([converter("csv"), converter("list", "My list"), converter("Bad"), converter("csv")]);
    expect(registry.all().map((one) => one.label)).toEqual(["tasks", "My list", "csv"]);
    expect(problems).toEqual([expect.stringContaining('"Bad" is no converter\'s name'), 'the converter "csv" is defined twice: the last kept']);
    registry.define([]);
    expect(registry.named("list")!.label).toBe("list");
  });
});
