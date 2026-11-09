// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { ViewHost } from "../core/view.ts";
import { textOf, typeOf } from "../domain/listing.ts";
import { TypeRegistry } from "../domain/types/registry.ts";
import type { Database, Item, ItemKey } from "../model/database.ts";
import { editValue, toggle } from "./editors.ts";
import { fieldNodes, valueNodes } from "./values.ts";

const types = new TypeRegistry();
const DATABASE: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [
    { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false },
    { key: "tags", label: "Tags", type: "select", params: { multiple: true, options: ["a", "b"] }, readonly: false },
    { key: "estimate", label: "Estimate", type: "number", params: {}, readonly: false },
    { key: "due", label: "Due", type: "date", params: {}, readonly: false },
    { key: "done", label: "Done", type: "checkbox", params: {}, readonly: false },
    { key: "made", label: "Made", type: "date", params: {}, readonly: true },
    { key: "note", label: "Note", type: "text", params: {}, readonly: false },
    { key: "at", label: "At", type: "time", params: {}, readonly: false },
    { key: "when", label: "When", type: "datetime", params: {}, readonly: false },
    { key: "web", label: "Web", type: "url", params: {}, readonly: false },
    { key: "refs", label: "Refs", type: "reference", params: {}, readonly: false },
    { key: "owner", label: "Owner", type: "person", params: { options: ["ada", "bob"], anyone: true }, readonly: false },
    { key: "team", label: "Team", type: "person", params: { options: ["ada", "bob"], multiple: true, anyone: true }, readonly: false },
    { key: "lead", label: "Lead", type: "person", params: { options: ["ada", "bob"] }, readonly: false },
  ],
};
const ITEM: Item = { key: "page-1" as ItemKey, name: "Fix login", values: { status: "Todo", tags: ["a", "old"], estimate: 3 }, rank: "a0", revision: "1" };

