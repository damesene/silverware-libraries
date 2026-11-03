// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { allConditions, allFormats, clearCustomDefinitions } from "../conditions/index.ts";
import { defineFormats } from "../index.ts";
import { cell, controller, flashes, flush, setup, tableMenuItem, text, useTablePage } from "../testing/page.ts";

const here = dirname(fileURLToPath(import.meta.url));

const META = (rules: string, more = "") => `| <meta core.table conditions.-c-score.rules='${rules}'${more}> |\n`;
const TABLE = "| Name | Score |\n|---|---|\n| Pear | 10 |\n| Fig | 60 |\n| Kiwi | 90 |\n";

// A cell by its row in the markdown (a row pinned to the bottom is rendered apart from the body)
const at = (row: number, column: number) => (row === 0 ? cell(0, column) : document.querySelector<HTMLTableRowElement>(`tr[data-swt-row="${row}"]`)!.cells[column]!);
const formatted = (row: number, column = 1) => at(row, column).classList.contains("swt-cf");
const fill = (row: number, column = 1) => at(row, column).style.getPropertyValue("--swt-cf-fill");
const item = (label: string | RegExp) =>
  Array.from(document.querySelectorAll<HTMLElement>(".swt-menu-item")).find((b) => (typeof label === "string" ? b.textContent === label : label.test(b.textContent!)));
