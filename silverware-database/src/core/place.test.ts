// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { TypeRegistry } from "../domain/types/registry.ts";
import type { Database } from "../model/database.ts";
import { MemoryStore } from "../store/memory.ts";
import { MemoryViewState } from "../store/viewstate.ts";
import { DatabaseCore } from "./core.ts";
import { DatabasePlace, FILTER_TYPED_MS, VIEW_KEY, viewSettingPath } from "./place.ts";
import type { ViewDefinition, ViewHost } from "./view.ts";
import { ViewRegistry } from "./views.ts";

const TASKS: Database = {
  id: "tasks",
  name: "Tasks",
  properties: [{ key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false }],
};


/** The items of the place's menu shown now: each its label (with its value) and whether it is checked */
const menuShown = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>(".swd-menu .swd-menu-item")].map((one) => [one.querySelector(".swd-label")!.textContent, one.getAttribute("aria-checked")]);
/** An item of the place's menu chosen by its label (its value after it left out) */
const choose = (root: ParentNode, label: string) => {
  const item = [...root.querySelectorAll<HTMLElement>(".swd-menu .swd-menu-item")].find((one) => one.querySelector(".swd-label")!.textContent!.split(": ")[0] === label);
  if (!item) throw new Error(`No item "${label}" in the menu`);
  item.click();
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
  const told: string[] = [];
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
    ui: { notify: (message) => void told.push(message) },
    editor: { open: (ref) => void opened.push(ref) },
    ...(editSource ? { editSource } : {}),
  });
  const listed = () => [...element.querySelectorAll("li")].map((one) => one.textContent);
  // The views on, as the picker's menu lists them (opened for it): each item's view (a test view's label is its name in capitals)
  const switches = () => {
    const picker = element.querySelector<HTMLButtonElement>(".swd-view-picker")!;
    if (picker.getAttribute("aria-expanded") !== "true") picker.click();
    return [...element.querySelectorAll<HTMLElement>(".swd-menu .swd-menu-item")].map((item) => Object.assign(item, { view: item.querySelector(".swd-label")!.textContent!.toLowerCase() }));
  };
  return { store, element, viewState, place, listed, switches, opened, core, told };
}

