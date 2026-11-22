// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { keepFromWidgetMenu, WIDGET_MENU_ATTRIBUTE } from "./widgetmenu.ts";

afterEach(() => document.body.replaceChildren());

/** A card as SilverBullet's edge makes one for a code block's widget: its content first, registered after */
function card(content: Element): HTMLElement {
  const div = document.createElement("div");
  div.append(content);
  return div;
}

describe("A widget of ours kept out of SilverBullet's widget menu", () => {
  it("its card registered once it is in the page (a code block's widget): taken out, and again as it is registered anew", async () => {
    const ours = document.createElement("div");
    keepFromWidgetMenu(ours);
    const around = card(ours);
    document.body.append(around);
    around.setAttribute(WIDGET_MENU_ATTRIBUTE, "block");
    await vi.waitFor(() => expect(around.hasAttribute(WIDGET_MENU_ATTRIBUTE)).toBe(false));
    // (Drawn anew: registered again, taken out again)
    around.setAttribute(WIDGET_MENU_ATTRIBUTE, "block");
    await vi.waitFor(() => expect(around.hasAttribute(WIDGET_MENU_ATTRIBUTE)).toBe(false));
  });

  it("a card registered before it is in the page (a table, itself the card): taken out as it is found", () => {
    const table = document.createElement("span");
    table.setAttribute(WIDGET_MENU_ATTRIBUTE, "block");
    document.body.append(table);
    keepFromWidgetMenu(table);
    expect(table.hasAttribute(WIDGET_MENU_ATTRIBUTE)).toBe(false);
  });

  it("every other widget keeps its menu, a card round ours further out too (an embed holding a widget of ours)", async () => {
    const others = card(document.createElement("div"));
    const ours = document.createElement("div");
    keepFromWidgetMenu(ours);
    const inner = card(ours);
    const embed = card(inner);
    document.body.append(others, embed);
    for (const one of [others, embed, inner]) one.setAttribute(WIDGET_MENU_ATTRIBUTE, "block");
    await vi.waitFor(() => expect(inner.hasAttribute(WIDGET_MENU_ATTRIBUTE)).toBe(false));
    expect(others.hasAttribute(WIDGET_MENU_ATTRIBUTE)).toBe(true);
    expect(embed.hasAttribute(WIDGET_MENU_ATTRIBUTE)).toBe(true);
  });
});
