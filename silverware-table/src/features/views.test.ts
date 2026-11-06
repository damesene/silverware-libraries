// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { setCell } from "../ops.ts";
import { cell, clickOn, controller, cursorMoves, editor, edits, flashes, flush, key, renderPage, setText, setup, tableMenuItem, text, useTablePage } from "../testing/page.ts";

const TASKS = [
  "| Name | Assignee | Hours |",
  "|---|---|--:|",
  "| Write | anna | 3 |",
  "| Test | petr | 1 |",
  "| Ship | anna | 2 |",
  "| <meta core.table core.name='tasks'> |",
].join("\n");

/** A view of the tasks' assignees, sorted, as written (its body as given) */
const VIEW = (body: string, more = "") => `| Assignee |\n|---|\n${body}\n| <meta core.table core.name='people' view.formula='=SORT(UNIQUE(tasks![assignee]))'${more}> |`;

describe("Views", () => {
  useTablePage();
  const field = () => editor.querySelector<HTMLInputElement>(".swt-cell-editor")!;
  const type = async (value: string) => {
    field().value = value;
    field().dispatchEvent(new Event("input", { bubbles: true }));
    key(field(), "Enter");
    await flush();
    await controller.scan();
  };
  const table = (index: number) => editor.querySelectorAll("table")[index]!;
  const viewOf = (page: string) => page.slice(page.indexOf("| Assignee |\n"), page.indexOf("view.formula"));

  it("writes a view anew with each edit of its source, and a table reading the view, in the same edit", async () => {
    const total = "| People |\n|---|\n| 2 <meta formulas.f='=COUNTA(people![assignee])'> |";
    await setup(`${TASKS}\n\n${VIEW("| anna |\n| petr |")}\n\n${total}\n`, { "silverware.table.editor.enterKey": "save" });
    clickOn(cell(2, 1)); // Test's assignee
    await type("eva");
    expect(edits).toBe(1);
    expect(viewOf(text)).toBe("| Assignee |\n|---|\n| anna |\n| eva |\n| <meta core.table core.name='people' ");
    expect(text).toContain("| 2 <meta formulas.f='=COUNTA(people![assignee])'> |");
    clickOn(cell(1, 1));
    await type("jan");
    expect(viewOf(text)).toBe("| Assignee |\n|---|\n| anna |\n| eva |\n| jan |\n| <meta core.table core.name='people' ");
    // The table reading the view: as the view is now, in the same edit
    expect(text).toContain("| 3 <meta formulas.f='=COUNTA(people![assignee])'> |");
    // (Its header, three rows, its metadata row)
    expect(table(1).rows.length).toBe(5);
  });

  it("follows its source's renamed column and table in its formula, a header named after the column with it", async () => {
    await setup(`${TASKS}\n\n${VIEW("| anna |\n| petr |")}\n`, { "silverware.table.editor.enterKey": "save", "silverware.table.metadata": true });
    clickOn(cell(0, 1));
    await type("Owner");
    expect(text).toContain("view.formula='=SORT(UNIQUE(tasks![owner]))'");
    expect(text).toContain("| Owner |\n|---|\n| anna |\n| petr |");
    const info = controller.shownTables()[0]!;
    await controller.writeTable(info, (t) => controller.withTableName(t, "jobs"));
    await controller.scan();
    expect(text).toContain("view.formula='=SORT(UNIQUE(jobs![owner]))'");
    expect(text).toContain("| Owner |\n|---|\n| anna |\n| petr |");
  });

  it("follows its source's rename before a table reading both is calculated, wherever that table is", async () => {
    const reader = "| Count |\n|---|\n| 5 <meta formulas.f='=COUNTA(people![assignee]) + COUNTA(tasks![name])'> |";
    await setup(`${VIEW("| anna |\n| petr |")}\n\n${reader}\n\n${TASKS}\n`, { "silverware.table.metadata": true });
    const info = controller.shownTables()[2]!;
    await controller.writeTable(info, (t) => controller.withTableName(t, "jobs"));
    await controller.scan();
    expect(text).toContain("view.formula='=SORT(UNIQUE(jobs![assignee]))'");
    expect(text).toContain("| 5 <meta formulas.f='=COUNTA(people![assignee]) + COUNTA(jobs![name])'> |");
  });

  it("keeps a header the user renamed through every recalculation, and through its source column's rename", async () => {
    await setup(`${TASKS}\n\n${VIEW("| anna |\n| petr |")}\n`, { "silverware.table.editor.enterKey": "save", "silverware.table.metadata": true });
    clickOn(table(1).rows[0]!.cells[0]!);
    await type("Who");
    expect(text).toContain(`| Who |\n|---|\n| anna |\n| petr |`);
    expect(text).toContain(`view.headers='{"name:Assignee":"Who"}'`);
    clickOn(cell(2, 1));
    await type("eva");
    expect(text).toContain(`| Who |\n|---|\n| anna |\n| eva |`);
    // The source column renamed: the user's name stays, kept by the column's new id
    clickOn(cell(0, 1));
    await type("Owner");
    expect(text).toContain(`| Who |\n|---|\n| anna |\n| eva |`);
    expect(text).toContain(`view.headers='{"name:Owner":"Who"}'`);
    // Given its made name back: it follows the source again
    clickOn(table(1).rows[0]!.cells[0]!);
    await type("Owner");
    expect(text).not.toContain("view.headers");
  });

  it("stays as it was where it cannot be calculated, written (its Refresh) or not", async () => {
    const broken = VIEW("| anna |\n| petr |").replace("tasks![assignee]", "gone![assignee]");
    await setup(`${TASKS}\n\n${broken}\n`, { "silverware.table.metadata": true });
    const page = text;
    await controller.writeTable(controller.shownTables()[1]!, (t) => t);
    await controller.scan();
    expect(text).toBe(page);
  });

  it("is changed by its formula only: no cell of its body edited, no edit of one written", async () => {
    await setup(`${TASKS}\n\n${VIEW("| anna |\n| petr |")}\n`, { "silverware.table.metadata": true });
    const page = text;
    clickOn(table(1).rows[1]!.cells[0]!);
    expect(editor.querySelector(".swt-cell-editor")).toBeNull();
    expect(flashes.at(-1)).toContain("is a view");
    const info = controller.shownTables()[1]!;
    expect(await controller.writeTable(info, (t) => setCell(t, 1, 0, "zed"))).toBe("failed");
    expect(text).toBe(page);
  });

  describe("its dialog", () => {
    const dialog = () => document.querySelector<HTMLElement>(".swt-view-dialog");
    const formulaField = () => dialog()!.querySelector<HTMLInputElement>('input[aria-label="Formula"]')!;
    const nameField = () => dialog()!.querySelector<HTMLInputElement>('input[aria-label="Name"]')!;
    const submit = () => dialog()!.querySelector<HTMLButtonElement>(".swt-dialog-primary")!;
    const previewCells = () => Array.from(dialog()!.querySelectorAll(".swt-view-table tr"), (tr) => Array.from(tr.children, (c) => c.textContent));
    const typeInto = (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.setSelectionRange(value.length, value.length);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const settle = async () => {
      // (The preview once typing pauses)
      await new Promise((resolve) => setTimeout(resolve, 200));
    };

    it("makes a view of a table, its whole body to start with, its preview as the formula is typed, inserted under it", async () => {
      await setup(`${TASKS}\n\nEnd.\n`, { "silverware.table.metadata": true });
      tableMenuItem(/^Insert view…$/)!.click();
      expect(formulaField().value).toBe("=tasks![#Data]");
      expect(nameField().value).toBe("view1");
      expect(previewCells()).toEqual([
        ["Name", "Assignee", "Hours"],
        ["Write", "anna", "3"],
        ["Test", "petr", "1"],
        ["Ship", "anna", "2"],
      ]);
      typeInto(formulaField(), '=SORT(FILTER(tasks![#Data], tasks![assignee] = "anna"))');
      await settle();
      expect(previewCells().slice(1)).toEqual([
        ["Ship", "anna", "2"],
        ["Write", "anna", "3"],
      ]);
      expect(dialog()!.querySelector(".swt-view-size")!.textContent).toBe("2 rows × 3 columns");
      submit().click();
      await flush();
      await controller.scan();
      expect(text).toBe(
        `${TASKS}\n\n| Name | Assignee | Hours |\n|---|---|---:|\n| Ship | anna | 2 |\n| Write | anna | 3 |\n| <meta core.table view.formula='=SORT(FILTER(tasks![#Data], tasks![assignee] = "anna"))' core.name='view1'> |\n\nEnd.\n`,
      );
    });

    it("names a table without a name in the same edit, and says why a formula or a name cannot be written", async () => {
      await setup(`${TASKS.replace("| <meta core.table core.name='tasks'> |", "")}\nEnd.\n`, { "silverware.table.metadata": true });
      tableMenuItem(/^Insert view…$/)!.click();
      expect(formulaField().value).toBe("=table1![#Data]");
      expect(previewCells().length).toBe(4);
      // A formula that cannot be calculated: why, and nothing to insert
      typeInto(formulaField(), "=FILTER(table1![name], table1![hours] > 9)");
      await settle();
      expect(dialog()!.querySelector(".swt-view-none")!.textContent).toContain("#CALC!");
      expect(submit().disabled).toBe(true);
      typeInto(formulaField(), "=SORT(table1![assignee])");
      await settle();
      // A name another table has: refused
      typeInto(nameField(), "table1");
      expect(submit().disabled).toBe(true);
      expect(dialog()!.querySelector(".swt-view-problem")!.textContent).toContain("Another table");
      // None: a view no formula reads
      typeInto(nameField(), "");
      expect(submit().disabled).toBe(false);
      submit().click();
      await flush();
      await controller.scan();
      expect(text).toContain("<meta core.table core.name='table1'>");
      expect(text).toContain("| Assignee |\n|---|\n| anna |\n| anna |\n| petr |\n| <meta core.table view.formula='=SORT(table1![assignee])'> |");
    });

    it("is changed in View settings…, which a press on one of its cells opens", async () => {
      await setup(`${TASKS}\n\n${VIEW("| anna |\n| petr |")}\n`, { "silverware.table.metadata": true });
      clickOn(table(1).rows[1]!.cells[0]!);
      expect(dialog()).not.toBeNull();
      expect(formulaField().value).toBe("=SORT(UNIQUE(tasks![assignee]))");
      expect(nameField().value).toBe("people");
      typeInto(formulaField(), "=SORT(UNIQUE(tasks![assignee]), 1, -1)");
      await settle();
      expect(submit().textContent).toBe("Save");
      submit().click();
      await flush();
      await controller.scan();
      expect(text).toContain("| Assignee |\n|---|\n| petr |\n| anna |\n| <meta core.table core.name='people' view.formula='=SORT(UNIQUE(tasks![assignee]), 1, -1)'> |");
    });

    it("says first that formulas are needed, and inserts nothing, with the formulas module off", async () => {
      await setup(`${TASKS}\n`, { "silverware.table.metadata": true, "silverware.table.modules.formulas.enabled": false });
      tableMenuItem(/^Insert view…$/)!.click();
      expect(dialog()!.querySelector(".swt-view-warning")!.textContent).toContain("formulas module");
      expect(submit().disabled).toBe(true);
    });

    it("is a command, /view, starting from the page's first named table, inserted at the cursor", async () => {
      const page = `Intro.\n\n${TASKS}\n\nAfter.\n`;
      await setup(page, { "silverware.table.metadata": true }, { getCursor: () => page.length - 1 });
      const command = (await controller.commands()).find((c) => c.name === "Silverware Table: Insert view");
      expect(command).toMatchObject({ slash: "view" });
      await command!.run();
      expect(formulaField().value).toBe("=tasks![#Data]");
      submit().click();
      await flush();
      await flush();
      expect(text).toContain("After.\n\n| Name | Assignee | Hours |\n|---|---|---:|\n| Write | anna | 3 |");
    });
  });

  it("says in its tab what it is, and that it is out of date where its source was changed by hand; Refresh view writes it", async () => {
    await setup(`${TASKS}\n\n${VIEW("| anna |")}\n`, { "silverware.table.metadata": true });
    const info = controller.shownTables()[1]!;
    expect(controller.tableBadges(info).map((b) => b.text)).toEqual(["View", "Out of date"]);
    table(1).rows[1]!.cells[0]!.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    const refresh = document.querySelector<HTMLElement>('.swt-bar button[aria-label="Refresh view"]')!;
    expect(refresh.classList.contains("swt-attention")).toBe(true);
    refresh.click();
    await flush();
    await controller.scan();
    expect(viewOf(text)).toBe("| Assignee |\n|---|\n| anna |\n| petr |\n| <meta core.table core.name='people' ");
    expect(controller.tableBadges(controller.shownTables()[1]!).map((b) => b.text)).toEqual(["View"]);
  });

  it("shows out of date once its source is changed by hand, and cannot be calculated with the reason where its formula fails", async () => {
    await setup(`${TASKS}\n\n${VIEW("| anna |\n| petr |")}\n`, { "silverware.table.metadata": true });
    expect(controller.tableBadges(controller.shownTables()[1]!).map((b) => b.text)).toEqual(["View"]);
    const edited = text.replace("| Test | petr | 1 |", "| Test | eva | 1 |");
    setText(edited);
    renderPage(edited, editor, cursorMoves);
    await controller.scan();
    expect(controller.tableBadges(controller.shownTables()[1]!).map((b) => b.text)).toEqual(["View", "Out of date"]);
    const failing = text.replace("tasks![assignee]", "FILTER(tasks![name], tasks![hours] &gt; 9)");
    setText(failing);
    renderPage(failing, editor, cursorMoves);
    await controller.scan();
    expect(controller.tableBadges(controller.shownTables()[1]!).map((b) => b.text)).toEqual(["View", "Cannot be calculated"]);
    table(1).rows[1]!.cells[0]!.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(document.querySelector('.swt-bar button[aria-label="Refresh view"]')!.getAttribute("title")).toContain("#CALC!");
  });

  it("is calculated by the formulas module through the view module: with the view module off, it keeps its values", async () => {
    await setup(`${TASKS}\n\n${VIEW("| anna |\n| petr |")}\n`, { "silverware.table.editor.enterKey": "save", "silverware.table.modules.view.enabled": false });
    clickOn(cell(2, 1));
    await type("eva");
    expect(viewOf(text)).toBe("| Assignee |\n|---|\n| anna |\n| petr |\n| <meta core.table core.name='people' ");
  });
});
