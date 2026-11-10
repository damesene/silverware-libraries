import { describe, expect, it } from "vitest";
import type { Converted } from "../../core/converter.ts";
import { TASKS_CONVERTER } from "./tasks.ts";

const read = (lines: readonly string[]): Converted => TASKS_CONVERTER.read(lines.join("\n"))!;
const property = (converted: Converted, key: string) => converted.properties.find((one) => one.key === key);

describe("The tasks converter", () => {
  it("reads nothing where there is no task, nor one in fenced code", () => {
    expect(TASKS_CONVERTER.read("Some text\n- an item")).toBeUndefined();
    expect(TASKS_CONVERTER.read("```\n- [ ] code\n```")).toBeUndefined();
  });

  it("makes each task of the top level an item, what is under it its body, dedented", () => {
    const converted = read(["Before", "- [ ] Parent", "  - [x] Child", "    more text", "", "  > a quote", "- [x] Second", "Text after"]);
    expect(converted.items.map((item) => [item.name, item.values?.done, item.body])).toEqual([
      ["Parent", false, "- [x] Child\n  more text\n\n> a quote"],
      ["Second", true, "Text after"],
    ]);
  });

  it("takes a task indented less than the first as one of the top level too", () => {
    expect(read(["  - [ ] A", "    - [ ] A1", "- [ ] B"]).items.map((item) => item.name)).toEqual(["A", "B"]);
  });

  it("names an item by its text: attributes out, marks in a sentence words, marks at its end out", () => {
    const converted = read(["- [ ] Ask @jana about #budget [due: 2026-11-12] and [[Some Page|the page]] today #sales @ada [[Ref]]"]);
    expect(converted.items[0]).toMatchObject({ name: "Ask jana about budget and the page today", source: "Ask @jana about #budget [due: 2026-11-12] and [[Some Page|the page]] today #sales @ada [[Ref]]", tags: ["budget", "sales"] });
    expect(converted.items[0]!.values).toMatchObject({ people: ["jana", "ada"], links: ["[[Some Page]]", "[[Ref]]"], due: "2026-11-12" });
  });

  it("cuts a long name at a word", () => {
    const name = read([`- [ ] ${"word ".repeat(40)}`]).items[0]!.name;
    expect(name.length).toBeLessThanOrEqual(100);
    expect(name.endsWith("word")).toBe(true);
  });

  it("gives Done always, Status where a task has a state of its own (done ones Done), People, Links and Tags where any has them", () => {
    const converted = read(["- [IN PROGRESS] One @ada #a", "- [x] Two [[P]]", "- [ ] Three"]);
    expect(converted.properties.map((one) => [one.key, one.type])).toEqual([
      ["done", "checkbox"],
      ["status", "select"],
      ["people", "person"],
      ["links", "reference"],
      ["page_tags", "tags"],
    ]);
    expect(property(converted, "status")!.params).toEqual({ options: ["IN PROGRESS", "Done"] });
    expect(property(converted, "people")!.params).toEqual({ options: ["ada"], multiple: true, anyone: true });
    expect(property(converted, "page_tags")).toMatchObject({ system: "tags" });
    expect(converted.items.map((item) => item.values?.status)).toEqual(["IN PROGRESS", "Done", undefined]);
  });

  it("types each attribute by its values across the items", () => {
    const converted = read([
      "- [ ] A [n: 10] [due: 2026-11-12] [at: 2026-11-12 14:30] [ok: true] [owner: @ada] [tags: [x, y]] [ref: [[Web]]] [note: hi]",
      "- [ ] B [n: 2] [due: 2026-11-13] [at: 2026-11-13 09:00] [ok: false] [owner: @bob] [tags: z] [ref: [[App]]] [note: 3]",
    ]);
    expect(converted.properties.slice(1).map((one) => [one.key, one.label, one.type])).toEqual([
      ["n", "N", "number"],
      ["due", "Due", "date"],
      ["at", "At", "datetime"],
      ["ok", "Ok", "checkbox"],
      ["owner", "Owner", "person"],
      ["tags", "Tags", "select"],
      ["ref", "Ref", "reference"],
      ["note", "Note", "text"],
    ]);
    expect(property(converted, "owner")!.params).toEqual({ options: ["ada", "bob"], multiple: false, anyone: true });
    expect(property(converted, "tags")!.params).toEqual({ multiple: true, options: ["x", "y", "z"] });
    expect(converted.items.map((item) => [item.values?.owner, item.values?.tags, item.values?.ref, item.values?.note])).toEqual([
      ["ada", ["x", "y"], ["[[Web]]"], "hi"],
      ["bob", ["z"], ["[[App]]"], "3"],
    ]);
  });

  it("joins a key given twice into one list, and keeps a key clear of the task's own", () => {
    const converted = read(["- [ ] A [prop: a] [prop: b] [done: maybe] [people: x]"]);
    expect(converted.items[0]!.values).toMatchObject({ done: false, prop: ["a", "b"], done_2: "maybe", people_2: "x" });
    expect(property(converted, "prop")).toMatchObject({ type: "select", params: { multiple: true, options: ["a", "b"] } });
  });

  it("names a task of marks alone by their words, and reads a person quoted as a person", () => {
    const converted = read(["- [ ] [[Project X|X]] @ada", "- [ ] B [owner: \"@ada\"]", "- [ ] C [owner: '@bob']"]);
    expect(converted.items[0]!.name).toBe("X ada");
    expect(property(converted, "owner")).toMatchObject({ type: "person", params: { options: ["ada", "bob"], multiple: false } });
  });

  it("keeps a body's code and hard line breaks as written, and tabs and CRLF read", () => {
    const converted = TASKS_CONVERTER.read("- [ ] A\r\n\tline one  \r\n\t```\r\n\t- [ ] not a task\r\n\t```\r\n- [ ] B")!;
    expect(converted.items.map((item) => [item.name, item.body])).toEqual([
      ["A", "line one  \n```\n- [ ] not a task\n```"],
      ["B", undefined],
    ]);
  });

  it("keeps a value YAML does not read as written, as text", () => {
    expect(read(["- [ ] A [k: a: b]"]).items[0]!.values).toMatchObject({ k: "a: b" });
  });
});
