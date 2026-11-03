// The choice column type: Choices… in a column's menu sets up its list (a new
// one from the column's values), a value renamed there renamed in the cells;
// the table's lists under Choice in the Type menu, one no column takes deleted there
import type { Page } from "@playwright/test";
import { bodyRows, columnCells, expect, header, markdown, menu, rendersAnew, setPage, test } from "./helpers.ts";

const LIST = `| <meta core.table columntypes.choice.status='["open","in progress","done"]'> |`;
const PAGE = ["| Task | Status #choice-status |", "|---|---|", "| A | done |", "| B | open |", "| C | later |", LIST, ""].join("\n");

async function load(page: Page, text = PAGE, rows = 3): Promise<void> {
  await setPage(page, text);
  await expect(bodyRows(page)).toHaveCount(rows);
}

const dialog = (page: Page) => page.locator(".swt-choices-dialog");

async function openChoices(page: Page): Promise<void> {
  await header(page, 1).click({ button: "right" });
  await menu(page).locator(".swt-menu-item", { hasText: "Choices…" }).click();
  await expect(dialog(page)).toBeVisible();
}

test.describe("Choices", () => {
  test("a value not in the list is marked; a value renamed in Choices… is renamed in the cells", async ({ page }) => {
    await load(page);
    await expect(columnCells(page, 1).nth(2)).toHaveClass(/swt-type-invalid/);
    await expect(columnCells(page, 1).nth(0)).not.toHaveClass(/swt-type-invalid/);
    await openChoices(page);
    const values = dialog(page).locator(".swt-choices-value");
    await expect(values).toHaveCount(3);
    await values.nth(2).fill("finished");
    await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
    const text = await markdown(page);
    expect(text).toContain(`columntypes.choice.status='["open","in progress","finished"]'`);
    expect(text).toMatch(/\| A +\| finished +\|/);
    expect(text).toMatch(/\| C +\| later +\|/);
  });

  test("a #choice column without a list gets one from its values, named after the column", async ({ page }) => {
    await load(page, ["| Task | Stav úkolu #choice |", "|---|---|", "| A | done |", "| B | open |", "| C | done |", ""].join("\n"));
    await openChoices(page);
    await expect(dialog(page).locator(".swt-choices-name")).toHaveValue("stav-ukolu");
    await expect(dialog(page).locator(".swt-choices-value")).toHaveCount(2);
    await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
    const text = await markdown(page);
    expect(text).toMatch(/\| Task +\| Stav úkolu #choice-stav-ukolu +\|/);
    expect(text).toContain(`columntypes.choice.stav-ukolu='["done","open"]'`);
  });

  test("a list no column takes stays under Choice in the Type menu, and is deleted there", async ({ page }) => {
    await load(page, ["| Task | Status |", "|---|---|", "| A | done |", LIST, ""].join("\n"), 1);
    await header(page, 1).click({ button: "right" });
    await menu(page).getByTitle("Choose how the column's cells show").click();
    const row = menu(page).locator(".swt-menu-segmented", { hasText: "Choice: status" });
    await expect(row).toBeVisible();
    await rendersAnew(page, () => row.getByTitle("Delete the list status").click());
    expect(await markdown(page)).not.toContain("columntypes.choice");
  });
});
