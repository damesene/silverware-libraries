import { describe, expect, it } from "vitest";
import { BUILT_IN_SETS } from "./manifest.ts";
import type { DrawData, SearchData } from "./set.ts";

// The files beside the bundle, as the build wrote them (plain modules: no types of their own)
const load = async (file: string): Promise<unknown> => ((await import(new URL(`../${file}`, import.meta.url).href)) as { default: unknown }).default;
const draw = (await load("silverware-icons-lucide.js")) as DrawData;
const sets: Record<string, SearchData> = {
  lucide: (await load("silverware-icons-lucide-search.js")) as SearchData,
  emoji: (await load("silverware-icons-emoji-search.js")) as SearchData,
};

describe("The built-in sets' data", () => {
  it("are the manifest's sets, a file each for picking and an SVG set's for drawing", () => {
    expect(BUILT_IN_SETS.map((set) => [set.name, set.kind, set.draw, set.search])).toEqual([
      ["lucide", "svg", "silverware-icons-lucide.js", "silverware-icons-lucide-search.js"],
      ["emoji", "text", undefined, "silverware-icons-emoji-search.js"],
    ]);
  });

  it("each group's icon one of its set's (Lucide's: not always of that category); every icon in a group the set has", () => {
    for (const [name, set] of Object.entries(sets)) {
      const ids = new Set(set.groups.map((group) => group.id));
      for (const icon of set.icons) for (const group of icon[3]) expect(ids.has(group), `${name}: ${icon[0]}'s ${group}`).toBe(true);
      for (const group of set.groups) {
        const own = name === "emoji" ? group.icon : group.icon.replace(/^lucide:/, "");
        expect(set.icons.some((icon) => icon[0] === own), `${name}: ${group.id}`).toBe(true);
      }
    }
  });

  it("Lucide's: every icon drawn and picked alike, of the elements and attributes Lucide draws with; its aliases to its icons", () => {
    expect(Object.keys(draw.icons)).toEqual(sets.lucide!.icons.map((icon) => icon[0]));
    for (const nodes of Object.values(draw.icons))
      for (const node of nodes) {
        if (typeof node === "string") continue;
        expect(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]).toContain(node[0]);
        for (const attr of Object.keys(node[1])) expect(["d", "cx", "cy", "r", "x", "y", "width", "height", "rx", "ry", "x1", "x2", "y1", "y2", "fill", "points"]).toContain(attr);
      }
    for (const [alias, name] of Object.entries(draw.aliases)) {
      expect(draw.icons[name], alias).toBeDefined();
      expect(draw.icons[alias], alias).toBeUndefined();
    }
    expect(draw.aliases.home).toBe("house");
  });

  it("Lucide's icons by name, each with its label and keywords: house", () => {
    expect(sets.lucide!.icons.find((icon) => icon[0] === "house")).toEqual(["house", "House", expect.stringContaining("home"), expect.arrayContaining(["home"])]);
    expect(sets.lucide!.groups.length).toBeGreaterThan(10);
    expect(sets.emoji!.groups.length).toBeLessThanOrEqual(10);
  });
});
