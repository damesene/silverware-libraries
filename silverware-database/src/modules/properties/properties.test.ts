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

async function setup(answer = false, configured: Record<string, unknown> = {}, all: readonly ModuleDefinition[] = [PROPERTIES_MODULE]) {
  const store = new MemoryStore([{ database: TASKS, items: [{ name: "Fix login", values: { status: "Todo", estimate: "3" }, rank: "a0" }, { name: "Write docs", values: { estimate: "a lot" }, rank: "a1" }] }]);
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
  it("adds a property, renames a label, locks one and moves one, each written at once", async () => {
    const { open, q, schema, refreshed } = await setup();
    await open();
    change(q<HTMLInputElement>(".swd-property-new-label"), "Due date");
    q<HTMLSelectElement>(".swd-property-new-type").value = "date";
    q<HTMLButtonElement>(".swd-property-add").click();
    await settle();
    expect((await schema()).at(-1)).toMatchObject({ key: "due_date", label: "Due date", type: "date" });
    change(q<HTMLInputElement>('.swd-property-label[data-key="status"]'), "State");
    await settle();
    q<HTMLInputElement>('[data-property="estimate"] .swd-property-locked input').click();
    await settle();
    q<HTMLButtonElement>('[data-property="estimate"] .swd-property-up').click();
    await settle();
    expect((await schema()).map((one) => [one.key, one.label, one.readonly])).toEqual([
      ["estimate", "Estimate", true],
      ["status", "State", false],
      ["due_date", "Due date", false],
    ]);
    expect(refreshed()).toBeGreaterThan(0);
  });

  it("shows a change of items first, how many and the values kept, and writes it only once applied", async () => {
    const { open, q, schema, named } = await setup();
    await open();
    q<HTMLSelectElement>('[data-property="estimate"] .swd-property-type').value = "number";
    q<HTMLSelectElement>('[data-property="estimate"] .swd-property-type').dispatchEvent(new Event("change"));
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

  it("saves a select's options, one a line, and puts a change aside by Cancel", async () => {
    const { open, q, schema } = await setup();
    await open();
    const options = q<HTMLTextAreaElement>('.swd-property-options[aria-label="Options of Status"]');
    options.value = "Todo\nDoing\n\nDone\nDoing";
    q<HTMLButtonElement>(".swd-property-options-save").click();
    await settle();
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await schema())[0]!.params).toEqual({ options: ["Todo", "Doing", "Done"] });
    change(q<HTMLInputElement>('.swd-property-key[aria-label="Key of Status"]'), "state");
    await settle();
    q<HTMLButtonElement>(".swd-property-cancel").click();
    await settle();
    expect((await schema())[0]!.key).toBe("status");
  });

  it("keeps options and a new property typed and not saved while the dialog is drawn anew", async () => {
    const { open, q } = await setup();
    await open();
    const options = q<HTMLTextAreaElement>('.swd-property-options[aria-label="Options of Status"]');
    options.value = "Todo\nDoing\nDone";
    options.dispatchEvent(new Event("input"));
    const label = q<HTMLInputElement>(".swd-property-new-label");
    label.value = "Due";
    label.dispatchEvent(new Event("input"));
    q<HTMLInputElement>('[data-property="estimate"] .swd-property-locked input').click();
    await settle();
    expect(q<HTMLTextAreaElement>('.swd-property-options[aria-label="Options of Status"]').value).toBe("Todo\nDoing\nDone");
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
    q<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove').click();
    await settle();
    q<HTMLButtonElement>(".swd-property-apply").click();
    q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect(told.filter((one) => one.includes("nothing was written"))).toEqual([]);
    modules.stop();
    expect(document.querySelectorAll(".swd-properties")).toHaveLength(0);
  });

  it("removes a property keeping its values, unless asked to take them too", async () => {
    const kept = await setup(false);
    await kept.open();
    kept.q<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove').click();
    await settle();
    kept.q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await kept.schema()).map((one) => one.key)).toEqual(["status"]);
    expect((await kept.named("Fix login")).values.estimate).toBe("3");
    document.body.replaceChildren();
    const gone = await setup(true);
    await gone.open();
    gone.q<HTMLButtonElement>('[data-property="estimate"] .swd-property-remove').click();
    await settle();
    gone.q<HTMLButtonElement>(".swd-property-apply").click();
    await settle();
    expect((await gone.named("Fix login")).values.estimate).toBeUndefined();
  });
});
