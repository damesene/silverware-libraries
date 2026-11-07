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

function setup(views: readonly ViewDefinition[], state: Record<string, unknown> = {}, settings: Record<string, unknown> = {}, slowSettings = 0) {
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