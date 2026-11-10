// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Drawing, svgOf } from "./draw.ts";
import { Registry } from "./registry.ts";
import type { DrawData, SearchData, SetEntry } from "./set.ts";

const ENTRIES: SetEntry[] = [
  { name: "lucide", label: "Icons", kind: "svg", license: "ISC", draw: "lucide.js", search: "lucide-search.js" },
  { name: "emoji", label: "Emoji", kind: "text", license: "MIT", search: "emoji-search.js" },
];
const DRAW: DrawData = { icons: { house: ["M3 10h18"], dot: [["circle", { cx: "12", cy: "12", r: "1" }]] }, aliases: { home: "house" } };
const SEARCH: SearchData = { groups: [{ id: "home", label: "Home", icon: "lucide:house" }], icons: [["house", "A house", "home", ["home"]]] };

/** A registry and its drawing over `document`, its files given when `release` is called */
function setup() {
  let release: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => (release = resolve));
  const load = vi.fn(async (file: string) => {
    await ready;
    return file === "lucide.js" ? DRAW : SEARCH;
  });
  const registry: Registry = new Registry(ENTRIES, load, (on) => drawing.loading(on), () => drawing.fill());
  const drawing: Drawing = new Drawing(registry, () => document);
  return { drawing, registry, load, release: async () => {
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } };
}

describe("An icon's markup", () => {
  it("text as itself, escaped, in the caller's box", () => {
    const { drawing } = setup();
    expect(drawing.markup("🏠", "swb")).toBe('<span class="swb-icon swi-icon">🏠</span>');
    expect(drawing.markup("<b>", "swb")).toBe('<span class="swb-icon swi-icon">&lt;b&gt;</span>');
    expect(drawing.text("H1")).toBe("H1");
  });

  it("a set's icon: a placeholder while its set loads (loaded once), filled in the page once it is in; drawn at once after", async () => {
    const { drawing, load, release } = setup();
    document.body.innerHTML = drawing.markup("lucide:house", "swb");
    const box = document.body.firstElementChild as HTMLElement;
    expect(box.dataset.swiState).toBe("pending");
    expect(box.innerHTML).toBe("");
    drawing.markup("lucide:dot", "swd");
    expect(load).toHaveBeenCalledTimes(1);
    await release();
    expect(box.dataset.swiState).toBe("drawn");
    expect(box.querySelector("path")?.getAttribute("d")).toBe("M3 10h18");
    expect(drawing.markup("lucide:dot", "swd")).toContain('<circle cx="12" cy="12" r="1"/>');
  });

  it("a placeholder added to the page while its set loads is filled too", async () => {
    const { drawing, release } = setup();
    const made = drawing.markup("lucide:house", "swb");
    const later = document.createElement("div");
    later.innerHTML = made;
    await release();
    document.body.append(later);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(later.querySelector("[data-swi-icon]")?.getAttribute("data-swi-state")).toBe("drawn");
  });

  it("a name it had (an alias) drawn as its icon; one no set has, a stand-in saying why", async () => {
    const { drawing, release } = setup();
    drawing.markup("lucide:home", "swb");
    await release();
    expect(drawing.markup("lucide:home", "swb")).toContain("M3 10h18");
    expect(drawing.markup("lucide:nope", "swb")).toContain('title="No icon nope in lucide"');
    expect(drawing.markup("lucide:nope", "swb")).toContain("swi-missing");
    expect(drawing.markup("other:house", "swb")).toContain('title="No set of icons other"');
    expect(drawing.markup("emoji:house", "swb")).toContain("swi-missing");
  });

  it("an icon as text: its label once its set's picking data is in (not loaded for it), else made of its name", async () => {
    const { drawing, registry, load, release } = setup();
    expect(drawing.text("lucide:house")).toBe("House");
    expect(load).not.toHaveBeenCalled();
    const loaded = registry.searchLoaded("lucide");
    await release();
    expect((await loaded)?.icons).toHaveLength(1);
    expect(drawing.text("lucide:house")).toBe("A house");
    expect(drawing.text("lucide:arrow-big-down")).toBe("Arrow big down");
  });
});

describe("An icon's SVG", () => {
  it("of its nodes, the elements and attributes allowed only, values escaped", () => {
    const svg = svgOf(["M1 1", ["rect", { x: "1", onload: "alert(1)", style: "x" }], ["script", { src: "x" }], ["circle", { r: '1"/><script>' }]]);
    expect(svg).toContain('<path d="M1 1"/><rect x="1"/><circle r="1&quot;/&gt;&lt;script&gt;"/>');
    expect(svg).not.toContain("onload");
    expect(svg).not.toContain("<script");
    expect(svg).toContain('stroke="currentColor"');
  });
});

describe("The user's sets", () => {
  it("defined: drawn at once, the page's placeholders of it filled; a built-in one's name replaced", () => {
    const { drawing, registry } = setup();
    document.body.innerHTML = drawing.markup("mine:star", "swb");
    const { problems } = registry.define({ name: "mine", label: "Mine", kind: "svg", icons: [{ name: "star", nodes: ["M0 0"], keywords: ["fav"] }] });
    drawing.fill();
    expect(problems).toEqual([]);
    expect(document.body.firstElementChild?.getAttribute("data-swi-state")).toBe("drawn");
    expect(registry.sets().map((set) => set.name)).toEqual(["lucide", "emoji", "mine"]);
    registry.define({ name: "lucide", label: "Mine too", kind: "svg", icons: [{ name: "house", nodes: ["M9 9"] }] });
    expect(registry.sets().map((set) => set.label)).toEqual(["Mine too", "Emoji", "Mine"]);
    expect(drawing.markup("lucide:house", "swb")).toContain("M9 9");
  });

  it("what is wrong said, an icon left out, a set refused whole; made anew as Space Lua loads again, those of before kept until then", () => {
    const { drawing, registry } = setup();
    expect(registry.define({ name: "Bad Name", label: "x", kind: "svg", icons: [] }).problems[0]).toContain("lower case");
    const { problems } = registry.define({ name: "mine", label: "Mine", kind: "svg", icons: [{ name: "a", nodes: [["image", { href: "x" }]] }, { name: "b", nodes: ["M0 0"] }, { name: "b", nodes: ["M1 1"] }] });
    expect(problems).toEqual(["the set mine: the icon a: <image> is not drawn (only path, circle, rect, line, polyline, polygon, ellipse)", "the set mine: b twice"]);
    expect(registry.define({ name: "mine", label: "Mine", kind: "svg", icons: [{ name: "b", nodes: ["M0 0"] }] }).again).toEqual(["mine"]);
    registry.anewDefinitions();
    expect(drawing.markup("mine:b", "swb")).toContain("M0 0");
    registry.define({ name: "other", label: "Other", kind: "text", icons: [{ name: "★" }] });
    expect(drawing.markup("mine:b", "swb")).toContain("swi-missing");
  });
});
