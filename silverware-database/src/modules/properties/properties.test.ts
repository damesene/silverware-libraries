// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseCore } from "../../core/core.ts";
import { type ModuleDefinition, Modules } from "../../core/module.ts";
import { TypeRegistry } from "../../domain/types/registry.ts";
import type { Database } from "../../model/database.ts";
import { MemoryStore } from "../../store/memory.ts";
import { PROPERTIES_MODULE } from "./index.ts";

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
  const ui = { notify: (message: string) => void told.push(message), ask: () => answer };
  const core = new DatabaseCore(store, types, ui);
  let refreshed = 0;
  const modules = new Modules(all, { document, core, types, ui, database: (id) => store.database(id), items: async (id) => (await store.items(id)).value, itemBodies: true, body: (id, item) => store.body(id, item.key), openDocument: async () => {}, editorArea: () => undefined, onChanged: (listener) => store.onChanged((one) => listener(one.database)), onDocumentOpened: () => () => {}, refreshPlaces: () => void refreshed++ }, { get: (path, fallback) => (path in configured ? configured[path] : fallback) });
  await modules.start();
  const schema = async () => (await store.database("tasks"))!.value.properties;
  const named = async (name: string) => (await store.items("tasks")).value.find((one) => one.name === name)!;
  const open = async () => {
    const [button] = modules.placeTools({ document, database: (await store.database("tasks"))!.value }) as HTMLButtonElement[];
    document.body.append(button!);
    button!.click();
    await settle();
  };
  const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  return { store, core, modules, schema, named, open, q, told, refreshed: () => refreshed };
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
      expect(modules.placeTools({ document, database: TASKS })).toEqual([]);
    });
    expect(seen).toEqual([{ word: "hi" }]);
  });

  it("start once where a start overtakes another, each module's tools once", async () => {
    const { modules } = await setup();
    await Promise.all([modules.start(), modules.start()]);
    expect(modules.placeTools({ document, database: TASKS })).toHaveLength(1);
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
    // The eye in the list: hidden at once, no row opened for it
    q<HTMLButtonElement>('[data-property="estimate"] .swd-prop-eye').click();
    await settle();
    // Alt+↑ on its grip: one place up
    q('[data-property="estimate"] .swd-prop-grip').dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }));
    await settle();
    expect((await schema()).map((one) => [one.key, one.label, one.readonly, one.hidden ?? false])).toEqual([
      ["estimate", "Estimate", true, true],
      ["status", "State", false, false],
      ["due_date", "Due date", false, false],
    ]);
    expect(q('[data-property="estimate"] .swd-prop-eye').getAttribute("aria-pressed")).toBe("false");
    expect(refreshed()).toBeGreaterThan(0);
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

  it("says how many pages a change writes where each item is a page, and that many take a while", async () => {
    const { open, q, core } = await setup(false, {}, [PROPERTIES_MODULE], true);
    await open();
    expand("status");
    typeOption(optionNames()[0]!, "To do");
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    // (One item holds Todo: its page and the database's)
    expect(q(".swd-property-review").textContent).toContain("Writes 2 pages.");
    expect(q(".swd-property-review").textContent).not.toContain("takes a while");
    q<HTMLButtonElement>(".swd-property-cancel").click();
    await settle();
    for (let at = 0; at < 200; at++) await core.create("tasks", { name: `Item ${at}`, values: { status: "Todo" } });
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    expect(q(".swd-property-review").textContent).toContain("Writes 202 pages: it takes a while; keep this page open until it is done");
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
    expect(told.at(-1)).toContain("Wait until the change is written");
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
    const [button] = modules.placeTools({ document, database: TASKS }) as HTMLButtonElement[];
    document.body.append(button!);
    button!.click();
    button!.click();
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

  it("removes a property keeping its values, unless asked to take them too", async () => {
    const kept = await setup(false);
    await kept.open();
    expand("estimate");
    kept.q<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove').click();
    await settle();
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
    gone.q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await gone.named("Fix login")).values.estimate).toBeUndefined();
  });
});
