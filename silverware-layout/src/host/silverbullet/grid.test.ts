// @vitest-environment jsdom
// SilverBullet's side of a grid: a cell rendered and written through what the init page hands over, the cursor moved,
// and the frame's button bar as SilverBullet 2.12.1 draws a custom syntax's widget (seen in the probe of 2026-11-13:
// .sb-lua-directive-block, a .button-bar of Reload, Copy, Edit in it) hidden.
import { afterEach, describe, expect, it, vi } from "vitest";
import { pageWriter } from "../../../../shared/pages/writer.ts";
import type { Bridge } from "../../bridge.ts";
import { silverBulletPlatform } from "./platform.ts";
import { silverBulletGridHost } from "./grid.ts";

/** A bridge over one page open in memory */
function bridgeOf(text: string, extra: Partial<Bridge> = {}) {
  const state = { text, moved: [] as unknown[][], flashed: [] as string[] };
  const bridge = {
    getCurrentPage: () => "Page",
    getText: () => state.text,
    replaceRange: (from: number, to: number, insert: string) => void (state.text = state.text.slice(0, from) + insert + state.text.slice(to)),
    readPage: () => state.text,
    writePage: (_page: string, written: string) => void (state.text = written),
    listPages: () => [{ name: "Page" }],
    flash: (message: string) => void state.flashed.push(message),
    moveCursor: (...args: unknown[]) => void state.moved.push(args),
    ...extra,
  } as Bridge;
  return { state, bridge, host: silverBulletGridHost(bridge, pageWriter(silverBulletPlatform(bridge))) };
}

afterEach(() => document.body.replaceChildren());

describe("SilverBullet's grid host", () => {
  it("renders a cell through what the init page hands over, and says so where it hands nothing", async () => {
    expect(await bridgeOf("", { renderMarkdown: (text) => `<b>${text}</b>` }).host.renderMarkdown("x")).toBe("<b>x</b>");
    await expect(bridgeOf("").host.renderMarkdown("x")).rejects.toThrow(/renderMarkdown/);
    expect(await bridgeOf("page").host.pageText()).toBe("page");
  });

  it("writes a cell through the page writer, says why it did not, moves the cursor centred, says a problem", async () => {
    const { state, host } = bridgeOf("<grid>\n<column>\nA\n</column>\n</grid>\n");
    expect(await host.writeCell({ body: "<column>\nA\n</column>", occurrence: 0, of: 1, cell: 0, content: "B" })).toBeUndefined();
    expect(state.text).toBe("<grid>\n<column>\n\nB\n\n</column>\n</grid>\n");
    expect(await host.writeCell({ body: "<column>\nA\n</column>", occurrence: 0, of: 1, cell: 0, content: "C" })).toBe("its grid changed since it was read: left alone");
    expect(await host.writeAttributes({ body: "<column>\n\nB\n\n</column>", occurrence: 0, of: 1, attributes: { width: "900" } })).toBeUndefined();
    expect(state.text.startsWith('<grid width="900">\n')).toBe(true);
    host.moveCursor(7);
    expect(state.moved).toEqual([[7, true]]);
    host.problem("no");
    expect(state.flashed).toEqual(["no"]);
  });

  it("hides the frame's button bar once the grid is in the page", async () => {
    const frame = document.createElement("div");
    frame.className = "sb-lua-directive-block swl-grid-widget";
    const bar = Object.assign(document.createElement("div"), { className: "button-bar" });
    const grid = document.createElement("div");
    bridgeOf("").host.settle(grid);
    // In the page a frame later, as SilverBullet puts a widget's content in after its renderer returns: its bar in a
    // div of the frame, beside the content (2.12.1)
    const inner = document.createElement("div");
    const content = Object.assign(document.createElement("div"), { className: "content" });
    content.append(grid);
    inner.append(bar, content);
    frame.append(inner);
    document.body.append(frame);
    await vi.waitFor(() => expect(bar.style.getPropertyValue("display")).toBe("none"));
    expect(bar.style.getPropertyPriority("display")).toBe("important");
  });
});
