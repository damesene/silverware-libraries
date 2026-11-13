// @vitest-environment jsdom
// SilverBullet's frame round a grid made bare: its frame and button bar as SilverBullet 2.12.1 draws a custom syntax's
// widget (seen in the probe of 2026-11-13: .sb-lua-directive-block, a .button-bar of Reload, Copy, Edit in it).
import { afterEach, describe, expect, it } from "vitest";
import type { Bridge } from "../../bridge.ts";
import { silverBulletGridHost } from "./grid.ts";

const bridge = (render?: (text: string) => string) => ({ getText: () => "page", ...(render ? { renderMarkdown: render } : {}) }) as unknown as Bridge;

afterEach(() => document.body.replaceChildren());

describe("SilverBullet's grid host", () => {
  it("renders a cell through what the init page hands over, and says so where it hands nothing", async () => {
    expect(await silverBulletGridHost(bridge((text) => `<b>${text}</b>`)).renderMarkdown("x")).toBe("<b>x</b>");
    await expect(silverBulletGridHost(bridge()).renderMarkdown("x")).rejects.toThrow(/renderMarkdown/);
    expect(await silverBulletGridHost(bridge()).pageText()).toBe("page");
  });

  it("hides the frame's button bar once the grid is in the page", async () => {
    const frame = document.createElement("div");
    frame.className = "sb-lua-directive-block swl-grid-widget";
    const bar = Object.assign(document.createElement("div"), { className: "button-bar" });
    const grid = document.createElement("div");
    silverBulletGridHost(bridge()).settle(grid);
    // In the page a frame later, as SilverBullet puts a widget's content in after its renderer returns
    frame.append(bar, grid);
    document.body.append(frame);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(bar.style.getPropertyValue("display")).toBe("none");
    expect(bar.style.getPropertyPriority("display")).toBe("important");
  });
});
