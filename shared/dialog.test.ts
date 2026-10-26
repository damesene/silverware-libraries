// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Dialogs } from "./dialog.ts";
import { tabs } from "./tabs.ts";

describe("The shared dialog", () => {
  afterEach(() => document.body.replaceChildren());

  const dialogs = () => new Dialogs(document, { base: "x-dialog", backdropClass: "x-ui", closeIcon: "<svg></svg>" });
  const key = (target: Element, key: string) => target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  const content = (text = "Hello") => Object.assign(document.createElement("p"), { textContent: text });

  it("is made of the base's classes, its title its label, and takes the focus", () => {
    const dialog = dialogs().open({ title: "Settings", subtitle: "For all", content: content(), footer: document.createElement("button") });
    expect(document.querySelector(".x-ui.x-dialog-backdrop > .x-dialog")).toBe(dialog.element);
    expect(dialog.element.getAttribute("aria-label")).toBe("Settings");
    expect(Array.from(dialog.element.children, (c) => c.className)).toEqual(["x-dialog-head", "x-dialog-body", "x-dialog-foot"]);
    expect(dialog.element.querySelector(".x-dialog-subtitle")!.textContent).toBe("For all");
    expect(document.activeElement).toBe(dialog.element);
  });

  it("closes on Esc, ×, a press beside it, once dismiss agrees; the focus back where it was; no key reaches the page", async () => {
    const before = document.body.appendChild(document.createElement("button"));
    before.focus();
    const keys: string[] = [];
    document.addEventListener("keydown", (e) => keys.push(e.key));
    let agree = false;
    let closed = 0;
    const shown = dialogs();
    const dialog = shown.open({ title: "T", content: content(), dismiss: () => agree, closed: () => closed++ });
    key(dialog.element, "Escape");
    (dialog.element.querySelector(".x-dialog-close") as HTMLButtonElement).click();
    dialog.element.parentElement!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await Promise.resolve();
    expect(shown.isOpen).toBe(true);
    agree = true;
    key(dialog.element, "Escape");
    await Promise.resolve();
    expect(shown.isOpen).toBe(false);
    expect(closed).toBe(1);
    expect(document.activeElement).toBe(before);
    expect(keys).toEqual([]);
  });

  it("puts a bar between its head and body; tabs show one panel at a time", () => {
    const panels = ["a", "b"].map((id) => ({ id, title: id.toUpperCase(), panel: document.createElement("div") }));
    const bar = tabs(document, "x-dialog", "x", panels);
    const dialog = dialogs().open({ title: "T", bar: bar.bar, content: content() });
    expect(dialog.element.children[1]).toBe(bar.bar);
    const tab = (id: string) => bar.bar.querySelector<HTMLButtonElement>(`[data-x-tab="${id}"]`)!;
    expect(tab("a").getAttribute("aria-selected")).toBe("true");
    expect(panels.map((p) => p.panel.hidden)).toEqual([false, true]);
    tab("b").click();
    expect([tab("a"), tab("b")].map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    expect(panels.map((p) => [p.panel.hidden, p.panel.className, p.panel.getAttribute("data-x-panel")])).toEqual([
      [true, "x-dialog-panel", "a"],
      [false, "x-dialog-panel", "b"],
    ]);
  });
});
