// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { ViewHost } from "../core/view.ts";
import { textOf, typeOf } from "../domain/listing.ts";
import { TypeRegistry } from "../domain/types/registry.ts";
import type { Database, Item, ItemKey } from "../model/database.ts";
import { editValue, toggle } from "./editors.ts";

const types = new TypeRegistry();
const DATABASE: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [
    { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false },
    { key: "tags", label: "Tags", type: "multi-select", params: { options: ["a", "b"] }, readonly: false },
    { key: "estimate", label: "Estimate", type: "number", params: {}, readonly: false },
    { key: "due", label: "Due", type: "date", params: {}, readonly: false },
    { key: "done", label: "Done", type: "checkbox", params: {}, readonly: false },
    { key: "made", label: "Made", type: "date", params: {}, readonly: true },
    { key: "note", label: "Note", type: "text", params: {}, readonly: false },
  ],
};
const ITEM: Item = { key: "page-1" as ItemKey, name: "Fix login", values: { status: "Todo", tags: ["a", "old"], estimate: 3 }, rank: "a0", revision: "1" };

/** A host for one item, recording what the editors write */
function setup() {
  const writes: unknown[][] = [];
  const told: string[] = [];
  const own: Pick<ViewHost, "document" | "database" | "type" | "text" | "update" | "rename" | "notify"> = {
    notify: (message) => void told.push(message),
    document,
    database: DATABASE,
    type: (property) => typeOf(types, property),
    text: (item, key) => textOf(item, key, DATABASE, types),
    update: async (item, key, value) => (writes.push(["update", item.name, key, value]), { problem: "", cause: "unchanged" }),
    rename: async (item, name) => (writes.push(["rename", item.name, name]), { problem: "", cause: "unchanged" }),
  };
  const host = own as ViewHost;
  const cell = document.createElement("td");
  document.body.append(cell);
  let shown = 0;
  const edit = (key: string, item: Item = ITEM) => editValue(host, cell, item, key, () => void shown++);
  return { host, cell, writes, edit, told, shown: () => shown };
}

const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
afterEach(() => document.body.replaceChildren());

describe("the built-in views' editors", () => {
  it("edit a number as typed, its type reading it; one that does not read is said and not written", async () => {
    const { cell, writes, edit } = setup();
    edit("estimate");
    const input = cell.querySelector("input")!;
    expect([input.type, input.value]).toEqual(["text", "3"]);
    input.value = "a lot";
    key(input, "Enter");
    expect(input.validationMessage || input.title).toContain("no number");
    input.value = "2,5";
    key(input, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([["update", "Fix login", "estimate", 2.5]]);
  });

  it("put a value aside with Esc, and take a value emptied off the item", async () => {
    const { cell, writes, edit, shown } = setup();
    edit("estimate");
    key(cell.querySelector("input")!, "Escape");
    expect([writes, shown()]).toEqual([[], 1]);
    edit("estimate");
    const input = cell.querySelector("input")!;
    input.value = "";
    key(input, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([["update", "Fix login", "estimate", undefined]]);
  });

  it("pick a select's option, or none; a date in the browser's date field", async () => {
    const { cell, writes, edit } = setup();
    edit("status");
    const select = cell.querySelector("select")!;
    expect([...select.options].map((one) => one.value)).toEqual(["", "Todo", "Done"]);
    select.value = "Done";
    select.dispatchEvent(new Event("change"));
    edit("due");
    expect(cell.querySelector("input")!.type).toBe("date");
    await Promise.resolve();
    expect(writes).toEqual([["update", "Fix login", "status", "Done"]]);
  });

  it("tick several options, the values kept (none of them too) kept in their order, the new after", async () => {
    const { cell, writes, edit } = setup();
    edit("tags");
    const boxes = [...cell.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
    expect(boxes.map((box) => [box.value, box.checked])).toEqual([
      ["a", true],
      ["b", false],
      ["old", true],
    ]);
    boxes[1]!.checked = true;
    key(cell.querySelector(".swd-editor")!, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([["update", "Fix login", "tags", ["a", "old", "b"]]]);
  });

  it("rename the item by its name, and offer no editor for a property read only", async () => {
    const { cell, writes, edit } = setup();
    edit("made");
    expect(cell.querySelector("input")).toBeNull();
    edit("name");
    const input = cell.querySelector("input")!;
    input.value = "Fix the login";
    key(input, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([["rename", "Fix login", "Fix the login"]]);
  });

  it("turn a checkbox at once, unticked false", async () => {
    const { host, writes } = setup();
    await toggle(host, ITEM, "done");
    await toggle(host, { ...ITEM, values: { done: true } }, "done");
    expect(writes).toEqual([
      ["update", "Fix login", "done", true],
      ["update", "Fix login", "done", false],
    ]);
  });

  it("write nothing the user did not change: a date the date field cannot hold, another kind of value, options in another order", async () => {
    const { cell, writes, edit } = setup();
    const odd: Item = { ...ITEM, values: { due: "2026-02-30", status: 2, note: 42, tags: ["b", "a"] } };
    edit("due", odd);
    expect(cell.querySelector("input")!.type).toBe("text");
    cell.querySelector("input")!.dispatchEvent(new Event("blur"));
    edit("note", odd);
    cell.querySelector("input")!.dispatchEvent(new Event("blur"));
    edit("note", { ...odd, values: { note: ["x", "y"] } });
    cell.querySelector("input")!.dispatchEvent(new Event("blur"));
    edit("status", odd);
    expect(cell.querySelector("select")!.value).toBe("2");
    key(cell.querySelector("select")!, "Enter");
    edit("tags", odd);
    key(cell.querySelector(".swd-editor")!, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([]);
  });

  it("say a value that does not read as the field is left, writing nothing", async () => {
    const { cell, writes, edit, told } = setup();
    edit("estimate");
    const input = cell.querySelector("input")!;
    input.value = "1,000";
    input.dispatchEvent(new Event("blur"));
    await Promise.resolve();
    expect(writes).toEqual([]);
    expect(told).toEqual([expect.stringContaining("Estimate of Fix login")]);
  });

  it("take a select's choice made by the keys only with Enter", async () => {
    const { cell, writes, edit } = setup();
    edit("status");
    const select = cell.querySelector("select")!;
    key(select, "ArrowDown");
    select.value = "Done";
    select.dispatchEvent(new Event("change"));
    expect(writes).toEqual([]);
    key(select, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([["update", "Fix login", "status", "Done"]]);
  });

  it("write no date the field cannot read (half typed: the browser says empty), and take duplicates kept as they are", async () => {
    const { cell, writes, edit, told } = setup();
    edit("due", { ...ITEM, values: { due: "2026-02-10" } });
    const input = cell.querySelector("input")!;
    input.value = "";
    Object.defineProperty(input, "validity", { value: { badInput: true } });
    input.dispatchEvent(new Event("blur"));
    edit("tags", { ...ITEM, values: { tags: ["a", "a"] } });
    key(cell.querySelector(".swd-editor")!, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([]);
    expect(told).toEqual([expect.stringContaining("not a date")]);
  });
});
