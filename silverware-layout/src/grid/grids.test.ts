// @vitest-environment jsdom
// The grids over a host of memory: a cell's markdown "rendered" as text in a span marked with its offset, the page's
// text kept here, a cell written into it as the page writer writes it. No SilverBullet is needed to draw a grid,
// follow its `<grid>` line, edit a cell and find where a click was in its markdown.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readGrids } from "../../../shared/markdown/grid.ts";
import { type AttributesWrite, type CellWrite, type GridHost, Grids, toggledTask } from "./grids.ts";
import { gridProvider } from "./provider.ts";

const body = "<column>\n\nLeft\n\n</column>\n<column>\nRight\n</column>";

function host(text: string, fail?: string) {
  const state = {
    text,
    settled: [] as HTMLElement[],
    writes: [] as CellWrite[],
    attributeWrites: [] as AttributesWrite[],
    cursor: undefined as number | undefined,
    problems: [] as string[],
    refuse: undefined as string | undefined,
  };
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
    writeAttributes: async (write) => {
      state.attributeWrites.push(write);
      return state.refuse;
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

describe("a grid's width, as Silverware Layout's widget", () => {
  it("is read from its <grid> line by the provider, written there, and told when typed by hand", async () => {
    const { state, gridHost } = host(`<grid width="900" columns="2">\n${body}\n</grid>\n`);
    const grids = new Grids(document, gridHost);
    const provider = gridProvider(grids);
    const frame = document.createElement("div");
    frame.className = "swl-grid-widget";
    frame.append(await grids.render(body));
    document.body.append(frame);
    expect(frame.matches(provider.selector)).toBe(true);
    expect(provider.read(frame)).toEqual({ width: "900" });
    expect(await provider.write(frame, { width: "1200" })).toBeUndefined();
    expect(state.attributeWrites).toEqual([{ body, occurrence: 0, of: 1, attributes: { width: "1200" } }]);
    expect(provider.read(frame)).toEqual({ width: "1200" });
    expect(await provider.write(frame, { width: null })).toBeUndefined();
    expect(provider.read(frame)).toEqual({});
    // Typed by hand: told once the page is read again
    const told = vi.fn();
    grids.onAttributes = told;
    state.text = `<grid width="50%">\n${body}\n</grid>\n`;
    await grids.refresh();
    expect(told).toHaveBeenCalledTimes(1);
    expect(provider.read(frame)).toEqual({ width: "50%" });
    await grids.refresh();
    expect(told).toHaveBeenCalledTimes(1);
  });

  it("says why a width was not written", async () => {
    const { state, gridHost } = host(`<grid>\n${body}\n</grid>\n`);
    const grids = new Grids(document, gridHost);
    const frame = Object.assign(document.createElement("div"), { className: "swl-grid-widget" });
    frame.append(await grids.render(body));
    document.body.append(frame);
    state.refuse = "its grid changed since it was read: left alone";
    expect(await gridProvider(grids).write(frame, { width: "900" })).toBe("its grid changed since it was read: left alone");
    expect(gridProvider(grids).read(frame)).toEqual({});
    state.text = "";
    expect(await gridProvider(grids).write(frame, { width: "900" })).toBe("this grid changed in the page since it was drawn");
    expect(await gridProvider(grids).write(document.createElement("div"), { width: "900" })).toBe("the grid is not drawn");
  });
});

describe("a cell's menu", () => {
  it("moves the cell, sets the grid's columns, takes the grid apart, each through the host", async () => {
    const { state, gridHost } = host(`<grid>\n${body}\n</grid>\n`);
    const changes: unknown[] = [];
    const grids = new Grids(document, { ...gridHost, changeCells: async (write) => void changes.push(write.cells) });
    const grid = await grids.render(body);
    document.body.append(grid);
    const menuOf = (cell: number) => {
      grid.querySelectorAll<HTMLElement>(".swl-grid-cell-more")[cell]!.click();
      return [...document.querySelectorAll<HTMLElement>(".swl-asset-menu-holder .swl-menu-item")];
    };
    const pick = async (cell: number, label: string) => {
      menuOf(cell).find((item) => item.textContent?.trim() === label)!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
    expect(menuOf(0).map((item) => item.textContent?.trim())).toEqual([
      "Move left",
      "Move right",
      "Add a column after it",
      "Move out of the grid",
      "Columns: automatic",
      "2 columns",
      "3 columns",
      "4 columns",
      "Add a column at the end",
      "Remove the grid, its content kept",
    ]);
    // (Closed again by its button)
    grid.querySelector<HTMLElement>(".swl-grid-cell-more")!.click();
    await pick(0, "Move right");
    await pick(1, "Move out of the grid");
    await pick(0, "Remove the grid, its content kept");
    expect(changes).toEqual([{ kind: "move", cell: 0, by: 1 }, { kind: "takeOut", cell: 1 }, { kind: "ungrid" }]);
    await pick(0, "3 columns");
    expect(state.attributeWrites.map((write) => write.attributes)).toEqual([{ columns: "3" }]);
  });
});

describe("a cell edited from a click", () => {
  it("puts the field's cursor where the click was in the cell's markdown, at its end without a point", async () => {
    const words = "<column>\n\nLeft words here\n\n</column>";
    const { gridHost } = host(`<grid>\n${words}\n</grid>\n`);
    const grids = new Grids(document, gridHost);
    const grid = await grids.render(words);
    document.body.append(grid);
    const cell = grid.querySelector<HTMLElement>(".swl-grid-cell")!;
    const text = cell.querySelector("span")!.firstChild!;
    // On "words", two characters into it
    await grids.edit(grid, cell, { target: cell.querySelector("span")!, caret: { node: text, offset: "Left wo".length } });
    const field = await fieldOf(cell);
    expect(field.selectionStart).toBe("Left wo".length);
    field.blur();
    await grids.edit(grid, cell);
    expect((await fieldOf(cell)).selectionStart).toBe("Left words here".length);
  });
});

describe("a cell edited from a selection in it", () => {
  it("selects in the field what was selected in the cell's rendering, its direction kept", async () => {
    const words = "<column>\n\nLeft words here\n\n</column>";
    const { gridHost } = host(`<grid>\n${words}\n</grid>\n`);
    const grids = new Grids(document, gridHost);
    const grid = await grids.render(words);
    document.body.append(grid);
    const cell = grid.querySelector<HTMLElement>(".swl-grid-cell")!;
    const text = cell.querySelector("span")!.firstChild!;
    // "words" selected from its end back to its start
    await grids.edit(grid, cell, { target: cell.querySelector("span")!, caret: undefined, selected: { anchor: { node: text, offset: 10 }, focus: { node: text, offset: 5 } } });
    const field = await fieldOf(cell);
    expect([field.selectionStart, field.selectionEnd, field.selectionDirection]).toEqual([5, 10, "backward"]);
  });
});

describe("a task in a cell", () => {
  it("is toggled in the cell's markdown at its box's place, done and undone", () => {
    const content = "- [ ] one\n- [x] two";
    expect(toggledTask(content, 2)).toBe("- [x] one\n- [x] two");
    expect(toggledTask(content, content.indexOf("[x]"))).toBe("- [ ] one\n- [ ] two");
    expect(toggledTask(content, 0)).toBeUndefined();
  });

  it("is toggled by its box's click, written as the cell", async () => {
    const tasks = "<column>\n\n- [ ] one\n\n</column>";
    const { state, gridHost } = host(`<grid>\n${tasks}\n</grid>\n`);
    const grids = new Grids(document, { ...gridHost, renderMarkdown: async () => '<ul><li><span class="sb-task"><input type="checkbox" data-pos="2"> one</span></li></ul>' });
    grids.start();
    const grid = await grids.render(tasks);
    document.body.append(grid);
    grid.querySelector<HTMLInputElement>("input")!.click();
    await vi.waitFor(() => expect(state.writes.map((write) => write.content)).toEqual(["- [x] one"]));
    expect(grid.querySelector("textarea")).toBeNull();
  });
});
