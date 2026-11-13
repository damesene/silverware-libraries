// @vitest-environment jsdom
// The grids over a host of memory: a cell's markdown "rendered" as text in a span marked with its offset, the page's
// text kept here. No SilverBullet is needed to draw a grid and follow its `<grid>` line.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type GridHost, Grids } from "./grids.ts";

const body = "<column>\n\nLeft\n\n</column>\n<column>\nRight\n</column>";

function host(text: string, fail?: string) {
  const state = { text, settled: [] as HTMLElement[] };
  const gridHost: GridHost = {
    renderMarkdown: async (markdown) => {
      if (markdown === fail) throw new Error("no rendering");
      return `<span class="p" data-pos="0">${markdown}</span>`;
    },
    pageText: async () => state.text,
    settle: (element) => void state.settled.push(element),
  };
  return { state, gridHost };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("the grids", () => {
  it("draws a grid of its body: a cell each, the host's rendering in it, the columns of its <grid> line", async () => {
    const { state, gridHost } = host(`# A\n\n<grid columns="1fr 2fr">\n${body}\n</grid>\n`);
    const grid = await new Grids(document, gridHost).render(body);
    expect(grid.className).toBe("swl-grid");
    expect(grid.style.getPropertyValue("--swl-grid-columns")).toBe("minmax(0, 1fr) minmax(0, 2fr)");
    expect([...grid.querySelectorAll(".swl-grid-cell")].map((cell) => [cell.getAttribute("data-swl-cell"), cell.innerHTML])).toEqual([
      ["0", '<span class="p" data-pos="0">Left</span>'],
      ["1", '<span class="p" data-pos="0">Right</span>'],
    ]);
    expect(state.settled).toEqual([grid]);
  });

  it("shows a cell the host could not render as its text, and draws a grid not in the page as one column per cell", async () => {
    const { gridHost } = host("no grid here", "Right");
    const grid = await new Grids(document, gridHost).render(body);
    expect(grid.style.getPropertyValue("--swl-grid-columns")).toBe("repeat(2, minmax(0, 1fr))");
    expect(grid.querySelectorAll(".swl-grid-cell")[1]!.innerHTML).toBe('<div class="swl-grid-plain">Right</div>');
  });

  it("sets the columns again as the <grid> line changes, each grid drawn by its order among those of its body", async () => {
    const page = (a: string, b: string) => `<grid columns="${a}">\n${body}\n</grid>\n\n<grid columns="${b}">\n${body}\n</grid>`;
    const { state, gridHost } = host(page("1", "3"));
    const grids = new Grids(document, gridHost);
    const first = await grids.render(body);
    const second = await grids.render(body);
    document.body.append(first, second);
    await grids.refresh();
    expect([first, second].map((grid) => grid.style.getPropertyValue("--swl-grid-columns"))).toEqual(["repeat(1, minmax(0, 1fr))", "repeat(3, minmax(0, 1fr))"]);
    state.text = page("2", "1fr 1fr");
    await grids.refresh();
    expect([first, second].map((grid) => grid.style.getPropertyValue("--swl-grid-columns"))).toEqual(["repeat(2, minmax(0, 1fr))", "minmax(0, 1fr) minmax(0, 1fr)"]);
  });

  it("refreshes once, a moment after several asked", async () => {
    vi.useFakeTimers();
    const { gridHost } = host("");
    const pageText = vi.spyOn(gridHost, "pageText");
    const grids = new Grids(document, gridHost);
    const grid = await grids.render(body);
    document.body.append(grid);
    pageText.mockClear();
    grids.refreshSoon();
    grids.refreshSoon();
    await vi.runAllTimersAsync();
    expect(pageText).toHaveBeenCalledTimes(1);
  });
});
