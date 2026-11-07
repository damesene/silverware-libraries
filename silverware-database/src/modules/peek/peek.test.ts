// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseCore } from "../../core/core.ts";
import { Modules } from "../../core/module.ts";
import { DatabasePlace, VIEW_KEY } from "../../core/place.ts";
import { ViewRegistry } from "../../core/views.ts";
import { TypeRegistry } from "../../domain/types/registry.ts";
import type { Database } from "../../model/database.ts";
import { MemoryStore } from "../../store/memory.ts";
import { MemoryViewState } from "../../store/viewstate.ts";
import { BUILT_IN_VIEWS } from "../../views/builtin/index.ts";
import { PROPERTIES_MODULE } from "../properties/index.ts";
import { PEEK_MODULE } from "./index.ts";

const TASKS: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [
    { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false },
    { key: "estimate", label: "Estimate", type: "number", params: {}, readonly: false },
    { key: "done", label: "Done", type: "checkbox", params: {}, readonly: false },
  ],
};

async function setup(answer = true, withProperties = false, configured: Record<string, unknown> = {}) {
  const saved: Record<string, unknown>[] = [];
  const store = new MemoryStore([{ database: TASKS, items: [{ name: "Fix login", values: { status: "Todo", estimate: 3 }, rank: "a0", body: "Steps" }, { name: "Write docs", values: {}, rank: "a1" }] }]);
  const types = new TypeRegistry();
  const told: string[] = [];
  const opened: string[] = [];
  const openedListeners = new Set<(name: string) => void>();
  let failItems = false;
  const pageOpened = (name: string) => openedListeners.forEach((listener) => listener(name));
  const ui = { notify: (message: string) => void told.push(message), ask: () => answer };
  const core = new DatabaseCore(store, types, ui);
  const modules = new Modules(
    withProperties ? [PROPERTIES_MODULE, PEEK_MODULE] : [PEEK_MODULE],
    {
      document,
      core,
      types,
      ui,
      database: (id) => store.database(id),
      items: async (id) => {
        if (failItems) throw new Error("index unavailable");
        return (await store.items(id)).value;
      },
      itemBodies: true,
      body: (id, item) => store.body(id, item.key),
      openDocument: async (item) => void opened.push(item.name),
      editorArea: () => undefined,
      onChanged: (listener) => store.onChanged((one) => listener(one.database)),
      onDocumentOpened: (listener) => {
        openedListeners.add(listener);
        return () => void openedListeners.delete(listener);
      },
      refreshPlaces: () => {},
    },
    { get: (path, fallback) => (path in configured ? configured[path] : fallback), save: (values) => void saved.push(values) },
  );
  await modules.start();
  const element = document.createElement("div");
  document.body.append(element);
  const place = new DatabasePlace({ element, database: "tasks", state: new MemoryViewState({ [VIEW_KEY]: "list" }), store, core, types, views: new ViewRegistry(BUILT_IN_VIEWS), settings: { get: (_path, fallback) => fallback }, ui, openItem: (item, database) => modules.openItem(item, database) });
  await place.render();
  const named = async (name: string) => (await store.items("tasks")).value.find((one) => one.name === name)!;
  const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const peek = async (name: string) => {
    [...element.querySelectorAll<HTMLButtonElement>(".swd-list-name")].find((one) => one.textContent === name)!.click();
    await settle();
  };
  return { store, core, modules, place, named, q, peek, told, opened, pageOpened, saved, failItems: () => void (failItems = true) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("the peek's width", () => {
  const pointer = (target: Element, type: string, clientX: number) => target.dispatchEvent(new MouseEvent(type, { clientX, button: 0, bubbles: true, cancelable: true }) as PointerEvent);
  it("is 600px by default, the setting's where set, its left edge dragged saving it for every database, a double click its default", async () => {
    const { q, peek, saved } = await setup();
    // (jsdom's window: 1024px wide, the panel at most 80% of it)
    Object.defineProperty(window, "innerWidth", { value: 1600, configurable: true });
    await peek("Fix login");
    expect(q(".swd-peek").style.width).toBe("600px");
    const handle = q(".swd-peek-resize");
    const width = (px: number) => vi.spyOn(q(".swd-peek"), "getBoundingClientRect").mockReturnValue({ width: px } as DOMRect);
    width(600);
    pointer(handle, "pointerdown", 1000);
    pointer(handle, "pointermove", 900);
    expect(q(".swd-peek").style.width).toBe("700px");
    width(700);
    pointer(handle, "pointerup", 900);
    expect(saved.at(-1)).toEqual({ "silverware.database.modules.peek.width": 700 });
    handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(saved.at(-1)).toEqual({ "silverware.database.modules.peek.width": undefined });
    expect(q(".swd-peek").style.width).toBe("600px");
    // Its keys: ← wider
    key(handle, "ArrowLeft");
    expect(q(".swd-peek").style.width).toBe("640px");
    // Drawn anew (the item changed), the edge stays
    expect(q(".swd-peek").querySelector(".swd-peek-resize")).toBe(handle);
  });

  it("takes the width set in the settings", async () => {
    const { q, peek } = await setup(true, false, { "silverware.database.modules.peek.width": 720 });
    Object.defineProperty(window, "innerWidth", { value: 1600, configurable: true });
    await peek("Fix login");
    expect(q(".swd-peek").style.width).toBe("720px");
  });
});
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
});

