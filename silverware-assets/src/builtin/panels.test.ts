// @vitest-environment jsdom
// The asset in a side panel or enlarged: rendered as the core renders it, one of a kind at a time, closed by Esc, ×,
// or (the enlarged view) a click beside it; over the window, so the other plugins stand back.
import { afterEach, describe, expect, it } from "vitest";
import { type ActionContext, assetName } from "../../../shared/assets.ts";
import { OVER_WINDOW_ATTRIBUTE } from "../../../shared/overwindow.ts";
import { SIDE_PANEL_ATTRIBUTE, sidePanelOpen } from "../../../shared/sidepanel.ts";
import { sidePanel, enlarged } from "./panels.ts";

const context = (opened: string[] = []): ActionContext => ({
  asset: { kind: "file", path: "Docs/report.pdf", url: ".fs/Docs/report.pdf" },
  render: async (_view, container) => void container.append(Object.assign(document.createElement("object"), { className: "drawn" })),
  open: (url) => void opened.push(url),
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const esc = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

afterEach(() => {
  esc();
  document.body.replaceChildren();
});

describe("the asset's panels", () => {
  it("fit an asset drawn larger than its card", () => {
    const asset = context().asset;
    expect(sidePanel.fits(asset, { views: ["card", "full"] })).toBe(true);
    expect(enlarged.fits(asset, { views: ["card"] })).toBe(false);
    expect(assetName(asset)).toBe("report.pdf");
  });

  it("the side panel: the asset rendered in a panel at the right, its name, Open in a new tab; one at a time; Esc closes it", async () => {
    const opened: string[] = [];
    sidePanel.run(context(opened));
    await flush();
    const panel = document.querySelector(".swa-side-panel")!;
    expect(panel.hasAttribute(OVER_WINDOW_ATTRIBUTE)).toBe(true);
    // (A side panel: Silverware Layout may move the page's text to the left while it is open)
    expect(panel.hasAttribute(SIDE_PANEL_ATTRIBUTE)).toBe(true);
    expect(panel.querySelector(".swa-panel-title")!.textContent).toBe("report.pdf");
    expect(panel.querySelector(".swa-panel-body .drawn")).not.toBeNull();
    panel.querySelector<HTMLButtonElement>(".swa-panel-button")!.click();
    expect(opened).toEqual([".fs/Docs/report.pdf"]);
    sidePanel.run(context());
    await flush();
    expect(document.querySelectorAll(".swa-side-panel")).toHaveLength(1);
    esc();
    expect(document.querySelector(".swa-side-panel")).toBeNull();
    expect(sidePanelOpen(document)).toBe(false);
  });

  it("the side panel: its width set by its left edge, kept on this device for the next panel; a double click its default again", async () => {
    sidePanel.run(context());
    await flush();
    const panel = () => document.querySelector<HTMLElement>(".swa-side-panel")!;
    const edge = () => panel().querySelector<HTMLElement>(".swa-side-panel-resize")!;
    expect(edge().getAttribute("role")).toBe("separator");
    expect(panel().style.width).toBe("");
    // (jsdom measures nothing: a step from 0 is held at the narrowest)
    edge().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(panel().style.width).toBe("320px");
    expect(localStorage.getItem("silverware.assets.peekWidth")).toBe("320");
    esc();
    sidePanel.run(context());
    await flush();
    expect(panel().style.width).toBe("320px");
    edge().dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(panel().style.width).toBe("");
    expect(localStorage.getItem("silverware.assets.peekWidth")).toBeNull();
  });

  it("the side panel: over the area the host gives (its editor's), its × first; placed again as the area changes, no more once closed", async () => {
    let area = new DOMRect(200, 50, 800, 600);
    const listeners = new Set<() => void>();
    sidePanel.run({ ...context(), sheetArea: { rect: () => area, watch: (listener) => (listeners.add(listener), () => listeners.delete(listener)) } });
    await flush();
    const panel = document.querySelector<HTMLElement>(".swa-side-panel")!;
    expect([panel.style.top, panel.style.right, panel.style.height, panel.style.maxWidth]).toEqual(["50px", `${window.innerWidth - 1000}px`, "600px", "800px"]);
    expect(panel.querySelector(".swa-panel-head")!.firstElementChild!.classList.contains("swa-panel-close")).toBe(true);
    area = new DOMRect(200, 90, 800, 560);
    listeners.forEach((listener) => listener());
    expect([panel.style.top, panel.style.height]).toEqual(["90px", "560px"]);
    esc();
    expect(listeners.size).toBe(0);
  });

  it("the enlarged view: over the dimmed page, closed by a click beside it or ×", async () => {
    enlarged.run(context());
    await flush();
    const root = document.querySelector<HTMLElement>(".swa-enlarged")!;
    // (Over the whole window, no side panel: the page's text stays where it is)
    expect(root.hasAttribute(OVER_WINDOW_ATTRIBUTE)).toBe(true);
    expect(sidePanelOpen(document)).toBe(false);
    root.querySelector<HTMLElement>(".swa-enlarged-box")!.click();
    expect(document.querySelector(".swa-enlarged")).not.toBeNull();
    root.click();
    expect(document.querySelector(".swa-enlarged")).toBeNull();
    enlarged.run(context());
    document.querySelector<HTMLButtonElement>(".swa-panel-close")!.click();
    expect(document.querySelector(".swa-enlarged")).toBeNull();
  });
});
