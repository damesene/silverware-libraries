// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseCore } from "../../core/core.ts";
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

async function setup(answer = false, configured: Record<string, unknown> = {}, all: readonly ModuleDefinition[] = [PROPERTIES_MODULE], itemDocuments = false) {
  const store = new MemoryStore([{ database: TASKS, items: [{ name: "Fix login", values: { status: "Todo", estimate: "3" }, rank: "a0" }, { name: "Write docs", values: { estimate: "a lot" }, rank: "a1" }] }]);
  // (As a store of pages: each item a document of its own)
  if (itemDocuments) Object.defineProperty(store, "capabilities", { value: { ...store.capabilities, itemDocument: true } });
  const types = new TypeRegistry();
  const told: string[] = [];
  let asked = 0;
  const ui = { notify: (message: string) => void told.push(message), ask: () => (asked++, answer) };
  const core = new DatabaseCore(store, types, ui);
  let refreshed = 0;
  const modules = new Modules(all, { document, core, types, ui, database: (id) => store.database(id), items: async (id) => (await store.items(id)).value, itemBodies: true, body: (id, item) => store.body(id, item.key), openDocument: async () => {}, documents: async () => [], validateDocumentName: () => undefined, openByName: async () => {}, noun: { one: "page", many: "pages" }, editorArea: () => undefined, onChanged: (listener) => store.onChanged((one) => listener(one.database)), onDocumentOpened: () => () => {}, refreshPlaces: () => void refreshed++ }, { get: (path, fallback) => (path in configured ? configured[path] : fallback) });
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

  it("lists the properties, each with its type; adds one, renames one, locks, hides and moves one, each written at once", async () => {
    const { open, q, schema, refreshed } = await setup();
    await open();
    expect([...document.querySelectorAll(".swd-prop-name")].map((one) => one.textContent)).toEqual(["Status", "Estimate"]);
    expect([...document.querySelectorAll(".swd-prop-type")].map((one) => one.textContent)).toEqual(["Select", "Text"]);
    change(q<HTMLInputElement>(".swd-property-new-label"), "Due date");
    q<HTMLSelectElement>(".swd-property-new-type").value = "date";
    q<HTMLButtonElement>(".swd-property-add").click();
    await settle();
    expect((await schema()).at(-1)).toMatchObject({ key: "due_date", label: "Due date", type: "date" });
    expand("status");
    change(q<HTMLInputElement>('.swd-property-label[data-key="status"]'), "State");
    await settle();
    expand("estimate");
    q<HTMLInputElement>('[data-property="estimate"] .swd-property-locked input').click();
    await settle();
    // Alt+↑ on its grip: one place up
    q('[data-property="estimate"] .swd-prop-grip').dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }));
    await settle();
    expect((await schema()).map((one) => [one.key, one.label, one.readonly])).toEqual([
      ["estimate", "Estimate", true],
      ["status", "State", false],
      ["due_date", "Due date", false],
    ]);
    expect(refreshed()).toBeGreaterThan(0);
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
    await settle();
    expect((await schema()).at(-1)).toEqual({ key: "order", label: "Order", type: "number", params: {}, readonly: true, system: "order" });
    expect((await named("Write docs")).values.order).toBe(2);
    expect(document.querySelector('[data-property="order"] .swd-prop-type')!.textContent).toBe("System: Order");
    // Offered once
    expect(types().find((one) => one.value === "system:order")!.disabled).toBe(true);
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
    // Removed: whether to take its values off is not asked (they are no item's), the change shown, no item's value changing
    details.querySelector<HTMLButtonElement>(".swd-property-remove")!.click();
    await settle();
    expect(document.querySelector(".swd-properties")!.textContent).toContain("no item's value changes");
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await schema()).some((one) => one.key === "order")).toBe(false);
  });

  it("shows the values outside the database on a screen of their own, read only as it is asked for: added with a type picked, or taken off the pages", async () => {
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
    // Added as a text, its values back in the items
    const type = q<HTMLSelectElement>('.swd-loose-row[data-key="points"] .swd-loose-type');
    type.value = "text";
    type.dispatchEvent(new Event("change"));
    q<HTMLButtonElement>('.swd-loose-row[data-key="points"] .swd-loose-add').click();
    await settle();
    expect((await schema()).at(-1)).toMatchObject({ key: "points", label: "Points", type: "text" });
    expect(rows().map(([key]) => key)).toEqual(["legacy"]);
    // Taken off the pages: shown first, applied, gone from the screen and the items
    q<HTMLButtonElement>('.swd-loose-row[data-key="legacy"] .swd-loose-remove').click();
    await settle();
    expect(q(".swd-property-review").textContent).toContain('Take "legacy" off the items: one item changes');
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await named("Write docs")).values.legacy).toBeUndefined();
    expect(q(".swd-loose-none").textContent).toBe("Every key the items keep is a property of the database.");
    // Back to the properties
    q<HTMLButtonElement>(".swd-loose-back").click();
    expect(document.querySelector(".swd-property-new-label")).not.toBeNull();
    // Closed on that screen: opened again on the properties
    q<HTMLButtonElement>(".swd-property-loose-open").click();
    await settle();
    document.querySelector<HTMLElement>(".swd-settings-close")!.click();
    await settle();
    await open();
    expect(document.querySelector(".swd-loose")).toBeNull();
    expect(document.querySelector(".swd-property-new-label")).not.toBeNull();
  });

  it("makes a property required from its details, marked * in the list", async () => {
    const { open, q, schema } = await setup();
    await open();
    expect(q('[data-property="status"] .swd-prop-required')).toBeNull();
    expand("status");
    q<HTMLInputElement>('[data-property="status"] .swd-property-required input').click();
    await settle();
    expect((await schema())[0]!.required).toBe(true);
    expect(q('[data-property="status"] .swd-prop-required').textContent).toBe("*");
    expect(q('[data-property="status"] .swd-prop-head').getAttribute("aria-label")).toContain("required");
  });

  it("shows a property's name with its values in the views by its switch, a system property's too", async () => {
    const { open, q, schema } = await setup();
    await open();
    expand("status");
    q<HTMLInputElement>('[data-property="status"] .swd-property-show-name input').click();
    await settle();
    expect((await schema())[0]!.showName).toBe(true);
    // (Its details still open, drawn anew)
    q<HTMLInputElement>('[data-property="status"] .swd-property-show-name input').click();
    await settle();
    expect((await schema())[0]!.showName).toBeUndefined();
  });

  it("locks a property under Advanced, a lock then shown on its row folded", async () => {
    const { open, q, schema } = await setup();
    await open();
    expand("status");
    expect(q<HTMLDetailsElement>('[data-property="status"] .swd-prop-advanced').open).toBe(false);
    q<HTMLInputElement>('[data-property="status"] .swd-property-locked input').click();
    await settle();
    expect((await schema())[0]!.readonly).toBe(true);
    expand("status");
    expect(q('[data-property="status"] .swd-prop-lock').getAttribute("title")).toBe("Locked in views");
    expect(q('[data-property="status"] .swd-prop-head').getAttribute("aria-label")).toContain("locked in views");
  });

  it("offers no Required for a checkbox: unticked is its value", async () => {
    const { open, q, core } = await setup();
    await core.addProperty("tasks", { label: "Done", type: "checkbox" });
    await open();
    expand("done");
    expect(q('[data-property="done"] .swd-prop-detail')).not.toBeNull();
    expect(document.querySelector('[data-property="done"] .swd-property-required')).toBeNull();
  });

  it("shows a change of items first, how many and the values kept, and writes it only once applied", async () => {
    const { open, q, schema, named } = await setup();
    await open();
    expand("estimate");
    const type = q<HTMLSelectElement>('[data-property="estimate"] .swd-property-type');
    type.value = "number";
    type.dispatchEvent(new Event("change"));
    await settle();
    expect(q(".swd-property-review").textContent).toContain("one item changes");
    expect(q(".swd-property-review").textContent).toContain("One value does not read as the new type");
    expect((await schema())[1]!.type).toBe("text");
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await schema())[1]!.type).toBe("number");
    expect((await named("Fix login")).values.estimate).toBe(3);
    expect((await named("Write docs")).values.estimate).toBe("a lot");
  });

  it("edits a select's options as a list: one added, one renamed keeping its color, saved together; Discard puts them back", async () => {
    const { open, q, schema, core } = await setup();
    await core.setPropertyParams("tasks", "status", { options: ["Todo", "Done"], colors: { Done: "green" } }, { options: ["Todo", "Done"] });
    await open();
    expand("status");
    expect(q<HTMLButtonElement>(".swd-property-options-save").disabled).toBe(true);
    typeOption(optionNames()[1]!, "Finished");
    addOption("Doing");
    expect(optionNames().map((one) => one.value)).toEqual(["Todo", "Finished", "Doing"]);
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Finished", "Doing"], colors: { Finished: "green" } });
    // A change put aside: the options as saved (the property still open after the change)
    q<HTMLButtonElement>(".swd-option-remove").click();
    expect(optionNames()).toHaveLength(2);
    q<HTMLButtonElement>(".swd-property-options-discard").click();
    expect(optionNames()).toHaveLength(3);
  });

  it("moves an option by Alt+↑ on its grip, and takes a key's change aside by Cancel", async () => {
    const { open, q, schema } = await setup();
    await open();
    expand("status");
    document.querySelectorAll<HTMLElement>(".swd-option-grip")[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }));
    expect(optionNames().map((one) => one.value)).toEqual(["Done", "Todo"]);
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await schema())[0]!.params).toEqual({ options: ["Done", "Todo"] });
    change(q<HTMLInputElement>('.swd-property-key[aria-label="Key of Status"]'), "state");
    await settle();
    q<HTMLButtonElement>(".swd-property-cancel").click();
    await settle();
    expect((await schema())[0]!.key).toBe("status");
  });

  it("keeps the options edited through a review put aside, and saves none of two names alike", async () => {
    const { open, q, schema, told } = await setup();
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "To do");
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    expect(q(".swd-property-review").textContent).toContain("1 item: Todo → To do");
    q<HTMLButtonElement>(".swd-property-cancel").click();
    await settle();
    expect(optionNames().map((one) => one.value)).toEqual(["To do", "Done"]);
    // Two of one name: nothing proposed, both marked
    typeOption(optionNames()[1]!, "To do");
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    expect(document.querySelector(".swd-property-review")).toBeNull();
    expect(optionNames().map((one) => one.classList.contains("swd-invalid"))).toEqual([true, true]);
    expect(told.at(-1)).toContain("is two options");
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"] });
  });

  it("renames the items' values with their option in the same write, said first, undone in one step", async () => {
    const { open, q, schema, named, core, store } = await setup();
    await core.create("tasks", { name: "Plan", values: { status: "Todo" } });
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "To do");
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    expect(q(".swd-property-review").textContent).toContain("2 items: Todo → To do");
    // Nothing written before Apply
    expect((await named("Fix login")).values.status).toBe("Todo");
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
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
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    // (One item holds Todo: its page and the database's)
    expect(q(".swd-property-review").textContent).toContain("Writes 2 pages, one after another: keep this window open until it is done");
  });

  it("stays open while a change is written, said why, and closes once it is", async () => {
    const { open, q, store, named, told } = await setup();
    // The store's write held until let go, as thousands of pages would hold it
    let letGo = () => {};
    const held = new Promise<void>((resolve) => (letGo = resolve));
    const apply = store.apply.bind(store);
    store.apply = async (plan, progress) => (await held, apply(plan, progress));
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "To do");
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    q<HTMLElement>(".swd-settings-close").click();
    await settle();
    expect(told.at(-1)).toContain("Wait until the change is shown or written");
    expect(document.querySelector(".swd-property-review")).not.toBeNull();
    letGo();
    await settle();
    expect((await named("Fix login")).values.status).toBe("To do");
    q<HTMLElement>(".swd-settings-close").click();
    await settle();
    expect(document.querySelector(".swd-properties")).toBeNull();
  });

  it("swaps two options' names with their values and colors", async () => {
    const { open, q, schema, named, core } = await setup();
    await core.setPropertyParams("tasks", "status", { options: ["Todo", "Done"], colors: { Done: "green" } }, { options: ["Todo", "Done"] });
    await core.update("tasks", await named("Write docs"), "status", "Done");
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "Done");
    typeOption(optionNames()[1]!, "Todo");
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    const review = q(".swd-property-review").textContent;
    expect(review).toContain("1 item: Todo → Done");
    expect(review).toContain("1 item: Done → Todo");
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect([(await named("Fix login")).values.status, (await named("Write docs")).values.status]).toEqual(["Done", "Todo"]);
    expect((await schema())[0]!.params).toEqual({ options: ["Done", "Todo"], colors: { Todo: "green" } });
  });

  it("renames an option named as an object's own member, keeping its color", async () => {
    const { open, q, schema, named, core } = await setup();
    const made = await core.retypeProperty("tasks", "status", "select", { options: ["constructor", "Done"], colors: { constructor: "red" } }, { Todo: "constructor" });
    if ("problem" in made) throw new Error(made.problem);
    await core.apply(made);
    expect((await named("Fix login")).values.status).toBe("constructor");
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "Built");
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await schema())[0]!.params).toEqual({ options: ["Built", "Done"], colors: { Built: "red" } });
    expect((await named("Fix login")).values.status).toBe("Built");
  });

  it("writes nothing where an item changed between the review and Apply, the options edited kept", async () => {
    const { open, q, schema, named, store, told } = await setup();
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "To do");
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    store.changeOutside("tasks", (await named("Write docs")).key, { values: { status: "Todo" } });
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect(told.at(-1)).toContain("nothing was written");
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"] });
    expect([(await named("Fix login")).values.status, (await named("Write docs")).values.status]).toEqual(["Todo", "Todo"]);
    expect(optionNames().map((one) => one.value)).toEqual(["To do", "Done"]);
  });

  it("asks before it closes with options edited and not saved, keeps the focus in the list as one is taken away", async () => {
    const asked: string[] = [];
    const { open, q, modules } = await setup(false);
    (modules as unknown as { host: { ui: { ask: (message: string) => boolean } } }).host.ui.ask = (message) => (asked.push(message), false);
    await open();
    expand("status");
    document.querySelectorAll<HTMLButtonElement>(".swd-option-remove")[0]!.click();
    expect(document.activeElement).toBe(optionNames()[0]);
    q<HTMLElement>(".swd-settings-close").click();
    await settle();
    expect(document.querySelector(".swd-properties")).not.toBeNull();
  });

  it("keeps options and a new property typed and not saved while the dialog is drawn anew", async () => {
    const { open, q } = await setup();
    await open();
    expand("status");
    addOption("Doing");
    const label = q<HTMLInputElement>(".swd-property-new-label");
    label.value = "Due";
    label.dispatchEvent(new Event("input"));
    q<HTMLInputElement>('[data-property="status"] .swd-property-locked input').click();
    await settle();
    expect(optionNames().map((one) => one.value)).toEqual(["Todo", "Done", "Doing"]);
    expect(q<HTMLInputElement>(".swd-property-new-label").value).toBe("Due");
  });

  it("opens one dialog a database, applies a change once, closes as the module stops", async () => {
    const { modules, q, told } = await setup();
    const [properties] = menuItems(modules, TASKS);
    properties!.run();
    properties!.run();
    await settle();
    expect(document.querySelectorAll(".swd-properties")).toHaveLength(1);
    expand("estimate");
    q<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove').click();
    await settle();
    q<HTMLButtonElement>(".swd-property-apply").click();
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect(told.filter((one) => one.includes("nothing was written"))).toEqual([]);
    modules.stop();
    expect(document.querySelectorAll(".swd-properties")).toHaveLength(0);
  });

  it("gives an option a color, at once, and takes it back with Auto", async () => {
    const { open, q, schema } = await setup();
    await open();
    expand("status");
    q<HTMLButtonElement>('.swd-option-color[aria-label="Color of Done"]').click();
    q<HTMLButtonElement>('.swd-option-swatch[data-color-name="green"]').click();
    await settle();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"], colors: { Done: "green" } });
    expect(q('.swd-option-color[aria-label="Color of Done"] .swd-pill').getAttribute("data-color")).toBe("2");
    q<HTMLButtonElement>('.swd-option-color[aria-label="Color of Done"]').click();
    q<HTMLButtonElement>(".swd-option-auto").click();
    await settle();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"] });
  });

  it("writes no color over params changed meanwhile: an option added elsewhere is kept, the dialog shows it", async () => {
    const { open, q, schema, core } = await setup();
    await open();
    expand("status");
    await core.retypeProperty("tasks", "status", "select", { options: ["Todo", "Done", "Later"] }).then((proposal) => ("plan" in proposal ? core.apply(proposal) : undefined));
    q<HTMLButtonElement>('.swd-option-color[aria-label="Color of Done"]').click();
    q<HTMLButtonElement>('.swd-option-swatch[data-color-name="green"]').click();
    await settle();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done", "Later"] });
    expect(optionNames().map((one) => one.value)).toEqual(["Todo", "Done", "Later"]);
  });

  it("saves no options made of params changed meanwhile: a color given elsewhere is kept, the options typed too", async () => {
    const { open, q, schema, core, told } = await setup();
    await open();
    expand("status");
    addOption("Later");
    await core.setPropertyParams("tasks", "status", { options: ["Todo", "Done"], colors: { Done: "green" } }, { options: ["Todo", "Done"] });
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"], colors: { Done: "green" } });
    expect(told.at(-1)).toContain("changed meanwhile");
    expect(optionNames().map((one) => one.value)).toEqual(["Todo", "Done", "Later"]);
  });

  it("gives an option a color of the user's own, shown in its pill", async () => {
    const { open, q, schema } = await setup();
    await open();
    expand("status");
    q<HTMLButtonElement>('.swd-option-color[aria-label="Color of Done"]').click();
    const own = q<HTMLInputElement>(".swd-option-own-input");
    own.value = "#3a7bd5";
    own.dispatchEvent(new Event("change"));
    await settle();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Done"], colors: { Done: "#3a7bd5" } });
    const pill = q<HTMLElement>('.swd-option-color[aria-label="Color of Done"] .swd-pill');
    expect([pill.dataset.color, pill.style.getPropertyValue("--swd-pill")]).toEqual(["own", "58, 123, 213"]);
  });

  it("drops the colors of the options taken away as the options are saved", async () => {
    const { open, q, schema, core } = await setup();
    await core.setPropertyParams("tasks", "status", { options: ["Todo", "Done"], colors: { Todo: "red", Done: "green" } }, (await schema())[0]!.params);
    await open();
    expand("status");
    document.querySelectorAll<HTMLButtonElement>(".swd-option-remove")[1]!.click();
    addOption("Doing");
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Doing"], colors: { Todo: "red" } });
  });

  it("removes a property, asking nothing: the review shown at once, its values kept unless its switch takes them off too", async () => {
    const kept = await setup(false);
    await kept.open();
    expand("estimate");
    kept.q<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove').click();
    await settle();
    // The review with its switch, off: nothing taken off the items
    const choice = () => kept.q<HTMLInputElement>('.swd-property-choice input[role="switch"]');
    expect(choice().checked).toBe(false);
    expect(kept.q(".swd-property-review").textContent).toContain("no item's value changes");
    kept.q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await kept.schema()).map((one) => one.key)).toEqual(["status"]);
    expect((await kept.named("Fix login")).values.estimate).toBe("3");
    document.body.replaceChildren();
    const gone = await setup(true);
    await gone.open();
    expand("estimate");
    gone.q<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove').click();
    await settle();
    // Switched on: held still while the change is proposed again, then what it writes said, the focus on the switch (not on
    // Apply, which a second key would press)
    const on = gone.q<HTMLInputElement>('.swd-property-choice input[role="switch"]');
    on.checked = true;
    on.dispatchEvent(new Event("change"));
    expect(on.disabled).toBe(true);
    await settle();
    const switched = gone.q<HTMLInputElement>('.swd-property-choice input[role="switch"]');
    expect([switched.checked, switched.disabled, document.activeElement === switched]).toEqual([true, false, true]);
    expect(gone.q(".swd-property-review").textContent).toContain("Remove Estimate and its values: 2 items change");
    gone.q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await gone.named("Fix login")).values.estimate).toBeUndefined();
    expect([kept.asked(), gone.asked()]).toEqual([0, 0]);
  });
});
