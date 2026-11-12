// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { floatPanel } from "./float.ts";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * A panel of `tall` px laid out of the flow by its style, an anchor at `top`…`bottom`, a window 800 px high; in a place
 * in the page (`place`), else in what is in the body already (the peek)
 */
function setup(top: number, bottom: number, tall: number, flow = "absolute", place = true) {
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
  const holder = document.createElement("div");
  holder.className = place ? "swd-place" : "swd-peek";
  const anchor = document.createElement("td");
  const panel = document.createElement("div");
  panel.style.position = flow;
  anchor.append(panel);
  holder.append(anchor);
  document.body.append(holder);
  vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({ top, bottom, left: 100, right: 300, width: 200, height: bottom - top } as DOMRect);
  Object.defineProperty(panel, "offsetHeight", { value: tall, configurable: true });
  Object.defineProperty(panel, "offsetWidth", { value: 160, configurable: true });
  return { holder, anchor, panel };
}

const changes = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("an editor's panel laid over the page", () => {
  it("is fixed to the window over its cell, out of every box that would clip it", () => {
    const { anchor, panel } = setup(100, 130, 200);
    floatPanel(panel, anchor, "over");
    expect([panel.style.position, panel.style.top, panel.style.left, panel.style.bottom, panel.style.maxHeight]).toEqual(["fixed", "100px", "100px", "auto", ""]);
  });

  it("opens upward where the room under its field is short (its top then none of the style page's), cut to the room where neither has enough", () => {
    const under = setup(700, 730, 200);
    floatPanel(under.panel, under.anchor, "under");
    expect([under.panel.style.top, under.panel.style.bottom]).toEqual(["auto", "102px"]);
    document.body.replaceChildren();
    const tall = setup(380, 400, 900);
    floatPanel(tall.panel, tall.anchor, "under");
    expect([tall.panel.style.top, tall.panel.style.maxHeight]).toEqual(["402px", "390px"]);
  });

  it("is in the body while it shows, its keys its own, and goes with its cell's content drawn anew", async () => {
    const { anchor, panel } = setup(100, 130, 200);
    floatPanel(panel, anchor, "over");
    expect(panel.parentElement).toBe(document.body);
    expect(panel.classList.contains("swd-lifted")).toBe(true);
    // (A mark where it was: what the view finds in the cell edited)
    expect(anchor.querySelector(".swd-float-home")).not.toBeNull();
    const reached: string[] = [];
    document.body.addEventListener("keydown", () => reached.push("keydown"));
    panel.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(reached).toEqual([]);
    anchor.replaceChildren(document.createTextNode("drawn anew"));
    await changes();
    expect(panel.isConnected).toBe(false);
  });

  it("goes back into its cell while CodeMirror takes the place out of its view, the edit going on, and into the body again as it comes back", async () => {
    // (Laid out again in the page: what the browser's observer of its size tells)
    const observers: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(told: () => void) {
          observers.push(told);
        }
        observe() {}
        disconnect() {}
      },
    );
    const { holder, anchor, panel } = setup(100, 130, 200);
    floatPanel(panel, anchor, "over");
    holder.remove();
    // (The document changed: the place gone with its mark)
    document.body.append(document.createElement("p"));
    await changes();
    expect([panel.parentElement, panel.classList.contains("swd-lifted")]).toEqual([anchor, false]);
    document.body.append(holder);
    for (const told of observers) told();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect([panel.parentElement, panel.classList.contains("swd-lifted")]).toEqual([document.body, true]);
  });

  it("stays in what is in the body already (the peek), at its own layer", () => {
    const { anchor, panel } = setup(100, 130, 200, "absolute", false);
    floatPanel(panel, anchor, "over");
    expect([panel.parentElement, panel.style.position, panel.style.top]).toEqual([anchor, "fixed", "100px"]);
  });

  it("is left where the style keeps it in the flow (the peek's choices)", () => {
    const { anchor, panel } = setup(100, 130, 200, "static");
    floatPanel(panel, anchor, "over");
    expect([panel.style.position, panel.style.top]).toEqual(["static", ""]);
  });
});
