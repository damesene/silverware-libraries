// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Drawing } from "./draw.ts";
import { picker } from "./picker.ts";
import { Registry } from "./registry.ts";
import type { DrawData, SearchData, SetEntry } from "./set.ts";

const ENTRIES: SetEntry[] = [
  { name: "lucide", label: "Icons", kind: "svg", license: "ISC", draw: "lucide.js", search: "lucide-search.js" },
  { name: "emoji", label: "Emoji", kind: "text", license: "MIT", search: "emoji-search.js" },
];
const ids = Array.from({ length: 12 }, (_, i) => `g${i}`);
const FILES: Record<string, DrawData | SearchData> = {
  "lucide.js": { icons: { house: ["M1 1"], "arrow-up": ["M2 2"] }, aliases: {} },
  "lucide-search.js": {
    groups: ids.map((id) => ({ id, label: `Group ${id}`, icon: "lucide:house" })),
    icons: [
      ["house", "House", "home building", ["g0"]],
      ["arrow-up", "Arrow up", "direction", ["g1"]],
    ],
  },
  "emoji-search.js": {
    groups: [
      { id: "smileys", label: "Smileys", icon: "😀" },
      { id: "food", label: "Food", icon: "🍔" },
    ],
    icons: [
      ["😀", "grinning face", "smile", ["smileys"]],
      ["🍔", "hamburger", "burger", ["food"]],
    ],
  },
};

async function open(options: { sets?: string[] } = {}) {
  const registry: Registry = new Registry(ENTRIES, async (file) => FILES[file], (on) => drawing.loading(on), () => drawing.fill());
  const drawing: Drawing = new Drawing(registry, () => document);
  const into = document.createElement("div");
  document.body.replaceChildren(into);
  const picked = vi.fn();
  const shown = vi.fn();
  picker(registry, drawing, into, { ...options, picked, shown });
  await vi.waitFor(() => expect(shown).toHaveBeenCalled());
  const items = () => [...into.querySelectorAll<HTMLButtonElement>(".swi-item")].map((b) => b.dataset.swiValue);
  const field = into.querySelector<HTMLInputElement>(".swi-field")!;
  const type = (text: string) => {
    field.value = text;
    field.dispatchEvent(new Event("input"));
  };
  return { into, picked, shown, items, field, type };
}

beforeEach(() => localStorage.clear());

describe("The picker", () => {
  it("a tab per set, the first open; an SVG set's icons by their reference, its many groups a dropdown", async () => {
    const { into, items } = await open();
    expect([...into.querySelectorAll(".swi-set")].map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])).toEqual([
      ["Icons", "true"],
      ["Emoji", "false"],
    ]);
    expect(items()).toEqual(["lucide:house", "lucide:arrow-up"]);
    expect(into.querySelector(".swi-item svg path")?.getAttribute("d")).toBe("M1 1");
    const select = into.querySelector<HTMLSelectElement>(".swi-group-select")!;
    expect(select.options).toHaveLength(13);
    expect(into.querySelector<HTMLElement>(".swi-groups")!.hidden).toBe(true);
    select.value = "g1";
    select.dispatchEvent(new Event("change"));
    expect(items()).toEqual(["lucide:arrow-up"]);
  });

  it("a set of few groups: a row of their icons, its icons by their character, in their groups", async () => {
    const { into, items } = await open();
    into.querySelector<HTMLButtonElement>('.swi-set[data-swi-set="emoji"]')!.click();
    await vi.waitFor(() => expect(items()).toEqual(["😀", "🍔"]));
    expect(into.querySelector(".swi-group-select")).toBeNull();
    expect([...into.querySelectorAll(".swi-group")].map((b) => b.getAttribute("aria-label"))).toEqual(["All", "Smileys", "Food"]);
    expect([...into.querySelectorAll(".swi-section")].map((s) => s.textContent)).toEqual(["Smileys", "Food"]);
    into.querySelectorAll<HTMLButtonElement>(".swi-group")[2]!.click();
    expect(items()).toEqual(["🍔"]);
  });

  it("the search by label and keywords; Enter picks the current one, as written; used last first, the tab used last open next time", async () => {
    const first = await open();
    first.type("building");
    expect(first.items()).toEqual(["lucide:house"]);
    first.field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(first.picked).toHaveBeenCalledWith("lucide:house");
    first.into.querySelector<HTMLButtonElement>('.swi-set[data-swi-set="emoji"]')!.click();
    await vi.waitFor(() => expect(first.items()).toEqual(["😀", "🍔"]));
    const again = await open();
    expect(again.into.querySelector('.swi-set[aria-selected="true"]')?.textContent).toBe("Emoji");
    again.into.querySelector<HTMLButtonElement>('.swi-set[data-swi-set="lucide"]')!.click();
    await vi.waitFor(() => expect(again.items()).toEqual(["lucide:house", "lucide:house", "lucide:arrow-up"]));
    expect(again.into.querySelector(".swi-section")?.textContent).toBe("Used last");
  });

  it("narrowed to sets: one, no tabs", async () => {
    const { into, items } = await open({ sets: ["emoji"] });
    expect(into.querySelector(".swi-sets")).toBeNull();
    expect(items()).toEqual(["😀", "🍔"]);
  });

  it("the emoji pickers' lists of before read into its own once, then removed", async () => {
    localStorage.setItem("silverware.toolbar.recentEmoji", JSON.stringify(["🍔"]));
    localStorage.setItem("silverware.database.recentEmoji", JSON.stringify(["😀", "🍔"]));
    const { into, items } = await open({ sets: ["emoji"] });
    expect(items().slice(0, 2)).toEqual(["🍔", "😀"]);
    expect(into.querySelector(".swi-section")?.textContent).toBe("Used last");
    expect(localStorage.getItem("silverware.toolbar.recentEmoji")).toBeNull();
    expect(localStorage.getItem("silverware.database.recentEmoji")).toBeNull();
  });
});