describe("the peek", () => {
  it("shows an item opened from a view, its values and its body, and opens its page by Open", async () => {
    const { q, peek, opened } = await setup();
    await peek("Fix login");
    expect(q<HTMLInputElement>(".swd-peek-name").value).toBe("Fix login");
    expect([...document.querySelectorAll(".swd-peek-label")].map((one) => one.textContent)).toEqual(["Status", "Estimate", "Done"]);
    expect(q('.swd-peek-value[data-key="status"]').textContent).toBe("Todo");
    expect(q<HTMLTextAreaElement>(".swd-peek-body").value).toBe("Steps");
    q<HTMLButtonElement>(".swd-peek-open").click();
    await settle();
    expect(document.querySelector(".swd-peek")).toBeNull();
    expect(opened).toEqual(["Fix login"]);
  });

  it("writes a value, the name and the body as their fields are left, the panel following", async () => {
    const { q, peek, named, store } = await setup();
    await peek("Fix login");
    q('.swd-peek-value[data-key="estimate"]').click();
    const input = q<HTMLInputElement>('.swd-peek-value[data-key="estimate"] input');
    input.value = "8";
    key(input, "Enter");
    await settle();
    expect((await named("Fix login")).values.estimate).toBe(8);
    expect(q('.swd-peek-value[data-key="estimate"]').textContent).toBe("8");
    q('.swd-peek-value[data-key="done"]').click();
    await settle();
    expect((await named("Fix login")).values.done).toBe(true);
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Steps and more";
    body.blur();
    await settle();
    expect(await store.body("tasks", (await named("Fix login")).key)).toBe("Steps and more");
    const name = q<HTMLInputElement>(".swd-peek-name");
    name.focus();
    name.value = "Fix the login";
    name.dispatchEvent(new Event("change"));
    await settle();
    expect((await named("Fix the login")).values.estimate).toBe(8);
  });

  it("keeps a body typed that changed elsewhere since it was read, said so, loaded anew only once asked", async () => {
    const { q, peek, core, named, store } = await setup(false);
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Mine";
    // Changed elsewhere meanwhile
    const item = await named("Fix login");
    await core.setBody("tasks", item, "Theirs", await store.body("tasks", item.key));
    body.blur();
    await settle();
    expect(await store.body("tasks", item.key)).toBe("Theirs");
    expect(q<HTMLTextAreaElement>(".swd-peek-body").value).toBe("Mine");
    expect(q(".swd-peek-note").textContent).toContain("Your text is still here");
    // Asked, the answer no: nothing replaced
    q<HTMLButtonElement>(".swd-peek-reload").click();
    await settle();
    expect(q<HTMLTextAreaElement>(".swd-peek-body").value).toBe("Mine");
  });

  it("stays open over a body typed that could not be written: another item, Esc, a press beside take nothing away", async () => {
    const { q, peek, core, named, store, told } = await setup(false);
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Mine";
    const item = await named("Fix login");
    await core.setBody("tasks", item, "Theirs", await store.body("tasks", item.key));
    await peek("Write docs");
    expect(q<HTMLInputElement>(".swd-peek-name").value).toBe("Fix login");
    expect(q<HTMLTextAreaElement>(".swd-peek-body").value).toBe("Mine");
    key(q(".swd-peek-name"), "Escape");
    await settle();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await settle();
    expect(q<HTMLTextAreaElement>(".swd-peek-body").value).toBe("Mine");
    expect(told.some((one) => one.includes("was not written"))).toBe(true);
    // A press in a dialog over the page (a question asked) is not beside it
    const dialog = document.createElement("dialog");
    document.body.append(dialog);
    dialog.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await settle();
    expect(document.querySelector(".swd-peek")).not.toBeNull();
  });

  it("says a body kept as the module stops, with its text", async () => {
    const { q, peek, core, named, store, told, modules } = await setup(false);
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Mine";
    const item = await named("Fix login");
    await core.setBody("tasks", item, "Theirs", await store.body("tasks", item.key));
    body.blur();
    await settle();
    modules.stop();
    expect(document.querySelector(".swd-peek")).toBeNull();
    expect(told.at(-1)).toContain("Mine");
  });

  it("follows the schema changed elsewhere, as the places are drawn anew", async () => {
    const { q, peek, core, modules } = await setup();
    await peek("Fix login");
    // (Not under a name being typed: once it is left, written)
    q<HTMLInputElement>(".swd-peek-name").focus();
    q<HTMLInputElement>(".swd-peek-name").value = "Fix login now";
    await core.addProperty("tasks", { label: "Owner", type: "text" });
    modules.placeTools({ document, database: TASKS });
    await settle();
    expect([...document.querySelectorAll(".swd-peek-label")]).toHaveLength(3);
    expect(q<HTMLInputElement>(".swd-peek-name").value).toBe("Fix login now");
    q<HTMLInputElement>(".swd-peek-name").dispatchEvent(new Event("change"));
    q<HTMLInputElement>(".swd-peek-name").blur();
    await settle();
    expect(q<HTMLInputElement>(".swd-peek-name").value).toBe("Fix login now");
    expect([...document.querySelectorAll(".swd-peek-label")].map((one) => one.textContent)).toEqual(["Status", "Estimate", "Done", "Owner"]);
    expect(q(".swd-peek")).not.toBeNull();
  });

  it("never puts a body read over one being written, nor writes a kept text over a change made elsewhere (a slow write)", async () => {
    const { q, peek, core, named, store, told } = await setup(false);
    const write = core.setBody.bind(core);
    core.setBody = async (...args: Parameters<typeof write>) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return write(...args);
    };
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Mine";
    const item = await named("Fix login");
    await write("tasks", item, "Theirs", await store.body("tasks", item.key));
    store.changeOutside("tasks", item.key, { values: { estimate: 5 } });
    await settle();
    body.blur();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(q<HTMLTextAreaElement>(".swd-peek-body").value).toBe("Mine");
    expect(q(".swd-peek-note").textContent).toContain("Your text is still here");
    // Left again, it is refused again: never written over theirs unasked
    const field = q<HTMLTextAreaElement>(".swd-peek-body");
    field.focus();
    field.blur();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await store.body("tasks", item.key)).toBe("Theirs");
    expect(told.length).toBeGreaterThan(0);
  });

  it("shows a change made elsewhere at once while nothing is edited, a checkbox turned from what it shows", async () => {
    const { q, peek, named, store } = await setup();
    await peek("Fix login");
    store.changeOutside("tasks", (await named("Fix login")).key, { values: { done: true, estimate: 5 } });
    await settle();
    expect(q('.swd-peek-value[data-key="estimate"]').textContent).toBe("5");
    expect(q('.swd-peek-value[data-key="done"] .swd-peek-check').getAttribute("aria-label")).toBe("Yes");
    // (The panel has the focus as it opens, not its name: a phone's keyboard stays down)
    expect(document.activeElement).toBe(q(".swd-peek"));
    q('.swd-peek-value[data-key="done"]').click();
    await settle();
    expect((await named("Fix login")).values.done).toBe(false);
  });

  it("refuses a value edited from what the panel showed where it changed meanwhile, the editor open", async () => {
    const { q, peek, named, store } = await setup();
    await peek("Fix login");
    q('.swd-peek-value[data-key="estimate"]').click();
    const input = q<HTMLInputElement>('.swd-peek-value[data-key="estimate"] input');
    store.changeOutside("tasks", (await named("Fix login")).key, { values: { estimate: 5 } });
    await settle();
    input.value = "8";
    key(input, "Enter");
    await settle();
    expect((await named("Fix login")).values.estimate).toBe(5);
  });

  it("keeps a body whose write failed, writes the next, and leaves no field reading", async () => {
    const { q, peek, core, named, store } = await setup();
    const write = core.setBody.bind(core);
    let calls = 0;
    core.setBody = async (...args: Parameters<typeof write>) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (++calls === 1) throw new Error("disk");
      return write(...args);
    };
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "One";
    body.blur();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(q(".swd-peek-note").textContent).toContain("disk");
    expect(q<HTMLTextAreaElement>(".swd-peek-body").value).toBe("One");
    // Two writes one after the other: the field read again once both are written
    core.setBody = async (...args: Parameters<typeof write>) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return write(...args);
    };
    await q<HTMLButtonElement>(".swd-peek-reload").click();
    await settle();
    const field = q<HTMLTextAreaElement>(".swd-peek-body");
    field.focus();
    field.value = "Mine";
    field.blur();
    field.focus();
    field.blur();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await store.body("tasks", (await named("Fix login")).key)).toBe("Mine");
    const now = q<HTMLTextAreaElement>(".swd-peek-body");
    expect([now.value, now.readOnly, now.dataset.reading]).toEqual(["Mine", false, undefined]);
    q<HTMLButtonElement>(".swd-peek-close").click();
    await settle();
    expect(document.querySelector(".swd-peek")).toBeNull();
  });

  it("renames against the item as read now, a value changed elsewhere meanwhile", async () => {
    const { q, peek, named, store } = await setup();
    await peek("Fix login");
    const name = q<HTMLInputElement>(".swd-peek-name");
    name.focus();
    name.value = "Fix login now";
    store.changeOutside("tasks", (await named("Fix login")).key, { values: { estimate: 5 } });
    await settle();
    name.dispatchEvent(new Event("change"));
    await settle();
    expect((await named("Fix login now")).values.estimate).toBe(5);
  });

  it("writes a body where only a value changed elsewhere since the item was read", async () => {
    const { q, peek, named, store, told } = await setup(false);
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Mine";
    store.changeOutside("tasks", (await named("Fix login")).key, { values: { estimate: 5 } });
    body.blur();
    await settle();
    const item = await named("Fix login");
    expect([await store.body("tasks", item.key), item.values.estimate]).toEqual(["Mine", 5]);
    expect(document.querySelector(".swd-peek-note")!.textContent).toBe("");
    expect(told).toEqual([]);
  });

  it("keeps a body typed where reading the item before its write fails", async () => {
    const { q, peek, failItems, pageOpened, store, named } = await setup();
    await peek("Fix login");
    failItems();
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Typed";
    pageOpened("Other");
    await settle();
    // Written against the item as last read (the store's checks deciding), or kept: never dropped
    const stored = await store.body("tasks", (await named("Fix login")).key);
    const field = document.querySelector<HTMLTextAreaElement>(".swd-peek-body");
    expect(stored === "Typed" || field?.value === "Typed").toBe(true);
  });

  it("closes as another page is opened, what is typed written first", async () => {
    const { q, peek, named, store, pageOpened } = await setup();
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Typed";
    pageOpened("Other");
    await settle();
    expect(document.querySelector(".swd-peek")).toBeNull();
    expect(await store.body("tasks", (await named("Fix login")).key)).toBe("Typed");
  });

  it("shows the properties hidden in the views under their own heading, still edited there", async () => {
    const { q, peek, core, named } = await setup();
    await core.setPropertyHidden("tasks", "estimate", true);
    await peek("Fix login");
    expect(q(".swd-peek-hidden-title").textContent).toBe("Hidden in views");
    q('.swd-peek-hidden .swd-peek-value[data-key="estimate"]').click();
    const input = q<HTMLInputElement>('.swd-peek-value[data-key="estimate"] input');
    input.value = "8";
    key(input, "Enter");
    await settle();
    expect((await named("Fix login")).values.estimate).toBe(8);
  });

  it("opens a property in Properties from its name, adds one from + Add a property, moves one by Alt+↑ on its grip", async () => {
    const { q, peek, store } = await setup(true, true);
    await peek("Fix login");
    q<HTMLButtonElement>('.swd-peek-row[data-property="estimate"] .swd-peek-label').click();
    await settle();
    expect(document.querySelector('.swd-prop-open[data-property="estimate"]')).not.toBeNull();
    // (A press in the dialog over it is not beside the peek)
    document.querySelector(".swd-settings-backdrop")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.querySelector(".swd-peek")).not.toBeNull();
    document.querySelector<HTMLElement>(".swd-settings-close")!.click();
    await settle();
    q<HTMLButtonElement>(".swd-peek-add-property").click();
    await settle();
    expect(document.activeElement?.classList.contains("swd-property-new-label")).toBe(true);
    document.querySelector<HTMLElement>(".swd-settings-close")!.click();
    await settle();
    q('.swd-peek-row[data-property="estimate"] .swd-peek-grip').dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }));
    await settle();
    expect((await store.database("tasks"))!.value.properties.map((one) => one.key)).toEqual(["estimate", "status", "done"]);
  });

  it("offers no editing of properties where the properties module is off: names are no buttons, no + Add a property", async () => {
    const { q, peek } = await setup();
    await peek("Fix login");
    expect(q('.swd-peek-row[data-property="status"] .swd-peek-label').tagName).toBe("SPAN");
    expect(document.querySelector(".swd-peek-add-property")).toBeNull();
  });

  it("says a body typed and not left as the module stops", async () => {
    const { q, peek, modules, told } = await setup();
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Typed, not left";
    modules.stop();
    expect(told.at(-1)).toContain("Typed, not left");
  });

  it("writes what is typed as a press beside it closes it, and Esc closes it", async () => {
    const { q, peek, named, store } = await setup();
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Typed";
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await settle();
    expect(document.querySelector(".swd-peek")).toBeNull();
    expect(await store.body("tasks", (await named("Fix login")).key)).toBe("Typed");
    await peek("Write docs");
    key(q(".swd-peek-name"), "Escape");
    await settle();
    expect(document.querySelector(".swd-peek")).toBeNull();
  });

  it("closes as the module stops", async () => {
    const { modules, peek } = await setup();
    await peek("Fix login");
    modules.stop();
    expect(document.querySelector(".swd-peek")).toBeNull();
  });
});
