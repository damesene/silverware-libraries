// @vitest-environment jsdom
// The shared reader of Silverware Assets DOCX and XLSX: its zoom's steps, its shell (as wide as its line, its height or filling
// a panel, its presses and keys its own, its zoom told).
import { describe, expect, it, vi } from "vitest";
import { ASSET_WIDE_ATTRIBUTE } from "./assets.ts";
import { nextZoom, readerShell, ZOOMS } from "./docreader.ts";

describe("a document's reader", () => {
  it("zooms by steps, held to the first and the last, from a zoom between steps to the next each way", () => {
    expect(nextZoom(1, 1)).toBe(1.25);
    expect(nextZoom(1, -1)).toBe(0.75);
    expect(nextZoom(ZOOMS.at(-1)!, 1)).toBe(ZOOMS.at(-1));
    expect(nextZoom(ZOOMS[0]!, -1)).toBe(ZOOMS[0]);
    expect(nextZoom(1.1, 1)).toBe(1.25);
    expect(nextZoom(1.1, -1)).toBe(1);
  });

  it("is as wide as its line, its height in the page or filling a panel, its zoom said and told", () => {
    const inPage = readerShell(document, { base: "swz" }, { name: "a.docx", height: 480 });
    expect(inPage.root.hasAttribute(ASSET_WIDE_ATTRIBUTE)).toBe(true);
    // (As the content's scale makes it: shared/contentscale.ts)
    expect(inPage.root.style.height).toBe("calc(480px * var(--sw-content-scale, 1))");
    expect(readerShell(document, { base: "swz" }, { name: "a.docx", height: undefined }).root.classList.contains("swz-reader-fills")).toBe(true);
    const told = vi.fn();
    inPage.onZoom(told);
    inPage.root.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click();
    expect(told).toHaveBeenCalledWith(1.25);
    expect(inPage.root.querySelector(".swz-reader-fit")!.textContent).toBe("125%");
    inPage.root.querySelector<HTMLButtonElement>('[aria-label="Fit the width"]')!.click();
    expect(inPage.zoom).toBe(1);
  });

  it("keeps a press and a key in it its own: the editor around it moves no cursor, shows no markdown", () => {
    const shell = readerShell(document, { base: "swz" }, { name: "a.docx", height: 480 });
    const holder = document.createElement("div");
    const outside = vi.fn();
    for (const type of ["mousedown", "pointerdown", "keydown"]) holder.addEventListener(type, outside);
    holder.append(shell.root);
    shell.scroller.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    shell.scroller.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    shell.scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(outside).not.toHaveBeenCalled();
  });
});
