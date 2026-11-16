// @vitest-environment jsdom
// A popup menu: opened by its trigger, closed by a press beside it; the document watched only while it is open, so a
// trigger drawn anew and thrown away (a grid's cell's "…", each time the grid is drawn) leaves no listener behind.
import { afterEach, describe, expect, it, vi } from "vitest";
import { opensMenu } from "./popupmenu.ts";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const LOOK = { base: "swa-xlsx" } as const;
const menu = () => ({ title: "Menu", sections: [[{ label: "One", run: () => undefined }]] });

describe("a popup menu", () => {
  it("watches the document for a press beside it only while it is open", () => {
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const trigger = document.body.appendChild(document.createElement("button"));
    opensMenu(document, LOOK, trigger, menu);
    expect(added.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(0);
    trigger.click();
    expect(document.querySelector(".swa-xlsx-popup")).not.toBeNull();
    expect(added.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(1);
    // A press beside it: closed, the document no longer watched
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.querySelector(".swa-xlsx-popup")).toBeNull();
    expect(removed.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(1);
  });

  it("closes on a second press of its trigger, and as its signal aborts", () => {
    const trigger = document.body.appendChild(document.createElement("button"));
    const control = new AbortController();
    opensMenu(document, LOOK, trigger, menu, control.signal);
    trigger.click();
    trigger.click();
    expect(document.querySelector(".swa-xlsx-popup")).toBeNull();
    trigger.click();
    control.abort();
    expect(document.querySelector(".swa-xlsx-popup")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Esc wherever the focus is, the key no one else's, and listens for it only while open", () => {
    const trigger = document.body.appendChild(document.createElement("button"));
    const field = document.body.appendChild(document.createElement("input"));
    const removed = vi.spyOn(document, "removeEventListener");
    opensMenu(document, LOOK, trigger, menu);
    trigger.click();
    field.focus();
    const heard = vi.fn();
    field.addEventListener("keydown", heard);
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".swa-xlsx-popup")).toBeNull();
    expect(heard).not.toHaveBeenCalled();
    expect(removed.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
  });

  it("opens over what opened it where it has no room under it and has above it, under it else", () => {
    const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 300, right: 330, width: 30, height, x: 300, y: top, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    // (jsdom lays nothing out: the menu 200 px high as a browser would make it)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("swa-xlsx-popup") ? rect(0, 200) : rect(Number(this.dataset.top), 20);
    });
    const low = document.body.appendChild(document.createElement("button"));
    low.dataset.top = "700";
    opensMenu(document, LOOK, low, menu);
    low.click();
    expect(document.querySelector<HTMLElement>(".swa-xlsx-popup")!.style.top).toBe(`${700 - 4 - 200}px`);
    low.click();
    const high = document.body.appendChild(document.createElement("button"));
    high.dataset.top = "100";
    opensMenu(document, LOOK, high, menu);
    high.click();
    expect(document.querySelector<HTMLElement>(".swa-xlsx-popup")!.style.top).toBe(`${100 + 20 + 4}px`);
    high.click();
    // Room neither under nor over it (a phone held sideways): as low as it fits, in the window
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(360);
    const middle = document.body.appendChild(document.createElement("button"));
    middle.dataset.top = "180";
    opensMenu(document, LOOK, middle, menu);
    middle.click();
    expect(document.querySelector<HTMLElement>(".swa-xlsx-popup")!.style.top).toBe(`${360 - 200 - 8}px`);
  });
});
