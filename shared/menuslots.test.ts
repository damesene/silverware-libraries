import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import type { MenuEntry } from "./menu.ts";
import { customSections, type MenuGroup, menuBuilder, slotEntries } from "./menuslots.ts";

const labels = (entries: readonly MenuEntry[]) => entries.map((one) => (one.kind === "item" ? one.label : one.kind));

describe("a menu's slots", () => {
  it("make groups in the slots a menu names, and sections of their own, its entries asked by slot", () => {
    const opened: string[] = [];
    const menu = menuBuilder(["view", "data"] as const, (title) => void opened.push(title));
    const groups: MenuGroup<"view" | "data">[] = [
      menu.slot.data([menu.item({ label: "Properties", run: () => {} })]),
      menu.slot.view([menu.item({ label: "Group by", run: () => {} })]),
      menu.slot.custom({ name: "Mine", position: "primary" }, [menu.item({ label: "Mine", run: () => {} })]),
      menu.slot.view([menu.separator()]),
    ];
    expect(labels(slotEntries(groups, "view"))).toEqual(["Group by", "separator"]);
    expect(labels(slotEntries(groups, "data"))).toEqual(["Properties"]);
    expect(customSections(groups, "primary").map(labels)).toEqual([["Mine"]]);
    // A submenu: its entries made as it is chosen, shown in the menu's place under its label
    const sub = menu.submenu({ label: "Group by" }, () => []);
    if (sub.kind === "item") sub.run();
    expect(opened).toEqual(["Group by"]);
  });

  it("keeps no state of its own: every builder and group made for one menu, nothing one plugin adds reaching another's", () => {
    // (Bundled into each plugin apart; a module-level variable would still be shared by every menu of one plugin)
    const source = readFileSync(join(import.meta.dirname, "menuslots.ts"), "utf8");
    const topLevel = source.split("\n").filter((line) => /^(export\s+)?(let|var)\s|^(export\s+)?const\s+\w+\s*=\s*(new\s|\[|\{)/.test(line));
    expect(topLevel).toEqual([]);
  });

  it("is reached by no plugin through another's code: each plugin imports its own and shared/ alone", () => {
    const root = join(import.meta.dirname, "..");
    const plugins = readdirSync(root).filter((name) => name.startsWith("silverware-"));
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? sources(join(dir, entry.name)) : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : []));
    const crossing = plugins.flatMap((plugin) =>
      sources(join(root, plugin, "src")).flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(/(?:\bfrom\s+|^import\s+|\bimport\(\s*)["']([^"']+)["']/gm)]
          .map((m) => relative(root, join(file, "..", m[1]!)).replace(/\\/g, "/"))
          .filter((path) => path.startsWith("silverware-") && !path.startsWith(`${plugin}/`))
          .map((path) => `${relative(root, file)} → ${path}`),
      ),
    );
    expect(plugins.length).toBeGreaterThan(1);
    expect(crossing).toEqual([]);
  });
});
