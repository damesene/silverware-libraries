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
    // (The grips' column first, the actions' last: no name)
    expect(all("th").map((th) => th.textContent)).toEqual(["", "Name", "Status", "Estimate", "Done", ""]);
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
    const sort = q<HTMLButtonElement>(".swd-sort-button");
    expect([sort.textContent, sort.classList.contains("swd-tool-on")]).toEqual(["Status", true]);
    // The header's arrow held to its name's last word: never on a line of its own
    expect(q('th[aria-sort] .swd-table-sort-end').textContent).toBe("Status ↑");
  });
});

describe("the list", () => {
  it("shows each item's values, those of a property hidden in the views left out, and has no Properties of its own", async () => {
    const { all } = await setup("list");
    expect(all(".swd-list-item")[0]!.textContent).toBe("Fix loginTodo3");
    expect(all(".swd-list-properties")).toEqual([]);
    const hidden = await setup("list", {}, { ...TASKS, properties: TASKS.properties.map((one) => (one.key === "estimate" ? { ...one, hidden: true } : one)) });
    expect(hidden.all(".swd-list-item")[0]!.textContent).toBe("Fix loginTodo");
  });
});

describe("the board", () => {
  it("has a column per option, one for a value none of them is, and one for none", async () => {
    const { all } = await setup("board");
    // (No column of none: every item has a value)
    expect(all(".swd-board-column").map((column) => column.getAttribute("aria-label"))).toEqual(["Todo", "Done", "Later (none of its options)"]);
    expect(all('.swd-board-column[data-value="Todo"] .swd-board-name').map((one) => one.textContent)).toEqual(["Fix login"]);
  });

  it("shows the column of none first, and only where an item has no value", async () => {
    const { all, store, named } = await setup("board");
    store.changeOutside("tasks", (await named("Plan")).key, { values: { status: null } });
    await settle();
    expect(all(".swd-board-column").map((column) => column.getAttribute("aria-label"))).toEqual(["No Status", "Todo", "Done"]);
  });

  it("moves a card to another column by dragging it, its value set and its place there", async () => {
    const { all, named, items } = await setup("board");
    const drag = (card: Element, onto: Element) => {
      card.dispatchEvent(new Event("dragstart"));
      onto.dispatchEvent(new MouseEvent("dragover", { bubbles: true, cancelable: true, clientY: 1000 }));
      onto.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
    };
    drag(all('.swd-board-column[data-value="Todo"] .swd-board-card')[0]!, all('.swd-board-column[data-value="Done"]')[0]!);
    await settle();
    expect((await named("Fix login")).values.status).toBe("Done");
    expect(inRankOrder((await items()).filter((one) => one.values.status === "Done")).map((one) => one.name)).toEqual(["Write docs", "Fix login"]);
  });

  it("moves nothing for a card dropped on itself", async () => {
    const { all, items } = await setup("board");
    const before = (await items()).map((one) => one.rank);
    const card = all('.swd-board-column[data-value="Todo"] .swd-board-card')[0]!;
    card.dispatchEvent(new Event("dragstart"));
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    card.querySelector(".swd-board-name")!.dispatchEvent(drop);
    await settle();
    expect((await items()).map((one) => one.rank)).toEqual(before);
  });

  it("moves a card within its own column by its place alone, its value never rewritten; at its column's end already, nothing", async () => {
    const odd: Database = { ...TASKS, id: "odd" };
    const { all, store, items, named } = await setup("board", {}, odd);
    // Two cards of a value of another kind (a list) in one column, and one alone in its column
    for (const name of ["Fix login", "Write docs"]) store.changeOutside("odd", (await named(name)).key, { values: { status: ["x", "y"] } });
    await settle();
    // Over `onto` at a height (jsdom lays nothing out: every card's middle at 0; above it, before the first card; below, at the end), then dropped
    const drag = (card: Element, onto: Element, y: number) => {
      card.dispatchEvent(new Event("dragstart"));
      onto.dispatchEvent(new MouseEvent("dragover", { bubbles: true, cancelable: true, clientY: y }));
      onto.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
    };
    const column = all(".swd-board-column").find((one) => one.getAttribute("aria-label")?.startsWith("x"))!;
    const [first, second] = [...column.querySelectorAll(".swd-board-card")];
    drag(second!, first!.querySelector(".swd-board-name")!, -1);
    // (The line shown while over it, gone with the drop)
    expect(column.querySelector(".swd-board-drop-line")).toBeNull();
    await settle();
    expect((await named("Write docs")).values.status).toEqual(["x", "y"]);
    expect(inRankOrder((await items()).filter((one) => Array.isArray(one.values.status))).map((one) => one.name)).toEqual(["Write docs", "Fix login"]);
    const ranks = (await items()).map((one) => one.rank);
    const alone = all(".swd-board-column").find((one) => one.getAttribute("aria-label")?.startsWith("Later"))!;
    drag(alone.querySelector(".swd-board-card")!, alone.querySelector(".swd-board-title")!, 1000);
    await settle();
    expect((await items()).map((one) => one.rank)).toEqual(ranks);
  });

  it("groups by the property its meta names, picked by Group by in ⋯, and says so where no property can group", async () => {
    const both: Database = { ...TASKS, properties: [...TASKS.properties, { key: "area", label: "Area", type: "select", params: { options: ["Web"] }, readonly: false }] };
    const { q, viewState, all } = await setup("board", {}, both);
    q<HTMLButtonElement>(".swd-more").click();
    // The selects alone, the one grouped by checked, no None: a board always groups
    expect(all<HTMLButtonElement>(".swd-group-option").map((one) => [one.textContent, one.getAttribute("aria-pressed")])).toEqual([
      ["Status", "true"],
      ["Area", "false"],
    ]);
    q<HTMLButtonElement>('.swd-group-option[data-key="area"]').click();
    await settle();
    expect(viewState.get("board.groupBy")).toBe("area");
    expect(all(".swd-board-column").map((column) => column.getAttribute("aria-label"))).toEqual(["No Area", "Web"]);
    const none = await setup("board", {}, { ...TASKS, properties: TASKS.properties.filter((one) => one.type !== "select") });
    expect(none.q(".swd-place-note").textContent).toContain("has none");
    // A table is grouped by the place: any property, or None
    const table = await setup("table");
    table.q<HTMLButtonElement>(".swd-more").click();
    expect(table.all(".swd-group-option").map((one) => one.textContent)[0]).toBe("None");
  });
});

