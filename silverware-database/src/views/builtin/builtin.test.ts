// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseCore } from "../../core/core.ts";
import { DatabasePlace, VIEW_KEY } from "../../core/place.ts";
import { ViewRegistry } from "../../core/views.ts";
import { inRankOrder } from "../../domain/rank.ts";
import { TypeRegistry } from "../../domain/types/registry.ts";
import type { Database } from "../../model/database.ts";
import { MemoryStore } from "../../store/memory.ts";
import { MemoryViewState } from "../../store/viewstate.ts";
import { BUILT_IN_VIEWS } from "./index.ts";

const TASKS: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [
    { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false },
    { key: "estimate", label: "Estimate", type: "number", params: {}, readonly: false },
    { key: "done", label: "Done", type: "checkbox", params: {}, readonly: false },
  ],
};

async function setup(view: string, state: Record<string, unknown> = {}, database: Database = TASKS) {
  const store = new MemoryStore([
    {
      database,
      items: [
        { name: "Fix login", values: { status: "Todo", estimate: 3 }, rank: "a0" },
        { name: "Write docs", values: { status: "Done", estimate: "a lot" }, rank: "a1" },
        { name: "Plan", values: { status: "Later" }, rank: "a2" },
      ],
    },
  ]);
  const types = new TypeRegistry();
  const core = new DatabaseCore(store, types, { notify: () => {}, ask: () => true });
  const element = document.createElement("div");
  document.body.append(element);
  const viewState = new MemoryViewState({ [VIEW_KEY]: view, ...state });
  const place = new DatabasePlace({ element, database: database.id, state: viewState, store, core, types, views: new ViewRegistry(BUILT_IN_VIEWS), settings: { get: (_path, fallback) => fallback }, ui: { notify: () => {} } });
  await place.render();
  const items = async () => (await store.items(database.id)).value;
  const named = async (name: string) => (await items()).find((one) => one.name === name)!;
  const q = <T extends Element = HTMLElement>(selector: string) => element.querySelector<T>(selector)!;
  const all = <T extends Element = HTMLElement>(selector: string) => [...element.querySelectorAll<T>(selector)];
  return { store, element, viewState, place, items, named, q, all };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
afterEach(() => document.body.replaceChildren());

describe("the table", () => {
  it("shows a row per item and a column per property, a value that does not read marked with why", async () => {
    const { all, q } = await setup("table");
    expect(all("th").map((th) => th.textContent)).toEqual(["Name", "Status", "Estimate", "Done", ""]);
    expect(all("tbody tr").map((tr) => tr.querySelector('[data-key="name"] .swd-table-name')!.textContent)).toEqual(["Fix login", "Write docs", "Plan"]);
    const lot = q('tbody tr:nth-child(2) [data-key="estimate"]');
    expect([lot.classList.contains("swd-invalid"), lot.title]).toEqual([true, "no number"]);
  });

  it("edits a value in place, turns a checkbox at once, and sorts by a header", async () => {
    const { q, all, named } = await setup("table");
    q('tbody tr:first-child [data-key="estimate"]').click();
    const input = q<HTMLInputElement>('tbody tr:first-child [data-key="estimate"] input');
    input.value = "8";
    key(input, "Enter");
    await settle();
    expect((await named("Fix login")).values.estimate).toBe(8);
    q<HTMLInputElement>('tbody tr:first-child [data-key="done"] input').click();
    await settle();
    expect((await named("Fix login")).values.done).toBe(true);
    all<HTMLButtonElement>(".swd-table-sort")[0]!.click();
    await settle();
    expect(all("tbody tr").map((tr) => tr.querySelector(".swd-table-name")!.textContent)).toEqual(["Fix login", "Plan", "Write docs"]);
  });

  it("adds an item and removes one", async () => {
    const { q, items } = await setup("table");
    q<HTMLButtonElement>(".swd-table-add").click();
    await settle();
    expect((await items()).map((one) => one.name)).toContain("Untitled");
    q<HTMLButtonElement>("tbody tr:first-child .swd-remove").click();
    await settle();
    expect((await items()).map((one) => one.name)).not.toContain("Fix login");
  });
});

describe("the table, from the keys and while edited", () => {
  it("edits a cell reached by Tab with Enter, and draws the data changed meanwhile once the edit is put aside", async () => {
    const { q, store, named } = await setup("table");
    const cell = q('tbody tr:first-child [data-key="estimate"]');
    expect(cell.tabIndex).toBe(0);
    key(cell, "Enter");
    const input = q<HTMLInputElement>('tbody tr:first-child [data-key="estimate"] input');
    input.value = "7";
    store.changeOutside("tasks", (await named("Write docs")).key, { name: "Write the docs" });
    await settle();
    // The edit kept as the data changed
    expect(q('tbody tr:first-child [data-key="estimate"] input')).not.toBeNull();
    key(input, "Escape");
    await settle();
    expect(q('tbody tr:nth-child(2) .swd-table-name').textContent).toBe("Write the docs");
  });

  it("takes a filter's mark of a condition that did not read away as the view is drawn anew", async () => {
    const { q, place } = await setup("table");
    const name = q<HTMLInputElement>('.swd-filter input[data-key="name"]');
    name.value = "/(/";
    name.dispatchEvent(new Event("change"));
    expect(name.classList.contains("swd-invalid")).toBe(true);
    await place.refresh();
    expect([name.value, name.classList.contains("swd-invalid"), name.title]).toEqual(["", false, ""]);
  });

  it("keeps the bar's sort as a header sorts", async () => {
    const { q, all } = await setup("table");
    all<HTMLButtonElement>(".swd-table-sort")[1]!.click();
    await settle();
    expect(q<HTMLSelectElement>(".swd-sort").value).toBe("status");
    expect(q<HTMLButtonElement>(".swd-sort-direction").disabled).toBe(false);
  });
});

describe("the list", () => {
  it("shows each item's values, or those its Properties pick", async () => {
    const { q, all } = await setup("list");
    expect(all(".swd-list-item")[0]!.textContent).toBe("Fix loginTodo3");
    q<HTMLButtonElement>(".swd-list-properties").click();
    const estimate = q<HTMLInputElement>('.swd-list-chooser input[value="estimate"]');
    estimate.checked = false;
    q<HTMLButtonElement>(".swd-list-properties").click();
    await settle();
    expect(all(".swd-list-item")[0]!.textContent).toBe("Fix loginTodo");
  });
});

describe("the kanban", () => {
  it("has a column per option, one for a value none of them is, and one for none", async () => {
    const { all } = await setup("kanban");
    expect(all(".swd-kanban-column").map((column) => column.getAttribute("aria-label"))).toEqual(["Todo", "Done", "Later (none of its options)", "No Status"]);
    expect(all('.swd-kanban-column[data-value="Todo"] .swd-kanban-name').map((one) => one.textContent)).toEqual(["Fix login"]);
  });

  it("moves a card to another column by Move to, its value set and its place there", async () => {
    const { all, named, items } = await setup("kanban");
    const mover = all<HTMLSelectElement>('.swd-kanban-column[data-value="Todo"] .swd-kanban-move')[0]!;
    mover.value = "1";
    mover.dispatchEvent(new Event("change"));
    await settle();
    expect((await named("Fix login")).values.status).toBe("Done");
    expect(inRankOrder((await items()).filter((one) => one.values.status === "Done")).map((one) => one.name)).toEqual(["Write docs", "Fix login"]);
    const none = all<HTMLSelectElement>('.swd-kanban-column[data-value="Done"] .swd-kanban-move')[0]!;
    none.value = String(none.options.length - 2);
    none.dispatchEvent(new Event("change"));
    await settle();
    expect((await named("Write docs")).values.status).toBeUndefined();
  });

  it("moves nothing for a card dropped on itself", async () => {
    const { all, items } = await setup("kanban");
    const before = (await items()).map((one) => one.rank);
    const card = all('.swd-kanban-column[data-value="Todo"] .swd-kanban-card')[0]!;
    card.dispatchEvent(new Event("dragstart"));
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    card.querySelector(".swd-kanban-name")!.dispatchEvent(drop);
    await settle();
    expect((await items()).map((one) => one.rank)).toEqual(before);
  });

  it("moves a card within its own column by its place alone, its value never rewritten; at its column's end already, nothing", async () => {
    const odd: Database = { ...TASKS, id: "odd" };
    const { all, store, items, named } = await setup("kanban", {}, odd);
    // Two cards of a value of another kind (a list) in one column, and one alone in its column
    for (const name of ["Fix login", "Write docs"]) store.changeOutside("odd", (await named(name)).key, { values: { status: ["x", "y"] } });
    await settle();
    const drag = (card: Element, onto: Element) => {
      card.dispatchEvent(new Event("dragstart"));
      onto.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
    };
    const column = all(".swd-kanban-column").find((one) => one.getAttribute("aria-label")?.startsWith("x"))!;
    const [first, second] = [...column.querySelectorAll(".swd-kanban-card")];
    drag(second!, first!.querySelector(".swd-kanban-name")!);
    await settle();
    expect((await named("Write docs")).values.status).toEqual(["x", "y"]);
    expect(inRankOrder((await items()).filter((one) => Array.isArray(one.values.status))).map((one) => one.name)).toEqual(["Write docs", "Fix login"]);
    const ranks = (await items()).map((one) => one.rank);
    const alone = all(".swd-kanban-column").find((one) => one.getAttribute("aria-label")?.startsWith("Later"))!;
    drag(alone.querySelector(".swd-kanban-card")!, alone.querySelector(".swd-kanban-title")!);
    await settle();
    expect((await items()).map((one) => one.rank)).toEqual(ranks);
  });

  it("takes Move to's mouse pick after the keys went through it and were left", async () => {
    const { all, named } = await setup("kanban");
    const mover = all<HTMLSelectElement>('.swd-kanban-column[data-value="Todo"] .swd-kanban-move')[0]!;
    key(mover, "ArrowDown");
    mover.value = "2";
    mover.dispatchEvent(new Event("change"));
    mover.dispatchEvent(new Event("blur"));
    expect(mover.value).toBe("");
    mover.value = "1";
    mover.dispatchEvent(new Event("change"));
    await settle();
    expect((await named("Fix login")).values.status).toBe("Done");
  });

  it("groups by the property its meta names, picked by Group by, and says so where no property can group", async () => {
    const both: Database = { ...TASKS, properties: [...TASKS.properties, { key: "area", label: "Area", type: "select", params: { options: ["Web"] }, readonly: false }] };
    const { q, viewState, all } = await setup("kanban", {}, both);
    const picker = q<HTMLSelectElement>(".swd-kanban-by");
    picker.value = "area";
    picker.dispatchEvent(new Event("change"));
    await settle();
    expect(viewState.get("kanban.groupBy")).toBe("area");
    expect(all(".swd-kanban-column").map((column) => column.getAttribute("aria-label"))).toEqual(["No Area", "Web"]);
    const none = await setup("kanban", {}, { ...TASKS, properties: TASKS.properties.filter((one) => one.type !== "select") });
    expect(none.q(".swd-place-note").textContent).toContain("has none");
  });
});

describe("the place's tools", () => {
  it("filter, sort and undo for the view shown, kept in its own state", async () => {
    const { q, all, viewState, named } = await setup("table");
    q<HTMLButtonElement>(".swd-filter-button").click();
    const status = q<HTMLInputElement>('.swd-filter input[data-key="status"]');
    status.value = "Todo";
    status.dispatchEvent(new Event("change"));
    await settle();
    expect(viewState.get("table.filter")).toEqual({ status: "Todo" });
    expect(all("tbody tr")).toHaveLength(1);
    expect(q(".swd-filter-button").textContent).toBe("Filter (1)");
    const sort = q<HTMLSelectElement>(".swd-sort");
    sort.value = "name";
    sort.dispatchEvent(new Event("change"));
    await settle();
    expect(viewState.get("table.sort")).toEqual([{ key: "name", direction: "asc" }]);
    q('tbody tr:first-child [data-key="estimate"]').click();
    const input = q<HTMLInputElement>('tbody tr:first-child [data-key="estimate"] input');
    input.value = "9";
    key(input, "Enter");
    await settle();
    expect((await named("Fix login")).values.estimate).toBe(9);
    q<HTMLButtonElement>(".swd-undo").click();
    await settle();
    expect((await named("Fix login")).values.estimate).toBe(3);
  });
});
