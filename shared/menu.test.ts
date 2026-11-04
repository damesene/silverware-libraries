// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { menuItem, menuSeparator, renderMenu } from "./menu.ts";

describe("The shared menu", () => {
  it("shows a separator only between entries: none at its ends nor after another (sections between left out)", () => {
    const item = (label: string) => menuItem({ label, run: () => undefined });
    const menu = renderMenu(document, { base: "x" }, "Menu", [menuSeparator(), item("a"), menuSeparator(), menuSeparator(), item("b"), menuSeparator()]);
    const shown = [...menu.querySelectorAll(".x-menu-item, .x-menu-separator")].map((e) => (e.classList.contains("x-menu-separator") ? "---" : e.textContent));
    expect(shown).toEqual(["a", "---", "b"]);
  });
});
