// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { Action } from "../core/action.ts";
import type { ItemHost } from "../core/items.ts";
import { gesturesModule } from "./gestures.ts";

const action = (id: string): Action => ({ id, label: id, icon: "<svg></svg>", group: "Format" });
const BOLD = action("formats.bold");
const ITALIC = action("formats.italic");
const CODE = action("formats.code");

/** A gesture button drawn, 30px tall, with what it ran */
function gesture(enabled: (a: Action) => boolean = () => true, active: (a: Action) => boolean = () => false, actions: Record<string, Action> = { tap: BOLD, up: ITALIC }) {
  const [kind] = gesturesModule().itemKinds!();
  const ran: string[] = [];
  const host: ItemHost = {
    doc: document,
    docked: false,
    state: (a) => ({ active: active(a), enabled: enabled(a) }),
    activate: (a) => void ran.push(a.id),
    content: (a) => Object.assign(document.createElement("span"), { textContent: a.label }),
    button: () => Object.assign(document.createElement("button"), { type: "button", className: "swb-button" }),
  };
  const item = { type: "gesture", ...Object.fromEntries(Object.entries(actions).map(([key, a]) => [key, a.id])) };
  const button = kind!.render({ kind: kind!, actions, labeled: false, item }, host);
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
  it("is a kind of favourite with a click's slot and optional swipes up and down, giving no actions of its own", () => {
    const module = gesturesModule();
    expect(module.actions()).toEqual([]);
    expect(module.itemKinds!().map((k) => [k.type, k.slots.map((s) => s.key)])).toEqual([["gesture", ["tap", "up", "down"]]]);
    expect(module.itemKinds!()[0]!.slots.map((s) => !!s.optional)).toEqual([false, true, true]);
  });

  it("dragged down past half its height runs the swipe down's action, its icon in the bottom right corner; up still the swipe up's", () => {
    const { button, ran } = gesture(undefined, undefined, { tap: BOLD, up: ITALIC, down: CODE });
    expect(button.querySelector(".swb-hint-down")!.innerHTML).toBe(CODE.icon);
    pointer(button, "pointerdown", 100);
    pointer(button, "pointermove", 112, 10, 100);
    expect(button.style.getPropertyValue("--swb-roll")).toBe(String(-12 / 30));
    pointer(button, "pointermove", 120, 10, 200);
    expect(button.classList.contains("swb-armed")).toBe(true);
    pointer(button, "pointerup", 120, 10, 300);
    drag(button, [100, 80]);
    expect(ran).toEqual([CODE.id, ITALIC.id]);
  });

  it("without a swipe down does not roll down (nor up without a swipe up)", () => {
    const { button, ran } = gesture();
    drag(button, [100, 130]);
    expect(button.style.getPropertyValue("--swb-roll")).toBe("0");
    const downOnly = gesture(undefined, undefined, { tap: BOLD, down: CODE });
    expect(downOnly.button.querySelector(".swb-hint-up")).toBeNull();
    drag(downOnly.button, [100, 70]);
    expect([...ran, ...downOnly.ran]).toEqual([]);
  });

  it("runs the first action on a click, and shows the second's icon small in its corner", () => {
    const { button, ran } = gesture();
    button.click();
    expect(ran).toEqual([BOLD.id]);
    expect(button.querySelector(".swb-gesture-hint")!.innerHTML).toBe(ITALIC.icon);
  });

  it("shows the second's icon on where the second is on (a swipe turns it off), the button pressed by the first only", () => {
    const off = gesture().button;
    expect(off.querySelector(".swb-gesture-hint")!.classList.contains("swb-on")).toBe(false);
    const on = gesture(undefined, (a) => a === ITALIC).button;
    expect(on.querySelector(".swb-gesture-hint")!.classList.contains("swb-on")).toBe(true);
    expect(on.getAttribute("aria-pressed")).toBe("false");
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
