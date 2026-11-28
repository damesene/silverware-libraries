// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the init
// page again on the module already loaded. After it the table works as before, once (a row added is one row), and a
// table's view is as it was; a function and a source of the space's own read as before.
import { bodyRows, cell, defineSources, SAMPLE_SOURCES, expect, hoverCell, markdown, reloadSpaceLua, rendersAnew, setOtherFile, setOtherPage, startingOn, table, tableIcon, target, test } from "./helpers.ts";

/** The library page's VAT at a rate of its own, as a module of the space */
const VAT = (rate: number) => `export default ({ toNumber }) => [{ name: "VAT", minArgs: 1, maxArgs: 2, call: ([amount, rate = ${rate}]) => toNumber(amount) * (1 + toNumber(rate)) }];\n`;
/** A script defining the functions of a module of Library/UiTests */
const FUNCTIONS = (file: string) => `\`\`\`space-lua\nsilverware.table.defineFunctions(js.importFromSpace("Library/UiTests/${file}"))\n\`\`\`\n`;

/** A formula computed by Silverware Table's Space Lua API as a page's expression would, as text */
const evaluated = (page: import("@playwright/test").Page, formula: string) =>
  page.evaluate(async (formula) => String(await (window as unknown as { client: { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } } }).client.clientSystem.localSyscall("lua.evalExpression", [`silverware.table.evaluateText(${JSON.stringify(formula)})`])), formula);

test.describe("System: Reload", () => {
  test.skip(target !== "silverbullet", "System: Reload is SilverBullet's");

  test("after it the + under the last row adds one row, not one per load", async ({ page }) => {
    await expect(table(page)).toBeVisible();
    const rows = await bodyRows(page).count();
    await reloadSpaceLua(page);
    const last = bodyRows(page).last().locator("td").first();
    await last.click();
    await hoverCell(page, last);
    const box = (await last.boundingBox())!;
    await page.mouse.move(box.x - 13, box.y + box.height + 1, { steps: 4 });
    const plus = page.locator(".swt-insert.swt-visible");
    await expect(plus).toHaveCount(1);
    await rendersAnew(page, () => plus.click());
    await expect(bodyRows(page)).toHaveCount(rows + 1);
    expect(await markdown(page)).toMatch(/\| Šípek[^\n]*\n\| +\| +\| +\| +\|\n/);
  });

  test("after it a function and a source of the space's own as their scripts define them anew: a formula of each written again computed by them", startingOn("| Price | Open |\n|---|---|\n| 100 | |\n"), async ({ page }) => {
    // A function (the library page's example, VAT) and the sources (the playground's, alike), each by a space's script
    await setOtherFile(page, "Library/UiTests/functions.js", VAT(0.21));
    await setOtherPage(page, "Library/UiTests/FunctionsScript", FUNCTIONS("functions.js"));
    await defineSources(page);
    const write = async (column: number, formula: string, shown: string) => {
      await cell(page, 1, column).dblclick();
      const field = page.locator(".swt-cell-editor");
      await expect(field).toBeFocused();
      await field.fill(formula);
      // (Tab saves and opens the next cell's editor, which Esc leaves: Enter in the last row would add a row)
      await rendersAnew(page, async () => {
        await page.keyboard.press("Tab");
        await page.keyboard.press("Escape");
      });
      await expect(cell(page, 1, column)).toHaveText(shown);
    };
    await write(1, '=COUNTIFS(@tasks[done], "TRUE")', "2");
    await write(0, "=VAT(100)", "121");
    // (Tab from the last column added a row, the column's formula filled into it, as a table's column formula is)
    await expect.poll(() => markdown(page)).toBe(`| Price | Open |\n| ----- | ---- |\n| 121 <meta formulas.f='=VAT(100)'>  | 2 <meta formulas.f='=COUNTIFS(@tasks[done], "TRUE")'>   |\n|       | 2 <meta formulas.f='=COUNTIFS(@tasks[done], "TRUE")'>   |\n`);
    // Their scripts changed (a module of another path: an import is kept by its path), then Space Lua loaded again:
    // only definitions made anew give the new values (those of before are kept until a new one comes)
    await setOtherFile(page, "Library/UiTests/functions2.js", VAT(0.1));
    await setOtherPage(page, "Library/UiTests/FunctionsScript", FUNCTIONS("functions2.js"));
    await setOtherPage(page, "Library/UiTests/SourcesScript", SAMPLE_SOURCES.replace('due = "2025-11-14", done = false', 'due = "2025-11-14", done = true'));
    await reloadSpaceLua(page);
    // (A source is read a moment after it is defined: both waited for as a formula of Space Lua computes them)
    await expect.poll(() => evaluated(page, '=COUNTIFS(@tasks[done], "TRUE")')).toBe("3");
    await expect.poll(() => evaluated(page, "=VAT(200)")).toBe("220");
    await write(0, "=VAT(200)", "220");
    await write(1, '=COUNTIFS(@tasks[done], "FALSE")', "2");
    // (The second row's own formula computed by the source defined anew: 3)
    await expect.poll(() => markdown(page)).toBe(`| Price | Open |\n| ----- | ---- |\n| 220 <meta formulas.f='=VAT(200)'>  | 2 <meta formulas.f='=COUNTIFS(@tasks[done], "FALSE")'>   |\n|       | 3 <meta formulas.f='=COUNTIFS(@tasks[done], "TRUE")'>   |\n`);
  });

  test("after it a table in the sheet view is still in it, its toolbar one", async ({ page }) => {
    await expect(table(page)).toBeVisible();
    await hoverCell(page, cell(page, 1, 1));
    await (await tableIcon(page, "Sheet view")).click();
    const sheet = page.locator(".sb-table-widget.swt-drawn.swt-sheet-table:not(.swt-stand-in)");
    await expect(sheet).toHaveCount(1);
    await reloadSpaceLua(page);
    // (The table's controller is the same after it, set on the new platform: the view kept by that; its toolbar shown
    // by a pointer is what a second controller would double)
    await expect(sheet).toHaveCount(1);
    await sheet.locator("tr[data-swt-row='1'] > td").first().hover();
    await expect(page.locator(".swt-bar.swt-visible")).toHaveCount(1);
  });
});
