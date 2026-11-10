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


/** The items of the place's menu shown now: each its label (with its value) and whether it is checked */
const menuShown = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>(".swd-menu .swd-menu-item")].map((one) => [one.querySelector(".swd-label")!.textContent, one.getAttribute("aria-checked")]);
/** An item of the place's menu chosen by its label (its value after it left out) */
const choose = (root: ParentNode, label: string) => {
  const item = [...root.querySelectorAll<HTMLElement>(".swd-menu .swd-menu-item")].find((one) => one.querySelector(".swd-label")!.textContent!.split(": ")[0] === label);
  if (!item) throw new Error(`No item "${label}" in the menu`);
  item.click();
};

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
  it("shows a property's name with its values where the property says so, on a list's row and a card's line, never in a table's cell nor where empty", async () => {
    const named = { ...TASKS, properties: TASKS.properties.map((one) => (one.key === "estimate" ? { ...one, showName: true } : one)) };
    const list = await setup("list", {}, named);
    expect(list.all(".swd-list-item").map((one) => one.textContent)).toEqual(["Fix loginTodoEstimate: 3", "Write docsDoneEstimate: a lot", "PlanLater"]);
    expect(list.q(".swd-field-name").textContent).toBe("Estimate: ");
    document.body.replaceChildren();
    const board = await setup("board", {}, named);
    expect(board.all(".swd-board-card").map((one) => one.textContent)).toContain("Fix loginEstimate: 3");
    document.body.replaceChildren();
    const table = await setup("table", {}, named);
    expect(table.all(".swd-field-name")).toEqual([]);
  });

  it("shows each item's values, those of a property it hides left out", async () => {
    const { all } = await setup("list");
    expect(all(".swd-list-item")[0]!.textContent).toBe("Fix loginTodo3");
    const hidden = await setup("list", { "list.hiddenProperties": ["estimate"] });
    expect(hidden.all(".swd-list-item")[0]!.textContent).toBe("Fix loginTodo");
  });
});

describe("the table grouped", () => {
  it("is one table, a part per group, each its head, its own header row, its rows and + New adding in it", async () => {
    const { all, q, named, viewState } = await setup("table", { "table.groupBy": "status" });
    expect(all("table")).toHaveLength(1);
    const parts = all(".swd-table-group");
    expect(parts.map((part) => part.querySelector(".swd-group-label")!.textContent)).toEqual(["Todo", "Done", "Later (none of its options)"]);
    expect(parts.map((part) => part.querySelectorAll(".swd-table-headrow").length)).toEqual([1, 1, 1]);
    expect(parts.map((part) => [...part.querySelectorAll("tr[data-item]")].map((row) => row.querySelector(".swd-table-name")!.textContent))).toEqual([["Fix login"], ["Write docs"], ["Plan"]]);
    // (Its group's head over the whole width: the grips' column, the name's, each property's, the actions')
    expect(parts[0]!.querySelector(".swd-table-group-head > th")!.getAttribute("colspan")).toBe("6");
    parts[1]!.querySelector<HTMLButtonElement>(".swd-table-add")!.click();
    await settle();
    expect((await named("Untitled")).values.status).toBe("Done");
    // Folded: its rows kept in the table, unseen; kept in the view's meta
    q<HTMLButtonElement>('.swd-table-group[data-group] .swd-group-head').click();
    await settle();
    expect(viewState.get("table.folded")).toEqual([all(".swd-table-group")[0]!.dataset.group]);
    expect([all(".swd-table-group")[0]!.classList.contains("swd-folded"), all(".swd-table-group")[0]!.querySelectorAll("tr[data-item]").length]).toEqual([true, 1]);
  });
});

