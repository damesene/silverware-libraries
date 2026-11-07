// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { TypeRegistry } from "../domain/types/registry.ts";
import type { Database } from "../model/database.ts";
import { MemoryStore } from "../store/memory.ts";
import { MemoryViewState } from "../store/viewstate.ts";
import { DatabaseCore } from "./core.ts";
import { DatabasePlace, VIEW_KEY, viewSettingPath } from "./place.ts";
import type { ViewDefinition, ViewHost } from "./view.ts";
import { ViewRegistry } from "./views.ts";

const TASKS: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [{ key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false }],
};

/** A view listing names, keeping its host for the test, counting how it was drawn and told */
function listView(name: string, options: { update?: boolean; fail?: boolean } = {}) {
  const seen = { host: undefined as ViewHost | undefined, renders: 0, updates: 0, destroyed: 0 };
  const view: ViewDefinition = {
    name,
    label: name.toUpperCase(),
    icon: "•",
    settings: [{ key: "dense", label: "Dense", control: "switch", default: false }],
    render(host, element) {
      if (options.fail) throw new Error("broken");
      seen.host = host;
      seen.renders++;
      const draw = () => element.replaceChildren(...host.items.map((item) => Object.assign(element.ownerDocument.createElement("li"), { textContent: host.text(item, "name") })));
      draw();
      return {
        ...(options.update === false
          ? {}
          : {
              update: () => {
                seen.updates++;
                draw();
              },
            }),
        destroy: () => void seen.destroyed++,
      };
    },
  };
  return { view, seen };
}

function setup(views: readonly ViewDefinition[], state: Record<string, unknown> = {}, settings: Record<string, unknown> = {}, slowSettings = 0, editSource?: () => void) {
  const store = new MemoryStore([{ database: TASKS, items: [{ name: "Fix login", values: { status: "Todo" }, rank: "a0" }, { name: "Write docs", values: { status: "Done" }, rank: "a1" }] }]);
  const types = new TypeRegistry();
  const core = new DatabaseCore(store, types, { notify: () => {}, ask: () => true });
  const element = document.createElement("div");
  const viewState = new MemoryViewState(state);
  const opened: string[] = [];
  const place = new DatabasePlace({
    element,
    database: "tasks",
    state: viewState,
    store,
    core,
    types,
    views: new ViewRegistry(views),
    settings: {
      get: (path, fallback) => {
        const value = path in settings ? settings[path] : fallback;
        return slowSettings ? new Promise((resolve) => setTimeout(() => resolve(value), slowSettings)) : value;
      },
    },
    ui: { notify: () => {} },
    editor: { open: (ref) => void opened.push(ref) },
    ...(editSource ? { editSource } : {}),
  });
  const listed = () => [...element.querySelectorAll("li")].map((one) => one.textContent);
  const switches = () => [...element.querySelectorAll<HTMLButtonElement>(".swd-switch")];
  return { store, element, viewState, place, listed, switches, opened, core };
}

