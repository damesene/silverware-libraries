// @vitest-environment jsdom
// A popup menu: opened by its trigger, closed by a press beside it; the document watched only while it is open, so a
// trigger drawn anew and thrown away (a grid's cell's "…", each time the grid is drawn) leaves no listener behind.
import { afterEach, describe, expect, it, vi } from "vitest";
import { opensMenu } from "./popupmenu.ts";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const LOOK = { base: "swx" } as const;
const menu = () => ({ title: "Menu", sections: [[{ label: "One", run: () => undefined }]] });

describe("a popup menu", () => {
  it("watches the document for a press beside it only while it is open", () => {
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const trigger = document.body.appendChild(document.createElement("button"));
    opensMenu(document, LOOK, trigger, menu);
    expect(added.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(0);
    trigger.click();
    expect(document.querySelector(".swx-popup")).not.toBeNull();
    expect(added.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(1);
    // A press beside it: closed, the document no longer watched
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.querySelector(".swx-popup")).toBeNull();
    expect(removed.mock.calls.filter(([type]) => type === "pointerdown")).toHaveLength(1);
  });

  it("closes on a second press of its trigger, and as its signal aborts", () => {
    const trigger = document.body.appendChild(document.createElement("button"));
    const control = new AbortController();
    opensMenu(document, LOOK, trigger, menu, control.signal);
    trigger.click();
    trigger.click();
    expect(document.querySelector(".swx-popup")).toBeNull();
    trigger.click();
    control.abort();
    expect(document.querySelector(".swx-popup")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