/** A host for one item, recording what the editors write */
function setup() {
  const writes: unknown[][] = [];
  const told: string[] = [];
  const opened: string[] = [];
  let listed: Promise<readonly string[]> = Promise.resolve(["Projects/Alpha", "Projects/Beta", "People/Ada"]);
  const own: Pick<ViewHost, "document" | "database" | "type" | "text" | "update" | "rename" | "notify" | "documents" | "validateDocumentName" | "openByName" | "noun" | "folderSeparator"> = {
    documents: () => listed,
    noun: { one: "page", many: "pages" },
    folderSeparator: "/",
    validateDocumentName: (name) => (name.includes("#") ? "no # in a page's name" : undefined),
    openByName: async (name) => void opened.push(name),
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
  return { host, cell, writes, edit, told, opened, shown: () => shown, list: (names: Promise<readonly string[]>) => void (listed = names) };
}

// (The pages listed, and what follows them, done)
const listedNow = () => new Promise((resolve) => setTimeout(resolve));
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
afterEach(() => document.body.replaceChildren());

describe("the built-in views' editors", () => {
  it("show a cell with the value saved at once, a view holding its drawing meanwhile (another of its cells edited); not written, as it was", async () => {
    const { host, cell, writes } = setup();
    const drawn: Item[] = [];
    editValue(host, cell, ITEM, "name", (written) => void drawn.push(written ?? ITEM));
    const field = cell.querySelector("input")!;
    field.value = "Fix the login";
    // (The field left by a press on another cell)
    field.dispatchEvent(new FocusEvent("blur"));
    await Promise.resolve();
    expect(writes).toEqual([["rename", "Fix login", "Fix the login"]]);
    // (This host writes nothing: the cell shown as it was again)
    expect(drawn.map((one) => one.name)).toEqual(["Fix the login", "Fix login"]);
  });

  it("edit a time and a date and time in the browser's own fields, as their types say", async () => {
    const { cell, writes, edit } = setup();
    edit("at", { ...ITEM, values: { at: "09:05" } });
    expect([cell.querySelector("input")!.type, cell.querySelector("input")!.value]).toEqual(["time", "09:05"]);
    const time = cell.querySelector("input")!;
    time.value = "14:30";
    key(time, "Enter");
    await Promise.resolve();
    edit("when");
    const moment = cell.querySelector("input")!;
    expect(moment.type).toBe("datetime-local");
    moment.value = "2026-11-08T14:30";
    key(moment, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([
      ["update", "Fix login", "at", "14:30"],
      ["update", "Fix login", "when", "2026-11-08T14:30"],
    ]);
  });

  it("edit a date with a time in the date field, its time kept; a day alone in the date and time field from midnight, written only if changed", async () => {
    const { cell, writes, edit } = setup();
    edit("due", { ...ITEM, values: { due: "2026-11-08T14:30" } });
    const day = cell.querySelector("input")!;
    expect([day.type, day.value]).toEqual(["date", "2026-11-08"]);
    day.value = "2026-11-12";
    key(day, "Enter");
    await Promise.resolve();
    edit("when", { ...ITEM, values: { when: "2026-11-10" } });
    const moment = cell.querySelector("input")!;
    expect([moment.type, moment.value]).toEqual(["datetime-local", "2026-11-10T00:00"]);
    // (Left as it was: nothing written, the day kept without a time)
    key(moment, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([["update", "Fix login", "due", "2026-11-12T14:30"]]);
  });

  it("pick references from the space's documents: those picked first, a search, Enter ticking the first found, a name no document has", async () => {
    const { cell, writes, edit } = setup();
    edit("refs", { ...ITEM, values: { refs: ["[[People/Ada|Ada]]"] } });
    await listedNow();
    const names = () => [...cell.querySelectorAll<HTMLInputElement>(".swd-editor-documents input[type=checkbox]")].map((box) => `${box.checked ? "x" : " "} ${box.value}`);
    expect(names()).toEqual(["x People/Ada", "  Projects/Alpha", "  Projects/Beta"]);
    const search = cell.querySelector<HTMLInputElement>(".swd-editor-search")!;
    search.value = "proj beta";
    search.dispatchEvent(new Event("input"));
    expect(names()).toEqual(["x People/Ada", "  Projects/Beta", "  proj beta"]);
    key(search, "Enter");
    expect(names()).toEqual(["x People/Ada", "x Projects/Beta", "  Projects/Alpha"]);
    search.value = "Ideas";
    search.dispatchEvent(new Event("input"));
    expect(cell.querySelector(".swd-editor-new")?.textContent).toBe("New: Ideas");
    // (Each its name, its folder under it, the whole path its title and its box's name)
    const beta = cell.querySelector<HTMLElement>('.swd-editor-choice[title="Projects/Beta"]')!;
    expect([beta.querySelector(".swd-editor-document-name")?.textContent, beta.querySelector(".swd-editor-document-folder")?.textContent, beta.querySelector("input")?.getAttribute("aria-label")]).toEqual(["Beta", "Projects", "Projects/Beta"]);
    key(search, "Enter");
    // (A name no page can have: not offered, why said)
    search.value = "C# notes";
    search.dispatchEvent(new Event("input"));
    expect([cell.querySelector(".swd-editor-new"), cell.querySelector(".swd-editor-note")?.textContent]).toEqual([null, "no # in a page's name"]);
    key(search, "Enter");
    search.value = "";
    // (Enter with nothing typed: saved, the reference kept keeping its text, the new ones links)
    key(search, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([["update", "Fix login", "refs", ["[[People/Ada|Ada]]", "[[Projects/Beta]]", "[[Ideas]]"]]]);
  });

  it("search in a document's folder by its icon, or beside it by its folder: a new one typed there, no box ticked", async () => {
    const { cell, writes, edit } = setup();
    edit("refs");
    await listedNow();
    const search = cell.querySelector<HTMLInputElement>(".swd-editor-search")!;
    const row = (name: string) => cell.querySelector<HTMLElement>(`.swd-editor-choice[title="${name}"]`)!;
    row("Projects/Beta").querySelector<HTMLButtonElement>(".swd-editor-document-into")!.click();
    // (Nothing under it in this space: none found, none ticked)
    expect([search.value, cell.querySelectorAll("input[type=checkbox]:checked").length]).toEqual(["Projects/Beta/", 0]);
    search.value = "";
    search.dispatchEvent(new Event("input"));
    row("Projects/Alpha").querySelector<HTMLButtonElement>("button.swd-editor-document-folder")!.click();
    const shown = () => [...cell.querySelectorAll<HTMLElement>(".swd-editor-choice")].map((one) => one.title);
    // (A folder alone: its documents, no name offered nor refused yet)
    expect([search.value, shown(), cell.querySelector(".swd-editor-note")?.textContent]).toEqual(["Projects/", ["Projects/Alpha", "Projects/Beta"], ""]);
    search.value += "Gamma";
    search.dispatchEvent(new Event("input"));
    key(search, "Enter");
    key(search, "Enter");
    await listedNow();
    expect(writes).toEqual([["update", "Fix login", "refs", ["[[Projects/Gamma]]"]]]);
  });

  it("keep a single link's text as written; offer nothing typed as new, nor tick by Enter, until the pages are listed", async () => {
    const { cell, writes, edit, list } = setup();
    let listNow: (names: readonly string[]) => void = () => {};
    list(new Promise((resolve) => (listNow = resolve)));
    edit("refs", { ...ITEM, values: { refs: "[[People/Ada|Ada]]" } });
    const search = cell.querySelector<HTMLInputElement>(".swd-editor-search")!;
    search.value = "proj";
    search.dispatchEvent(new Event("input"));
    expect(cell.querySelector(".swd-editor-note")?.textContent).toBe("Listing the pages…");
    key(search, "Enter");
    expect(cell.querySelectorAll(".swd-editor-new")).toHaveLength(0);
    listNow(["Projects/Alpha"]);
    await listedNow();
    key(search, "Enter");
    search.value = "";
    key(search, "Enter");
    await listedNow();
    expect(writes).toEqual([["update", "Fix login", "refs", ["[[People/Ada|Ada]]", "[[Projects/Alpha]]"]]]);
  });

  it("say pages that could not be listed, the editor kept open, names typed still taken", async () => {
    const { cell, writes, edit, list } = setup();
    list(Promise.reject(new Error("index down")));
    edit("refs");
    await listedNow();
    expect(cell.querySelector(".swd-editor-note")?.textContent).toBe("The pages could not be listed: index down");
    const search = cell.querySelector<HTMLInputElement>(".swd-editor-search")!;
    search.value = "Ideas";
    search.dispatchEvent(new Event("input"));
    key(search, "Enter");
    key(search, "Enter");
    await listedNow();
    expect(writes).toEqual([["update", "Fix login", "refs", ["[[Ideas]]"]]]);
  });

  it("write no references where the same are picked again, and edit as text a value that is no references", async () => {
    const { cell, writes, edit } = setup();
    edit("refs", { ...ITEM, values: { refs: ["[[Projects/Alpha]]"] } });
    key(cell.querySelector(".swd-editor-search")!, "Enter");
    await Promise.resolve();
    edit("refs", { ...ITEM, values: { refs: "see Alpha" } });
    expect(cell.querySelector("input")!.type).toBe("text");
    expect(writes).toEqual([]);
  });

  it("draw a value standing alone: its property's name before it where said, nothing where empty, a box its name, a required one missing its pill", () => {
    const { host } = setup();
    const property = (key: string, more: object = {}) => ({ ...DATABASE.properties.find((one) => one.key === key)!, ...more });
    const text = (nodes: Node[]) => nodes.map((node) => node.textContent).join("");
    expect(text(fieldNodes(host, ITEM, property("status", { showName: true })))).toBe("Status: Todo");
    expect(text(fieldNodes(host, ITEM, property("status")))).toBe("Todo");
    expect(fieldNodes(host, ITEM, property("due", { showName: true }))).toEqual([]);
    expect(text(fieldNodes(host, { ...ITEM, values: { done: true } }, property("done", { showName: true })))).toBe("✓ Done");
    expect(fieldNodes(host, ITEM, property("done"))).toEqual([]);
    expect(text(fieldNodes(host, ITEM, property("due", { required: true, showName: true })))).toBe("Due required");
    // (Under a header naming it: the value alone)
    expect(text(valueNodes(host, ITEM, property("status", { showName: true })))).toBe("Todo");
  });

  it("show tags as quiet labels, none of them marked as none of its options", () => {
    const { host } = setup();
    const tags = { key: "page_tags", label: "Tags", type: "multi-select", params: {}, readonly: true, system: "tags" };
    const nodes = valueNodes(host, { ...ITEM, values: { page_tags: ["work", "urgent"] } }, tags) as HTMLElement[];
    expect(nodes.map((node) => [node.textContent, node.classList.contains("swd-pill-none"), node.title])).toEqual([
      ["work", false, ""],
      ["urgent", false, ""],
    ]);
  });

  it("show references as links that open their documents, a press on one editing nothing", () => {
    const { host, opened } = setup();
    const nodes = valueNodes(host, { ...ITEM, values: { refs: ["[[Projects/Alpha]]", "[[People/Ada|Ada]]"] } }, DATABASE.properties.find((one) => one.key === "refs")!);
    expect(nodes.map((node) => [node.textContent, (node as HTMLElement).title])).toEqual([["Projects/Alpha", "Projects/Alpha"], ["Ada", "People/Ada"]]);
    // (Its folder quieter before its name; a link's own text alone)
    expect([(nodes[0] as HTMLElement).querySelector(".swd-reference-folder")?.textContent, (nodes[1] as HTMLElement).querySelector(".swd-reference-folder")]).toEqual(["Projects/", null]);
    const cell = document.createElement("div");
    let edited = 0;
    cell.addEventListener("click", () => edited++);
    cell.append(...nodes);
    (nodes[1] as HTMLElement).click();
    expect([opened, edited]).toEqual([["People/Ada"], 0]);
    // (A value that is no references: shown as kept, no link)
    expect(valueNodes(host, { ...ITEM, values: { refs: "see Alpha" } }, DATABASE.properties.find((one) => one.key === "refs")!).map((node) => node.nodeName)).toEqual(["#text"]);
  });

  it("edit a link's address and text in two fields, kept as a markdown link; read by the type, an address it does not take not written", async () => {
    const { cell, writes, edit, told } = setup();
    edit("web", { ...ITEM, values: { web: "https://silverbullet.md" } });
    const [address, text] = [...cell.querySelectorAll<HTMLInputElement>(".swd-editor-link input")];
    expect([address!.value, text!.value]).toEqual(["https://silverbullet.md", ""]);
    text!.value = "Docs";
    key(text!, "Enter");
    await Promise.resolve();
    edit("web", { ...ITEM, values: { web: "[Docs](https://silverbullet.md)" } });
    const [again, label] = [...cell.querySelectorAll<HTMLInputElement>(".swd-editor-link input")];
    expect([again!.value, label!.value]).toEqual(["https://silverbullet.md", "Docs"]);
    again!.value = "not an address";
    key(again!, "Enter");
    await Promise.resolve();
    // Enter on an address the type refuses: kept open on what was typed, why said there; left so: not written, said
    expect(cell.querySelector(".swd-editor-link")).not.toBeNull();
    expect(again!.validationMessage || again!.title).toContain("no web address");
    again!.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
    await Promise.resolve();
    expect(writes).toEqual([["update", "Fix login", "web", "[Docs](https://silverbullet.md)"]]);
    expect(told.at(-1)).toContain("no web address");
    // Opened and left unchanged: nothing written, a link written by hand kept as it is
    edit("web", { ...ITEM, values: { web: "[ Docs ](https://silverbullet.md)" } });
    key(cell.querySelector<HTMLInputElement>(".swd-link-address")!, "Enter");
    await Promise.resolve();
    expect(writes).toHaveLength(1);
  });

  it("show a link to open in a tab of its own, its text or its address as read, a press on it editing nothing", () => {
    const { host, cell } = setup();
    const web = DATABASE.properties.find((one) => one.key === "web")!;
    const [plain] = valueNodes(host, { ...ITEM, values: { web: "https://www.github.com/silverbullet/issues/" } }, web) as HTMLAnchorElement[];
    expect([plain!.href, plain!.target, plain!.textContent, plain!.querySelector(".swd-link-rest")!.textContent]).toEqual(["https://www.github.com/silverbullet/issues/", "_blank", "github.com/silverbullet/issues", "/silverbullet/issues"]);
    const [named] = valueNodes(host, { ...ITEM, values: { web: "[Docs](https://silverbullet.md)" } }, web) as HTMLAnchorElement[];
    expect(named!.textContent).toBe("Docs");
    // A press on it: not on to the value's own (its editor)
    let reached = false;
    cell.append(named!);
    cell.addEventListener("click", () => (reached = true));
    named!.addEventListener("click", (event) => event.preventDefault());
    named!.click();
    expect(reached).toBe(false);
  });

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

  it("offer a person's people in a field to type any name in where it takes Anyone, a list alone where it does not", async () => {
    const { cell, writes, edit } = setup();
    edit("owner", { ...ITEM, values: { owner: "ada" } });
    const input = cell.querySelector<HTMLInputElement>("input.swd-editor-typed")!;
    const offeredNow = () => [...cell.querySelectorAll<HTMLElement>(".swd-suggest:not([hidden]) .swd-suggest-item")].map((one) => one.textContent);
    // (As kept, as an editor edits a value: its @ only how it shows; every one offered as it opens)
    expect([input.value, offeredNow()]).toEqual(["ada", ["ada", "bob"]]);
    const typed = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event("input"));
    };
    typed("b");
    expect(offeredNow()).toEqual(["bob"]);
    // Cleared: every one offered again
    typed("");
    expect(offeredNow()).toEqual(["ada", "bob"]);
    // One picked by the arrows taken by Enter, written at once
    key(input, "ArrowDown");
    key(input, "ArrowDown");
    key(input, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([["update", "Fix login", "owner", "bob"]]);
    // A name none of them typed, Enter: written as typed, its @ read off
    edit("owner", { ...ITEM, values: { owner: "ada" } });
    const again = cell.querySelector<HTMLInputElement>("input.swd-editor-typed")!;
    again.value = "@eve";
    key(again, "Enter");
    await Promise.resolve();
    expect(writes.at(-1)).toEqual(["update", "Fix login", "owner", "eve"]);
    // (Without Anyone: its list only, each option as it shows)
    edit("lead");
    expect([...cell.querySelectorAll("select option")].map((one) => one.textContent)).toEqual(["", "ada", "bob"]);
  });

  it("add a name typed under a person's boxes where it takes Anyone, ticked, then saved with the rest", async () => {
    const { cell, writes, edit } = setup();
    edit("team", { ...ITEM, values: { team: ["ada"] } });
    expect([...cell.querySelectorAll("label.swd-editor-choice")].map((one) => one.textContent)).toEqual(["ada", "bob"]);
    const adder = cell.querySelector<HTMLInputElement>(".swd-editor-add")!;
    adder.value = "@eve";
    key(adder, "Enter");
    // (Added, the editor still open, the field empty for another; one already there ticked, not twice)
    expect([...cell.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].map((box) => [box.value, box.checked])).toEqual([
      ["ada", true],
      ["bob", false],
      ["eve", true],
    ]);
    expect([adder.value, writes]).toEqual(["", []]);
    // Add beside the field, as Enter: off while nothing is typed
    const button = cell.querySelector<HTMLButtonElement>(".swd-editor-add-button")!;
    expect(button.disabled).toBe(true);
    adder.value = "bob";
    adder.dispatchEvent(new Event("input"));
    expect(button.disabled).toBe(false);
    button.click();
    expect([adder.value, button.disabled, document.activeElement]).toEqual(["", true, adder]);
    // Enter with nothing typed saves; what is typed and not added yet goes with it
    adder.value = "zoe";
    key(cell.querySelector(".swd-editor")!, "Enter");
    await Promise.resolve();
    expect(writes).toEqual([["update", "Fix login", "team", ["ada", "bob", "eve", "zoe"]]]);
    // (Without Anyone: no field to add one)
    edit("tags");
    expect(cell.querySelector(".swd-editor-add")).toBeNull();
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
    expect(told).toEqual([expect.stringContaining("not read as date")]);
  });
});
