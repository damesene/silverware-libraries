// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { Action } from "../core/action.ts";
import type { ItemHost } from "../core/items.ts";
import { gesturesModule } from "./gestures.ts";

const action = (id: string): Action => ({ id, label: id, icon: "<svg></svg>", group: "Format" });
const BOLD = action("formats.bold");
const ITALIC = action("formats.italic");

/** A gesture button drawn, 30px tall, with what it ran */
function gesture(enabled: (a: Action) => boolean = () => true) {
  const [kind] = gesturesModule().itemKinds!();
  const ran: string[] = [];
  const host: ItemHost = {
    doc: document,
    docked: false,
    state: (a) => ({ active: false, enabled: enabled(a) }),
    activate: (a) => void ran.push(a.id),
    content: (a) => Object.assign(document.createElement("span"), { textContent: a.label }),
    button: () => Object.assign(document.createElement("button"), { type: "button", className: "swb-button" }),
  };
  const item = { type: "gesture", tap: BOLD.id, up: ITALIC.id };
  const button = kind!.render({ kind: kind!, actions: { tap: BOLD, up: ITALIC }, labeled: false, item }, host);
  document.body.append(button);
  button.querySelector<HTMLElement>(".swb-gesture-reel")!.getBoundingClientRect = () => ({ height: 30 }) as DOMRect;
  button.setPointerCapture = () => undefined;
  return { button, ran };
}

// jsdom has no PointerEvent: a mouse event with a pointer's fields
function pointer(target: Element, type: string, y: number, x = 10, timeStamp = 0): void {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperties(e, { pointerId: { value: 1 }, isPrimary: { value: true }, timeStamp: { value: timeStamp } });
  target.dispatchEvent(e);
}

function drag(button: Element, ys: readonly number[], click = true): void {
  pointer(button, "pointerdown", ys[0]!, 10, 0);
  ys.slice(1).forEach((y, i) => pointer(button, "pointermove", y, 10, (i + 1) * 100));
  pointer(button, "pointerup", ys.at(-1)!, 10, ys.length * 100);
  if (click) button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

afterEach(() => document.body.replaceChildren());

describe("The gesture button", () => {
  it("is a kind of favourite with two slots, giving no actions of its own", () => {
    const module = gesturesModule();
    expect(module.actions()).toEqual([]);
    expect(module.itemKinds!().map((k) => [k.type, k.slots.map((s) => s.key)])).toEqual([["gesture", ["tap", "up"]]]);
  });

  it("runs the first action on a click, and shows a 2 in its corner", () => {
    const { button, ran } = gesture();
    button.click();
    expect(ran).toEqual([BOLD.id]);
    expect(button.querySelector(".swb-gesture-count")!.textContent).toBe("2");
  });

  it("dragged up past half its height runs the second action, the click after it none; the reel follows the pointer", () => {
    const { button, ran } = gesture();
    pointer(button, "pointerdown", 100);
    pointer(button, "pointermove", 92, 10, 100);
    expect(button.style.getPropertyValue("--swb-roll")).toBe(String(8 / 30));
    expect(button.classList.contains("swb-armed")).toBe(false);
    pointer(button, "pointermove", 80, 10, 200);
    expect(button.classList.contains("swb-armed")).toBe(true);
    pointer(button, "pointerup", 80, 10, 300);
    button.click();
    expect(ran).toEqual([ITALIC.id]);
  });

  it("dragged up and back, or not far enough, runs nothing and rolls back", () => {
    const { button, ran } = gesture();
    drag(button, [100, 80, 98]);
    drag(button, [100, 93, 92]);
    expect(ran).toEqual([]);
    expect(button.style.getPropertyValue("--swb-roll")).toBe("0");
  });

  it("a sideways move is not the gesture (the docked toolbar scrolls)", () => {
    const { button, ran } = gesture();
    pointer(button, "pointerdown", 100, 10);
    pointer(button, "pointermove", 95, 40, 100);
    pointer(button, "pointermove", 70, 40, 200);
    pointer(button, "pointerup", 70, 40, 300);
    expect(ran).toEqual([]);
    expect(button.style.getPropertyValue("--swb-roll")).toBe("");
  });

  it("a second action not offered is shown dimmed, and let go runs nothing; a first not offered: the click nothing", () => {
    const { button, ran } = gesture((a) => a !== ITALIC);
    expect(button.querySelector(".swb-gesture-up")!.classList.contains("swb-off")).toBe(true);
    drag(button, [100, 70]);
    expect(ran).toEqual([]);
    const other = gesture((a) => a !== BOLD);
    expect(other.button.getAttribute("aria-disabled")).toBe("true");
    other.button.click();
    drag(other.button, [100, 70]);
    expect(other.ran).toEqual([ITALIC.id]);
  });
});