describe("the table grouped, its edges", () => {
  it("keeps + New under the table where no group shows, every one hidden", async () => {
    const { all, q, items } = await setup("table", { "table.groupBy": "status", "table.groupHidden": ['value:"Todo"', 'value:"Done"', 'value:"Later"'] });
    expect(all(".swd-table-group")).toEqual([]);
    q<HTMLButtonElement>(".swd-table-foot .swd-table-add").click();
    await settle();
    expect((await items()).map((one) => one.name)).toContain("Untitled");
  });

  it("puts the focus back on a row moved by Alt+arrows in its own group, an item in several groups having a row in each", async () => {
    const tagged: Database = { ...TASKS, properties: [...TASKS.properties, { key: "tags", label: "Tags", type: "select", params: { multiple: true, options: ["a", "b"] }, readonly: false }] };
    const { all, store } = await setup("table", { "table.groupBy": "tags" }, tagged);
    const keys = (await store.items("tasks")).value.map((one) => one.key);
    for (const key of keys.slice(0, 2)) store.changeOutside("tasks", key, { values: { tags: ["a", "b"] } });
    await settle();
    const group = () => all(".swd-table-group").find((part) => part.querySelector(".swd-group-label")!.textContent === "b")!;
    const grip = group().querySelector<HTMLElement>("tr[data-item] .swd-row-grip")!;
    grip.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true, cancelable: true }));
    await settle();
    expect(group().contains(document.activeElement)).toBe(true);
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

  it("groups by the property its meta names, picked under Group in ⋯ (any property), and says so where no property can group", async () => {
    const both: Database = { ...TASKS, properties: [...TASKS.properties, { key: "area", label: "Area", type: "select", params: { options: ["Web"] }, readonly: false }] };
    const { q, viewState, all } = await setup("board", {}, both);
    q<HTMLButtonElement>(".swd-more").click();
    choose(document, "Group");
    choose(document, "Group by");
    // Every property, the first select grouped by where none is picked, no None: a board always groups
    expect(menuShown(document)).toEqual([
      ["Status", "true"],
      ["Estimate", "false"],
      ["Done", "false"],
      ["Area", "false"],
    ]);
    choose(document, "Area");
    await settle();
    expect(viewState.get("board.groupBy")).toBe("area");
    expect(all(".swd-board-column").map((column) => column.getAttribute("aria-label"))).toEqual(["No Area", "Web"]);
    const none = await setup("board", {}, { ...TASKS, properties: [] });
    expect(none.q(".swd-place-note").textContent).toContain("has none");
    // A table is grouped by the place: any property, or None
    const table = await setup("table");
    table.q<HTMLButtonElement>(".swd-more").click();
    choose(document, "Group");
    choose(document, "Group by");
    expect(menuShown(document)[0]).toEqual(["None", "true"]);
  });

  it("groups by any property: a column per value, a card dragged setting that column's value, a multi-select's one value replaced", async () => {
    const tagged: Database = { ...TASKS, properties: [...TASKS.properties, { key: "tags", label: "Tags", type: "select", params: { multiple: true, options: ["web", "api", "ops"] }, readonly: false }] };
    const drag = (card: Element, onto: Element) => {
      card.dispatchEvent(new Event("dragstart"));
      onto.dispatchEvent(new MouseEvent("dragover", { bubbles: true, cancelable: true, clientY: 1000 }));
      onto.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
    };
    const columnOf = (all: (selector: string) => HTMLElement[], label: string) => all(".swd-board-column").find((one) => one.getAttribute("aria-label") === label)!;
    const cardOf = (column: HTMLElement, name: string) => [...column.querySelectorAll(".swd-board-card")].find((one) => one.querySelector(".swd-board-name")!.textContent === name)!;
    // A checkbox: Checked and Unchecked, a card dragged ticked
    const ticks = await setup("board", { "board.groupBy": "done" }, tagged);
    expect(ticks.all(".swd-board-column").map((one) => one.getAttribute("aria-label"))).toEqual(["Checked", "Unchecked"]);
    drag(cardOf(columnOf(ticks.all, "Unchecked"), "Fix login"), columnOf(ticks.all, "Checked"));
    await settle();
    expect((await ticks.named("Fix login")).values.done).toBe(true);
    // A number: a column per value, in the order sorting gives them, none first
    const numbers = await setup("board", { "board.groupBy": "estimate" }, tagged);
    expect(numbers.all(".swd-board-column").map((one) => one.getAttribute("aria-label"))).toEqual(["No Estimate", "3", "a lot"]);
    // A multi-select: a card in each of its values' columns; moved from one, that value replaced in its place, the others kept
    const tags = await setup("board", { "board.groupBy": "tags" }, tagged);
    tags.store.changeOutside("tasks",(await tags.named("Write docs")).key, { values: { tags: ["web", "api"] } });
    await settle();
    expect(tags.all(".swd-board-column").map((one) => [one.getAttribute("aria-label"), one.querySelectorAll(".swd-board-card").length])).toEqual([
      ["No Tags", 2],
      ["web", 1],
      ["api", 1],
      ["ops", 0],
    ]);
    drag(cardOf(columnOf(tags.all, "web"), "Write docs"), columnOf(tags.all, "ops"));
    await settle();
    expect((await tags.named("Write docs")).values.tags).toEqual(["ops", "api"]);
    // Onto another of its own columns: nothing written
    drag(cardOf(columnOf(tags.all, "ops"), "Write docs"), columnOf(tags.all, "api"));
    await settle();
    expect((await tags.named("Write docs")).values.tags).toEqual(["ops", "api"]);
    // From the column of none: the column's value given
    drag(cardOf(columnOf(tags.all, "No Tags"), "Plan"), columnOf(tags.all, "web"));
    await settle();
    expect((await tags.named("Plan")).values.tags).toEqual(["web"]);
  });

  it("arranges its columns under Group in ⋯: dragged or Alt+↑ ↓ into an order, hidden by their eye, empty ones hidden, all kept in its meta", async () => {
    const { q, all, viewState } = await setup("board");
    const labels = () => all(".swd-board-column").map((column) => column.getAttribute("aria-label"));
    q<HTMLButtonElement>(".swd-more").click();
    choose(document, "Group");
    const rows = () => [...document.querySelectorAll<HTMLElement>(".swd-group-row")];
    expect(rows().map((row) => row.querySelector(".swd-group-row-label")!.textContent)).toEqual(["Todo", "Done", "Later (none of its options)"]);
    // Alt+↓ on Todo's grip: after Done, the menu still open
    rows()[0]!.querySelector(".swd-group-grip")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true, cancelable: true }));
    await settle();
    expect(labels()).toEqual(["Done", "Todo", "Later (none of its options)"]);
    expect(viewState.get("board.groupOrder")).toEqual(['value:"Done"', 'value:"Todo"', 'value:"Later"']);
    expect(rows().map((row) => row.dataset.group)).toEqual(['value:"Done"', 'value:"Todo"', 'value:"Later"']);
    // Its eye: hidden, the row kept in the list, dimmed
    rows()[1]!.querySelector<HTMLButtonElement>(".swd-group-eye")!.click();
    await settle();
    expect(labels()).toEqual(["Done", "Later (none of its options)"]);
    expect(viewState.get("board.groupHidden")).toEqual(['value:"Todo"']);
    expect(rows()[1]!.classList.contains("swd-group-off")).toBe(true);
    // Hide all, Show all
    document.querySelector<HTMLButtonElement>(".swd-group-all")!.click();
    await settle();
    expect(labels()).toEqual([]);
    expect(document.querySelector(".swd-group-all")!.textContent).toBe("Show all");
    document.querySelector<HTMLButtonElement>(".swd-group-all")!.click();
    await settle();
    expect(labels()).toEqual(["Done", "Todo", "Later (none of its options)"]);
    // Hide empty groups: Done emptied by a change elsewhere goes
    const switched = document.querySelector<HTMLButtonElement>(".swd-group-switch")!;
    switched.click();
    await settle();
    expect(viewState.get("board.groupHideEmpty")).toBe(true);
    expect(document.querySelector(".swd-group-switch")!.getAttribute("aria-checked")).toBe("true");
    // Another property picked: the order and the hiding go with the one they were for
    choose(document, "Group by");
    choose(document, "Done");
    await settle();
    expect([viewState.get("board.groupOrder"), viewState.get("board.groupHidden"), viewState.get("board.groupHideEmpty")]).toEqual([undefined, undefined, true]);
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
  it("is no column, card line or list value of the view hiding it, the others showing it; still filtered and sorted by", async () => {
    const { all, q, viewState } = await setup("table", { "table.hiddenProperties": ["estimate"] });
    expect(all("th").map((th) => th.textContent)).not.toContain("Estimate");
    expect(q('.swd-filter input[data-key="estimate"]')).not.toBeNull();
    q<HTMLButtonElement>(".swd-sort-button").click();
    choose(document, "Estimate");
    await settle();
    expect(viewState.get("table.sort")).toEqual([{ key: "estimate", direction: "asc" }]);
    // (Another view of the same block shows it: what is hidden is each view's own)
    const list = await setup("list", { "table.hiddenProperties": ["estimate"] });
    expect(list.all('.swd-list-value[data-key="estimate"]')).toHaveLength(2);
    const board = await setup("board", { "board.hiddenProperties": ["estimate"] });
    expect(board.all('.swd-board-value[data-key="estimate"]')).toHaveLength(0);
  });

  it("hidden on a board, changes nothing of what it is grouped by", async () => {
    const shown = await setup("board");
    const columns = shown.all(".swd-board-title").map((one) => one.textContent);
    expect(columns.length).toBeGreaterThan(1);
    const hidden = await setup("board", { "board.hiddenProperties": ["status"] });
    expect(hidden.all(".swd-board-title").map((one) => one.textContent)).toEqual(columns);
  });

  it("hidden in one view, given to every other view of the block by Apply to all views, each keeping it its way", async () => {
    const { q, viewState } = await setup("table", { "table.hiddenProperties": ["estimate"] });
    q<HTMLButtonElement>(".swd-more").click();
    choose(document, "Visible properties");
    choose(document, "Apply to all views");
    await settle();
    expect(viewState.get("list.hiddenProperties")).toEqual(["estimate"]);
    expect(viewState.get("board.hiddenProperties")).toEqual(["estimate"]);
    // (The calendar and the timeline keep those shown)
    expect(viewState.get("calendar.shownProperties")).toEqual(TASKS.properties.map((one) => one.key).filter((key) => key !== "estimate"));
    expect(viewState.get("timeline.shownProperties")).toEqual(TASKS.properties.map((one) => one.key).filter((key) => key !== "estimate"));
  });

  it("is hidden and shown again by its eye under Visible properties in ⋯, the menu staying open; Hide all and Show all", async () => {
    const { all, q, viewState } = await setup("table");
    q<HTMLButtonElement>(".swd-more").click();
    choose(document, "Visible properties");
    const eye = () => q<HTMLButtonElement>('.swd-shown-row[data-property="estimate"] .swd-shown-eye');
    expect(eye().getAttribute("aria-pressed")).toBe("true");
    eye().click();
    await settle();
    expect(viewState.get("table.hiddenProperties")).toEqual(["estimate"]);
    expect(all("th").map((th) => th.textContent)).not.toContain("Estimate");
    expect(eye().getAttribute("aria-pressed")).toBe("false");
    q<HTMLButtonElement>(".swd-shown-all").click();
    await settle();
    expect(viewState.get("table.hiddenProperties")).toEqual(TASKS.properties.map((one) => one.key));
    q<HTMLButtonElement>(".swd-shown-all").click();
    await settle();
    expect(viewState.get("table.hiddenProperties")).toBeUndefined();
  });
});

