// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { besideNavPanels, navPanelOverPage, watchNavPanels } from "./navpanels.ts";

/** A panel as SilverBullet's navigator, at a place on screen (jsdom lays nothing out), put in the document or `into` */
function panel(left: number, right: number, side = "lhs", into: Element = document.body): HTMLElement {
  const element = document.createElement("div");
  element.className = `sb-nav-root sb-nav-root-${side}`;
  element.getBoundingClientRect = () => new DOMRect(left, 0, right - left, 800);
  into.append(element);
  return element;
}

const VIEW = { left: 0, right: 412, top: 56, bottom: 794 };

afterEach(() => document.body.replaceChildren());

describe("a panel over the page's editor", () => {
  /** SilverBullet's editor where it is on screen */
  function editor(left: number, right: number): void {
    const main = Object.assign(document.createElement("div"), { id: "sb-main" });
    const element = document.createElement("div");
    element.className = "cm-editor";
    element.getBoundingClientRect = () => new DOMRect(left, 56, right - left, 738);
    main.append(element);
    document.body.append(main);
  }

  it("is told where one lies over part of the editor (a phone's space tree), not where it is docked beside it", () => {
    editor(0, 412);
    expect(navPanelOverPage(document)).toBe(false);
    panel(0, 368);
    expect(navPanelOverPage(document)).toBe(true);
    document.body.replaceChildren();
    // (A wider window: the tree docked, the editor beside it)
    editor(300, 1400);
    panel(0, 300);
    expect(navPanelOverPage(document)).toBe(false);
  });

  it("is none without an editor laid out", () => {
    panel(0, 368);
    expect(navPanelOverPage(document)).toBe(false);
  });
});

describe("the page's view beside SilverBullet's panels", () => {
  it("is the view where no panel lies over it, one beside it (docked, the editor beside it) too", () => {
    expect(besideNavPanels(VIEW, document)).toEqual(VIEW);
    panel(-260, 0);
    expect(besideNavPanels(VIEW, document)).toEqual(VIEW);
  });

  it("starts after a panel over its left part, ends before one over its right part", () => {
    panel(0, 368);
    expect(besideNavPanels(VIEW, document)).toEqual({ ...VIEW, left: 368 });
    document.body.replaceChildren();
    panel(300, 412, "rhs");
    expect(besideNavPanels(VIEW, document)).toEqual({ ...VIEW, right: 300 });
  });

  it("is none where a panel lies in its middle, at neither edge (placed elsewhere than a side)", () => {
    panel(100, 300);
    const none = besideNavPanels(VIEW, document);
    expect(none.right - none.left).toBe(0);
  });

  it("is none where a panel lies over all of it, and leaves out one not shown", () => {
    panel(0, 412);
    const none = besideNavPanels(VIEW, document);
    expect(none.right - none.left).toBe(0);
    document.body.replaceChildren();
    panel(0, 0);
    expect(besideNavPanels(VIEW, document)).toEqual(VIEW);
    // (There, but unseen: sliding in from nothing)
    panel(0, 368).style.opacity = "0";
    expect(besideNavPanels(VIEW, document)).toEqual(VIEW);
  });

  it("tells a panel put in and taken out, and one's sliding ended, until its watch ends", async () => {
    const told = vi.fn();
    const stop = watchNavPanels(document, told);
    const one = panel(0, 368);
    await vi.waitFor(() => expect(told).toHaveBeenCalledTimes(1));
    one.dispatchEvent(new Event("transitionend", { bubbles: true }));
    expect(told).toHaveBeenCalledTimes(2);
    one.remove();
    await vi.waitFor(() => expect(told).toHaveBeenCalledTimes(3));
    // (Something else of the page: nothing told)
    // (A macrotask: every mutation record of before is delivered by then)
    document.body.append(document.createElement("p"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(told).toHaveBeenCalledTimes(3);
    stop();
    panel(0, 368);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(told).toHaveBeenCalledTimes(3);
  });

  it("tells a panel put in with the element holding it (SilverBullet's main element drawn anew), not one deeper in what is put in", async () => {
    const told = vi.fn();
    const stop = watchNavPanels(document, told);
    const main = Object.assign(document.createElement("div"), { id: "sb-main" });
    panel(0, 368, "lhs", main);
    document.body.append(main);
    await vi.waitFor(() => expect(told).toHaveBeenCalledTimes(1));
    // (Two levels down in a node put in: not looked for)
    const deep = document.createElement("div");
    deep.append(document.createElement("div"));
    panel(0, 368, "lhs", deep.firstElementChild!);
    document.body.append(deep);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(told).toHaveBeenCalledTimes(1);
    stop();
  });
});
