import { describe, expect, it } from "vitest";
import type { Converted } from "../../core/converter.ts";
import type { Item, ItemKey, Property } from "../../model/database.ts";
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
    expect(converted.items.map((item) => [item.name, item.values?.status, item.body])).toEqual([
      ["Parent", "Todo", "- [x] Child\n  more text\n\n> a quote"],
      ["Second", "Done", "Text after"],
    ]);
  });

  it("takes a task indented less than the first as one of the top level too", () => {
    expect(read(["  - [ ] A", "    - [ ] A1", "- [ ] B"]).items.map((item) => item.name)).toEqual(["A", "B"]);
  });

  it("names an item by its text: attributes out, marks in a sentence words, marks at its end out", () => {
    const converted = read(["- [ ] Ask @jana about #budget [due: 2026-11-12] and [[Some Page|the page]] today #sales @ada [[Ref]]"]);
    // (The source with its attribute escaped: in the item's text it would give the page its value, over the frontmatter's)
    const backslash = String.fromCharCode(92);
    expect(converted.items[0]).toMatchObject({ name: "Ask jana about budget and the page today", source: `Ask @jana about #budget ${backslash}[due: 2026-11-12] and [[Some Page|the page]] today #sales @ada [[Ref]]`, tags: ["budget", "sales"] });
    expect(converted.items[0]!.values).toMatchObject({ people: ["jana", "ada"], links: ["[[Some Page]]", "[[Ref]]"], due: "2026-11-12" });
  });

  it("cuts a long name at a word", () => {
    const name = read([`- [ ] ${"word ".repeat(40)}`]).items[0]!.name;
    expect(name.length).toBeLessThanOrEqual(100);
    expect(name.endsWith("word")).toBe(true);
  });

  it("gives Status always (Todo, In progress, Done), People, Links and Tags where any has them, shown on a board by Status", () => {
    const converted = read(["- [IN PROGRESS] One @ada #a", "- [x] Two [[P]]", "- [ ] Three"]);
    expect(converted.properties.map((one) => [one.key, one.type])).toEqual([
      ["status", "select"],
      ["people", "person"],
      ["links", "reference"],
      ["page_tags", "tags"],
    ]);
    expect(property(converted, "status")!.params).toEqual({ options: ["Todo", "In progress", "Done"] });
    expect(property(converted, "people")!.params).toEqual({ options: ["ada"], multiple: true, anyone: true });
    expect(property(converted, "page_tags")).toMatchObject({ system: "tags" });
    expect(converted.items.map((item) => item.values?.status)).toEqual(["In progress", "Done", "Todo"]);
    expect(converted.view).toEqual({ name: "board", groupBy: "status" });
  });

  it("reads the status from [state: …] or [status: …] before the checkbox, whatever the case, a state of its own added before Done", () => {
    const converted = read(["- [ ] A [state: in  progress]", "- [x] B [Status: TODO]", "- [Waiting] C", "- [ ] D [status: waiting]", "- [in progress] E"]);
    expect(converted.items.map((item) => item.values?.status)).toEqual(["In progress", "Todo", "Waiting", "Waiting", "In progress"]);
    expect(property(converted, "status")!.params).toEqual({ options: ["Todo", "In progress", "Waiting", "Done"] });
    expect(converted.properties.map((one) => one.key)).toEqual(["status"]);
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

  it("takes the state attribute over the checkbox, as written where YAML reads no text of it, and none when empty", () => {
    const converted = read(["- [x] A [status: todo]", "- [X] B", "- [ ] C [STATE: @ada]", "- [ ] D [status: [a, b]]", "- [x] E [status: ]"]);
    expect(converted.items.map((item) => item.values?.status)).toEqual(["Todo", "Done", "@ada", "[a, b]", "Done"]);
  });

  it("writes no task done by a checkbox `done` where there is a Status (a task's attribute so named)", () => {
    const converted = read(["- [ ] A [done: true]"]);
    const props = converted.properties.map((one): Property => ({ params: {}, readonly: false, ...one }));
    const item: Item = { key: "a" as ItemKey, name: "A", values: converted.items[0]!.values!, rank: undefined, revision: "1" };
    expect(TASKS_CONVERTER.write!([item], props)).toBe("- [ ] A [done: true]\n");
  });

  it("joins a key given twice into one list, and keeps a key clear of the task's own", () => {
    const converted = read(["- [ ] A [prop: a] [prop: b] [done: maybe] [people: x]"]);
    expect(converted.items[0]!.values).toMatchObject({ status: "Todo", prop: ["a", "b"], done: "maybe", people_2: "x" });
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

  it("writes items back as tasks that read back the same: states, marks, attributes; what the system gives left out", () => {
    const properties: Property[] = [
      { key: "status", label: "Status", type: "select", params: { options: ["IN PROGRESS", "Done"] }, readonly: false },
      { key: "due", label: "Due", type: "date", params: {}, readonly: false },
      { key: "owner", label: "Owner", type: "person", params: {}, readonly: false },
      { key: "ref", label: "Ref", type: "reference", params: {}, readonly: false },
      { key: "note", label: "Note", type: "text", params: {}, readonly: false },
      { key: "people", label: "People", type: "person", params: { multiple: true }, readonly: false },
      { key: "links", label: "Links", type: "reference", params: {}, readonly: false },
      { key: "page_tags", label: "Tags", type: "tags", params: {}, readonly: true, system: "tags" },
      { key: "created_at", label: "Created", type: "datetime", params: {}, readonly: true, system: "createdAt" },
    ];
    const item = (name: string, values: Item["values"]): Item => ({ key: name as ItemKey, name, values, rank: undefined, revision: "1" });
    const items = [
      item("Call the client", { status: "IN PROGRESS", due: "2026-11-12", owner: "ada", ref: ["[[Web]]"], note: "a ] b", people: ["jana"], links: ["[[Acme]]"], page_tags: ["sales", "two words"], created_at: "2026-11-10T10:00" }),
      item("Send offer", { status: "Done" }),
      item("Plain", {}),
    ];
    const written = TASKS_CONVERTER.write!(items, properties);
    expect(written).toBe(
      [
        '- [ ] Call the client [status: IN PROGRESS] [due: "2026-11-12"] [owner: "@ada"] [ref: [[Web]]] [note: "a \\u005d b"] @jana [[Acme]] #sales #<two words>',
        "- [x] Send offer",
        "- [ ] Plain",
        "",
      ].join("\n"),
    );
    const back = TASKS_CONVERTER.read(written)!;
    // (A state read whatever its case: IN PROGRESS is In progress)
    expect(back.items[0]).toMatchObject({ name: "Call the client", tags: ["sales", "two words"], values: { status: "In progress", due: "2026-11-12", owner: "ada", ref: ["[[Web]]"], note: "a ] b", people: ["jana"], links: ["[[Acme]]"] } });
    expect(back.items.map((one) => one.values?.status)).toEqual(["In progress", "Done", "Todo"]);
    // A status of Todo a task not done; a checkbox `done` of a database's own, without a Status, ticked done
    expect(TASKS_CONVERTER.write!([item("A", { status: "todo" })], properties)).toBe("- [ ] A\n");
    const done: Property = { key: "done", label: "Done", type: "checkbox", params: {}, readonly: false };
    expect(TASKS_CONVERTER.write!([item("B", { done: true }), item("C", { done: false })], [done])).toBe("- [x] B\n- [ ] C\n");
    expect(TASKS_CONVERTER.write!([], properties)).toBe("");
  });

  it("writes what a task cannot hold so it still reads back: a status as an attribute, a person no mention can name, a name of syntax", () => {
    const prop = (key: string, type: string, params = {}): Property => ({ key, label: key, type, params, readonly: false });
    const properties = [prop("status", "select"), prop("people", "person", { multiple: true }), prop("ref", "reference"), prop("page_tags", "tags")].map((one) => (one.key === "page_tags" ? { ...one, system: "tags" } : one));
    const item = (name: string, values: Item["values"]): Item => ({ key: name as ItemKey, name, values, rank: undefined, revision: "1" });
    const written = TASKS_CONVERTER.write!(
      [
        item("[x: y] Use `a` #not @not", { status: "Waiting: for x", people: ["Ada Lovelace", "bob"], ref: ["Plain", "[[Web]]"], page_tags: ["ok", "a>b"] }),
        item("B", { status: "x" }),
      ],
      properties,
    );
    expect(written).toBe(String.raw`- [ ] \[x: y\] Use \`a\` \#not \@not [status: "Waiting: for x"] @bob [people: ["@Ada Lovelace"]] [ref: [[Plain]], [[Web]]] #ok
- [ ] B [status: x]
`);
    const back = TASKS_CONVERTER.read(written)!;
    expect(back.items[0]).toMatchObject({ name: "[x: y] Use `a` #not @not", tags: ["ok"], values: { status: "Waiting: for x", people: ["bob"], ref: ["[[Plain]]", "[[Web]]"], people_2: "Ada Lovelace" } });
    expect(back.items[1]!.values).toMatchObject({ status: "x" });
  });

  it("writes any status so it reads back the same, and a property keyed state or status clear of it", () => {
    const prop = (key: string, type: string): Property => ({ key, label: key, type, params: {}, readonly: false });
    const item = (name: string, values: Item["values"]): Item => ({ key: name as ItemKey, name, values, rank: undefined, revision: "1" });
    const statuses = ["a ] b", 'say "hi"', "  ", "IN progress", "done", "TODO", "x", "Waiting: for x"];
    const written = TASKS_CONVERTER.write!(statuses.map((status, at) => item(`T${at}`, { status })), [prop("status", "select")]);
    expect(TASKS_CONVERTER.read(written)!.items.map((one) => one.values?.status)).toEqual(["a ] b", 'say "hi"', "Todo", "In progress", "Done", "Todo", "x", "Waiting: for x"]);
    const clash = TASKS_CONVERTER.write!([item("A", { status: "Blocked", state: "open" })], [prop("status", "select"), prop("state", "text")]);
    expect(clash).toBe("- [ ] A [status: Blocked] [state_2: open]\n");
    expect(TASKS_CONVERTER.read(clash)!.items[0]!.values).toMatchObject({ status: "Blocked", state_2: "open" });
  });

  it("keeps a value YAML does not read as written, as text", () => {
    expect(read(["- [ ] A [k: a: b]"]).items[0]!.values).toMatchObject({ k: "a: b" });
  });
});