describe("the place's tools", () => {
  it("shows a filter as it is typed, nothing written, and keeps it once the field is left; one that does not read neither", async () => {
    const { q, all, viewState } = await setup("table");
    q<HTMLButtonElement>(".swd-filter-button").click();
    const name = q<HTMLInputElement>('.swd-filter input[data-key="name"]');
    const type = (text: string) => {
      name.value = text;
      name.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
    name.focus();
    type("F");
    type("Fi");
    // Shown at once, written not yet (a write draws the block anew, the field with it)
    await settle();
    expect([all("tbody tr").length, viewState.get("table.filter"), viewState.writes]).toEqual([1, undefined, 0]);
    // Left: kept, once
    name.blur();
    await settle();
    expect([viewState.get("table.filter"), viewState.writes]).toEqual([{ name: "Fi" }, 1]);
    // One that does not read: marked, the view as kept, nothing written as it is left
    name.focus();
    type("/unclosed(/");
    name.blur();
    await settle();
    expect([viewState.get("table.filter"), name.classList.contains("swd-invalid"), all("tbody tr").length]).toEqual([{ name: "Fi" }, true, 1]);
    // Typed back to what is kept and left: nothing written
    name.focus();
    type("Fi");
    name.blur();
    await settle();
    expect(viewState.writes).toBe(1);
  });

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
    // The sort's menu (the shared menu): the order by hand checked, the way of none to pick yet; a property, then the other way
    q<HTMLButtonElement>(".swd-sort-button").click();
    expect(menuShown(document)[0]).toEqual(["Order by hand", "true"]);
    expect(all<HTMLButtonElement>(".swd-menu-row-direction .swd-segment").map((one) => one.getAttribute("aria-disabled"))).toEqual(["true", "true"]);
    choose(document, "Name");
    await settle();
    expect(viewState.get("table.sort")).toEqual([{ key: "name", direction: "asc" }]);
    expect(document.querySelector<HTMLElement>(".swd-menu")?.hidden ?? true).toBe(true);
    q<HTMLButtonElement>(".swd-sort-button").click();
    all<HTMLButtonElement>(".swd-menu-row-direction .swd-segment")[1]!.click();
    await settle();
    expect(viewState.get("table.sort")).toEqual([{ key: "name", direction: "desc" }]);
    q<HTMLButtonElement>(".swd-sort-button").click();
    choose(document, "Order by hand");
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
