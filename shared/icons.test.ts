// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ICONS_VERSION, type Icons, iconsOf, isReference, referenceOf } from "./icons.ts";

describe("An icon's value", () => {
  it("a reference by its form alone: a set's name and an icon's; anything else text (an emoji, H1, a colon in text)", () => {
    expect(referenceOf("lucide:house")).toEqual({ set: "lucide", name: "house" });
    expect(referenceOf("lucide:arrow-big-down")).toEqual({ set: "lucide", name: "arrow-big-down" });
    for (const text of ["🏠", "H1", "a:b c", "Lucide:house", ":house", "lucide:", "x:y:z"]) expect(isReference(text), text).toBe(false);
  });
});

describe("The icons a plugin gets", () => {
  const api: Icons = { version: ICONS_VERSION, markup: () => "<i>", text: () => "t", pick: () => () => undefined };

  it("Silverware Icons' API where it is there, of this version", () => {
    expect(iconsOf(api)).toBe(api);
    expect(iconsOf({ ...api, version: ICONS_VERSION + 1 })).not.toBe(api);
    expect(iconsOf({ version: ICONS_VERSION })).not.toBe(api);
  });

  it("else the stand-in: text as itself (escaped), an icon of a set a dotted box saying why, as text its name", () => {
    const icons = iconsOf(undefined);
    expect(icons.markup("🏠", "swb")).toBe('<span class="swb-icon">🏠</span>');
    expect(icons.markup("<b>", "swb")).toBe('<span class="swb-icon">&lt;b&gt;</span>');
    expect(icons.markup("lucide:house", "swb")).toBe('<span class="swb-icon swb-icon-missing" title="Needs Silverware Icons"></span>');
    expect(icons.text("lucide:house")).toBe("house");
    expect(icons.text("H1")).toBe("H1");
  });

  it("its picker's place says Silverware Icons is needed, with where it is", () => {
    const into = document.createElement("div");
    into.append("before");
    iconsOf(undefined).pick(into, { picked: () => undefined });
    expect(into.textContent).toBe("Emoji and icons need Silverware Icons. Install it as you installed this plugin.");
    expect(into.querySelector("a")?.getAttribute("href")).toContain("silverware-icons/silverware-icons.md");
  });
});
