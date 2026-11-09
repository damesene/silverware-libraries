// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseCore, type ItemConflict } from "../../core/core.ts";
import { type ModuleDefinition, Modules } from "../../core/module.ts";
import { TypeRegistry } from "../../domain/types/registry.ts";
import type { Database } from "../../model/database.ts";
import { MemoryStore } from "../../store/memory.ts";
import { PROPERTIES_MODULE } from "./index.ts";
import { menuBuilder } from "../../../../shared/menuslots.ts";
import { PLACE_MENU_SLOTS } from "../../core/placemenu.ts";

/** The modules' entries in a place's menu, as items (labels, what they run) */
const menuItems = (modules: Modules, database: Database) =>
  modules.placeMenu({ document, database, overWindow: false, setOverWindow: () => {} }, menuBuilder(PLACE_MENU_SLOTS, () => {})).flatMap((group) => group.entries.flatMap((entry) => (entry.kind === "item" ? [entry] : [])));

const TASKS: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [
    { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false },
    { key: "estimate", label: "Estimate", type: "text", params: {}, readonly: false },
  ],
};

async function setup(answer = false, configured: Record<string, unknown> = {}, all: readonly ModuleDefinition[] = [PROPERTIES_MODULE], itemDocuments = false, showConflict?: (conflict: ItemConflict, done: () => void) => void) {
  const store = new MemoryStore([{ database: TASKS, items: [{ name: "Fix login", values: { status: "Todo", estimate: "3" }, rank: "a0" }, { name: "Write docs", values: { estimate: "a lot" }, rank: "a1" }] }]);
  // (As a store of pages: each item a document of its own)
  if (itemDocuments) Object.defineProperty(store, "capabilities", { value: { ...store.capabilities, itemDocument: true } });
  const types = new TypeRegistry();
  const told: string[] = [];
  let asked = 0;
  const ui = { notify: (message: string) => void told.push(message), ask: () => (asked++, answer) };
  const core = new DatabaseCore(store, types, ui);
  let refreshed = 0;
  const modules = new Modules(all, { document, core, types, ui, database: (id) => store.database(id), items: async (id) => (await store.items(id)).value, itemBodies: true, body: (id, item) => store.body(id, item.key), openDocument: async () => {}, documents: async () => [], validateDocumentName: () => undefined, openByName: async () => {}, noun: { one: "page", many: "pages" }, editorArea: () => undefined, onChanged: (listener) => store.onChanged((one) => listener(one.database)), onDocumentOpened: () => () => {}, refreshPlaces: () => void refreshed++, ...(showConflict ? { showConflict } : {}) }, { get: (path, fallback) => (path in configured ? configured[path] : fallback) });
  await modules.start();
  const schema = async () => (await store.database("tasks"))!.value.properties;
  const named = async (name: string) => (await store.items("tasks")).value.find((one) => one.name === name)!;
  const open = async () => {
    menuItems(modules, (await store.database("tasks"))!.value).find((one) => one.label === "Properties")!.run();
    await settle();
  };
  const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  return { store, core, modules, schema, named, open, q, told, refreshed: () => refreshed, asked: () => asked };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
const change = (target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) => {
  target.value = value;
  target.dispatchEvent(new Event("change"));
};
afterEach(() => document.body.replaceChildren());

describe("the modules", () => {
  it("start only those on, each with its settings, and tell each other through offers", async () => {
    const seen: unknown[] = [];
    const giver: ModuleDefinition = { name: "giver", label: "Giver", description: "", settings: [{ key: "word", label: "Word", control: "text", default: "hi" }], start: (host) => void host.offer({ word: host.setting("word") }) };
    const taker: ModuleDefinition = { name: "taker", label: "Taker", description: "", start: (host) => void seen.push(host.offered("giver")) };
    await setup(false, { "silverware.database.modules.properties.enabled": false }, [PROPERTIES_MODULE, giver, taker]).then(({ modules }) => {
      expect(menuItems(modules, TASKS)).toEqual([]);
    });
    expect(seen).toEqual([{ word: "hi" }]);
  });

  it("start once where a start overtakes another, each module's entries once, in the slot of what they do", async () => {
    const { modules } = await setup();
    await Promise.all([modules.start(), modules.start()]);
    expect(menuItems(modules, TASKS).map((one) => one.label)).toEqual(["Properties"]);
    expect(modules.placeMenu({ document, database: TASKS, overWindow: false, setOverWindow: () => {} }, menuBuilder(PLACE_MENU_SLOTS, () => {})).map((group) => group.slot)).toEqual(["data"]);
  });
});

describe("the properties' dialog", () => {
  // A property's row opened (its details shown), as a press on it does
  const expand = (key: string) => document.querySelector<HTMLButtonElement>(`[data-property="${key}"] .swd-prop-head`)!.click();
  // A select's options as the list edits them: each name typed, one added by Enter
  const optionNames = () => [...document.querySelectorAll<HTMLInputElement>(".swd-option-name")];
  const typeOption = (input: HTMLInputElement, text: string) => {
    input.value = text;
    input.dispatchEvent(new Event("input"));
  };
  const addOption = (text: string) => {
    const added = document.querySelector<HTMLInputElement>(".swd-option-new")!;
    added.value = text;
    added.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  };
  const saveButton = () => document.querySelector<HTMLButtonElement>(".swd-properties-save")!;
  const save = async () => {
    saveButton().click();
    await settle();
  };
  const apply = async () => {
    document.querySelector<HTMLButtonElement>(".swd-property-apply")!.click();
    await settle();
  };
  const marks = () => Object.fromEntries([...document.querySelectorAll<HTMLElement>("[data-property]")].map((row) => [row.dataset.property, row.querySelector(".swd-prop-mark")?.textContent ?? ""]));

  it("keeps every change in its draft, marked in the list, until Save writes them all in one change, undone as one", async () => {
    const { open, q, schema, refreshed, core } = await setup();
    await open();
    expect([...document.querySelectorAll(".swd-prop-name")].map((one) => one.textContent)).toEqual(["Status", "Estimate"]);
    expect([...document.querySelectorAll(".swd-prop-type")].map((one) => one.textContent)).toEqual(["Select", "Text"]);
    // Nothing changed: nothing to save
    expect(saveButton().disabled).toBe(true);
    change(q<HTMLInputElement>(".swd-property-new-label"), "Due date");
    q<HTMLSelectElement>(".swd-property-new-type").value = "date";
    q<HTMLButtonElement>(".swd-property-add").click();
    expand("status");
    change(q<HTMLInputElement>('.swd-property-label[data-key="status"]'), "State");
    expand("estimate");
    q<HTMLInputElement>('[data-property="estimate"] .swd-property-locked input').click();
    // Alt+↑ on its grip: one place up
    q('[data-property="estimate"] .swd-prop-grip').dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }));
    await settle();
    expect(marks()).toEqual({ estimate: "Changed", status: "Changed", "new:1": "New" });
    expect(q(".swd-properties-note").textContent).toBe("Not saved yet");
    // Nothing written yet
    expect((await schema()).map((one) => [one.key, one.label, one.readonly])).toEqual([
      ["status", "Status", false],
      ["estimate", "Estimate", false],
    ]);
    await save();
    // The schema alone: written at once, no review, the dialog closed
    expect(document.querySelector(".swd-properties")).toBeNull();
    expect((await schema()).map((one) => [one.key, one.label, one.readonly])).toEqual([
      ["estimate", "Estimate", true],
      ["status", "State", false],
      ["due_date", "Due date", false],
    ]);
    expect(refreshed()).toBeGreaterThan(0);
    await core.undo("tasks");
    expect(await schema()).toEqual(TASKS.properties);
  });

  it("adds a system property from the System group of the types, its name offered; read only, its details saying what it is, offered once", async () => {
    const { open, q, schema, named } = await setup();
    await open();
    const types = () => [...q<HTMLSelectElement>(".swd-property-new-type").options];
    // (Progress is a system property's own: not offered for one of the user's; date and time is)
    expect(types().some((one) => one.value === "progress")).toBe(false);
    expect(types().some((one) => one.value === "datetime")).toBe(true);
    expect(types().filter((one) => one.value.startsWith("system:")).map((one) => one.text)).toEqual(["Created", "Modified", "Order", "Page", "Tags", "Task progress"]);
    change(q<HTMLSelectElement>(".swd-property-new-type"), "system:order");
    expect(q<HTMLInputElement>(".swd-property-new-label").value).toBe("Order");
    q<HTMLButtonElement>(".swd-property-add").click();
    // Offered once, in the draft already
    expect(types().find((one) => one.value === "system:order")!.disabled).toBe(true);
    expect(document.querySelector('[data-property="new:1"] .swd-prop-type')!.textContent).toBe("System: Order");
    await save();
    expect((await schema()).at(-1)).toEqual({ key: "order", label: "Order", type: "number", params: {}, readonly: true, system: "order" });
    expect((await named("Write docs")).values.order).toBe(2);
    await open();
    // Its details: its name, what it is, its key read only (under Advanced); no type, required or locked to change
    expand("order");
    const details = q('[data-property="order"] .swd-prop-detail');
    expect(details.querySelector(".swd-prop-system")!.textContent).toContain("Given by the system");
    expect(details.querySelector(".swd-property-type, .swd-property-required, .swd-property-locked")).toBeNull();
    // (Its name in the views may be shown, as any property's)
    expect(details.querySelector(".swd-property-show-name")).not.toBeNull();
    expect(details.querySelector<HTMLInputElement>(".swd-property-key")!.readOnly).toBe(true);
    // (Its key under Advanced, folded, as any property's: a system property's lock opens nothing)
    expect(details.querySelector<HTMLDetailsElement>(".swd-prop-advanced")!.open).toBe(false);
    expect(details.querySelector(".swd-prop-advanced .swd-property-key")).not.toBeNull();
    // Removed: whether to take its values off is not offered (they are no item's); the schema alone, written at once
    details.querySelector<HTMLButtonElement>(".swd-property-remove")!.click();
    expect(marks().order).toBe("Removed");
    expect(document.querySelector('[data-property="order"] .swd-property-values-off')).toBeNull();
    await save();
    expect((await schema()).some((one) => one.key === "order")).toBe(false);
  });

  it("shows the values outside the database on a screen of their own, read only as it is asked for: added to the draft with a type picked, or taken off the pages", async () => {
    const { open, q, schema, store, named } = await setup();
    // A key the items keep that no property is
    store.changeOutside("tasks", (await named("Fix login")).key, { values: { points: 5 } });
    store.changeOutside("tasks", (await named("Write docs")).key, { values: { points: 8, legacy: "x" } });
    const looseValues = store.looseValues.bind(store);
    let read = 0;
    store.looseValues = (id) => (read++, looseValues(id));
    await open();
    expect(read).toBe(0);
    q<HTMLButtonElement>(".swd-property-loose-open").click();
    await settle();
    expect(read).toBe(1);
    const rows = () => [...document.querySelectorAll<HTMLElement>(".swd-loose-row")].map((row) => [row.dataset.key, row.querySelector(".swd-loose-count")!.textContent, row.querySelector<HTMLSelectElement>(".swd-loose-type")!.value]);
    expect(rows()).toEqual([
      ["points", "2 items", "number"],
      ["legacy", "1 item", "text"],
    ]);
    // Added as a text: in the draft, gone from the screen
    const type = q<HTMLSelectElement>('.swd-loose-row[data-key="points"] .swd-loose-type');
    type.value = "text";
    type.dispatchEvent(new Event("change"));
    q<HTMLButtonElement>('.swd-loose-row[data-key="points"] .swd-loose-add').click();
    expect(rows().map(([key]) => key)).toEqual(["legacy"]);
    expect((await schema()).some((one) => one.key === "points")).toBe(false);
    // Taken off the pages: shown first, applied at once (the draft kept), gone from the screen and the items
    q<HTMLButtonElement>('.swd-loose-row[data-key="legacy"] .swd-loose-remove').click();
    await settle();
    expect(q(".swd-property-review").textContent).toContain('Take "legacy" off the items: one item changes');
    await apply();
    expect((await named("Write docs")).values.legacy).toBeUndefined();
    expect(q(".swd-loose-none").textContent).toBe("Every key the items keep is a property of the database, or added to it on Save.");
    // Back to the properties: the draft's new property there, written by Save with its values back
    q<HTMLButtonElement>(".swd-loose-back").click();
    expect(marks()["new:1"]).toBe("New");
    await save();
    expect((await schema()).at(-1)).toMatchObject({ key: "points", label: "Points", type: "text" });
    // Closed on that screen: opened again on the properties
    await open();
    q<HTMLButtonElement>(".swd-property-loose-open").click();
    await settle();
    document.querySelector<HTMLElement>(".swd-settings-close")!.click();
    await settle();
    await open();
    expect(document.querySelector(".swd-loose")).toBeNull();
    expect(document.querySelector(".swd-property-new-label")).not.toBeNull();
  });

  it("makes a property required from its details, marked * in the list, written on Save", async () => {
    const { open, q, schema } = await setup();
    await open();
    expect(q('[data-property="status"] .swd-prop-required')).toBeNull();
    expand("status");
    q<HTMLInputElement>('[data-property="status"] .swd-property-required input').click();
    expect(q('[data-property="status"] .swd-prop-required').textContent).toBe("*");
    expect(q('[data-property="status"] .swd-prop-head').getAttribute("aria-label")).toContain("required");
    expect((await schema())[0]!.required).toBeUndefined();
    await save();
    expect((await schema())[0]!.required).toBe(true);
  });

  it("takes a change back that is undone in the draft: nothing to save", async () => {
    const { open, q } = await setup();
    await open();
    expand("status");
    q<HTMLInputElement>('[data-property="status"] .swd-property-show-name input').click();
    expect([saveButton().disabled, marks().status]).toEqual([false, "Changed"]);
    // (Its details still open, drawn anew)
    q<HTMLInputElement>('[data-property="status"] .swd-property-show-name input').click();
    expect([saveButton().disabled, marks().status]).toEqual([true, ""]);
  });

  it("locks a property under Advanced, a lock then shown on its row folded", async () => {
    const { open, q, schema } = await setup();
    await open();
    expand("status");
    expect(q<HTMLDetailsElement>('[data-property="status"] .swd-prop-advanced').open).toBe(false);
    q<HTMLInputElement>('[data-property="status"] .swd-property-locked input').click();
    expand("status");
    expect(q('[data-property="status"] .swd-prop-lock').getAttribute("title")).toBe("Locked in views");
    expect(q('[data-property="status"] .swd-prop-head').getAttribute("aria-label")).toContain("locked in views");
    await save();
    expect((await schema())[0]!.readonly).toBe(true);
  });

  it("turns a select's Multiple on, its values made lists of their option on Save, and off again: the switch a select's alone", async () => {
    const { open, q, schema, named } = await setup();
    await open();
    expand("estimate");
    expect(document.querySelector('[data-property="estimate"] .swd-property-setting')).toBeNull();
    expand("status");
    const multiple = () => q<HTMLInputElement>('[data-property="status"] .swd-property-setting[data-param="multiple"] input');
    expect(multiple().checked).toBe(false);
    multiple().click();
    expect([multiple().checked, marks().status]).toEqual([true, "Changed"]);
    await save();
    await apply();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"], multiple: true });
    expect((await named("Fix login")).values.status).toEqual(["Todo"]);
    await open();
    expand("status");
    multiple().click();
    await save();
    await apply();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"] });
    expect((await named("Fix login")).values.status).toBe("Todo");
  });

  it("offers no Required for a checkbox: unticked is its value", async () => {
    const { open, q, core } = await setup();
    await core.addProperty("tasks", { label: "Done", type: "checkbox" });
    await open();
    expand("done");
    expect(q('[data-property="done"] .swd-prop-detail')).not.toBeNull();
    expect(document.querySelector('[data-property="done"] .swd-property-required')).toBeNull();
  });

  it("shows a change of items first, how many and the values kept, and writes it only once applied; Back keeps the draft", async () => {
    const { open, q, schema, named } = await setup();
    await open();
    expand("estimate");
    change(q<HTMLSelectElement>('[data-property="estimate"] .swd-property-type'), "number");
    await save();
    expect(q(".swd-property-review").textContent).toContain("one item changes");
    expect(q(".swd-property-review").textContent).toContain("One item holds a value that does not read");
    expect((await schema())[1]!.type).toBe("text");
    // Back: the draft as it was, not written
    q<HTMLButtonElement>(".swd-property-cancel").click();
    expect(q<HTMLSelectElement>('[data-property="estimate"] .swd-property-type').value).toBe("number");
    await save();
    await apply();
    expect(document.querySelector(".swd-properties")).toBeNull();
    expect((await schema())[1]!.type).toBe("number");
    expect((await named("Fix login")).values.estimate).toBe(3);
    expect((await named("Write docs")).values.estimate).toBe("a lot");
  });

  it("edits a select's options as a list: one added, one renamed keeping its color, written with the rest on Save", async () => {
    const { open, schema, core } = await setup();
    await core.setPropertyParams("tasks", "status", { options: ["Todo", "Done"], colors: { Done: "green" } }, { options: ["Todo", "Done"] });
    await open();
    expand("status");
    typeOption(optionNames()[1]!, "Finished");
    addOption("Doing");
    expect(optionNames().map((one) => one.value)).toEqual(["Todo", "Finished", "Doing"]);
    // Add beside the field, as Enter: off while nothing is typed, the field focused again for another
    const field = () => document.querySelector<HTMLInputElement>('[data-property="status"] .swd-option-new')!;
    const add = () => document.querySelector<HTMLButtonElement>('[data-property="status"] .swd-option-add')!;
    expect(add().disabled).toBe(true);
    field().value = "Later";
    field().dispatchEvent(new Event("input"));
    expect(add().disabled).toBe(false);
    add().click();
    expect([optionNames().map((one) => one.value), document.activeElement, add().disabled]).toEqual([["Todo", "Finished", "Doing", "Later"], field(), true]);
    document.querySelectorAll<HTMLButtonElement>('[data-property="status"] .swd-option-remove')[3]!.click();
    // (No item holds Done: the schema alone, written at once)
    await save();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Finished", "Doing"], colors: { Finished: "green" } });
  });

  it("moves an option by Alt+↑ on its grip, a key changed with it in one change", async () => {
    const { open, q, schema, named } = await setup();
    await open();
    expand("status");
    document.querySelectorAll<HTMLElement>(".swd-option-grip")[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }));
    expect(optionNames().map((one) => one.value)).toEqual(["Done", "Todo"]);
    change(q<HTMLInputElement>('.swd-property-key[aria-label="Key of Status"]'), "state");
    await save();
    await apply();
    expect((await schema())[0]).toMatchObject({ key: "state", params: { options: ["Done", "Todo"] } });
    expect((await named("Fix login")).values.state).toBe("Todo");
  });

  it("saves none of two option names alike, both marked, the draft kept", async () => {
    const { open, q, schema, told } = await setup();
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "To do");
    typeOption(optionNames()[1]!, "To do");
    await save();
    expect(document.querySelector(".swd-property-review")).toBeNull();
    expect(optionNames().map((one) => one.classList.contains("swd-invalid"))).toEqual([true, true]);
    expect(told.at(-1)).toContain("is two options");
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"] });
    expect(q<HTMLButtonElement>(".swd-properties-save").disabled).toBe(false);
  });

  it("renames the items' values with their option in the same write, said first, undone in one step", async () => {
    const { open, q, schema, named, core, store } = await setup();
    await core.create("tasks", { name: "Plan", values: { status: "Todo" } });
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "To do");
    await save();
    expect(q(".swd-property-review").textContent).toContain("2 items: Todo → To do");
    // Nothing written before Apply
    expect((await named("Fix login")).values.status).toBe("Todo");
    await apply();
    expect([(await named("Fix login")).values.status, (await named("Plan")).values.status]).toEqual(["To do", "To do"]);
    expect((await schema())[0]!.params).toEqual({ options: ["To do", "Done"] });
    await core.undo("tasks");
    expect([(await named("Fix login")).values.status, (await named("Plan")).values.status]).toEqual(["Todo", "Todo"]);
    expect((await store.database("tasks"))!.value).toEqual(TASKS);
  });

  it("says how many pages a change writes where each item is a page, and to keep the window open, however few", async () => {
    const { open, q } = await setup(false, {}, [PROPERTIES_MODULE], true);
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "To do");
    await save();
    // (One item holds Todo: its page and the database's)
    expect(q(".swd-property-review").textContent).toContain("Writes 2 pages, one after another: keep this window open until it is done");
  });

  it("stays open while a change is written, said why, and closes once it is", async () => {
    const { open, q, store, named, told } = await setup();
    // The store's write held until let go, as thousands of pages would hold it
    let letGo = () => {};
    const held = new Promise<void>((resolve) => (letGo = resolve));
    const write = store.apply.bind(store);
    store.apply = async (plan, progress) => (await held, write(plan, progress));
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "To do");
    await save();
    await apply();
    q<HTMLElement>(".swd-settings-close").click();
    await settle();
    expect(told.at(-1)).toContain("Wait until the change is shown or written");
    expect(document.querySelector(".swd-property-review")).not.toBeNull();
    letGo();
    await settle();
    expect((await named("Fix login")).values.status).toBe("To do");
    expect(document.querySelector(".swd-properties")).toBeNull();
  });

  it("draws nothing anew as a field typed in is left, so a press on another field types there: the row's head and marks told", async () => {
    const { open, q } = await setup();
    await open();
    expand("status");
    const second = optionNames()[1]!;
    const label = q<HTMLInputElement>('.swd-property-label[data-key="status"]');
    change(optionNames()[0]!, "Open");
    change(label, "State");
    expect(optionNames()[1]).toBe(second);
    expect(q<HTMLInputElement>('.swd-property-label[data-key="status"]')).toBe(label);
    expect([q('[data-property="status"] .swd-prop-name').textContent, marks().status]).toEqual(["State", "Changed"]);
    expect(q('.swd-option-color[aria-label="Color of Open"]')).not.toBeNull();
  });

  it("swaps two options' names with their values and colors", async () => {
    const { open, q, schema, named, core } = await setup();
    await core.setPropertyParams("tasks", "status", { options: ["Todo", "Done"], colors: { Done: "green" } }, { options: ["Todo", "Done"] });
    await core.update("tasks", await named("Write docs"), "status", "Done");
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "Done");
    typeOption(optionNames()[1]!, "Todo");
    await save();
    const review = q(".swd-property-review").textContent;
    expect(review).toContain("1 item: Todo → Done");
    expect(review).toContain("1 item: Done → Todo");
    await apply();
    expect([(await named("Fix login")).values.status, (await named("Write docs")).values.status]).toEqual(["Done", "Todo"]);
    expect((await schema())[0]!.params).toEqual({ options: ["Done", "Todo"], colors: { Todo: "green" } });
  });

  it("renames an option named as an object's own member, keeping its color", async () => {
    const { open, schema, named, core } = await setup();
    const made = await core.retypeProperty("tasks", "status", "select", { options: ["constructor", "Done"], colors: { constructor: "red" } }, { Todo: "constructor" });
    if ("problem" in made) throw new Error(made.problem);
    await core.apply(made);
    expect((await named("Fix login")).values.status).toBe("constructor");
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "Built");
    await save();
    await apply();
    expect((await schema())[0]!.params).toEqual({ options: ["Built", "Done"], colors: { Built: "red" } });
    expect((await named("Fix login")).values.status).toBe("Built");
  });

  it("writes nothing where an item changed between the review and Apply, the draft kept", async () => {
    const { open, schema, named, store, told } = await setup();
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "To do");
    await save();
    store.changeOutside("tasks", (await named("Write docs")).key, { values: { status: "Todo" } });
    await apply();
    expect(told.at(-1)).toContain("nothing was written");
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"] });
    expect([(await named("Fix login")).values.status, (await named("Write docs")).values.status]).toEqual(["Todo", "Todo"]);
    expect(optionNames().map((one) => one.value)).toEqual(["To do", "Done"]);
  });

  it("asks before it closes with a draft of changes, keeps the focus in the list as an option is taken away", async () => {
    const asked: string[] = [];
    const { open, q, modules } = await setup(false);
    (modules as unknown as { host: { ui: { ask: (message: string) => boolean } } }).host.ui.ask = (message) => (asked.push(message), false);
    await open();
    expand("status");
    document.querySelectorAll<HTMLButtonElement>(".swd-option-remove")[0]!.click();
    expect(document.activeElement).toBe(optionNames()[0]);
    q<HTMLElement>(".swd-properties-cancel").click();
    await settle();
    expect(asked).toEqual(["Close the properties? What you changed is not saved."]);
    expect(document.querySelector(".swd-properties")).not.toBeNull();
  });

  it("keeps options and a new property typed and not added while the dialog is drawn anew", async () => {
    const { open, q } = await setup();
    await open();
    expand("status");
    addOption("Doing");
    const label = q<HTMLInputElement>(".swd-property-new-label");
    label.value = "Due";
    label.dispatchEvent(new Event("input"));
    q<HTMLInputElement>('[data-property="status"] .swd-property-locked input').click();
    expect(optionNames().map((one) => one.value)).toEqual(["Todo", "Done", "Doing"]);
    expect(q<HTMLInputElement>(".swd-property-new-label").value).toBe("Due");
  });

  it("opens one dialog a database, writes a change once, closes as the module stops", async () => {
    const { modules, schema, told } = await setup();
    const [properties] = menuItems(modules, TASKS);
    properties!.run();
    properties!.run();
    await settle();
    expect(document.querySelectorAll(".swd-properties")).toHaveLength(1);
    expand("estimate");
    document.querySelector<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove')!.click();
    saveButton().click();
    saveButton().click();
    await settle();
    expect(told.filter((one) => one.includes("nothing was written"))).toEqual([]);
    expect((await schema()).map((one) => one.key)).toEqual(["status"]);
    properties!.run();
    await settle();
    modules.stop();
    expect(document.querySelectorAll(".swd-properties")).toHaveLength(0);
  });

  it("gives an option a color in the draft, and takes it back with Auto", async () => {
    const { open, q, schema } = await setup();
    await open();
    expand("status");
    q<HTMLButtonElement>('.swd-option-color[aria-label="Color of Done"]').click();
    q<HTMLButtonElement>('.swd-option-swatch[data-color-name="green"]').click();
    expect(q('.swd-option-color[aria-label="Color of Done"] .swd-pill').getAttribute("data-color")).toBe("2");
    q<HTMLButtonElement>('.swd-option-color[aria-label="Color of Done"]').click();
    q<HTMLButtonElement>(".swd-option-auto").click();
    expect(saveButton().disabled).toBe(true);
    q<HTMLButtonElement>('.swd-option-color[aria-label="Color of Done"]').click();
    q<HTMLButtonElement>('.swd-option-swatch[data-color-name="green"]').click();
    // (The schema alone: written at once)
    await save();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"], colors: { Done: "green" } });
  });

  it("saves no draft made of properties changed elsewhere since: said in its foot, the draft kept", async () => {
    const { open, q, schema, core } = await setup();
    await open();
    expand("status");
    addOption("Later");
    await core.setPropertyParams("tasks", "status", { options: ["Todo", "Done"], colors: { Done: "green" } }, { options: ["Todo", "Done"] });
    await save();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"], colors: { Done: "green" } });
    expect(q(".swd-properties-note").textContent).toContain("changed elsewhere");
    expect(optionNames().map((one) => one.value)).toEqual(["Todo", "Done", "Later"]);
  });

  it("offers the conflict of a draft made of properties changed elsewhere: Show conflict in its foot, its Write mine writing the draft over them, the dialog closed", async () => {
    const shown: ItemConflict[] = [];
    const { open, q, schema, core } = await setup(false, {}, [PROPERTIES_MODULE], false, (conflict, done) => {
      shown.push(conflict);
      void conflict.force().then(done);
    });
    await open();
    expand("status");
    addOption("Later");
    await core.renameProperty("tasks", "estimate", "Effort");
    await save();
    q<HTMLButtonElement>(".swd-properties-conflict").click();
    await settle();
    expect(shown).toHaveLength(1);
    expect(document.querySelector(".swd-properties")).toBeNull();
    // (Written over them: the draft's Estimate, its option added)
    expect((await schema()).map((one) => one.label)).toEqual(["Status", "Estimate"]);
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done", "Later"] });
  });

  it("gives an option a color of the user's own, shown in its pill", async () => {
    const { open, q, schema } = await setup();
    await open();
    expand("status");
    q<HTMLButtonElement>('.swd-option-color[aria-label="Color of Done"]').click();
    const own = q<HTMLInputElement>(".swd-option-own-input");
    own.value = "#3a7bd5";
    own.dispatchEvent(new Event("change"));
    const pill = q<HTMLElement>('.swd-option-color[aria-label="Color of Done"] .swd-pill');
    expect([pill.dataset.color, pill.style.getPropertyValue("--swd-pill")]).toEqual(["own", "58, 123, 213"]);
    await save();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"], colors: { Done: "#3a7bd5" } });
  });

  it("drops the colors of the options taken away as the options are saved", async () => {
    const { open, schema, core } = await setup();
    await core.setPropertyParams("tasks", "status", { options: ["Todo", "Done"], colors: { Todo: "red", Done: "green" } }, (await schema())[0]!.params);
    await open();
    expand("status");
    document.querySelectorAll<HTMLButtonElement>(".swd-option-remove")[1]!.click();
    addOption("Doing");
    await save();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Doing"], colors: { Todo: "red" } });
  });

  it("removes a property on Save, asking nothing: its values kept unless its switch takes them off too; Keep it takes the removal back", async () => {
    const kept = await setup(false);
    await kept.open();
    expand("estimate");
    kept.q<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove').click();
    expect(marks().estimate).toBe("Removed");
    // Kept after all, removed again
    kept.q<HTMLButtonElement>('[data-property="estimate"] .swd-property-keep').click();
    expect(marks().estimate).toBe("");
    kept.q<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove').click();
    // Its values kept: the schema alone, written at once
    await save();
    expect((await kept.schema()).map((one) => one.key)).toEqual(["status"]);
    expect((await kept.named("Fix login")).values.estimate).toBe("3");
    document.body.replaceChildren();
    const gone = await setup(true);
    await gone.open();
    expand("estimate");
    gone.q<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove').click();
    gone.q<HTMLInputElement>('[data-property="estimate"] .swd-property-values-off input').click();
    await save();
    expect(gone.q(".swd-property-review").textContent).toContain("Save the properties: 2 items change");
    await apply();
    expect((await gone.named("Fix login")).values.estimate).toBeUndefined();
    expect([kept.asked(), gone.asked()]).toEqual([0, 0]);
  });
});
