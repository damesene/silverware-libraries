// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { PAGE, cell, clickOn, controller, cursorMoves, editor, flashes, flush, key, renderPage, setup, text, useTablePage } from "../testing/page.ts";

describe("Lazy saving", () => {
  useTablePage();

  const button = () => {
    cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    return document.querySelector<HTMLElement>('.swt-bar button[aria-label="Lazy saving"]')!;
  };
  const field = () => editor.querySelector<HTMLInputElement>(".swt-cell-editor");
  const type = (row: number, column: number, value: string) => {
    clickOn(cell(row, column));
    field()!.value = value;
  };
  // Time moved on by the fake timers a test waiting for the delay starts before its setup, not waited for
  const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  it("shows what was typed into an empty cell while it is held", async () => {
    const page = "| A | B |\n|---|---|\n| 1 |  |\n";
    // (Enter saves: on the last row it would add one)
    await setup(page, { "silverware.table.modules.lazy.delay": 5000, "silverware.table.editor.enterKey": "save" });
    button().click();
    type(1, 1, "new");
    key(field()!, "Enter");
    await flush();
    expect(text).toBe(page);
    expect(cell(1, 1).textContent).toBe("new");
    expect(cell(1, 1).classList.contains("swt-lazy-pending")).toBe(true);
  });

  it("shows a held cell without applying the table's view again (its other cells untouched)", async () => {
    const page = "| A | B |\n|---|---|\n| 1 |  |\n| 2 |  |\n";
    await setup(page, { "silverware.table.modules.lazy.delay": 5000 });
    button().click();
    const views = vi.spyOn(controller as unknown as { applyView(...args: unknown[]): void }, "applyView");
    type(1, 1, "new");
    key(field()!, "Enter");
    await flush();
    expect(cell(1, 1).textContent).toBe("new");
    expect(views).not.toHaveBeenCalled();
  });

  it("waits with what it holds for a table no longer rendered, and writes it once the table is rendered again", async () => {
    vi.useFakeTimers();
    await setup(PAGE, { "silverware.table.modules.lazy.delay": 20, "silverware.table.editor.enterKey": "save" });
    button().click();
    type(1, 1, "4");
    key(field()!, "Enter");
    await flush();
    // Scrolled far out of view: SilverBullet takes the table out of the page
    editor.replaceChildren();
    await wait(60);
    expect(text).toBe(PAGE);
    expect(flashes).toEqual([]);
    // Back in view: written
    renderPage(text, editor, cursorMoves);
    await controller.scan();
    await wait(60);
    expect(text).toContain("| Pear | 4 |");
  });

  it("keeps the cells edited until editing stops for the delay, then writes them in one edit", async () => {
    vi.useFakeTimers();
    await setup(PAGE, { "silverware.table.modules.lazy.delay": 30, "silverware.table.editor.enterKey": "moveDown" });
    button().click();
    expect(button().getAttribute("aria-pressed")).toBe("true");
    expect(button().classList.contains("swt-attention")).toBe(false);
    type(1, 1, "4");
    key(field()!, "Enter"); // held; the cell below opens at once
    await flush();
    expect(text).toBe(PAGE);
    expect(cell(1, 1).textContent).toBe("4");
    expect(cell(1, 1).classList.contains("swt-lazy-pending")).toBe(true);
    expect(field()!.value).toBe("10");
    field()!.value = "11";
    key(field()!, "Enter");
    await flush();
    // Still editing (the next cell): nothing written, the icon says so
    await wait(60);
    expect(text).toBe(PAGE);
    expect(button().classList.contains("swt-attention")).toBe(true);
    key(field()!, "Escape");
    // The delay (30 ms) past, the write done
    await wait(30);
    expect(text).toBe(PAGE.replace("| Pear | 3 |", "| Pear | 4 |").replace("| apple | 10 |", "| apple | 11 |"));
    await controller.scan();
    expect(button().classList.contains("swt-attention")).toBe(false);
    expect(button().getAttribute("aria-pressed")).toBe("true");
  });

  it("writes what it holds at once when switched off, and shows a held cell's value in its editor", async () => {
    await setup(PAGE, { "silverware.table.modules.lazy.delay": 10000 });
    button().click();
    type(2, 1, "12");
    key(field()!, "Enter");
    await flush();
    expect(text).toBe(PAGE);
    // Opened again: the value held, kept as it is
    clickOn(cell(2, 1));
    expect(field()!.value).toBe("12");
    key(field()!, "Escape");
    await flush();
    expect(cell(2, 1).textContent).toBe("12");
    button().click();
    await flush();
    expect(text).toBe(PAGE.replace("| apple | 10 |", "| apple | 12 |"));
  });

  it("a value held over a formula ends it, as written at once would: shown in its editor as typed, written without it", async () => {
    const page = "| A | B |\n|---|---|\n| 1 | 2 <meta formulas.f='=A1*2'> |\n";
    await setup(page, { "silverware.table.modules.lazy.delay": 10000, "silverware.table.metadata": true, "silverware.table.editor.enterKey": "save" });
    button().click();
    type(1, 1, "5");
    key(field()!, "Enter");
    await flush();
    clickOn(cell(1, 1));
    expect(field()!.value).toBe("5");
    key(field()!, "Escape");
    await flush();
    button().click();
    await flush();
    expect(text).toBe("| A | B |\n|---|---|\n| 1 | 5 |\n");
  });

  it("a text typed as '= over a formula, held, then written into the page's file: written without the formula", async () => {
    const formula = "| A | B |\n|---|---|\n| 1 | 2 <meta formulas.f='=A1*2'> |\n";
    let page = "Test";
    const files: Record<string, string> = {};
    await setup(formula, { "silverware.table.modules.lazy.delay": 10000, "silverware.table.metadata": true, "silverware.table.editor.enterKey": "save" }, {
      getCurrentPage: () => page,
      readPage: (name) => files[name] ?? "",
      writePage: (name, content) => void (files[name] = content),
    });
    button().click();
    type(1, 1, "'=text");
    key(field()!, "Enter");
    await flush();
    files.Test = text;
    page = "Other";
    await controller.pageLoaded();
    expect(files.Test).toBe("| A | B |\n|---|---|\n| 1 | =text |\n");
  });

  it("switched off while a cell is being edited: that cell and those held are written at once", async () => {
    await setup(PAGE, { "silverware.table.modules.lazy.delay": 10000, "silverware.table.editor.enterKey": "moveDown" });
    button().click();
    type(1, 1, "4");
    key(field()!, "Enter"); // held; the cell below is edited now
    await flush();
    field()!.value = "11";
    // A press on the toolbar leaves the editor open
    button().click();
    await flush();
    await flush();
    expect(field()).toBeNull();
    expect(text).toBe(PAGE.replace("| Pear | 3 |", "| Pear | 4 |").replace("| apple | 10 |", "| apple | 11 |"));
  });

  it("holds a cell left by a click on another cell (select mode)", async () => {
    localStorage.removeItem("silverware.table.editMode");
    await setup(PAGE, { "silverware.table.modules.lazy.delay": 10000 });
    button().click();
    clickOn(cell(1, 1));
    clickOn(cell(1, 1)); // the cell selected alone, clicked again: edited
    field()!.value = "9";
    clickOn(cell(2, 0)); // selects that one: the edit is held, not written
    await flush();
    expect(text).toBe(PAGE);
    expect(cell(1, 1).textContent).toBe("9");
    expect(button().classList.contains("swt-attention")).toBe(true);
  });

  it("undoes the cells held together with Ctrl+Z: written, then that write undone", async () => {
    const undone: string[] = [];
    await setup(PAGE, { "silverware.table.modules.lazy.delay": 10000, "silverware.table.editor.enterKey": "save" }, { undo: () => void undone.push(text) });
    button().click();
    // Nothing held: Ctrl+Z is the editor's as usual
    key(editor, "z", { ctrlKey: true });
    await flush();
    expect(undone).toEqual([]);
    type(1, 1, "4");
    key(field()!, "Enter");
    await flush();
    key(editor, "z", { ctrlKey: true });
    await flush();
    await flush();
    // One step, undoing exactly the write of the cells held
    expect(undone).toEqual([PAGE.replace("| Pear | 3 |", "| Pear | 4 |")]);
  });

  it("puts the cells held into any other write of the table", async () => {
    await setup(PAGE, { "silverware.table.modules.lazy.delay": 10000 });
    button().click();
    type(1, 0, "Plum");
    key(field()!, "Escape"); // dropped: not held
    await flush();
    type(1, 0, "Plum");
    key(field()!, "Tab"); // held, the next cell opens
    await flush();
    expect(text).toBe(PAGE);
    // Ctrl+Enter adds a row: one write, the cell held in it
    key(field()!, "Enter", { ctrlKey: true });
    await flush();
    expect(text).toBe(PAGE.replace("| Pear | 3 |", "| Plum | 3 |\n| | |"));
  });

  it("puts what it wrote into the page's file into the editor too where the page was opened again meanwhile", async () => {
    let page = "Test";
    const files: Record<string, string> = {};
    await setup(PAGE, { "silverware.table.modules.lazy.delay": 10000, "silverware.table.editor.enterKey": "save" }, {
      getCurrentPage: () => page,
      readPage: (name) => files[name] ?? "",
      // (Back on the page as its file is written: the editor shows it as it was read before)
      writePage: (name, content) => {
        files[name] = content;
        page = "Test";
      },
    });
    button().click();
    type(3, 1, "6");
    key(field()!, "Enter");
    await flush();
    expect(text).toBe(PAGE);
    files.Test = text;
    page = "Other";
    await controller.pageLoaded();
    await flush();
    expect(files.Test).toBe(PAGE.replace("| Fig | 2 |", "| Fig | 6 |"));
    expect(text).toBe(PAGE.replace("| Fig | 2 |", "| Fig | 6 |"));
    expect(flashes.filter((f) => f.includes("changed elsewhere"))).toEqual([]);
  });

  it("writes into the page's file once another page is loaded, and asks before the tab closes", async () => {
    let page = "Test";
    const files: Record<string, string> = {};
    await setup(PAGE, { "silverware.table.modules.lazy.delay": 10000, "silverware.table.editor.enterKey": "save" }, {
      getCurrentPage: () => page,
      readPage: (name) => files[name] ?? "",
      writePage: (name, content) => void (files[name] = content),
    });
    button().click();
    type(3, 1, "5");
    key(field()!, "Enter");
    await flush();
    expect(text).toBe(PAGE);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    // Twice at once (the tab hidden and closing): written once, no edit taken for one changed elsewhere
    window.dispatchEvent(new Event("beforeunload", { cancelable: true }));
    await flush();
    expect(flashes.filter((f) => f.includes("changed elsewhere"))).toEqual([]);
    // (that wrote it into the editor: held again for the file this time)
    await flush();
    expect(text).toBe(PAGE.replace("| Fig | 2 |", "| Fig | 5 |"));
    await controller.scan();
    type(3, 1, "6");
    key(field()!, "Enter");
    await flush();
    // Another page: SilverBullet saved this one first
    files.Test = text;
    page = "Other";
    await controller.pageLoaded();
    expect(files.Test).toBe(PAGE.replace("| Fig | 2 |", "| Fig | 6 |"));
    expect(flashes).toContain("Silverware Table: saved 1 cell edited on Test");
  });
});
