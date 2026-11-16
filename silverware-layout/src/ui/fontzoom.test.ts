// @vitest-environment jsdom
// The font zoom by a pinch, where asked: two fingers on the editor held from the window (the host's own gesture of
// them), a pinch zooming, a tap given back to the host; nothing of it where it is not asked.
import { afterEach, describe, expect, it } from "vitest";
import { FontZoom, type FontZoomHost } from "./fontzoom.ts";

type Finger = { readonly id: number; readonly x: number; readonly y: number };

/** A touch event as a browser gives one (jsdom has no Touch: plain objects in its lists) */
function touch(target: EventTarget, type: string, fingers: readonly Finger[], timeStamp: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const list = fingers.map((one) => ({ identifier: one.id, clientX: one.x, clientY: one.y }));
  Object.defineProperty(event, "touches", { value: Object.assign(list, { item: (i: number) => list[i] }) });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  target.dispatchEvent(event);
  return event;
}

function setup(pinches: boolean) {
  const editor = document.createElement("div");
  document.body.append(editor);
  let size = 16;
  const zooms: (number | undefined)[] = [];
  let taps = 0;
  const host: FontZoomHost = {
    enabled: () => true,
    inEditor: (node) => node instanceof Node && editor.contains(node),
    size: () => size,
    defaultSize: () => 16,
    zoom: (to) => {
      zooms.push(to);
      size = to ?? 16;
    },
    pinches: () => pinches,
    twoFingerTap: () => taps++,
  };
  new FontZoom(document, host);
  // What the host's own gesture of two fingers gets: at the window, as SilverBullet listens
  const atWindow: number[] = [];
  const listen = (e: Event) => atWindow.push((e as unknown as { touches: unknown[] }).touches.length);
  window.addEventListener("touchstart", listen);
  return { editor, zooms, taps: () => taps, atWindow, stop: () => window.removeEventListener("touchstart", listen) };
}

afterEach(() => document.body.replaceChildren());

describe("the font zoom by a pinch", () => {
  it("where asked: two fingers on the editor kept from the window, a pinch zooms, a tap is the host's; three fingers the host's", () => {
    const { editor, zooms, taps, atWindow, stop } = setup(true);
    const one = { id: 1, x: 100, y: 100 };
    const two = { id: 2, x: 200, y: 100 };
    // A pinch: spread to twice as far
    touch(editor, "touchstart", [one], 0);
    touch(editor, "touchstart", [one, two], 10);
    touch(editor, "touchmove", [one, { id: 2, x: 300, y: 100 }], 40);
    touch(editor, "touchend", [one], 60);
    expect(zooms.at(-1)).toBe(32);
    expect(taps()).toBe(0);
    expect(atWindow).toEqual([1]);
    // A tap: the host's own, run as the fingers are lifted
    touch(editor, "touchstart", [one, two], 100);
    touch(editor, "touchend", [one], 180);
    expect(taps()).toBe(1);
    // A move of both together: neither
    touch(editor, "touchstart", [one, two], 300);
    touch(editor, "touchmove", [{ id: 1, x: 100, y: 160 }, { id: 2, x: 200, y: 160 }], 320);
    touch(editor, "touchend", [one], 340);
    expect(taps()).toBe(1);
    // Three fingers: the host's gesture of them
    touch(editor, "touchstart", [one, two, { id: 3, x: 150, y: 150 }], 400);
    expect(atWindow).toEqual([1, 3]);
    stop();
  });

  it("not asked: two fingers the host's as before, nothing zoomed", () => {
    const { editor, zooms, taps, atWindow, stop } = setup(false);
    touch(editor, "touchstart", [{ id: 1, x: 100, y: 100 }, { id: 2, x: 200, y: 100 }], 0);
    touch(editor, "touchmove", [{ id: 1, x: 100, y: 100 }, { id: 2, x: 300, y: 100 }], 30);
    touch(editor, "touchend", [], 60);
    expect(atWindow).toEqual([2]);
    expect(zooms).toEqual([]);
    expect(taps()).toBe(0);
    stop();
  });
});
