// @vitest-environment jsdom
// Load more (docs/silverware-database-load-more.md): a view draws its first items of each group, as many more each
// press, an item added past them shown, a listing changed starting anew; kept for the window as a place drawn anew
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseCore } from "../../core/core.ts";
import { DatabasePlace, VIEW_KEY } from "../../core/place.ts";
import { calculatingStore } from "../../core/calculating.ts";
import { ViewRegistry } from "../../core/views.ts";
import { TypeRegistry } from "../../domain/types/registry.ts";
import type { Database } from "../../model/database.ts";
import { MemoryStore } from "../../store/memory.ts";
import { MemoryViewState } from "../../store/viewstate.ts";
import { BUILT_IN_VIEWS } from "./index.ts";
import { ranksInOrder } from "../../domain/rank.ts";
import { revealItem, viewLimit } from "../../core/limit.ts";
import type { Item } from "../../model/database.ts";

// What a press or a write draws, waited for as it comes (a place draws anew after its data is read again)
const settled = (check: () => void) => vi.waitFor(check, { timeout: 5_000 });
afterEach(() => document.body.replaceChildren());

let databases = 0;

/** A database of `count` items (Item 01, Item 02…, in that order by hand), each of status A for the first 15, B for the rest; its place of `view` */
async function setup(count: number, state: Record<string, unknown> = {}, size = 10) {
  // (A database of its own each: what a view has loaded is kept for the window by database)
  const id = `many${++databases}`;
  const ranks = ranksInOrder(count);
  const database: Database = { id, name: "Many", properties: [{ key: "status", label: "Status", type: "select", params: { options: ["A", "B"] }, readonly: false }, { key: "due", label: "Due", type: "date", params: {}, readonly: false }] };
  const store = new MemoryStore([{ database, items: Array.from({ length: count }, (_, n) => ({ name: `Item ${String(n + 1).padStart(2, "0")}`, values: { status: n < 15 ? "A" : "B", due: "2026-11-10" }, rank: ranks[n] })) }]);
  const types = new TypeRegistry();
  const core = new DatabaseCore(store, types, { notify: () => {}, ask: () => true });
  const viewState = new MemoryViewState({ [VIEW_KEY]: "list", ...state });
  let pageSize = size;
  const settings = { get: (path: string, fallback: unknown) => (path === "silverware.database.pageSize" ? pageSize : fallback) };
  const make = async () => {
    const element = document.createElement("div");
    document.body.replaceChildren(element);
    const place = new DatabasePlace({ element, database: id, state: viewState, store: calculatingStore(store), core, types, views: new ViewRegistry(BUILT_IN_VIEWS), settings, ui: { notify: () => {} } });
    await place.render();
    return { element, place };
  };
  let { element, place } = await make();
  const names = (within: ParentNode = element) => [...within.querySelectorAll(".swd-list-name")].map((one) => one.textContent);
  const more = (within: ParentNode = element) => within.querySelector<HTMLButtonElement>(".swd-load-more-button");
  const count_ = (within: ParentNode = element) => within.querySelector(".swd-load-more-count")?.textContent;
  return {
    store,
    viewState,
    names,
    more,
    count: count_,
    get element() {
      return element;
    },
    place: () => place,
    /** A place drawn anew for the block (as SilverBullet draws one after a write), the page's size set anew where given */
    async again(size?: number) {
      if (size !== undefined) pageSize = size;
      ({ element, place } = await make());
    },
  };
}