const openColumnMenu = (column: number) => {
  cell(1, column).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
  document.querySelector(".swt-grip-column")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
  window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 }));
};
const dialog = () => document.querySelector<HTMLElement>(".swt-cf-dialog");
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Conditional formatting", () => {
  useTablePage();
  afterEach(() => clearCustomDefinitions());

  it("formats the cells a column's rule picks, from the table's metadata", async () => {
    await setup(TABLE + META('[{"when":["greater",{"value":50}],"format":"redFill"}]'));
    await flush();
    expect([1, 2, 3].map((r) => formatted(r))).toEqual([false, true, true]);
    expect(cell(2, 1).classList.contains("swt-cf-fill")).toBe(true);
    expect(fill(2)).toBe("var(--swt-cf-red-fill)");
    expect(cell(2, 1).style.getPropertyValue("--swt-cf-color")).toBe("var(--swt-cf-red-text)");
    // The rule's column only
    expect(formatted(2, 0)).toBe(false);
  });

  it("leaves the header and pinned rows and columns alone; a scale over the rest", async () => {
    const pinned = "| Name | Score |\n|---|---|\n| Pear | 10 |\n| Fig | 60 |\n| Total | 1000 |\n";
    await setup(pinned + `| <meta core.table core.pin-bottom='1' conditions.rules='[{"format":"colorScale"}]'> |\n`);
    await flush();
    expect(cell(0, 1).classList.contains("swt-cf")).toBe(false);
    expect(formatted(3)).toBe(false);
    expect(formatted(3, 0)).toBe(false);
    // The total pinned is no part of the scale: 60 is its largest
    expect(fill(1)).toBe("var(--swt-cf-red-fill)");
    expect(fill(2)).toBe("var(--swt-cf-green-fill)");
    // The whole table's rule: the text column too (no number: not formatted)
    expect(formatted(1, 0)).toBe(false);
  });

  it("grades a whole table's rule over its cells as one range, as a spreadsheet's; column by column where it says so", async () => {
    const page = "| A | B |\n|---|---|\n| 1 | 100 |\n| 9 | 900 |\n";
    await setup(page + `| <meta core.table conditions.rules='[{"format":"colorScale"}]'> |\n`);
    await flush();
    // As one range: 9 is near the smallest of all
    expect(fill(2, 0)).toMatch(/color-mix/);
    expect(fill(2, 1)).toBe("var(--swt-cf-green-fill)");
    controller.stop();
    document.body.replaceChildren();
    await setup(page + `| <meta core.table conditions.rules='[{"format":"colorScale","perColumn":true}]'> |\n`);
    await flush();
    // Each column on its own: 9 is its column's largest
    expect(fill(2, 0)).toBe("var(--swt-cf-green-fill)");
    expect(fill(1, 1)).toBe("var(--swt-cf-red-fill)");
  });

  it("shows its icon in the toolbar of a table with rules; Conditional formatting… in the ⋯ menu always", async () => {
    await setup(TABLE, { "silverware.table.metadata": true });
    await flush();
    expect(tableMenuItem(/^Conditional formatting…/)).toBeDefined();
    expect(document.querySelector('.swt-bar [aria-label="Conditional formatting"]')).toBeNull();
    controller.stop();
    document.body.replaceChildren();
    await setup(TABLE + META('[{"format":"dataBar"}]'), { "silverware.table.metadata": true });
    await flush();
    cell(1, 0).dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(document.querySelector('.swt-bar [aria-label="Conditional formatting"]')).not.toBeNull();
    // A data bar: the share of the largest
    expect(cell(1, 1).style.getPropertyValue("--swt-cf-bar")).toBe("11.1%");
  });

  it("adds a quick rule from a column's menu: shown in the table as it is edited, written on Save", async () => {
    await setup(TABLE, { "silverware.table.metadata": true });
    await flush();
    openColumnMenu(1);
    item(/^Conditional formatting/)!.click();
    item("Greater than…")!.click();
    expect(dialog()).not.toBeNull();
    // The new rule's value: typed in its field, the table shows it before it is saved
    const value = dialog()!.querySelector<HTMLInputElement>('input[aria-label="Value"]')!;
    value.value = "50";
    value.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(200);
    await flush();
    expect([1, 2, 3].map((r) => formatted(r))).toEqual([false, true, true]);
    expect(text).toBe(TABLE);
    Array.from(dialog()!.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === "Save")!.click();
    await flush();
    await controller.scan();
    expect(text).toBe(TABLE + META('[{"when":["greater",{"value":50}],"format":"redFill"}]'));
    expect([1, 2, 3].map((r) => formatted(r))).toEqual([false, true, true]);
  });

  it("leaves the table as it was when the dialog is cancelled", async () => {
    await setup(TABLE, { "silverware.table.metadata": true });
    await flush();
    openColumnMenu(1);
    item(/^Conditional formatting/)!.click();
    item("Color scale")!.click();
    await wait(200);
    await flush();
    expect(formatted(1)).toBe(true);
    Array.from(dialog()!.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === "Cancel")!.click();
    await flush();
    expect(formatted(1)).toBe(false);
    expect(text).toBe(TABLE);
  });

  it("opens the table's rules from the cell menu where it has some, a first rule for the cell's column where it has none", async () => {
    const rightClick = (target: Element) => target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }));
    await setup(TABLE + META('[{"format":"dataBar"}]'), { "silverware.table.metadata": true });
    await flush();
    rightClick(at(2, 1));
    item("Conditional formatting…")!.click();
    expect(dialog()!.querySelectorAll(".swt-cf-line")).toHaveLength(1);
    expect(dialog()!.querySelector(".swt-cf-editor")).toBeNull();
    Array.from(dialog()!.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === "Cancel")!.click();
    controller.stop();
    document.body.replaceChildren();
    await setup(TABLE, { "silverware.table.metadata": true });
    await flush();
    rightClick(at(2, 1));
    item("Conditional formatting…")!.click();
    expect(dialog()!.querySelectorAll(".swt-cf-line")).toHaveLength(1);
    expect(dialog()!.querySelector<HTMLSelectElement>('select[aria-label="Applies to"]')!.selectedOptions[0]!.textContent).toBe("Column Score");
  });

  it("clears a column's rules from its menu", async () => {
    await setup(TABLE + META('[{"format":"dataBar"}]'), { "silverware.table.metadata": true });
    await flush();
    openColumnMenu(1);
    item(/^Conditional formatting/)!.click();
    item(/^Clear rules of this column/)!.click();
    await flush();
    await controller.scan();
    expect(text).toBe(TABLE);
  });

  it("formats by custom formats, and says once what failed", async () => {
    defineFormats(({ palette }: { palette: { red: string } }) => [
      { name: "urgent", label: "Urgent", look: (c: { text: string }) => (/urgent/i.test(c.text) ? { color: palette.red, bold: true } : undefined) },
      { name: "broken", label: "Broken", look: () => 42 },
    ]);
    await wait(10);
    const page = "| Task |\n|---|\n| URGENT fix |\n| later |\n";
    await setup(page + `| <meta core.table conditions.rules='[{"format":"urgent"},{"format":"broken"}]'> |\n`);
    await flush();
    expect(formatted(1, 0)).toBe(true);
    expect(cell(1, 0).style.getPropertyValue("--swt-cf-weight")).toBe("bold");
    expect(formatted(2, 0)).toBe(false);
    expect(flashes.filter((f) => f.includes("broken"))).toHaveLength(1);
  });

  it("documents every built-in condition and format on the library page", () => {
    const page = readFileSync(join(here, "../../silverware-table.md"), "utf8");
    for (const c of allConditions()) expect(page, c.name).toContain(`| ${c.label} | ${(c.description ?? "").replace(/\|/g, "\\|")} |`);
    for (const f of allFormats()) expect(page, f.name).toContain(`| ${f.label} |`);
  });
});
