// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { composedClosest, composedContains, composedTarget, inShadow } from "./shadow.ts";

describe("Nodes in a shadow root", () => {
  it("are in the elements around its host, and find them as closest; an event's target is the node itself", () => {
    document.body.innerHTML = `<div class="grid"><div class="cell"></div></div><div class="other"></div>`;
    const field = document.createElement("div");
    document.querySelector(".cell")!.append(field);
    const shadow = field.attachShadow({ mode: "open" });
    shadow.innerHTML = `<span class="frame"><img></span>`;
    const img = shadow.querySelector("img")!;
    expect(composedContains(document.querySelector(".grid")!, img)).toBe(true);
    expect(composedContains(document.querySelector(".other")!, img)).toBe(false);
    expect(document.querySelector(".grid")!.contains(img)).toBe(false);
    expect(composedClosest(img, ".frame")).toBe(shadow.querySelector(".frame"));
    expect(composedClosest(img, ".cell")).toBe(document.querySelector(".cell"));
    expect(composedClosest(img, ".nothing")).toBeNull();
    expect([inShadow(img), inShadow(field)]).toEqual([true, false]);
    let target: Element | undefined;
    document.addEventListener("pointermove", (e) => (target = composedTarget(e)), { once: true });
    img.dispatchEvent(new Event("pointermove", { bubbles: true, composed: true }));
    expect(target).toBe(img);
  });
});
