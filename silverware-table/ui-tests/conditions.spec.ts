// Conditional formatting: a quick rule from a column's menu, shown in the table as it is edited, written on Save;
// the table's rules in the dialog from its toolbar's icon, a change shown at once and dropped by Esc
import type { Page } from "@playwright/test";
import { bodyRows, columnCells, expect, header, hoverCell, markdown, menu, rendersAnew, setPage, test } from "./helpers.ts";

const PAGE = ["| Item | Score |", "|---|---|", "| Pear | 10 |", "| Fig | 60 |", "| Kiwi | 90 |", ""].join("\n");

async function load(page: Page, text = PAGE): Promise<void> {
  await setPage(page, text);
  await expect(bodyRows(page)).toHaveCount(3);
}

const dialog = (page: Page) => page.locator(".swt-cf-dialog");
const scores = (page: Page) => columnCells(page, 1);

test.describe("Conditional formatting", () => {
  test("a quick rule of a column's menu shows in the table as its value is typed, and is written on Save", async ({ page }) => {
    await load(page);
    await header(page, 1).click({ button: "right" });
    await menu(page).locator(".swt-menu-item", { hasText: /^Conditional formatting/ }).click();
    await menu(page).locator(".swt-menu-item", { hasText: "Greater than…" }).click();
    await expect(dialog(page)).toBeVisible();
    const value = dialog(page).getByLabel("Value", { exact: true });
    await value.fill("50");
    // Shown before it is saved; the markdown as it was
    await expect(scores(page).nth(1)).toHaveClass(/swt-cf-fill/);
    await expect(scores(page).nth(0)).not.toHaveClass(/swt-cf/);
    expect(await markdown(page)).not.toContain("conditions");
    await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
    expect(await markdown(page)).toContain(`conditions.-c-score.rules='[{"when":["greater",{"value":50}],"format":"redFill"}]'`);
    await expect(scores(page).nth(2)).toHaveClass(/swt-cf-fill/);
    await expect(scores(page).nth(0)).not.toHaveClass(/swt-cf/);
  });

  test("the toolbar's icon of a table with rules opens them; a change shows at once, Esc leaves the table as it was", async ({ page }) => {
    await load(page, PAGE + `| <meta core.table conditions.-c-score.rules='[{"format":"dataBar"}]'> |\n`);
    await expect(scores(page).nth(2)).toHaveClass(/swt-cf-bar/);
    await hoverCell(page, scores(page).nth(0));
    await page.locator('.swt-bar button[aria-label="Conditional formatting"]').click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).locator(".swt-cf-summary").first().click();
    await dialog(page).getByLabel("Format", { exact: true }).selectOption("redFill");
    await expect(scores(page).nth(0)).toHaveClass(/swt-cf-fill/);
    await expect(scores(page).nth(0)).not.toHaveClass(/swt-cf-bar/);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(scores(page).nth(0)).toHaveClass(/swt-cf-bar/);
    await expect(scores(page).nth(0)).not.toHaveClass(/swt-cf-fill/);
  });
});