describe("a row's place by hand", () => {
  it("moves a table's row and a list's line by Alt+↑ ↓ on its grip, its rank alone written; rests while the view is sorted", async () => {
    for (const view of ["table", "list"] as const) {
      const { all, items } = await setup(view);
      const names = async () => inRankOrder(await items()).map((one) => one.name);
      const grips = () => all<HTMLButtonElement>(".swd-row-grip");
      grips()[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true }));
      await settle();
      expect(await names()).toEqual(["Write docs", "Fix login", "Plan"]);
      grips()[2]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }));
      await settle();
      expect(await names()).toEqual(["Write docs", "Plan", "Fix login"]);
      // At the top already: nothing written
      const ranks = (await items()).map((one) => one.rank);
      grips()[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", altKey: true, bubbles: true }));
      await settle();
      expect((await items()).map((one) => one.rank)).toEqual(ranks);
    }
    const sorted = await setup("table", { "table.sort": [{ key: "name", direction: "asc" }] });
    expect(sorted.all<HTMLButtonElement>(".swd-row-grip").every((one) => one.disabled)).toBe(true);
  });
});

describe("a property required", () => {
  it("marks an item without a value missing, its cell saying so", async () => {
    const required: Database = { ...TASKS, properties: TASKS.properties.map((one) => (one.key === "estimate" ? { ...one, required: true } : one)) };
    const { q } = await setup("table", {}, required);
    const plan = q('tbody tr:nth-child(3) [data-key="estimate"]');
    expect([plan.classList.contains("swd-missing"), plan.classList.contains("swd-invalid"), plan.title]).toEqual([true, true, "Estimate is required"]);
    expect(q('tbody tr:first-child [data-key="estimate"]').classList.contains("swd-missing")).toBe(false);
    // A list's line and a card say it too
    const list = await setup("list", {}, required);
    expect(list.all('.swd-list-value[data-key="estimate"] .swd-pill-missing')).toHaveLength(1);
    const board = await setup("board", {}, required);
    expect(board.all('.swd-board-value[data-key="estimate"] .swd-pill-missing')).toHaveLength(1);
  });

  it("never takes a checkbox for missing: unticked is its value", async () => {
    const required: Database = { ...TASKS, properties: TASKS.properties.map((one) => (one.key === "done" ? { ...one, required: true } : one)) };
    const { all } = await setup("table", {}, required);
    expect(all('[data-key="done"].swd-missing')).toHaveLength(0);
  });
});

describe("a property hidden in the views", () => {
  it("is no column, card line or list value, and is still filtered and sorted by", async () => {
    const hidden: Database = { ...TASKS, properties: TASKS.properties.map((one) => (one.key === "estimate" ? { ...one, hidden: true } : one)) };
    const { all, q, viewState } = await setup("table", {}, hidden);
    expect(all("th").map((th) => th.textContent)).not.toContain("Estimate");
    expect(q('.swd-filter input[data-key="estimate"]')).not.toBeNull();
    q<HTMLButtonElement>(".swd-sort-button").click();
    q<HTMLButtonElement>('.swd-sort-option[data-key="estimate"]').click();
    await settle();
    expect(viewState.get("table.sort")).toEqual([{ key: "estimate", direction: "asc" }]);
    const list = await setup("list", {}, hidden);
    expect(list.all('.swd-list-value[data-key="estimate"]')).toHaveLength(0);
    const board = await setup("board", {}, hidden);
    expect(board.all('.swd-board-value[data-key="estimate"]')).toHaveLength(0);
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
    expect(q(".swd-filter-button").getAttribute("aria-label")).toBe("Filter (1)");
    expect(q(".swd-place-count").textContent).toBe("1 of 3");
    // The sort's menu: a property, then the other way
    q<HTMLButtonElement>(".swd-sort-button").click();
    q<HTMLButtonElement>('.swd-sort-option[data-key="name"]').click();
    await settle();
    expect(viewState.get("table.sort")).toEqual([{ key: "name", direction: "asc" }]);
    expect(q<HTMLElement>(".swd-popover").hidden).toBe(true);
    q<HTMLButtonElement>(".swd-sort-button").click();
    q<HTMLButtonElement>(".swd-sort-desc").click();
    await settle();
    expect(viewState.get("table.sort")).toEqual([{ key: "name", direction: "desc" }]);
    q<HTMLButtonElement>(".swd-sort-button").click();
    q<HTMLButtonElement>('.swd-sort-option[data-key=""]').click();
    await settle();
    expect(viewState.get("table.sort")).toBeUndefined();
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
