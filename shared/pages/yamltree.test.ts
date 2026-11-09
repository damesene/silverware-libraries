import { describe, expect, it } from "vitest";
import { readYamlMap, writeYamlEntry } from "./yamltree.ts";

const SCHEMA = `_database:
  id: tasks
  name: "Tasks: mine"
  format: 1
  properties:
    status: { type: select, label: Status, options: [Todo, "Doing, now", Done] }
    due: { type: date, label: Due }
    estimate:
      type: number
      readonly: true
  tags_seen:
    - a
    - 2
`;

describe("nested YAML", () => {
  it("reads maps by indent, maps and lists in brackets, block lists, scalars as YAML has them", () => {
    expect(readYamlMap(SCHEMA)).toEqual({
      value: {
        _database: {
          id: "tasks",
          name: "Tasks: mine",
          format: 1,
          properties: {
            status: { type: "select", label: "Status", options: ["Todo", "Doing, now", "Done"] },
            due: { type: "date", label: "Due" },
            estimate: { type: "number", readonly: true },
          },
          tags_seen: ["a", 2],
        },
      },
    });
    expect(readYamlMap("a:\n- x\n- y\nb: # a comment\nc: [] # none\n")).toEqual({ value: { a: ["x", "y"], b: null, c: [] } });
    expect(readYamlMap("due: 2026-11-10\nempty: {}")).toEqual({ value: { due: "2026-11-10", empty: {} } });
  });

  it("says why a form is not read, never guessing", () => {
    for (const text of ["a: &x 1", "a: |\n  text", "a:\n  - b: 1\n    c: 2", "a: [1, 2", "a: 1\na: 2", "a:\n    b: 1\n  c: 2", "a: { b 1 }"]) expect(readYamlMap(text), text).toHaveProperty("problem");
  });

  it("writes a key's map by indent, a map of scalars below it on one line, lists in brackets", () => {
    const value = (readYamlMap(SCHEMA) as { value: { _database: never } }).value._database;
    const written = writeYamlEntry("_database", value);
    expect(written).toBe(`_database:
  id: tasks
  name: "Tasks: mine"
  format: 1
  properties:
    status: { type: select, label: Status, options: [Todo, "Doing, now", Done] }
    due: { type: date, label: Due }
    estimate: { type: number, readonly: true }
  tags_seen: [a, 2]
`);
    expect(readYamlMap(written)).toEqual({ value: { _database: value } });
  });

  it("reads back whatever it writes: texts YAML would read otherwise quoted", () => {
    const value = { texts: ["yes", "007", "a: b", "#x", "[x]", "{y}", "2026-11-10", " padded", "it's", 'say "hi"', "a,b", ""], n: -1.5, t: false, z: null, deep: { a: { b: { c: [1, { d: "e" }] } } } };
    expect(readYamlMap(writeYamlEntry("v", value))).toEqual({ value: { v: value } });
  });

  it("refuses what it would read otherwise than written: a map in a list item, ': ' unquoted, numbers not kept exactly", () => {
    for (const text of ["a:\n  - name: x", "a: b: c", "a: 12345678901234567890", "a: [1, b: c]"]) expect(readYamlMap(text), text).toHaveProperty("problem");
    expect(() => writeYamlEntry("a", Number.NaN)).toThrow();
    expect(() => writeYamlEntry("a", 2 ** 60)).toThrow();
  });

  it("reads keys in quotes in brackets as their text, and keys named as an object's own properties as any", () => {
    // (JSON.parse makes "__proto__" a key of its own, as a page's YAML would)
    const value = JSON.parse('{"k": {"1e3": [1], "a b": "x", "constructor": 1, "toString": "s", "__proto__": {"inner": true}}}');
    expect(Object.keys(value.k)).toContain("__proto__");
    const written = writeYamlEntry("v", value);
    const read = readYamlMap(written) as { value: { v: Record<string, unknown> } };
    expect(JSON.stringify(read.value.v)).toBe(JSON.stringify(value));
    expect(Object.keys(read.value.v.k as object)).toContain("__proto__");
    expect(writeYamlEntry("v", read.value.v as never)).toBe(written);
    expect(readYamlMap("constructor: 1\ntoString: 2")).toHaveProperty("value");
  });

  it("writes line and paragraph separators so that a reader of lines reads them back", () => {
    const text = `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`;
    const written = writeYamlEntry("v", { t: text, l: [text] });
    expect(written.split("\n")).toHaveLength(4);
    expect(readYamlMap(written)).toEqual({ value: { v: { t: text, l: [text] } } });
  });
});