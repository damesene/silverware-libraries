// @vitest-environment jsdom
// The grids over a host of memory: a cell's markdown "rendered" as text in a span marked with its offset, the page's
// text kept here, a cell written into it as the page writer writes it. No SilverBullet is needed to draw a grid,
// follow its `<grid>` line, edit a cell and find where a click was in its markdown.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readGrids } from "../../../shared/markdown/grid.ts";
import { type AttributesWrite, type CellWrite, type GridHost, Grids, toggledTask } from "./grids.ts";
import { gridProvider } from "./provider.ts";

const body = "<cell>\n\nLeft\n\n</cell>\n<cell>\nRight\n</cell>";

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
    // Written into the page's text as a host writes them: the grids read them back from there as they settle
    // (`refresh`, a moment after a grid is drawn), and kept none where they were not
    writeAttributes: async (write) => {
      state.attributeWrites.push(write);
      if (state.refuse) return state.refuse;
      const grid = readGrids(state.text).filter((one) => one.body === write.body)[write.occurrence]!;
      const attributes = Object.entries({ ...grid.attributes, ...write.attributes }).flatMap(([name, value]) => (value === null ? [] : [` ${name}="${value}"`]));
      state.text = `${state.text.slice(0, grid.from)}<grid${attributes.join("")}>${state.text.slice(state.text.indexOf("\n", grid.from))}`;
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

  it("takes the host's editor's look as it draws a grid, and again once the page's look changed (its font zoomed)", async () => {
    const { gridHost } = host(`# A\n\n<grid>\n${body}\n</grid>\n`);
    let above = "0.375em";
    const grids = new Grids(document, { ...gridHost, pageEditorLook: () => ({ heading2: { "padding-top": above } }) });
    const grid = await grids.render(body);
    document.body.append(grid);
    expect(grid.style.getPropertyValue("--swl-h2-above")).toBe("0.375em");
    above = "0.2em";
    grids.pageLookChanged();
    expect(grid.style.getPropertyValue("--swl-h2-above")).toBe("0.2em");
  });

  it("reads the page's look once for every grid as it changed, and a grid drawn before it and put into the page after takes it then", async () => {
    const { gridHost } = host(`# A\n\n<grid>\n${body}\n</grid>\n\n<grid>\n${body}\n</grid>\n`);
    let above = "0.375em";
    let reads = 0;
    const grids = new Grids(document, { ...gridHost, pageEditorLook: () => (reads++, { heading2: { "padding-top": above } }) });
    const shown = await grids.render(body);
    const later = await grids.render(body);
    const embedded = await grids.drawText(`<grid>\n${body}\n</grid>`);
    document.body.append(shown);
    above = "0.2em";
    reads = 0;
    grids.pageLookChanged();
    expect(reads).toBe(1);
    expect(shown.style.getPropertyValue("--swl-h2-above")).toBe("0.2em");
    expect(later.style.getPropertyValue("--swl-h2-above")).toBe("0.375em");
    reads = 0;
    document.body.append(later, embedded!);
    await vi.waitFor(() => expect([later, embedded!].map((grid) => grid.style.getPropertyValue("--swl-h2-above"))).toEqual(["0.2em", "0.2em"]), { timeout: 5_000 });
    expect(reads).toBe(1);
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
    // (A text without the grid read again a few times, a moment apart, as it is drawn)
    const rendering = grids.render(body);
    await vi.runAllTimersAsync();
    const grid = await rendering;
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
    expect(state.text.endsWith("<cell>\n\nRight\n- item\n\n</cell>\n</grid>\n")).toBe(true);
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
    // (Left by a press elsewhere: a blur without one is the host's, the cell kept)
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    field.blur();
    document.body.dispatchEvent(new Event("pointerup", { bubbles: true }));
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
    const text = "# A\n\n<grid>\n<cell>\n\nIntro.\n\n**Left** with a [[Target]] link\n\n</cell>\n</grid>\n";
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

describe("a grid's menus: a cell's by its grip, the grid's in its handle's", () => {
  it("moves a cell by its grip's menu, sets the grid's columns and borders and takes it apart by its handle's, each through the host", async () => {
    const { state, gridHost } = host(`<grid>\n${body}\n</grid>\n`);
    const changes: unknown[] = [];
    const asked: string[] = [];
    let answer = false;
    const confirmDelete = async (question: string) => (asked.push(question), answer);
    const grids = new Grids(document, { ...gridHost, confirmDelete, ask: async () => "180px", changeCells: async (write) => void changes.push(write.cells) });
    const grid = await grids.render(body);
    const frame = Object.assign(document.createElement("div"), { className: "swl-grid-widget" });
    frame.append(grid);
    document.body.append(frame);
    const cellMenu = (cell: number) => {
      grid.querySelectorAll<HTMLElement>(".swl-grid-cell-grip")[cell]!.click();
      return [...document.querySelectorAll<HTMLElement>(".swl-popup .swl-menu-item")];
    };
    const pick = async (cell: number, label: string) => {
      cellMenu(cell).find((item) => item.textContent?.trim() === label)!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    };
    // A cell's: what is done with it alone
    expect(cellMenu(0).map((item) => item.textContent?.trim())).toEqual(["Edit markdown (Alt+click)", "Move left", "Move right", "Add a cell after it", "Move out of the grid", "Clear cell…", "Delete cell…"]);
    // (Deleting: in the danger colour, its trash before it)
    const remove = [...document.querySelectorAll<HTMLElement>(".swl-popup .swl-menu-item")].at(-1)!;
    expect(remove.classList.contains("swl-danger")).toBe(true);
    expect(remove.querySelector("svg")).not.toBeNull();
    // (Closed again by its grip)
    grid.querySelector<HTMLElement>(".swl-grid-cell-grip")!.click();
    await pick(0, "Move right");
    await pick(1, "Move out of the grid");
    expect(changes).toEqual([{ kind: "move", cell: 0, by: 1 }, { kind: "takeOut", cell: 1 }]);
    // A cell deleted: asked first; declined, nothing; confirmed, deleted with its content
    asked.length = 0;
    answer = false;
    await pick(1, "Delete cell…");
    expect(asked).toEqual(["Delete cell 2 and everything in it? Ctrl+Z brings it back."]);
    expect(changes).toHaveLength(2);
    answer = true;
    await pick(1, "Delete cell…");
    expect(changes.at(-1)).toEqual({ kind: "remove", cell: 1 });
    // The grid's: in its handle's menu, through its provider
    const gridItems = () => gridProvider(grids).menu!(frame).flat();
    // (Its columns a row of choices: Auto, 2 to 8, its own count set; a min width only where they are as many as fit)
    const columns = gridItems()[0]!;
    if (!("kind" in columns)) throw new Error("no row of columns");
    expect(columns.label).toBe("Columns");
    expect(columns.options.map((option) => option.icon)).toEqual(["Auto", "2", "3", "4", "5", "6", "7", "8"]);
    expect(columns.options.filter((option) => option.active).map((option) => option.icon)).toEqual(["2"]);
    expect(gridItems().map((item) => item.label)).toEqual(["Columns", "Borders", "Add a cell at the end", "Unwrap grid"]);
    const settled = () => new Promise((resolve) => setTimeout(resolve, 0));
    const run = async (label: string) => {
      const item = gridItems().find((one) => one.label === label)!;
      if ("kind" in item) throw new Error(`${label} is a row`);
      item.run();
      await settled();
    };
    await run("Unwrap grid");
    expect(changes.at(-1)).toEqual({ kind: "ungrid" });
    columns.options[2]!.run();
    await settled();
    expect(state.attributeWrites.map((write) => write.attributes)).toEqual([{ columns: "3", "min-width": null }]);
    expect(grid.style.getPropertyValue("--swl-grid-columns")).toBe("repeat(3, minmax(0, 1fr))");
    // Its borders, a row of two: all (as HTML's table has them), the cells' alone, shown at once; chosen again, off
    const borders = () => {
      const row = gridItems().find((one) => one.label === "Borders")!;
      if (!("kind" in row)) throw new Error("no row of borders");
      return row.options;
    };
    expect(borders().map((option) => option.title)).toEqual(["Lines between the cells alone", "Lines round the grid and between its cells"]);
    borders()[1]!.run();
    await settled();
    expect(grid.hasAttribute("data-swl-border")).toBe(true);
    expect(borders().map((option) => !!option.active)).toEqual([false, true]);
    borders()[0]!.run();
    await settled();
    expect([grid.hasAttribute("data-swl-border"), grid.hasAttribute("data-swl-border-inner")]).toEqual([false, true]);
    borders()[0]!.run();
    await settled();
    expect(grid.hasAttribute("data-swl-border-inner")).toBe(false);
    expect(state.attributeWrites.slice(1).map((write) => write.attributes)).toEqual([{ border: "1" }, { border: "inner" }, { border: null }]);
    // As many as fit: shown at once (no divider), its min width a row of names and px asked
    columns.options[0]!.run();
    await settled();
    expect(state.attributeWrites.at(-1)!.attributes).toEqual({ columns: "auto" });
    expect(grid.hasAttribute("data-swl-fit")).toBe(true);
    expect(grid.style.getPropertyValue("--swl-grid-columns")).toBe("repeat(auto-fit, minmax(min(240px, 100%), 1fr))");
    // (Its own sections: the columns and their min width, then the rest)
    expect(gridProvider(grids).menu!(frame).map((section) => section.map((item) => item.label))).toEqual([["Columns", "Min width"], ["Borders", "Add a cell at the end"], ["Unwrap grid"]]);
    const minRow = () => {
      const row = gridItems()[1]!;
      if (!("kind" in row)) throw new Error("no row of min widths");
      return row;
    };
    expect(minRow().options.map((option) => [option.icon, !!option.active])).toEqual([["XS", false], ["S", false], ["M", true], ["L", false], ["px…", false]]);
    minRow().options[1]!.run();
    await settled();
    expect(state.attributeWrites.at(-1)!.attributes).toEqual({ "min-width": "s" });
    expect(grid.style.getPropertyValue("--swl-grid-columns")).toBe("repeat(auto-fit, minmax(min(160px, 100%), 1fr))");
    // Its own px: the row's last choice, asked; the one set shown there
    minRow().options[4]!.run();
    await settled();
    expect(state.attributeWrites.at(-1)!.attributes).toEqual({ "min-width": "180" });
    expect(minRow().options.map((option) => [option.icon, !!option.active]).at(-1)).toEqual(["180px", true]);
    // A cell cleared (last: its write changes the page): asked first; declined, nothing; confirmed, its content
    // written empty, the cell kept
    asked.length = 0;
    answer = false;
    await pick(0, "Clear cell…");
    expect(asked).toEqual(["Clear cell 1? Everything in it goes, the cell stays. Ctrl+Z brings it back."]);
    expect(state.writes).toHaveLength(0);
    answer = true;
    await pick(0, "Clear cell…");
    expect(state.writes.map((write) => [write.cell, write.content])).toEqual([[0, ""]]);
  });

  it("opens the grid's own menu from a cell's by Grid… where no handle is shown (a narrow pane), deleting the cell last", async () => {
    const { gridHost } = host(`<grid>\n${body}\n</grid>\n`);
    const grids = new Grids(document, { ...gridHost, changeCells: async () => undefined });
    let hidden = true;
    grids.handleHidden = () => hidden;
    const grid = await grids.render(body);
    document.body.append(grid);
    const items = () => [...document.querySelectorAll<HTMLElement>(".swl-popup .swl-menu-item")];
    grid.querySelector<HTMLElement>(".swl-grid-cell-grip")!.click();
    expect(items().map((item) => item.textContent?.trim())).toEqual(["Edit markdown (Alt+click)", "Move left", "Move right", "Add a cell after it", "Move out of the grid", "Grid…", "Clear cell…", "Delete cell…"]);
    items().find((item) => item.textContent?.trim() === "Grid…")!.click();
    expect(document.querySelector(".swl-popup .swl-menu-title")?.textContent ?? document.querySelector(".swl-popup")!.textContent).toContain("Grid");
    expect(items().map((item) => item.textContent?.trim())).toEqual(["Add a cell at the end", "Unwrap grid"]);
    expect([...document.querySelectorAll(".swl-popup .swl-menu-segmented .swl-label")].map((label) => label.textContent)).toEqual(["Columns", "Borders"]);
    expect(document.querySelector(".swl-popup .swl-menu-segmented")?.textContent).toContain("Columns");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    // Its handle shown: no Grid… (its menu the handle's)
    hidden = false;
    grid.querySelector<HTMLElement>(".swl-grid-cell-grip")!.click();
    expect(items().map((item) => item.textContent?.trim())).not.toContain("Grid…");
    grid.querySelector<HTMLElement>(".swl-grid-cell-grip")!.click();
  });

  it("draws a grid's borders as its border attribute says: all, or the lines between its cells alone", async () => {
    const { gridHost } = host(`<grid border="1">\n${body}\n</grid>\n`);
    const grid = await new Grids(document, gridHost).render(body);
    expect(grid.hasAttribute("data-swl-border")).toBe(true);
    const columns = host(`<grid border="inner">\n${body}\n</grid>\n`);
    const lined = await new Grids(document, columns.gridHost).render(body);
    expect([lined.hasAttribute("data-swl-border"), lined.hasAttribute("data-swl-border-inner")]).toEqual([false, true]);
  });
});

describe("a cell edited from a click", () => {
  it("puts the field's cursor where the click was in the cell's markdown, at its end without a point", async () => {
    const words = "<cell>\n\nLeft words here\n\n</cell>";
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
    const words = "<cell>\n\nLeft words here\n\n</cell>";
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
    const tasks = "<cell>\n\n- [ ] one\n\n</cell>";
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

describe("what a grid draws, told", () => {
  it("tells its media and links once it is in the page and placed, with their places in the page and their cell", async () => {
    const cellBody = "<cell>\n\nSee [[a.pdf]] and\n![[cat.png]]\n\n</cell>\n<cell>\n\nRight\n\n</cell>";
    const text = `# Page\n\n<grid>\n${cellBody}\n</grid>\n`;
    const { gridHost } = host(text);
    // (The host's rendering of the first cell: a link and an image, each marked with its offset in the cell)
    const grids = new Grids(document, {
      ...gridHost,
      renderMarkdown: async (markdown) =>
        markdown.startsWith("See") ? `<span class="p">See <a href="/a.pdf" data-pos="4">a.pdf</a> and<br><img src=".fs/cat.png" data-pos="${markdown.indexOf("![[")}"></span>` : `<span class="p">${markdown}</span>`,
    });
    const told: string[][] = [];
    grids.rendered.onChange((items) => told.push(items.map((one) => `${one.kind}:${one.target}:${one.position}:${one.room.getAttribute("data-swl-cell")}`)));
    const grid = await grids.render(cellBody);
    // (Not in the page yet: nothing told)
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(told).toEqual([]);
    document.body.append(grid);
    await vi.waitFor(() => expect(told).toHaveLength(1));
    expect(told[0]).toEqual([`embed:cat.png:${text.indexOf("![[cat")}:0`, `link:a.pdf:${text.indexOf("[[a.pdf")}:0`]);
    // (The ranges of a text: every grid's lines, drawn or not)
    expect(grids.rendered.ranges(text)).toEqual(readGrids(text).map((one) => ({ from: one.from, to: one.to })));
    // Drawn again as the page is edited, nothing moved: nothing told
    await grids.refresh();
    expect(told).toHaveLength(1);
  });

  it("tells them however long after it is drawn it is put in the page (scrolled to), and again as it is put in again", async () => {
    const cellBody = "<cell>\n\n![[cat.png]]\n\n</cell>";
    const { gridHost } = host(`<grid>\n${cellBody}\n</grid>\n`);
    const grids = new Grids(document, { ...gridHost, renderMarkdown: async () => `<img src=".fs/cat.png" data-pos="0">` });
    const told: number[] = [];
    grids.rendered.onChange((items) => told.push(items.length));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let grid: HTMLElement;
    try {
      grid = await grids.render(cellBody);
      // (A minute read above it)
      vi.advanceTimersByTime(60_000);
    } finally {
      vi.useRealTimers();
    }
    expect(told).toEqual([]);
    document.body.append(grid);
    await vi.waitFor(() => expect(told).toEqual([1]));
    // Taken out by the editor as it is scrolled away, put in again as it is scrolled back
    grid.remove();
    await new Promise((resolve) => setTimeout(resolve, 50));
    document.body.append(grid);
    await vi.waitFor(() => expect(told).toEqual([1, 1]));
    grid.remove();
  });
});

describe("a grid drawn anew after a write of one cell", () => {
  it("takes over the rendering of the cells it did not change, from the grid drawn where it starts; draws the changed one anew", async () => {
    const page = `Above\n\n<grid>\n${body}\n</grid>\n`;
    const { state, gridHost } = host(page);
    const grids = new Grids(document, gridHost);
    const old = await grids.render(body);
    document.body.append(old);
    // (Placed in the page as it is found there)
    await vi.waitFor(() => expect(old.querySelector(".swl-grid-cell")?.getAttribute("data-swl-pos")).not.toBeNull());
    const [left, right] = [...old.querySelectorAll(".swl-grid-cell")].map((cell) => cell.firstElementChild);
    // The second cell written: the page's text and the grid's body as they are now, the old grid taken out by the host
    const written = body.replace("Right", "Right typed");
    state.text = page.replace(body, written);
    old.remove();
    const drawn = await grids.render(written);
    const cells = [...drawn.querySelectorAll(".swl-grid-cell")];
    expect(cells[0]!.firstElementChild).toBe(left);
    expect(cells[1]!.firstElementChild).not.toBe(right);
    expect(cells[1]!.textContent).toContain("Right typed");
  });

  it("takes nothing from a grid still in the page (another of the same body), nor from a page shown before", async () => {
    const page = `Above\n\n<grid>\n${body}\n</grid>\n`;
    const { gridHost } = host(page);
    const grids = new Grids(document, gridHost);
    grids.pageShown("One");
    const old = await grids.render(body);
    document.body.append(old);
    await vi.waitFor(() => expect(old.querySelector(".swl-grid-cell")?.getAttribute("data-swl-pos")).not.toBeNull());
    const left = old.querySelector(".swl-grid-cell")!.firstElementChild;
    // Still in the page: its rendering its own
    expect((await grids.render(body)).querySelector(".swl-grid-cell")!.firstElementChild).not.toBe(left);
    expect(old.querySelector(".swl-grid-cell")!.firstElementChild).toBe(left);
    // Another page shown: none taken from the one before
    old.remove();
    grids.pageShown("Two");
    expect((await grids.render(body)).querySelector(".swl-grid-cell")!.firstElementChild).not.toBe(left);
  });

  it("takes over the blocks of a cell written whose markdown did not change, what they drew told at their new offsets", async () => {
    // (Each paragraph a block marked with its offset, as the host renders one; an image's line too)
    const renderMarkdown = async (markdown: string) => {
      let at = 0;
      return markdown
        .split("\n\n")
        .map((paragraph) => {
          const from = markdown.indexOf(paragraph, at);
          at = from + paragraph.length;
          return paragraph.startsWith("![") ? `<p data-pos="${from}"><img src="a.png" data-pos="${from}"></p>` : `<p data-pos="${from}">${paragraph}</p>`;
        })
        .join("");
    };
    const cellOf = (content: string) => `<cell>\n\n${content}\n\n</cell>\n<cell>\n\nRight\n\n</cell>`;
    const was = cellOf("Text\n\n![](a.png)");
    const page = `Above\n\n<grid>\n${was}\n</grid>\n`;
    const { state, gridHost } = host(page);
    const grids = new Grids(document, { ...gridHost, renderMarkdown });
    const old = await grids.render(was);
    document.body.append(old);
    await vi.waitFor(() => expect(old.querySelector(".swl-grid-cell")?.getAttribute("data-swl-pos")).not.toBeNull());
    const [text, image] = [...old.querySelectorAll(".swl-grid-cell")[0]!.querySelectorAll(":scope > p")];
    // Its first paragraph written longer: the image's block (its markdown the same) kept, moved down the cell's text
    const written = cellOf("Text typed\n\n![](a.png)");
    state.text = page.replace(was, written);
    old.remove();
    const drawn = await grids.render(written);
    document.body.append(drawn);
    const blocks = [...drawn.querySelectorAll(".swl-grid-cell")[0]!.querySelectorAll(":scope > p")];
    expect(blocks[0]).not.toBe(text);
    expect(blocks[0]!.textContent).toBe("Text typed");
    expect(blocks[1]).toBe(image);
    await vi.waitFor(() => expect(grids.rendered.items().filter((item) => item.kind === "embed").map((item) => [item.element, item.position])).toEqual([[image!.querySelector("img"), state.text.indexOf("![](a.png)")]]));
  });

  it("tells what a cell drew with its rendering taken over, not again from the rendering as decorated since", async () => {
    const withImage = body.replace("Right", "![](a.png)");
    const page = `Above\n\n<grid>\n${withImage}\n</grid>\n`;
    const { state, gridHost } = host(page);
    // (An image drawn as the host draws one, its markdown's offset on it)
    const renderMarkdown = async (markdown: string) => (markdown.startsWith("![") ? '<p><img src="a.png" data-pos="0"></p>' : `<span class="p">${markdown}</span>`);
    const grids = new Grids(document, { ...gridHost, renderMarkdown });
    const old = await grids.render(withImage);
    document.body.append(old);
    await vi.waitFor(() => expect(old.querySelector(".swl-grid-cell")?.getAttribute("data-swl-pos")).not.toBeNull());
    const image = old.querySelector("img")!;
    // Decorated by another (a frame round it, an image of its own in it)
    const frame = document.createElement("span");
    image.replaceWith(frame);
    frame.append(image, Object.assign(document.createElement("img"), { className: "decoration" }));
    const told: HTMLElement[][] = [];
    grids.rendered.onChange(() => told.push(grids.rendered.items().filter((item) => item.kind === "embed").map((item) => item.element)));
    const written = withImage.replace("Left", "Left typed");
    state.text = page.replace(withImage, written);
    old.remove();
    const drawn = await grids.render(written);
    document.body.append(drawn);
    expect(drawn.querySelector("img")).toBe(image);
    await vi.waitFor(() => expect(told.at(-1)).toEqual([image]));
  });
});