describe("a place", () => {
  it("draws the view its state names, the switcher listing the views on, the one shown pressed", async () => {
    const [table, board] = [listView("table"), listView("board")];
    const { place, listed, switches } = setup([table.view, board.view], { [VIEW_KEY]: "board" });
    await place.render();
    expect(switches().map((one) => [one.dataset.view, one.getAttribute("aria-pressed")])).toEqual([
      ["table", "false"],
      ["board", "true"],
    ]);
    expect(listed()).toEqual(["Fix login", "Write docs"]);
    expect([table.seen.renders, board.seen.renders]).toEqual([0, 1]);
  });

  it("shows the first view on where its state names none, and a note where it names one not on", async () => {
    const [table, board] = [listView("table"), listView("board")];
    const first = setup([table.view, board.view], {}, { [viewSettingPath("table", "enabled")]: false });
    await first.place.render();
    expect(board.seen.renders).toBe(1);
    expect(first.switches().map((one) => one.dataset.view)).toEqual(["board"]);
    const missing = setup([table.view], { [VIEW_KEY]: "calendar" });
    await missing.place.render();
    expect(missing.element.querySelector(".swd-place-note")!.textContent).toContain('No view "calendar"');
    expect(missing.switches()).toHaveLength(1);
  });

  it("switches views, writing the place's state, the view left told", async () => {
    const [table, board] = [listView("table"), listView("board")];
    const { place, viewState, switches } = setup([table.view, board.view]);
    await place.render();
    switches()[1]!.click();
    await place.render();
    expect(viewState.get(VIEW_KEY)).toBe("board");
    expect(table.seen.destroyed).toBe(1);
    expect(board.seen.renders).toBeGreaterThan(0);
  });

  it("tells the view as the database changes, through the core or outside it, or draws it anew where it has no update", async () => {
    const table = listView("table");
    const { place, store, listed } = setup([table.view]);
    await place.render();
    await table.seen.host!.create({ name: "Plan" });
    expect(listed()).toEqual(["Fix login", "Write docs", "Plan"]);
    store.changeOutside("tasks", table.seen.host!.items[0]!.key, { name: "Fix the login" });
    await place.refresh();
    expect(listed()[0]).toBe("Fix the login");
    expect(table.seen.renders).toBe(1);
    const plain = listView("plain", { update: false });
    const other = setup([plain.view]);
    await other.place.render();
    await other.place.refresh();
    expect(plain.seen.renders).toBe(2);
  });

  it("keeps a view's filter, sort and meta under its name, its settings read with their defaults", async () => {
    const table = listView("table");
    const { place, viewState, listed } = setup([table.view], {}, { [viewSettingPath("table", "dense")]: true });
    await place.render();
    const host = table.seen.host!;
    await host.listing.setFilter("status", "Done");
    expect(listed()).toEqual(["Write docs"]);
    await host.listing.setFilter("status", "");
    await host.listing.setSort([{ key: "name", direction: "desc" }]);
    expect(listed()).toEqual(["Write docs", "Fix login"]);
    await host.setMeta({ width: 3 });
    expect(Object.fromEntries(viewState.keys().map((key) => [key, viewState.get(key)]))).toEqual({ "table.sort": [{ key: "name", direction: "desc" }], "table.width": 3 });
    expect(host.getMeta("width")).toBe(3);
    expect(host.setting("dense")).toBe(true);
    expect(host.total).toBe(2);
  });

  it("shows a view that fails as a note, never breaking the place", async () => {
    const broken = listView("broken", { fail: true });
    const { place, element } = setup([broken.view]);
    await place.render();
    expect(element.querySelector(".swd-place-note")!.textContent).toBe('The view "BROKEN" failed: broken');
  });

  it("stops following the database once gone", async () => {
    const table = listView("table");
    const { place, store } = setup([table.view]);
    await place.render();
    place.destroy();
    store.changeOutside("tasks", table.seen.host!.items[0]!.key, { name: "X" });
    await place.refresh();
    expect([table.seen.updates, table.seen.destroyed]).toEqual([0, 1]);
  });

  it("writes a view's meta under its own name after another view is shown, never the one shown now", async () => {
    const [table, board] = [listView("table"), listView("board")];
    const { place, viewState, switches } = setup([table.view, board.view]);
    await place.render();
    const old = table.seen.host!;
    switches()[1]!.click();
    await place.render();
    await old.setMeta({ widths: [1, 2] });
    await old.listing.setSort([{ key: "name", direction: "desc" }]);
    expect([...viewState.keys()].sort()).toEqual(["table.sort", "table.widths", "view"]);
    expect(board.seen.renders).toBe(1);
  });

  it("draws a view again from its switch after a note", async () => {
    const table = listView("table");
    const { place, viewState, switches, listed } = setup([table.view]);
    await place.render();
    await viewState.set({ [VIEW_KEY]: "ghost" });
    await place.render();
    switches()[0]!.click();
    await place.render();
    expect(viewState.get(VIEW_KEY)).toBe("table");
    expect(listed()).toEqual(["Fix login", "Write docs"]);
  });

  it("draws nothing once gone, a drawing under way included", async () => {
    const table = listView("table");
    const { place } = setup([table.view], {}, {}, 5);
    const drawing = place.render();
    await new Promise((resolve) => setTimeout(resolve, 1));
    place.destroy();
    await drawing;
    expect(table.seen.renders).toBe(0);
  });

  it("refreshes once for changes asked before the refresh starts, and undoes the database's last change", async () => {
    const table = listView("table");
    const { place, listed } = setup([table.view]);
    await place.render();
    const before = table.seen.updates;
    await Promise.all([place.refresh(), place.refresh(), place.refresh()]);
    expect(table.seen.updates - before).toBe(1);
    await table.seen.host!.rename(table.seen.host!.items[0]!, "Fixed");
    expect(listed()[0]).toBe("Fixed");
    await table.seen.host!.undo();
    expect(listed()[0]).toBe("Fix login");
    expect(table.seen.host!.items).toBe(table.seen.host!.items);
  });

  it("shows how far an undo is on its Undo while it writes, one at a time, drawn anew meanwhile", async () => {
    const table = listView("table");
    const { place, store, element } = setup([table.view]);
    await place.render();
    await table.seen.host!.rename(table.seen.host!.items[0]!, "Fixed");
    // The store's write held halfway, as many pages would hold it
    let letGo = () => {};
    const held = new Promise<void>((resolve) => (letGo = resolve));
    const apply = store.apply.bind(store);
    let applied = 0;
    store.apply = async (plan, progress) => {
      applied++;
      progress?.(1, 3);
      await held;
      return apply(plan, progress);
    };
    const undo = () => element.querySelector<HTMLButtonElement>(".swd-undo")!;
    undo().click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(undo().getAttribute("aria-busy")).toBe("true");
    expect(undo().querySelector(".swd-undo-progress")!.textContent).toBe("1 / 3");
    // Pressed again: no second undo; the place drawn anew: still shown
    undo().click();
    await place.render();
    expect(undo().querySelector(".swd-undo-progress")!.textContent).toBe("1 / 3");
    letGo();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(applied).toBe(1);
    expect(undo().getAttribute("aria-busy")).toBe("false");
    expect(table.seen.host!.items.map((one) => one.name)).toContain("Fix login");
  });

  it("draws a view once per group picked under Group by, each knowing only its items, one added in a group with its value", async () => {
    const table = listView("table");
    const { place, element, viewState, store } = setup([table.view]);
    await place.render();
    element.querySelector<HTMLButtonElement>(".swd-more")!.click();
    // Every property offered, and None, checked: nothing grouped yet
    expect([...element.querySelectorAll(".swd-group-option")].map((one) => [one.textContent, one.getAttribute("aria-pressed")])).toEqual([
      ["None", "true"],
      ["Status", "false"],
    ]);
    element.querySelector<HTMLButtonElement>('.swd-group-option[data-key="status"]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(viewState.get("table.groupBy")).toBe("status");
    const sections = () => [...element.querySelectorAll(".swd-group")].map((one) => [one.querySelector(".swd-group-label")!.textContent, [...one.querySelectorAll("li")].map((li) => li.textContent)]);
    expect(sections()).toEqual([
      ["Todo", ["Fix login"]],
      ["Done", ["Write docs"]],
    ]);
    const renders = table.seen.renders;
    // Added in a group: its value; the groups the same, each view told, none drawn anew
    await table.seen.host!.create({ name: "New one" });
    expect((await store.items("tasks")).value.find((one) => one.name === "New one")!.values.status).toBe("Done");
    expect(sections()[1]).toEqual(["Done", ["Write docs", "New one"]]);
    expect(table.seen.renders).toBe(renders);
    // Folded: its head alone, kept in the view's meta
    element.querySelector<HTMLButtonElement>('.swd-group-head[data-group]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(viewState.get("table.folded")).toEqual(['value:"Todo"']);
    expect(sections()).toEqual([
      ["Todo", []],
      ["Done", ["Write docs", "New one"]],
    ]);
    // None: one view again
    element.querySelector<HTMLButtonElement>(".swd-more")!.click();
    element.querySelector<HTMLButtonElement>('.swd-group-option[data-key=""]')!.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(element.querySelectorAll(".swd-group")).toHaveLength(0);
    expect(element.querySelectorAll("li")).toHaveLength(3);
  });

  it("keeps a field being typed in while the groups change, draws them anew once it is left, and lets one group's view fail alone", async () => {
    // A view of a field each, its count of all as its host has it; failing for the group of Done
    const typed: ViewDefinition = {
      name: "typed",
      label: "Typed",
      icon: "•",
      render(host, element) {
        if (host.items.some((item) => item.values.status === "Done")) throw new Error("broken here");
        const field = Object.assign(element.ownerDocument.createElement("input"), { className: "field" });
        const draw = () => void (field.value = `${host.items.length} of ${host.total}`);
        draw();
        element.replaceChildren(field);
        return { update: draw };
      },
    };
    const { place, element, store } = setup([typed], { [VIEW_KEY]: "typed", "typed.groupBy": "status" });
    document.body.append(element);
    await place.render();
    expect([...element.querySelectorAll(".swd-group")].map((one) => one.querySelector(".swd-place-note")?.textContent ?? one.querySelector<HTMLInputElement>(".field")?.value)).toEqual(["1 of 1", 'The view "Typed" failed: broken here']);
    const field = element.querySelector<HTMLInputElement>(".field")!;
    field.focus();
    // A change bringing a group of none: held while the field has the focus
    const [first] = (await store.items("tasks")).value;
    store.changeOutside("tasks", first!.key, { values: { status: null } });
    await place.refresh();
    expect(element.querySelector(".field")).toBe(field);
    field.blur();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(element.querySelector(".swd-group-label")!.textContent).toBe("No Status");
    element.remove();
  });

  it("offers Edit source last in ⋯ where the place is a block, none where it is not", async () => {
    const table = listView("table");
    let asked = 0;
    const { place, element } = setup([table.view], {}, {}, 0, () => void asked++);
    await place.render();
    element.querySelector<HTMLButtonElement>(".swd-more")!.click();
    const item = document.querySelector<HTMLButtonElement>(".swd-edit-source") ?? element.querySelector<HTMLButtonElement>(".swd-edit-source");
    expect(item?.textContent).toBe("Edit source");
    item!.click();
    expect(asked).toBe(1);
    // A view never grouped, without a block: no ⋯
    const without = setup([{ ...table.view, groupBy: false }]);
    await without.place.render();
    expect(without.element.querySelector(".swd-more")).toBeNull();
  });

  it("draws a view setting its filter or sort as it draws once: the same again writes nothing", async () => {
    let renders = 0;
    const view: ViewDefinition = {
      name: "seeding",
      label: "Seeding",
      icon: "x",
      render(host) {
        renders++;
        if (renders > 20) return;
        void host.listing.setFilter("status", "Todo");
        void host.listing.setSort([{ key: "name", direction: "asc" }]);
      },
    };
    const { place, viewState } = setup([view]);
    await place.render();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(renders).toBeLessThan(5);
    const writes = viewState.writes;
    await place.render();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(viewState.writes).toBe(writes);
  });

  it("lets a view gone read the data it had, whatever the place shows now", async () => {
    const table = listView("table");
    const { place, store } = setup([table.view]);
    await place.render();
    const old = table.seen.host!;
    store.database = async () => undefined;
    await place.render();
    expect(old.items.map((one) => one.name)).toEqual(["Fix login", "Write docs"]);
    expect(old.total).toBe(2);
  });
});
describe("the view registry", () => {
  it("puts a view defined of a built-in name in its place, refusing what cannot be a view and saying why", () => {
    const registry = new ViewRegistry([listView("table").view, listView("list").view]);
    const mine = { ...listView("table").view, label: "Mine" };
    const nameless = { name: "x", render() {} } as unknown as ViewDefinition;
    const dotted = { ...listView("dots").view, settings: [{ key: "a.b", label: "A", control: "switch" as const, default: false }] };
    const problems = registry.define([listView("Bad Name").view, nameless, dotted, mine, listView("board").view, listView("board").view]);
    expect(problems).toHaveLength(4);
    expect(registry.all().map((one) => one.label)).toEqual(["Mine", "LIST", "BOARD"]);
  });
});