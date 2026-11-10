import { describe, expect, it } from "vitest";
import { inlineMarks } from "./inline.ts";
import { readAttributeValue, readTaskLine, validateAttributeName, validateTaskState, writeAttribute, writeTaskLine } from "./task.ts";

describe("readTaskLine", () => {
  it("reads a task's marker, state and text", () => {
    expect(readTaskLine("  - [ ] Call the client")).toEqual({ indent: "  ", marker: "-", state: " ", done: false, text: "Call the client", textFrom: 8 });
    expect(readTaskLine("* [x] done")).toMatchObject({ marker: "*", state: "x", done: true, text: "done" });
    expect(readTaskLine("1. [X] done")).toMatchObject({ marker: "1.", done: true });
    expect(readTaskLine("- [IN PROGRESS] Custom")).toMatchObject({ state: "IN PROGRESS", done: false, text: "Custom" });
    expect(readTaskLine("- [ ]")).toMatchObject({ text: "", textFrom: 5 });
  });

  it("reads no task where SilverBullet reads none", () => {
    expect(["- item", "- [ ]text", "- [due: x] text", "[ ] text", "- [] text", "-[ ] text"].map(readTaskLine)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
  });
});

describe("writeTaskLine", () => {
  it("writes a task, its state checked", () => {
    expect(writeTaskLine(" ", "Call")).toBe("- [ ] Call");
    expect(writeTaskLine("IN PROGRESS", "", "  ")).toBe("  - [IN PROGRESS]");
    expect(() => writeTaskLine("a:b", "x")).toThrow('cannot hold "]", ":"');
    expect(validateTaskState("")).toBe("a task's state cannot be empty");
    expect(() => writeTaskLine(" ", "a\nb")).toThrow("a task's text is one line");
  });
});

describe("Attributes", () => {
  it("read their values as YAML: numbers, lists, texts; a form not read here said so", () => {
    expect(readAttributeValue("10")).toEqual({ value: 10 });
    expect(readAttributeValue("[a, b]")).toEqual({ value: ["a", "b"] });
    expect(readAttributeValue("2026-11-12")).toEqual({ value: "2026-11-12" });
    expect(readAttributeValue("a [b] c")).toEqual({ value: "a [b] c" });
    expect(readAttributeValue("@ada")).toEqual({ value: "@ada" });
    expect(readAttributeValue("a: b")).toHaveProperty("problem");
  });

  it("have names of ASCII letters, digits, _ and $", () => {
    expect(validateAttributeName("due_date$")).toBeUndefined();
    expect(validateAttributeName("úkol")).toContain("cannot be an attribute's name");
    expect(() => writeAttribute("a-b", 1)).toThrow("cannot be an attribute's name");
  });

  it("are written so SilverBullet reads them back: each as written, read back the same", () => {
    const values = [10, true, null, "plain text", "2026-11-12", "@ada", "#not a tag", "a, b", "a ] b", "[x", ["a", "b c", "d]"], "say: hi", 'a "quote"'];
    for (const value of values) {
      const written = writeAttribute("k", value);
      const marks = inlineMarks(`Task ${written} after`);
      expect(marks, written).toHaveLength(1);
      expect(marks[0]).toMatchObject({ kind: "attribute", name: "k", from: 5, to: 5 + written.length });
      expect(readAttributeValue((marks[0] as { value: string }).value), written).toEqual({ value });
    }
  });

  it("quote a text that YAML or the brackets would read otherwise", () => {
    expect(writeAttribute("owner", "@ada")).toBe('[owner: "@ada"]');
    const backslash = String.fromCharCode(92);
    expect(writeAttribute("v", "a ] b")).toBe(`[v: "a ${backslash}u005d b"]`);
    expect(writeAttribute("tags", ["a", "b"])).toBe("[tags: [a, b]]");
  });
});
