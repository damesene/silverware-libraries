// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { TypeRegistry } from "../domain/types/registry.ts";
import type { Database } from "../model/database.ts";
import { MemoryStore } from "../store/memory.ts";
import { DatabaseCore } from "./core.ts";
import { openDeleteDatabase } from "./deletedatabase.ts";

const TASKS: Database = { id: "tasks", name: "Tasks", properties: [{ key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false }] };

function setup() {
  const store = new MemoryStore([{ database: TASKS, items: [{ name: "Fix login", values: { status: "Todo" }, rank: "a0" }, { name: "Write docs", values: {}, rank: "a1" }] }]);
  const told: string[] = [];
  const ui = { notify: (message: string) => void told.push(message), ask: () => true };
  const core = new DatabaseCore(store, new TypeRegistry(), ui);
  const open = () => openDeleteDatabase({ document, core, noun: { one: "page", many: "pages" }, notify: (message) => void told.push(message) }, "tasks", "Tasks");
  const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
  return { store, core, told, open, q };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

function type(field: HTMLInputElement, text: string): void {
  field.value = text;
  field.dispatchEvent(new Event("input"));
}

afterEach(() => document.body.replaceChildren());

describe("deleting a database", () => {
  it("says what goes, deletes only once its name is typed, and Undo brings it back", async () => {
    const { store, core, told, open, q } = setup();
    open();
    await settle();
    expect([...document.querySelectorAll(".swd-delete-lines li")].map((one) => one.textContent)[0]).toBe("2 items, deleted.");
    const confirm = q<HTMLButtonElement>(".swd-delete-confirm")!;
    const field = q<HTMLInputElement>(".swd-delete-name")!;
    expect(confirm.disabled).toBe(true);
    type(field, "Task");
    expect(confirm.disabled).toBe(true);
    confirm.click();
    await settle();
    expect(await store.database("tasks")).toBeDefined();
    type(field, "Tasks");
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await settle();
    expect(await store.database("tasks")).toBeUndefined();
    expect(q(".swd-delete-database")).toBeNull();
    expect(told.at(-1)).toMatch(/^The database "Tasks" was deleted/);
    await core.undo("tasks");
    expect((await store.items("tasks")).value.map((one) => one.name)).toEqual(["Fix login", "Write docs"]);
  });

  it("deletes nothing as it is closed before its name is typed", async () => {
    const { store, open, q } = setup();
    open();
    await settle();
    q<HTMLButtonElement>(".swd-settings-cancel")!.click();
    await settle();
    expect(q(".swd-delete-database")).toBeNull();
    expect(await store.database("tasks")).toBeDefined();
  });

  it("deletes none of it where an item changed after it was found, said why", async () => {
    const { store, told, open, q } = setup();
    open();
    await settle();
    const item = (await store.items("tasks")).value[0]!;
    await store.changeOutside("tasks", item.key, { name: "Fix the login" });
    type(q<HTMLInputElement>(".swd-delete-name")!, "Tasks");
    q<HTMLButtonElement>(".swd-delete-confirm")!.click();
    await settle();
    expect(await store.database("tasks")).toBeDefined();
    expect((await store.items("tasks")).value).toHaveLength(2);
    expect(told.join(" ")).toMatch(/nothing was written/);
  });
});
