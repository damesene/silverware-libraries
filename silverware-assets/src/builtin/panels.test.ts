// @vitest-environment jsdom
// The asset in a side panel or enlarged: rendered as the core renders it, one of a kind at a time, closed by Esc, ×,
// or (the popover) a click beside it; over the window, so the other plugins stand back.
import { afterEach, describe, expect, it } from "vitest";
import type { ActionContext } from "../../../shared/assets.ts";
import { assetName, peek, popover } from "./panels.ts";

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
    expect(peek.fits(asset, { views: ["icon", "embed"] })).toBe(true);
    expect(popover.fits(asset, { views: ["icon"] })).toBe(false);
    expect(assetName(asset)).toBe("report.pdf");
  });

  it("peek: the asset rendered in a panel at the right, its name, Open in a new tab; one at a time; Esc closes it", async () => {
    const opened: string[] = [];
    peek.run(context(opened));
    await flush();
    const panel = document.querySelector(".swl-asset-peek")!;
    expect(panel.hasAttribute("data-silverware-over-window")).toBe(true);
    expect(panel.querySelector(".swl-asset-panel-title")!.textContent).toBe("report.pdf");
    expect(panel.querySelector(".swl-asset-panel-body .drawn")).not.toBeNull();
    panel.querySelector<HTMLButtonElement>(".swl-asset-panel-button")!.click();
    expect(opened).toEqual([".fs/Docs/report.pdf"]);
    peek.run(context());
    await flush();
    expect(document.querySelectorAll(".swl-asset-peek")).toHaveLength(1);
    esc();
    expect(document.querySelector(".swl-asset-peek")).toBeNull();
  });

  it("popover: over the dimmed page, closed by a click beside it or ×", async () => {
    popover.run(context());
    await flush();
    const root = document.querySelector<HTMLElement>(".swl-asset-popover")!;
    root.querySelector<HTMLElement>(".swl-asset-popover-box")!.click();
    expect(document.querySelector(".swl-asset-popover")).not.toBeNull();
    root.click();
    expect(document.querySelector(".swl-asset-popover")).toBeNull();
    popover.run(context());
    document.querySelector<HTMLButtonElement>(".swl-asset-panel-close")!.click();
    expect(document.querySelector(".swl-asset-popover")).toBeNull();
  });
});
