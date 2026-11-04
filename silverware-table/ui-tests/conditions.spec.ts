// Conditional formatting: a quick rule from a column's menu, the table as it was while it is edited (the dialog's
// sample shows it), written on Save; the table's rules in the dialog from its toolbar's icon; the eye shows them
// in the table, kept back in the dialog, dropped by Esc
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
  test("a quick rule of a column's menu: the table as it was while its value is typed, written on Save", async ({ page }) => {
    await load(page);
    await header(page, 1).click({ button: "right" });
    await menu(page).locator(".swt-menu-item", { hasText: /^Conditional formatting/ }).click();
    await menu(page).locator(".swt-menu-item", { hasText: "Greater than…" }).click();
    await expect(dialog(page)).toBeVisible();
    const value = dialog(page).getByLabel("Value", { exact: true });
    await value.fill("50");
    // The dialog's sample shows it; the table and the markdown as they were
    await expect(dialog(page).locator(".swt-cf-preview > .swt-cf-description")).toHaveText("Formats 2 of 3 cells");
    await expect(scores(page).nth(1)).not.toHaveClass(/swt-cf/);
    expect(await markdown(page)).not.toContain("conditions");
    await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
    expect(await markdown(page)).toContain(`conditions.-c-score.rules='[{"when":["greater",{"value":50}],"format":"redFill"}]'`);
    await expect(scores(page).nth(2)).toHaveClass(/swt-cf-fill/);
    await expect(scores(page).nth(0)).not.toHaveClass(/swt-cf/);
  });

  test("a formula's column name selected and deleted: what is typed there offers the columns, the one picked closing it", async ({ page }) => {
    await load(page, PAGE + `| <meta core.table conditions.rules='[{"when":["formula",{"formula":"[@Score] &gt; 50"}],"format":"bold"}]'> |
`);
    await hoverCell(page, scores(page).nth(0));
    await page.locator('.swt-bar button[aria-label="Conditional formatting"]').click();
    await dialog(page).locator(".swt-cf-summary").first().click();
    const field = dialog(page).locator(".swt-cf-formula");
    await field.click();
    await field.evaluate((input: HTMLInputElement) => input.setSelectionRange(2, 7));
    await page.keyboard.press("Backspace");
    await expect(field).toHaveValue("[@] > 50");
    await page.keyboard.type("S");
    await expect(page.locator(".swt-cf-choice .swt-cf-choice-name")).toHaveText(["Score"]);
    await page.keyboard.press("Enter");
    await expect(field).toHaveValue("[@score] > 50");
  });

  test("the toolbar's icon of a table with rules opens them; a change leaves the table as it is, Esc too", async ({ page }) => {
    await load(page, PAGE + `| <meta core.table conditions.-c-score.rules='[{"format":"dataBar"}]'> |\n`);
    await expect(scores(page).nth(2)).toHaveClass(/swt-cf-bar/);
    await hoverCell(page, scores(page).nth(0));
    await page.locator('.swt-bar button[aria-label="Conditional formatting"]').click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).locator(".swt-cf-summary").first().click();
    await dialog(page).getByLabel("Format", { exact: true }).selectOption("redFill");
    await expect(dialog(page).locator(".swt-cf-preview-cell").first()).toHaveClass(/swt-cf-fill/);
    await expect(scores(page).nth(0)).toHaveClass(/swt-cf-bar/);
    await expect(scores(page).nth(0)).not.toHaveClass(/swt-cf-fill/);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(scores(page).nth(0)).toHaveClass(/swt-cf-bar/);
    await expect(scores(page).nth(0)).not.toHaveClass(/swt-cf-fill/);
  });

  test("the eye puts the dialog aside, the table showing the rules edited: worked in meanwhile; back in the dialog they stay shown, Esc takes them back", async ({ page }) => {
    await load(page, PAGE + `| <meta core.table conditions.-c-score.rules='[{"format":"dataBar"}]'> |\n`);
    await hoverCell(page, scores(page).nth(0));
    await page.locator('.swt-bar button[aria-label="Conditional formatting"]').click();
    await dialog(page).locator(".swt-cf-summary").first().click();
    await dialog(page).getByLabel("Format", { exact: true }).selectOption("redFill");
    await expect(scores(page).nth(1)).not.toHaveClass(/swt-cf-fill/);
    await page.getByRole("button", { name: "Put the dialog aside, to the page under it" }).click();
    const back = page.getByRole("button", { name: "Back to the dialog" });
    await expect(back).toBeVisible();
    await expect(dialog(page)).toHaveCSS("opacity", "0");
    // The table is the user's: a cell selected; the rule being edited still shown in it
    await scores(page).nth(1).click();
    await expect(page.locator(".swt-selected")).toHaveCount(1);
    await expect(scores(page).nth(1)).toHaveClass(/swt-cf-fill/);
    await back.click();
    await expect(back).toBeHidden();
    await expect(dialog(page)).toHaveCSS("opacity", "1");
    await expect(dialog(page).getByLabel("Format", { exact: true })).toHaveValue("redFill");
    // Back in the dialog the table keeps showing them, until the dialog closes without Save
    await expect(scores(page).nth(1)).toHaveClass(/swt-cf-fill/);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(scores(page).nth(1)).not.toHaveClass(/swt-cf-fill/);
    await expect(scores(page).nth(1)).toHaveClass(/swt-cf-bar/);
  });
});
