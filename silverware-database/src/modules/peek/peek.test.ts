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
  let asked = 0;
  const ui = {
    notify: (message: string) => void told.push(message),
    ask: () => {
      asked++;
      return answer;
    },
  };
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
      documents: async () => ["Projects/Alpha", "Projects/Beta"],
      openByName: async (name) => void opened.push(name),
      validateDocumentName: () => undefined,
      noun: { one: "page", many: "pages" },
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
    // (By its title: its text is its icon and its name)
    [...element.querySelectorAll<HTMLButtonElement>(".swd-list-name")].find((one) => one.title === `Open ${name}`)!.click();
    await settle();
  };
  return { store, core, modules, place, named, q, peek, told, opened, pageOpened, saved, asked: () => asked, failItems: () => void (failItems = true) };
}

/** A press on an element: its pointer down and up, its click (a press beside the panel closes it once it is over) */
function pressOn(target: Element): void {
  for (const type of ["pointerdown", "pointerup", "click"]) target.dispatchEvent(new Event(type, { bubbles: true }));
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

  it("shows a pencil after a link, which edits it as the link itself opens its address; none where there is no link", async () => {
    const { q, peek, core, named, store, place } = await setup();
    await core.addProperty("tasks", { label: "Web", type: "url" });
    const key = (await store.database("tasks"))!.value.properties.find((one) => one.label === "Web")!.key;
    await core.update("tasks", await named("Fix login"), key, "example.com/docs");
    // (The view drawn anew with it, as the place is once the store says so)
    await place.render();
    await peek("Fix login");
    const value = q(`.swd-peek-value[data-key="${key}"]`);
    expect(value.querySelector("a.swd-link")?.getAttribute("href")).toBe("https://example.com/docs");
    // (Not a control of its own: the value is the button the keys edit)
    expect(value.querySelector(".swd-peek-edit")?.getAttribute("aria-hidden")).toBe("true");
    q(`.swd-peek-value[data-key="${key}"] .swd-peek-edit`).click();
    expect(value.querySelector(".swd-editor-link")).not.toBeNull();
    // (No link, no pencil: an empty value, a value of another type)
    await peek("Write docs");
    expect(q(`.swd-peek-value[data-key="${key}"]`).querySelector(".swd-peek-edit")).toBeNull();
    expect(document.querySelector('.swd-peek-value[data-key="estimate"] .swd-peek-edit')).toBeNull();
  });

  it("shows a value written at once as its editor is left for the content, the content's field kept as it is (its text, its focus)", async () => {
    const { q, peek, named } = await setup();
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    q('.swd-peek-value[data-key="estimate"]').click();
    const input = q<HTMLInputElement>('.swd-peek-value[data-key="estimate"] input');
    input.value = "8";
    // (Left for the content: the press in it blurs the editor, which saves)
    body.focus();
    body.value = "Steps and";
    input.dispatchEvent(new FocusEvent("blur"));
    await settle();
    expect((await named("Fix login")).values.estimate).toBe(8);
    expect(q('.swd-peek-value[data-key="estimate"]').textContent).toBe("8");
    expect([q(".swd-peek-body") === body, document.activeElement === body, body.value]).toEqual([true, true, "Steps and"]);
  });

  it("shows a body changed elsewhere while nothing is typed in it; a body typed on after a refusal kept through a value's write", async () => {
    const { q, peek, named, store, core } = await setup();
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    store.changeOutside("tasks", (await named("Fix login")).key, { body: "Steps, edited elsewhere" });
    await settle();
    expect([q(".swd-peek-body") === body, body.value, body.readOnly]).toEqual([true, "Steps, edited elsewhere", false]);
    // A write refused (changed since read): the text kept; typed on, then a value written elsewhere drawn under it
    store.changeOutside("tasks", (await named("Fix login")).key, { body: "Theirs" });
    body.focus();
    body.value = "Mine";
    body.blur();
    await settle();
    expect(q(".swd-peek-note").textContent).toContain("Not written");
    body.focus();
    body.value = "Mine, and more";
    await core.update("tasks", await named("Fix login"), "estimate", 9);
    store.changeOutside("tasks", (await named("Fix login")).key, { values: { estimate: 9 } });
    await settle();
    expect(q('.swd-peek-value[data-key="estimate"]').textContent).toBe("9");
    expect([document.activeElement === body, body.value]).toEqual([true, "Mine, and more"]);
  });

  it("loads the content as it is now once asked, the text typed given up and never written", async () => {
    const { q, peek, named, store } = await setup();
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    store.changeOutside("tasks", (await named("Fix login")).key, { body: "Theirs" });
    body.focus();
    body.value = "Mine";
    body.blur();
    await settle();
    q<HTMLButtonElement>(".swd-peek-reload").click();
    await settle();
    expect([body.value, body.readOnly, q(".swd-peek-note").textContent]).toEqual(["Theirs", false, ""]);
    body.focus();
    body.blur();
    await settle();
    expect(await store.body("tasks", (await named("Fix login")).key)).toBe("Theirs");
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

  it("writes a value picked as the name is still written, the panel not drawn anew meanwhile (its editor open)", async () => {
    const { q, peek, named, told } = await setup();
    await peek("Fix login");
    const name = q<HTMLInputElement>(".swd-peek-name");
    name.focus();
    name.value = "Fix the login";
    name.dispatchEvent(new Event("change"));
    // A value's editor opened at once and its value given before the rename is written: the panel's drawing put off while
    // the editor is open, the value's write waiting for the rename's
    q('.swd-peek-value[data-key="estimate"]').click();
    const input = q<HTMLInputElement>('.swd-peek-value[data-key="estimate"] input');
    input.value = "8";
    key(input, "Enter");
    await settle();
    expect((await named("Fix the login")).values.estimate).toBe(8);
    expect(told.join(" ")).not.toContain("changed since");
  });

  it("writes a name typed back and a value changed twice while its drawing is put off, as the panel shows them", async () => {
    const { q, peek, named, told } = await setup();
    await peek("Fix login");
    const name = q<HTMLInputElement>(".swd-peek-name");
    name.focus();
    name.value = "Fix the login";
    name.dispatchEvent(new Event("change"));
    // The estimate's editor open: the panel's drawing put off while the name is written, then typed back
    q('.swd-peek-value[data-key="estimate"]').click();
    await settle();
    name.value = "Fix login";
    name.dispatchEvent(new Event("change"));
    await settle();
    expect((await named("Fix login")).name).toBe("Fix login");
    // The same value twice, its editor opened again each time from the panel as it shows it
    for (const estimate of ["8", "9"]) {
      if (!document.querySelector('.swd-peek-value[data-key="estimate"] input')) q('.swd-peek-value[data-key="estimate"]').click();
      const input = q<HTMLInputElement>('.swd-peek-value[data-key="estimate"] input');
      input.value = estimate;
      key(input, "Enter");
      await settle();
    }
    expect((await named("Fix login")).values.estimate).toBe(9);
    expect(told.join(" ")).not.toContain("changed since");
  });

  it("still refuses a value whose item changed elsewhere after the panel's own rename, its drawing put off", async () => {
    const { q, peek, named, store } = await setup();
    await peek("Fix login");
    q('.swd-peek-value[data-key="estimate"]').click();
    const name = q<HTMLInputElement>(".swd-peek-name");
    name.value = "Fix the login";
    name.dispatchEvent(new Event("change"));
    await settle();
    store.changeOutside("tasks", (await named("Fix the login")).key, { values: { estimate: 5 } });
    await settle();
    const input = q<HTMLInputElement>('.swd-peek-value[data-key="estimate"] input');
    input.value = "8";
    key(input, "Enter");
    await settle();
    expect((await named("Fix the login")).values.estimate).toBe(5);
  });

  it("removes its item by the bin at its top, asked first, a body typed written before it goes; Undo brings both back", async () => {
    const { q, peek, named, store, core } = await setup();
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Steps typed";
    q<HTMLButtonElement>(".swd-peek-remove").click();
    await settle();
    expect(document.querySelector(".swd-peek")).toBeNull();
    expect((await store.items("tasks")).value.map((one) => one.name)).toEqual(["Write docs"]);
    await core.undo("tasks");
    expect(await store.body("tasks", (await named("Fix login")).key)).toBe("Steps typed");
  });

  it("removes its item renamed just before the bin is pressed, the rename waited for; asked once however often the bin is pressed", async () => {
    const { q, peek, store, told, asked } = await setup();
    await peek("Fix login");
    const name = q<HTMLInputElement>(".swd-peek-name");
    name.focus();
    name.value = "Fix the login";
    name.dispatchEvent(new Event("change"));
    q<HTMLButtonElement>(".swd-peek-remove").click();
    q<HTMLButtonElement>(".swd-peek-remove").click();
    await settle();
    await settle();
    expect((await store.items("tasks")).value.map((one) => one.name)).toEqual(["Write docs"]);
    expect(asked()).toBe(1);
    expect(told).toEqual([]);
    expect(document.querySelector(".swd-peek")).toBeNull();
  });

  it("removes its item with a value edited just before the bin is pressed, the value written first", async () => {
    const { q, peek, store, core, named } = await setup();
    await peek("Fix login");
    q('.swd-peek-value[data-key="estimate"]').click();
    const input = q<HTMLInputElement>('.swd-peek-value[data-key="estimate"] input');
    input.value = "8";
    q<HTMLButtonElement>(".swd-peek-remove").click();
    await settle();
    await settle();
    expect((await store.items("tasks")).value.map((one) => one.name)).toEqual(["Write docs"]);
    await core.undo("tasks");
    expect((await named("Fix login")).values.estimate).toBe(8);
  });

  it("follows the database where the item was removed elsewhere as the bin is pressed: closed, no second removal", async () => {
    const { q, peek, store, core, named, told } = await setup();
    await peek("Fix login");
    await core.remove("tasks", [await named("Fix login")]);
    told.length = 0;
    q<HTMLButtonElement>(".swd-peek-remove").click();
    await settle();
    await settle();
    expect(document.querySelector(".swd-peek")).toBeNull();
    expect((await store.items("tasks")).value.map((one) => one.name)).toEqual(["Write docs"]);
  });

  it("keeps its item and stays open where the removal is declined", async () => {
    const { q, peek, store } = await setup(false);
    await peek("Fix login");
    q<HTMLButtonElement>(".swd-peek-remove").click();
    await settle();
    expect(q<HTMLInputElement>(".swd-peek-name").value).toBe("Fix login");
    expect((await store.items("tasks")).value).toHaveLength(2);
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
    pressOn(document.body);
    await settle();
    expect(q<HTMLTextAreaElement>(".swd-peek-body").value).toBe("Mine");
    expect(told.some((one) => one.includes("was not written"))).toBe(true);
    // A press in a dialog over the page (a question asked) is not beside it
    const dialog = document.createElement("dialog");
    document.body.append(dialog);
    pressOn(dialog);
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
    // (Typed on after it was refused, not left: the text as it is now said)
    body.focus();
    body.value = "Mine, and more";
    modules.stop();
    expect(document.querySelector(".swd-peek")).toBeNull();
    expect(told.at(-1)).toContain("Mine, and more");
  });

  it("follows the schema changed elsewhere, as the places are drawn anew", async () => {
    const { q, peek, core, modules } = await setup();
    await peek("Fix login");
    // (Not under a name being typed: once it is left, written)
    q<HTMLInputElement>(".swd-peek-name").focus();
    q<HTMLInputElement>(".swd-peek-name").value = "Fix login now";
    await core.addProperty("tasks", { label: "Owner", type: "text" });
    modules.placeDrawn({ document, database: TASKS, overWindow: false, setOverWindow: () => {} });
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

  it("opens a property in Properties from its name, adds one from + Add a property, moves one by Alt+↑ on its grip", async () => {
    const { q, peek, store } = await setup(true, true);
    await peek("Fix login");
    q<HTMLButtonElement>('.swd-peek-row[data-property="estimate"] .swd-peek-label').click();
    await settle();
    expect(document.querySelector('.swd-prop-open[data-property="estimate"]')).not.toBeNull();
    // (A press in the dialog over it is not beside the peek)
    pressOn(document.querySelector(".swd-settings-backdrop")!);
    await settle();
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

  it("shows another item pressed in its place in the same panel, never closed and opened anew; a press elsewhere closes it", async () => {
    const { q, peek } = await setup();
    await peek("Fix login");
    const panel = document.querySelector(".swd-peek");
    // A press on another item's name: down and up, its click showing it
    const other = [...document.querySelectorAll<HTMLElement>(".swd-list-name")].find((one) => one.title === "Open Write docs")!;
    other.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    other.dispatchEvent(new Event("pointerup", { bubbles: true }));
    await peek("Write docs");
    await settle();
    expect([document.querySelector(".swd-peek") === panel, q<HTMLInputElement>(".swd-peek-name").value]).toEqual([true, "Write docs"]);
    pressOn(document.body);
    await settle();
    expect(document.querySelector(".swd-peek")).toBeNull();
  });

  it("writes what is typed as a press beside it closes it, and Esc closes it", async () => {
    const { q, peek, named, store } = await setup();
    await peek("Fix login");
    const body = q<HTMLTextAreaElement>(".swd-peek-body");
    body.focus();
    body.value = "Typed";
    pressOn(document.body);
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

describe("the peek's look of an item", () => {
  it("sets its color from the palette, its swatch and the list's line showing it; Esc closes the picker alone", async () => {
    const { q, peek, named, place } = await setup();
    await peek("Fix login");
    q<HTMLButtonElement>(".swd-peek-color").click();
    expect(q(".swd-pop")).not.toBeNull();
    // Esc: the picker closed, the panel kept, the button focused again
    q(".swd-pop").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect([document.querySelector(".swd-pop"), document.querySelector(".swd-peek") !== null, document.activeElement?.className]).toEqual([null, true, "swd-peek-color swd-peek-color-none"]);
    q<HTMLButtonElement>(".swd-peek-color").click();
    q<HTMLButtonElement>('.swd-peek-pop-color[aria-label="Green"]').click();
    await settle();
    expect((await named("Fix login")).look).toEqual({ color: "green" });
    expect([q(".swd-peek-color-name").textContent, q(".swd-peek-color .swd-peek-swatch").dataset.swdItemColor, document.activeElement?.classList.contains("swd-peek-color")]).toEqual(["Green", "2", true]);
    await place.refresh();
    expect(document.querySelector<HTMLElement>('.swd-list-item[data-item] .swd-list-name')!.closest("li")!.dataset.swdItemColor).toBe("2");
    // None: taken off
    q<HTMLButtonElement>(".swd-peek-color").click();
    q<HTMLButtonElement>('.swd-peek-pop-color[aria-label="None"]').click();
    await settle();
    expect((await named("Fix login")).look).toBeUndefined();
  });

  it("shows its icon large over its name and in the views by the name, Remove taking it off", async () => {
    const { q, peek, named, core, place } = await setup();
    await core.setLook("tasks", await named("Fix login"), { icon: "🚀", color: "blue" });
    await place.refresh();
    expect(q(".swd-list-name").textContent).toBe("🚀Fix login");
    await peek("Fix login");
    expect(q(".swd-peek-icon .swd-item-icon").textContent).toBe("🚀");
    q<HTMLButtonElement>(".swd-peek-icon").click();
    q<HTMLButtonElement>(".swd-pop-remove").click();
    await settle();
    // (The color kept)
    expect((await named("Fix login")).look).toEqual({ color: "blue" });
    expect([document.querySelector(".swd-peek-icon .swd-item-icon"), q(".swd-peek-icon").classList.contains("swd-peek-icon-none")]).toEqual([null, true]);
  });
});
