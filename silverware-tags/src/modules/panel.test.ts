import { describe, expect, it } from "vitest";
import { readCatalog } from "../core/catalog.ts";
import type { ModuleHost } from "../core/module.ts";
import { PANEL_OFFER, type PanelOffer, RENAME_OFFER, type RenameOffer } from "../core/offers.ts";
import { memorySpace } from "../space/memory.ts";
import { panelModule, panelRows } from "./panel.ts";

/** A host recording what the panel asks of it; the rename module's offer where `rename` is given */
function host(rename?: RenameOffer) {
  const offers = new Map<string, unknown>(rename ? [[RENAME_OFFER, rename]] : []);
  const calls: string[] = [];
  const h: ModuleHost = {
    doc: undefined as unknown as Document,
    space: memorySpace({ A: "#project/alpha\n\n- [ ] do #todo", B: "#project/beta #todo" }),
    notifier: { flash: (message) => void calls.push(`flash ${message}`) },
    open: async (view, state) => void calls.push(`open ${view} ${JSON.stringify(state)}`),
    review: async () => undefined,
    offer: (name, api) => void offers.set(name, api),
    offered: <T>(name: string) => offers.get(name) as T | undefined,
  };
  panelModule(h);
  return { panel: offers.get(PANEL_OFFER) as PanelOffer, calls, space: h.space };
}

describe("the tags' panel", () => {
  it("gives a row per tag with its pages and where it is used", async () => {
    const { space } = host();
    const rows = panelRows((await readCatalog(space)).tags.values());
    expect(rows.map((r) => [r.name, r.label, r.count, r.onPages, r.inTasks])).toEqual([
      ["project/alpha", "alpha", 1, true, false],
      ["project/beta", "beta", 1, true, false],
      ["todo", "todo", 2, true, true],
    ]);
  });
  it("opens the window at a tag picked, with its name's field for F2", async () => {
    const { panel, calls } = host();
    await panel.select("todo");
    await panel.rename("todo");
    expect(calls).toEqual(['open tags "todo"', 'open tags {"tag":"todo","focus":"name"}']);
  });
  it("moves a tag through the rename module's offer, refused and said without it", async () => {
    const reviewed: string[] = [];
    const { panel } = host({ review: async (from, to) => void reviewed.push(`${from} > ${to}`), problem: () => undefined });
    await panel.move("todo", "project/todo");
    expect(reviewed).toEqual(["todo > project/todo"]);
    const off = host();
    await off.panel.move("todo", "project/todo");
    expect(off.calls[0]).toMatch(/Rename is turned off/);
  });
});
