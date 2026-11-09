// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { floatPanel } from "./float.ts";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** A panel of `tall` px laid out of the flow by its style, an anchor at `top`…`bottom`, a window 800 px high */
function setup(top: number, bottom: number, tall: number, flow = "absolute") {
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
  const anchor = document.createElement("td");
  const panel = document.createElement("div");
  panel.style.position = flow;
  anchor.append(panel);
  document.body.append(anchor);
  vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({ top, bottom, left: 100, right: 300, width: 200, height: bottom - top } as DOMRect);
  Object.defineProperty(panel, "offsetHeight", { value: tall, configurable: true });
  Object.defineProperty(panel, "offsetWidth", { value: 160, configurable: true });
  return { anchor, panel };
}

describe("an editor's panel laid over the page", () => {
  it("is fixed to the window over its cell, out of every box that would clip it", () => {
    const { anchor, panel } = setup(100, 130, 200);
    floatPanel(panel, anchor, "over");
    expect([panel.style.position, panel.style.top, panel.style.left, panel.style.bottom, panel.style.maxHeight]).toEqual(["fixed", "100px", "100px", "", ""]);
  });

  it("opens upward where the room under its field is short, cut to the room where neither has enough", () => {
    const under = setup(700, 730, 200);
    floatPanel(under.panel, under.anchor, "under");
    expect([under.panel.style.top, under.panel.style.bottom]).toEqual(["", "102px"]);
    document.body.replaceChildren();
    const tall = setup(380, 400, 900);
    floatPanel(tall.panel, tall.anchor, "under");
    expect([tall.panel.style.top, tall.panel.style.maxHeight]).toEqual(["402px", "390px"]);
  });

  it("is left where the style keeps it in the flow (the peek's choices)", () => {
    const { anchor, panel } = setup(100, 130, 200, "static");
    floatPanel(panel, anchor, "over");
    expect([panel.style.position, panel.style.top]).toEqual(["static", ""]);
  });
});
