// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { setCell } from "../ops.ts";
import { cell, clickOn, controller, editor, edits, flashes, flush, key, setup, text, useTablePage } from "../testing/page.ts";

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

  it("is calculated by the formulas module through the view module: with the view module off, it keeps its values", async () => {
    await setup(`${TASKS}\n\n${VIEW("| anna |\n| petr |")}\n`, { "silverware.table.editor.enterKey": "save", "silverware.table.modules.view.enabled": false });
    clickOn(cell(2, 1));
    await type("eva");
    expect(viewOf(text)).toBe("| Assignee |\n|---|\n| anna |\n| petr |\n| <meta core.table core.name='people' ");
  });
});
