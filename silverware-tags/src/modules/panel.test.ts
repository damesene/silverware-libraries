import { describe, expect, it } from "vitest";
import { readCatalog } from "../core/catalog.ts";
import type { ModuleHost, PanelAction } from "../core/module.ts";
import { PANEL_OFFER, type PanelOffer, RENAME_OFFER, type RenameOffer } from "../core/offers.ts";
import { memorySpace } from "../space/memory.ts";
import { panelModule, panelRows } from "./panel.ts";

/**
 * A host recording what the panel asks of it; the rename module's offer where
 * `rename` is given; the row actions the panel's own and another module's (its
 * Rename, as the rename module gives it)
 */
function host(rename?: RenameOffer) {
  const offers = new Map<string, unknown>(rename ? [[RENAME_OFFER, rename]] : []);
  const calls: string[] = [];
  let own: readonly PanelAction[] = [];
  const other: PanelAction = { id: "rename.rename", icon: "edit-2", label: "Rename", key: "F2", order: 20, run: (tag) => calls.push(`rename ${tag}`) };
  const h: ModuleHost = {
    doc: undefined as unknown as Document,
    space: memorySpace({ A: "#project/alpha\n\n- [ ] do #todo", B: "#project/beta #todo" }),
    catalog: () => readCatalog(h.space),
    newTagsForm: "flow",
    notifier: { flash: (message) => void calls.push(`flash ${message}`) },
    open: async (view, state) => void calls.push(`open ${view} ${JSON.stringify(state)}`),
    review: async () => undefined,
    apply: async (operation) => void calls.push(`apply ${operation.label}`),
    // (The panel module's own host)
    offer: (api) => void offers.set(PANEL_OFFER, api),
    offered: <T>(name: string) => offers.get(name) as T | undefined,
    panelActions: () => [...own, other].sort((a, b) => (a.order ?? 50) - (b.order ?? 50)),
  };
  own = panelModule(h, { pageFirst: false }).panelActions?.() ?? [];
  return { panel: offers.get(PANEL_OFFER) as PanelOffer, calls, space: h.space };
}

describe("the tags' panel", () => {
  it("gives a row per tag and per level, with their pages and where they are used", async () => {
    const { space } = host();
    const rows = panelRows(await readCatalog(space));
    // A level counts the pages of the tags under it, each page once
    expect(rows.map((r) => [r.name, r.label, r.count, r.level, r.parent, r.onPages, r.inTasks])).toEqual([
      ["project", "project", 2, true, true, true, false],
      ["project/alpha", "alpha", 1, false, false, true, false],
      ["project/beta", "beta", 1, false, false, true, false],
      ["todo", "todo", 2, false, false, true, true],
    ]);
  });
  it("marks the page open's own tags (−, not +)", async () => {
    const { space } = host();
    const own = panelRows(await readCatalog(space), "A", new Set(["project/alpha"])).filter((r) => r.own).map((r) => r.name);
    expect(own).toEqual(["project/alpha"]);
  });
  it("marks the page open's tags, and a level holding one", async () => {
    const { space } = host();
    const here = panelRows(await readCatalog(space), "A").filter((r) => r.here).map((r) => r.name);
    expect(here).toEqual(["project", "project/alpha", "todo"]);
  });
  it("draws every module's row actions in their order, each offered where its row allows it", async () => {
    const { panel, space } = host();
    (space as { current?: string }).current = "A";
    expect(panel.actions().map((a) => [a.id, a.key])).toEqual([
      ["panel.add", undefined],
      ["panel.remove", undefined],
      ["rename.rename", "F2"],
      ["panel.open", undefined],
    ]);
    const rows = await panel.rows();
    // #todo is in a task of A, not one of its own tags: + offered; a level: no +
    expect(rows.find((r) => r.name === "todo")!.can).toEqual({ "panel.add": true, "panel.remove": false, "rename.rename": true, "panel.open": true });
    expect(rows.find((r) => r.name === "project")!.can!["panel.add"]).toBe(false);
  });
  it("opens the window at a row clicked twice soon after, not at one clicked once", async () => {
    const { panel, calls } = host();
    await panel.clicked("todo");
    await panel.clicked("idea");
    expect(calls).toEqual([]);
    await panel.clicked("idea");
    expect(calls).toEqual(['open tags "idea"']);
  });
  it("runs a row's action: the panel's own (+ applied at once, Open the window), another module's", async () => {
    const { panel, calls, space } = host();
    (space as { current?: string }).current = "B";
    await panel.run("panel.add", "idea");
    await panel.run("panel.open", "todo");
    await panel.run("rename.rename", "todo");
    expect(calls).toEqual(["apply Tags of B: add #idea", 'open tags "todo"', "rename todo"]);
  });
  it("moves a tag through the rename module's offer, refused and said without it", async () => {
    const reviewed: string[] = [];
    const { panel } = host({ review: async (from, to) => void reviewed.push(`${from} > ${to}`), problem: () => undefined, merge: () => { throw new Error("not here"); } });
    await panel.move("todo", "project/todo");
    expect(reviewed).toEqual(["todo > project/todo"]);
    const off = host();
    await off.panel.move("todo", "project/todo");
    expect(off.calls[0]).toMatch(/Rename is turned off/);
  });
  it("refuses to move a tag under itself", async () => {
    const reviewed: string[] = [];
    const { panel, calls } = host({ review: async (from, to) => void reviewed.push(`${from} > ${to}`), problem: () => undefined, merge: () => { throw new Error("not here"); } });
    await panel.move("project", "project/alpha/project");
    expect(reviewed).toEqual([]);
    expect(calls[0]).toMatch(/cannot move under itself/);
  });
});
