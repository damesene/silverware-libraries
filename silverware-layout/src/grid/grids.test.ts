// @vitest-environment jsdom
// The grids over a host of memory: a cell's markdown "rendered" as text in a span marked with its offset, the page's
// text kept here, a cell written into it as the page writer writes it. No SilverBullet is needed to draw a grid,
// follow its `<grid>` line, edit a cell and find where a click was in its markdown.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readGrids } from "../../../shared/markdown/grid.ts";
import { type CellWrite, type GridHost, Grids } from "./grids.ts";

const body = "<column>\n\nLeft\n\n</column>\n<column>\nRight\n</column>";

function host(text: string, fail?: string) {
  const state = { text, settled: [] as HTMLElement[], writes: [] as CellWrite[], cursor: undefined as number | undefined, problems: [] as string[], refuse: undefined as string | undefined };
  const gridHost: GridHost = {
    renderMarkdown: async (markdown) => {
      if (markdown === fail) throw new Error("no rendering");
      return `<span class="p">${markdown}</span>`;
    },
    pageText: async () => state.text,
    writeCell: async (write) => {
      state.writes.push(write);
      if (state.refuse) return state.refuse;
      const grid = readGrids(state.text).filter((one) => one.body === write.body)[write.occurrence]!;
      const cell = grid.cells[write.cell]!;
      state.text = state.text.slice(0, cell.innerFrom) + `\n${write.content}\n\n` + state.text.slice(cell.innerTo);
      return undefined;
    },
    moveCursor: (at) => void (state.cursor = at),
    problem: (message) => void state.problems.push(message),
    settle: (element) => void state.settled.push(element),
  };
  return { state, gridHost };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

/** A cell's field, once its editing has started */
async function fieldOf(cell: Element): Promise<HTMLTextAreaElement> {
  await vi.waitFor(() => expect(cell.querySelector("textarea")).not.toBeNull());
  return cell.querySelector("textarea")!;
}

describe("the grids", () => {
  it("draws a grid of its body: a cell each, the host's rendering in it, the columns of its <grid> line", async () => {
    const { state, gridHost } = host(`# A\n\n<grid columns="1fr 2fr">\n${body}\n</grid>\n`);
    const grid = await new Grids(document, gridHost).render(body);
    expect(grid.className).toBe("swl-grid");
    expect(grid.style.getPropertyValue("--swl-grid-columns")).toBe("minmax(0, 1fr) minmax(0, 2fr)");
    expect([...grid.querySelectorAll(".swl-grid-cell")].map((cell) => [cell.getAttribute("data-swl-cell"), cell.innerHTML])).toEqual([
      ["0", '<span class="p">Left</span>'],
      ["1", '<span class="p">Right</span>'],
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

describe("a cell edited", () => {
  const page = `# A\n\n<grid>\n${body}\n</grid>\n\n<grid>\n${body}\n</grid>\n`;

  it("shows the cell's markdown in a field on a click, writes it as the cell is left, the grid of those alike clicked", async () => {
    const { state, gridHost } = host(page);
    const grids = new Grids(document, gridHost);
    grids.start();
    const [first, second] = [await grids.render(body), await grids.render(body)];
    document.body.append(first, second);
    const cell = second.querySelectorAll(".swl-grid-cell")[1]!;
    cell.querySelector("span")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const field = await fieldOf(cell);
    expect(field.value).toBe("Right");
    expect(cell.classList.contains("swl-grid-editing")).toBe(true);
    field.value = "Right\n- item";
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await vi.waitFor(() => expect(state.writes).toHaveLength(1));
    expect(state.writes[0]).toEqual({ body, occurrence: 1, of: 2, cell: 1, content: "Right\n- item" });
    expect(state.text.endsWith("<column>\n\nRight\n- item\n\n</column>\n</grid>\n")).toBe(true);
    // The rendering shown again until the host draws the grid anew
    expect(cell.querySelector("textarea")).toBeNull();
    expect(cell.textContent).toBe("Right");
  });

  it("writes nothing where the markdown is as it was, leaves a link's click to it, and says why a write was refused", async () => {
    const { state, gridHost } = host(page);
    const grids = new Grids(document, gridHost);
    grids.start();
    const grid = await grids.render(body);
    document.body.append(grid);
    const cell = grid.querySelector(".swl-grid-cell")!;
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const field = await fieldOf(cell);
    field.blur();
    expect(state.writes).toEqual([]);
    // A link in the rendering is its own
    const link = Object.assign(document.createElement("a"), { textContent: "x" });
    cell.append(link);
    link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(cell.querySelector("textarea")).toBeNull();
    // Refused
    state.refuse = "its grid changed since it was read: left alone";
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const again = await fieldOf(cell);
    again.value = "Other";
    again.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
    await vi.waitFor(() => expect(state.problems).toEqual(["Silverware Layout: the cell was not written: its grid changed since it was read: left alone"]));
  });

  it("says a grid changed in the page since it was drawn is to be edited there", async () => {
    const { state, gridHost } = host(page);
    const grids = new Grids(document, gridHost);
    const grid = await grids.render(body);
    document.body.append(grid);
    state.text = "# A\n";
    await grids.edit(grid, grid.querySelector(".swl-grid-cell")!);
    expect(state.problems).toEqual(["Silverware Layout: this grid changed in the page since it was drawn; edit it there"]);
  });
});

describe("an Alt+click in a grid", () => {
  it("puts the cursor where the word clicked is in the cell's markdown, from the element's place", async () => {
    const text = "# A\n\n<grid>\n<column>\n\nIntro.\n\n**Left** with a [[Target]] link\n\n</column>\n</grid>\n";
    const { state, gridHost } = host(text);
    const grids = new Grids(document, gridHost);
    const grid = await grids.render(readGrids(text)[0]!.body);
    document.body.append(grid);
    const cell = grid.querySelector<HTMLElement>(".swl-grid-cell")!;
    // As SilverBullet renders it: the second paragraph at 8 of the cell's markdown
    cell.innerHTML = '<span class="p">Intro.</span><span class="p" data-pos="8"><strong>Left</strong> with a link</span>';
    const paragraph = cell.querySelectorAll("span")[1]!;
    const words = paragraph.lastChild!;
    await grids.showSource(grid, cell, paragraph, { node: words, offset: 3 });
    const contentFrom = text.indexOf("Intro.");
    // (" with a link", offset 3: two characters into "with")
    expect(state.cursor).toBe(text.indexOf("with") + 2);
    expect(state.cursor! - contentFrom).toBe("Intro.\n\n**Left** wi".length);
    // No word under the point: where the element starts; no cell: the grid's start
    await grids.showSource(grid, cell, paragraph, undefined);
    expect(state.cursor).toBe(contentFrom + 8);
    await grids.showSource(grid, undefined, grid, undefined);
    expect(state.cursor).toBe(text.indexOf("<grid>"));
  });

  it("takes the press before the host does", async () => {
    const { gridHost } = host("");
    const grids = new Grids(document, gridHost);
    grids.start();
    const grid = await grids.render(body);
    document.body.append(grid);
    const hostSaw = vi.fn();
    document.body.addEventListener("mousedown", hostSaw);
    const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true, altKey: true });
    grid.querySelector(".swl-grid-cell")!.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    expect(hostSaw).not.toHaveBeenCalled();
  });
});