describe("Load more", () => {
  it("draws by a press the next items not shown yet, past a page shown whole already (its items changed past the cut)", () => {
    const items = Array.from({ length: 30 }, (_, n) => ({ key: `i${n}`, name: `I${n}`, values: {} }) as unknown as Item);
    const key = { key: `limit${++databases}`, signature: () => "" };
    let drawn = 0;
    const limit = viewLimit({ ...key, size: 10, document, refresh: () => drawn++ });
    for (const item of items.slice(10, 20)) revealItem(key, item.key);
    expect(limit.shown(items)).toHaveLength(20);
    const [button, count] = limit.more(items)!;
    expect([button!.textContent, count!.textContent]).toEqual(["Load 10 more", "20 of 30"]);
    button!.click();
    expect([drawn, limit.shown(items).length, limit.more(items)]).toEqual([1, 30, undefined]);
  });

  it("draws a view's first items, as many more each press, the first of them focused, none past the last", async () => {
    const view = await setup(25);
    expect(view.names()).toHaveLength(10);
    expect([view.more()!.textContent, view.count()]).toEqual(["Load 10 more", "10 of 25"]);
    view.more()!.click();
    await settled(() => expect(view.names()).toHaveLength(20));
    expect(document.activeElement?.closest("[data-item]")?.querySelector(".swd-list-name")?.textContent).toBe("Item 11");
    expect([view.more()!.textContent, view.count()]).toEqual(["Load 5 more", "20 of 25"]);
    view.more()!.click();
    await settled(() => expect([view.names().length, view.more()]).toEqual([25, null]));
  });

  it("keeps what was loaded for a place drawn anew (a block written), a larger page's size taking the presses", async () => {
    const view = await setup(60);
    view.more()!.click();
    await settled(() => expect(view.names()).toHaveLength(20));
    await view.again();
    expect(view.names()).toHaveLength(20);
    await view.again(15);
    expect(view.names()).toHaveLength(30);
  });

  it("starts anew as the listing changes (a sort, a filter)", async () => {
    const view = await setup(25);
    view.more()!.click();
    await settled(() => expect(view.names()).toHaveLength(20));
    view.viewState.set({ "list.sort": [{ key: "name", direction: "desc" }] });
    await view.place().render();
    expect(view.names()).toHaveLength(10);
  });

  it("shows an item added past what is drawn, after the drawn ones", async () => {
    const view = await setup(25);
    view.element.querySelector<HTMLButtonElement>(".swd-table-add")!.click();
    await settled(() => expect(view.names()).toHaveLength(11));
    expect(view.names().at(-1)).toBe("Untitled");
    expect(view.count()).toBe("11 of 26");
  });

  it("keeps each listing's own (two blocks of one view, filtered otherwise, drawn in turn)", async () => {
    const view = await setup(40, { "list.filter": { status: "B" } });
    view.more()!.click();
    await settled(() => expect(view.names()).toHaveLength(20));
    view.viewState.set({ "list.filter": {} });
    await view.place().render();
    expect(view.names()).toHaveLength(10);
    view.viewState.set({ "list.filter": { status: "B" } });
    await view.place().render();
    expect([view.names().length, view.count()]).toEqual([20, "20 of 25"]);
  });

  it("shows an item changed past what is drawn (a sort by its value), a press then drawing the rest of the next page", async () => {
    const rows = () => [...view.element.querySelectorAll("tr[data-item]")].map((row) => row.querySelector(".swd-table-name")?.textContent?.trim());
    const view = await setup(25, { [VIEW_KEY]: "table", "table.sort": [{ key: "status", direction: "asc" }] });
    const cell = view.element.querySelector<HTMLElement>('tr[data-item] td[data-key="status"]')!;
    cell.click();
    const select = cell.querySelector<HTMLSelectElement>("select")!;
    select.value = "B";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    // (Item 01 now the first of B, the 15th listed: past the 10 drawn, shown after them)
    await settled(() => expect(rows().at(-1)).toContain("Item 01"));
    expect([rows().length, view.more()!.textContent, view.count()]).toEqual([11, "Load 9 more", "11 of 25"]);
    view.more()!.click();
    await settled(() => expect(rows()).toHaveLength(20));
    expect(rows().filter((name) => name?.includes("Item 01"))).toHaveLength(1);
  });

  it("starts anew as the grouping changes", async () => {
    const view = await setup(25);
    view.more()!.click();
    await settled(() => expect(view.names()).toHaveLength(20));
    view.viewState.set({ "list.groupBy": "status" });
    await view.place().render();
    expect([...view.element.querySelectorAll<HTMLElement>(".swd-group")].map((group) => view.names(group).length)).toEqual([10, 10]);
  });

  it("shows an item added in a group past what it draws, the group's row counting it; a folded group no row", async () => {
    const view = await setup(40, { "list.groupBy": "status" });
    const groupB = () => [...view.element.querySelectorAll<HTMLElement>(".swd-group")][1]!;
    groupB().querySelector<HTMLButtonElement>(".swd-table-add")!.click();
    await settled(() => expect([view.names(groupB()).length, view.names(groupB()).at(-1), view.count(groupB())]).toEqual([11, "Untitled", "11 of 26"]));
    view.viewState.set({ "list.folded": ['value:"B"'] });
    await view.place().render();
    expect(view.more(groupB())).toBeNull();
  });

  it("focuses the first item drawn in the group pressed", async () => {
    const view = await setup(40, { "list.groupBy": "status" });
    view.more([...view.element.querySelectorAll<HTMLElement>(".swd-group")][1])!.click();
    await settled(() => expect(document.activeElement?.closest("[data-group]")?.getAttribute("data-group")).toBe('value:"B"'));
    expect(document.activeElement?.closest("[data-item]")?.querySelector(".swd-list-name")?.textContent).toBe("Item 26");
  });

  it("draws a table's first rows and Load more in a row across it, each group its own, the first row drawn focused", async () => {
    const rows = (within: ParentNode) => [...within.querySelectorAll("tr[data-item]")].length;
    const view = await setup(25, { [VIEW_KEY]: "table" });
    expect([rows(view.element), view.count()]).toEqual([10, "10 of 25"]);
    expect(view.element.querySelector(".swd-table-more > td")!.getAttribute("colspan")).toBe("4");
    view.more()!.click();
    await settled(() => expect(rows(view.element)).toBe(20));
    expect(document.activeElement?.closest("tr[data-item]")?.querySelector(".swd-table-name")?.textContent).toContain("Item 11");
    const grouped = await setup(40, { [VIEW_KEY]: "table", "table.groupBy": "status" });
    const parts = [...grouped.element.querySelectorAll<HTMLElement>(".swd-table-group")];
    expect(parts.map((part) => [rows(part), grouped.count(part)])).toEqual([
      [10, "10 of 15"],
      [10, "10 of 25"],
    ]);
    // (Load more in a group: its first new row focused, in that group)
    grouped.more(parts[1])!.click();
    await settled(() => expect(document.activeElement?.closest("[data-group]")?.getAttribute("data-group")).toBe('value:"B"'));
    expect(document.activeElement?.closest("tr[data-item]")?.querySelector(".swd-table-name")?.textContent).toContain("Item 26");
    // (+ New in a group: shown past what it draws)
    [...grouped.element.querySelectorAll<HTMLElement>(".swd-table-group")][1]!.querySelector<HTMLButtonElement>(".swd-table-group-add .swd-table-add")!.click();
    await settled(() => expect(rows([...grouped.element.querySelectorAll<HTMLElement>(".swd-table-group")][1]!)).toBe(21));
  });

  it("draws a board's column's first cards, Load more under them", async () => {
    const view = await setup(40, { [VIEW_KEY]: "board", "board.groupBy": "status" });
    const column = () => view.element.querySelector<HTMLElement>('.swd-board-column[data-value="B"]')!;
    expect([column().querySelectorAll(".swd-board-card").length, view.count(column())]).toEqual([10, "10 of 25"]);
    view.more(column())!.click();
    await settled(() => expect(column().querySelectorAll(".swd-board-card").length).toBe(20));
  });

  it("draws a timeline's first rows, of each group, Load more in a row under them, its axis of every item", async () => {
    const view = await setup(25, { [VIEW_KEY]: "timeline", "timeline.dateBy": "due" });
    expect([view.element.querySelectorAll(".swd-tl-row[data-item]").length, view.count()]).toEqual([10, "10 of 25"]);
    expect(view.element.querySelector(".swd-tl-count")!.textContent).toBe("25 items");
    const grouped = await setup(40, { [VIEW_KEY]: "timeline", "timeline.dateBy": "due", "timeline.groupBy": "status" });
    grouped.more()!.click();
    await settled(() => expect([...grouped.element.querySelectorAll<HTMLElement>(".swd-tl-row[data-item]")].map((row) => row.dataset.inGroup).filter((group) => group === 'value:"A"').length).toBe(15));
    expect(document.activeElement?.closest("[data-item]")?.getAttribute("data-in-group")).toBe('value:"A"');
  });

  it("cuts each group of a view the place draws per group, its own Load more under it", async () => {
    const view = await setup(40, { "list.groupBy": "status" });
    const groups = [...view.element.querySelectorAll<HTMLElement>(".swd-group")];
    expect(groups.map((group) => [view.names(group).length, view.count(group)])).toEqual([
      [10, "10 of 15"],
      [10, "10 of 25"],
    ]);
    view.more(groups[1])!.click();
    await settled(() => expect(view.names([...view.element.querySelectorAll<HTMLElement>(".swd-group")][1]!)).toHaveLength(20));
    const after = [...view.element.querySelectorAll<HTMLElement>(".swd-group")];
    expect(after.map((group) => view.names(group).length)).toEqual([10, 20]);
  });
});

describe("the focus through a view drawn anew", () => {
  it("stays on the item that had it, as the view is updated and as the place is drawn anew, where it went nowhere else", async () => {
    const view = await setup(5);
    const focusedName = () => document.activeElement?.closest("[data-item]")?.querySelector(".swd-list-name")?.textContent;
    const third = () => [...view.element.querySelectorAll<HTMLElement>("[data-item]")][2]!;
    (third().matches("button, a, [tabindex]") ? third() : third().querySelector<HTMLElement>("button, a, [tabindex]")!).focus();
    expect(focusedName()).toBe("Item 03");
    // (A change shown: the view updated, its elements made anew)
    await view.place().refresh();
    expect(focusedName()).toBe("Item 03");
    await view.place().render();
    expect(focusedName()).toBe("Item 03");
    // (Gone elsewhere meanwhile: left there)
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    await view.place().render();
    expect(document.activeElement).toBe(outside);
  });
});