describe("a place", () => {
  it("draws the view its state names, the picker listing the views on, the one shown checked", async () => {
    const [table, board] = [listView("table"), listView("board")];
    const { place, listed, switches, element } = setup([table.view, board.view], { [VIEW_KEY]: "board" });
    await place.render();
    expect(element.querySelector<HTMLElement>(".swd-view-picker")!.dataset.view).toBe("board");
    expect(switches().map((one) => [one.view, one.getAttribute("aria-checked")])).toEqual([
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
    expect(first.switches().map((one) => one.view)).toEqual(["board"]);
    const missing = setup([table.view], { [VIEW_KEY]: "calendar" });
    await missing.place.render();
    expect(missing.element.querySelector(".swd-place-note")!.textContent).toContain('No view "calendar"');
    expect(missing.switches()).toHaveLength(1);
  });

  it("closes the picker's menu as the place is drawn anew, and offers none where no view is on", async () => {
    const [table, board] = [listView("table"), listView("board")];
    const { place, switches, element } = setup([table.view, board.view]);
    await place.render();
    expect(switches()).toHaveLength(2);
    await place.render();
    expect(element.querySelectorAll(".swd-menu .swd-menu-item")).toHaveLength(0);
    const none = setup([]);
    await none.place.render();
    const picker = none.element.querySelector<HTMLButtonElement>(".swd-view-picker")!;
    expect([picker.disabled, picker.title]).toEqual([true, "No view is on: turn one on in the settings"]);
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

  it("writes a value picked from a row drawn before its name was written, on the item as renamed; one changed elsewhere refused", async () => {
    const table = listView("table");
    const { place, store } = setup([table.view]);
    await place.render();
    const host = table.seen.host!;
    // The row as drawn: its name typed and left, a status picked at once from the same row
    const row = host.items[0]!;
    const renaming = host.rename(row, "Fix the login");
    const setting = host.update(row, "status", "Done");
    expect(await renaming).not.toHaveProperty("problem");
    expect(await setting).not.toHaveProperty("problem");
    const now = () => store.items("tasks").then(({ value }) => value.find((one) => one.key === row.key)!);
    expect(await now()).toMatchObject({ name: "Fix the login", values: { status: "Done" } });
    // A value the row shows changed elsewhere since: one from that row again is refused, never written over
    store.changeOutside("tasks", row.key, { values: { estimate: "5" } });
    expect(await host.update(row, "estimate", "8")).toHaveProperty("problem");
    expect((await now()).values.estimate).toBe("5");
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
    expect(menuShown(element)).toEqual([["Visible properties: All shown", null], ["Group: None", null], ["Color by: None", null]]);
    // Group, then Group by in its place: every property offered, and None, checked: nothing grouped yet
    choose(element, "Group");
    expect(menuShown(element)).toEqual([["Group by: None", null]]);
    choose(element, "Group by");
    expect(menuShown(element)).toEqual([
      ["None", "true"],
      ["Status", "false"],
    ]);
    choose(element, "Status");
    // (Chosen, the menu closed)
    expect(element.querySelector<HTMLElement>(".swd-more + .swd-menu")!.hidden).toBe(true);
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
    choose(element, "Group");
    choose(element, "Group by");
    choose(element, "None");
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

  it("offers Edit source last in ⋯ where the place is a block, none where it is not; a view's own entries in its slot", async () => {
    // A view of its own entry in the menu's slot `view`, one in a section of its own, first (primary)
    const ran: string[] = [];
    const table = listView("table");
    const view: ViewDefinition = {
      ...table.view,
      menu: (_host, menu) => [menu.slot.view([menu.item({ label: "Density", run: () => void ran.push("density") })]), menu.slot.custom({ name: "Mine", position: "primary" }, [menu.item({ label: "Mine", run: () => void ran.push("mine") })])],
    };
    let asked = 0;
    const { place, element } = setup([view], {}, {}, 0, () => void asked++);
    await place.render();
    element.querySelector<HTMLButtonElement>(".swd-more")!.click();
    expect(menuShown(element).map(([label]) => label)).toEqual(["Mine", "Visible properties: All shown", "Group: None", "Color by: None", "Density", "Edit source"]);
    choose(element, "Density");
    expect(ran).toEqual(["density"]);
    element.querySelector<HTMLButtonElement>(".swd-more")!.click();
    choose(element, "Edit source");
    expect(asked).toBe(1);
    // A view never grouped nor colored, showing no property, without a block: ⋯ still, its title the database's name to rename, no entry
    const without = setup([{ ...table.view, groupBy: false, colors: false, properties: false }]);
    await without.place.render();
    without.element.querySelector<HTMLButtonElement>(".swd-more")!.click();
    expect(menuShown(without.element)).toEqual([]);
    expect(without.element.querySelector(".swd-menu-title-text")!.textContent).toBe("Tasks");
  });

  it("renames the database by the pencil in ⋯'s title, its id kept; an empty name refused under the field", async () => {
    const table = listView("table");
    const { place, element, store } = setup([table.view]);
    document.body.append(element);
    await place.render();
    const rename = async (name: string) => {
      element.querySelector<HTMLButtonElement>(".swd-more")!.click();
      element.querySelector<HTMLButtonElement>(".swd-menu-rename")!.click();
      const field = element.querySelector<HTMLInputElement>(".swd-menu-name")!;
      expect(field.value).toBe((await store.database("tasks"))!.value.name);
      field.value = name;
      field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    };
    await rename("   ");
    expect(element.querySelector(".swd-menu-name-problem")!.textContent).toContain("needs a name");
    expect((await store.database("tasks"))!.value.name).toBe("Tasks");
    // Esc in the field leaves it, the menu staying
    element.querySelector(".swd-menu-name")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(element.querySelector<HTMLElement>(".swd-more + .swd-menu")!.hidden).toBe(false);
    element.querySelector<HTMLButtonElement>(".swd-menu-close")!.click();
    await rename("Jobs");
    expect((await store.database("tasks"))!.value).toMatchObject({ id: "tasks", name: "Jobs" });
    expect(element.querySelector(".swd-place-name")!.textContent).toBe("Jobs");
    expect(element.querySelector<HTMLElement>(".swd-more + .swd-menu")!.hidden).toBe(true);
    element.remove();
  });

  it("hands what it has open to the place drawn after it for its block: Group with the focus where it was, a filter as typed; no other place takes it", async () => {
    const table = listView("table");
    const { place, element, viewState, store, core } = setup([table.view], { "table.groupBy": "status" });
    document.body.append(element);
    await place.render();
    // As the binding does: the place that wrote hands over to the one drawn for the text it wrote, once (another takes nothing)
    let from: DatabasePlace | undefined = place;
    const next = async (takes = true) => {
      const box = document.createElement("div");
      document.body.append(box);
      const handing = takes ? from : undefined;
      const made = new DatabasePlace({ element: box, database: "tasks", state: viewState, store, core, types: new TypeRegistry(), views: new ViewRegistry([table.view]), settings: { get: (_path, fallback) => fallback }, ui: { notify: () => {} }, takeOver: () => handing?.handOver() });
      await made.render();
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (takes) from = made;
      return box;
    };
    element.querySelector<HTMLButtonElement>(".swd-more")!.click();
    choose(element, "Group");
    document.querySelector<HTMLButtonElement>(".swd-group-eye")!.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(viewState.get("table.groupHidden")).toEqual(['value:"Todo"']);
    expect([...element.querySelectorAll(".swd-group-label")].map((one) => one.textContent)).toEqual(["Done"]);
    // Another block of the database drawn meanwhile: nothing of it
    const other = await next(false);
    expect(other.querySelector<HTMLElement>(".swd-more + .swd-menu")!.hidden).toBe(true);
    other.remove();
    element.remove();
    const second = await next();
    expect(second.querySelector<HTMLElement>(".swd-more + .swd-menu")!.hidden).toBe(false);
    expect(document.activeElement).toBe([...second.querySelectorAll<HTMLElement>(".swd-group-row")].find((row) => row.dataset.group === 'value:"Todo"')!.querySelector(".swd-group-eye"));
    // Closed by the user: the place after it opens nothing
    second.querySelector(".swd-menu [role=menu]")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    // A filter typed, written after a pause, then more typed before the block is drawn anew: the next place has it all,
    // the panel open, the focus and the caret in the field, and applies it; the place before writes nothing more
    second.querySelector<HTMLButtonElement>(".swd-filter-button")!.click();
    const field = second.querySelector<HTMLInputElement>('.swd-filter input[data-key="name"]')!;
    field.focus();
    field.value = "F";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, FILTER_TYPED_MS + 30));
    expect(viewState.get("table.filter")).toEqual({ name: "F" });
    field.value = "Fi";
    field.setSelectionRange(1, 1);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    second.remove();
    const third = await next();
    expect(third.querySelector<HTMLElement>(".swd-more + .swd-menu")!.hidden).toBe(true);
    expect(third.querySelector<HTMLElement>(".swd-filter")!.hidden).toBe(false);
    const typed = third.querySelector<HTMLInputElement>('.swd-filter input[data-key="name"]')!;
    expect([typed.value, document.activeElement === typed, typed.selectionStart]).toEqual(["Fi", true, 1]);
    await new Promise((resolve) => setTimeout(resolve, FILTER_TYPED_MS + 30));
    expect(viewState.get("table.filter")).toEqual({ name: "Fi" });
    expect(typed.value).toBe("Fi");
    third.remove();
  });

  it("closes ⋯ by Esc, from a submenu too, the focus back on ⋯; a view's menu giving no groups said as it opens, the others shown", async () => {
    const table = listView("table");
    const broken: ViewDefinition = { ...table.view, menu: () => "nothing" as never };
    const { place, element, told } = setup([broken]);
    document.body.append(element);
    await place.render();
    expect(told).toEqual([]);
    const more = element.querySelector<HTMLButtonElement>(".swd-more")!;
    more.click();
    expect(told.at(-1)).toContain("its menu gave no list of groups");
    expect(menuShown(element).map(([label]) => label)).toEqual(["Visible properties: All shown", "Group: None", "Color by: None"]);
    choose(element, "Group");
    choose(element, "Group by");
    element.querySelector(".swd-menu [role=menu]")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(element.querySelector<HTMLElement>(".swd-more + .swd-menu")!.hidden).toBe(true);
    expect(document.activeElement).toBe(more);
    element.remove();
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