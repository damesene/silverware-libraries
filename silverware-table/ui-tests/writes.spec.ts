import type { Page } from "@playwright/test";
import { cell, expect, hoverCell, markdown, openPage, rendersAnew, setOtherPage, setPage, setSettings, settled, table, target, test } from "./helpers.ts";

/** A cell's value typed and saved (Enter saves: the setting below) */
async function edit(page: Page, row: number, column: number, value: string, index = 0): Promise<void> {
  await cell(page, row, column, index).dblclick();
  await expect(page.locator(".swt-cell-editor")).toBeFocused();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(value);
  await page.keyboard.press("Enter");
}

test.describe("Writes in the page as it is", () => {
  test.skip(target !== "silverbullet", "the page's text compared as written, pages opened: SilverBullet's (the playground formats every table)");

  test.beforeEach(async ({ page }) => {
    // (The page's text compared as written: not formatted)
    await setSettings(page, { "silverware.table.autoFormat": false, "silverware.table.metadata": true, "silverware.table.editor.enterKey": "save" });
  });

  test("of two tables alike, the one edited is written, the other left", async ({ page }) => {
    await setPage(page, "| A |\n|---|\n| 1 |\n\nText.\n\n| A |\n|---|\n| 1 |\n");
    await settled(page);
    await rendersAnew(page, () => edit(page, 1, 0, "2", 1), 1);
    await expect.poll(() => markdown(page)).toBe("| A |\n|---|\n| 1 |\n\nText.\n\n| A |\n|---|\n| 2 |\n");
  });

  test("a row's cells past the header, an escape and a list item's indent kept as they are", async ({ page }) => {
    await setPage(page, "- item\n\n  | A | B |\n  |---|---|\n  | a \\| b | 1 | extra |\n");
    await settled(page);
    await rendersAnew(page, () => edit(page, 1, 1, "9"));
    await expect.poll(() => markdown(page)).toBe("- item\n\n  | A | B |\n  |---|---|\n  | a \\| b | 9 | extra |\n");
  });

  test("text typed above a table between its edits: each edit written where the table is now", async ({ page }) => {
    await setPage(page, "Top\n\n| A | B |\n|---|---|\n| 1 | 2 |\n");
    await settled(page);
    await rendersAnew(page, () => edit(page, 1, 0, "x"));
    await page.locator(".cm-line").first().click();
    await page.keyboard.press("End");
    await page.keyboard.type(" more text");
    await rendersAnew(page, () => edit(page, 1, 1, "y"));
    await expect.poll(() => markdown(page)).toBe("Top more text\n\n| A | B |\n|---|---|\n| x | y |\n");
  });

  test("writes of two tables one after another, each kept", async ({ page }) => {
    await setPage(page, "| A |\n|---|\n| 1 |\n\n| B |\n|---|\n| 2 |\n");
    await settled(page);
    for (let i = 0; i < 4; i++) {
      await rendersAnew(page, () => edit(page, 1, 0, `a${i}`, 0), 0);
      await rendersAnew(page, () => edit(page, 1, 0, `b${i}`, 1), 1);
    }
    await expect.poll(() => markdown(page)).toBe("| A |\n|---|\n| a3 |\n\n| B |\n|---|\n| b3 |\n");
  });
});

test.describe("Lazy saving", () => {
  test.skip(target !== "silverbullet", "the page's text compared as written, pages opened: SilverBullet's (the playground formats every table)");

  test.beforeEach(async ({ page }) => {
    await setSettings(page, {
      "silverware.table.autoFormat": false,
      "silverware.table.editor.enterKey": "save",
      "silverware.table.modules.lazy.enabled": true,
      "silverware.table.modules.lazy.delay": 10000,
    });
  });

  test("the cells it holds written into the page once another is opened, there when it is opened again", async ({ page }) => {
    await setOtherPage(page, "UiTests/Elsewhere", "Another page.\n");
    await setPage(page, "Intro.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n");
    await settled(page);
    const name = decodeURI(new URL(page.url()).pathname.slice(1));
    await hoverCell(page, cell(page, 1, 0));
    await page.locator(".swt-bar.swt-visible button[aria-label='Lazy saving']").click();
    await edit(page, 1, 0, "x");
    await edit(page, 2, 1, "y");
    // Held: shown in the table, not in the page yet
    await expect(cell(page, 1, 0)).toHaveText("x");
    await expect(cell(page, 2, 1)).toHaveText("y");
    expect(await markdown(page)).toBe("Intro.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n");
    await openPage(page, "UiTests/Elsewhere");
    await openPage(page, name);
    await expect(table(page)).toBeVisible();
    await expect.poll(() => markdown(page)).toBe("Intro.\n\n| A | B |\n|---|---|\n| x | 2 |\n| 3 | y |\n");
  });

  test("switched off, what it holds is written at once", async ({ page }) => {
    await setPage(page, "Intro.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n");
    await settled(page);
    await hoverCell(page, cell(page, 1, 0));
    const button = page.locator(".swt-bar.swt-visible button[aria-label='Lazy saving']");
    await button.click();
    await edit(page, 1, 1, "z");
    // Held: shown in the table, not in the page yet
    await expect(cell(page, 1, 1)).toHaveText("z");
    expect(await markdown(page)).toBe("Intro.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n");
    await hoverCell(page, cell(page, 1, 0));
    await button.click();
    await expect.poll(() => markdown(page)).toBe("Intro.\n\n| A | B |\n|---|---|\n| 1 | z |\n");
  });
});
