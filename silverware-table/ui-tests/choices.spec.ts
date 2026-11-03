// The choice column type: Choice picked in the Type menu opens the Choices
// dialog (as the pencil of the column's Type row does): the column's values
// (#choice) or a list of its own (a new one from the column's values), a value
// renamed there renamed in the cells;
// the table's lists under Choice in the Type menu, deleted there (one columns take asked first, those columns then without a type)
import type { Page } from "@playwright/test";
import { answerConfirm, bodyRows, columnCells, expect, header, markdown, menu, rendersAnew, setPage, settled, test } from "./helpers.ts";

const LIST = `| <meta core.table columntypes.choice.status='["open","in progress","done"]'> |`;
const PAGE = ["| Task | Status #choice-status |", "|---|---|", "| A | done |", "| B | open |", "| C | later |", LIST, ""].join("\n");

async function load(page: Page, text = PAGE, rows = 3): Promise<void> {
  await setPage(page, text);
  await expect(bodyRows(page)).toHaveCount(rows);
}

const dialog = (page: Page) => page.locator(".swt-choices-dialog");

async function openChoices(page: Page): Promise<void> {
  await header(page, 1).click({ button: "right" });
  await menu(page).getByTitle("Edit the column's choices").click();
  await expect(dialog(page)).toBeVisible();
}

async function pickChoice(page: Page): Promise<void> {
  await header(page, 1).click({ button: "right" });
  await menu(page).getByTitle(/Change the column's type|Choose how the column's cells show/).click();
  await menu(page).locator(".swt-menu-item", { hasText: /^Choice$/ }).click();
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

  test("a #choice column opens on its values; A list of its own makes one from them, named after the column", async ({ page }) => {
    await load(page, ["| Task | Stav úkolu #choice |", "|---|---|", "| A | done |", "| B | open |", "| C | done |", ""].join("\n"));
    await openChoices(page);
    await expect(dialog(page).getByRole("radio", { name: /The column's values/ })).toBeChecked();
    await dialog(page).getByRole("radio", { name: /A list of its own/ }).check();
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

  test("a list a column takes is deleted after a question, the column left without a type; No keeps both", async ({ page }) => {
    await load(page);
    const openTypes = async () => {
      await header(page, 1).click({ button: "right" });
      await menu(page).getByTitle(/Change the column's type/).click();
    };
    const trash = () => menu(page).locator(".swt-menu-segmented", { hasText: "Choice: status" }).getByTitle("Delete the list status");
    await openTypes();
    const question = await answerConfirm(page, false, () => trash().click());
    expect(question).toContain("The column Status takes it and will have no type");
    await settled(page);
    expect(await markdown(page)).toContain("columntypes.choice.status");
    await page.keyboard.press("Escape");
    await openTypes();
    await rendersAnew(page, () => answerConfirm(page, true, () => trash().click()));
    const text = await markdown(page);
    expect(text).not.toContain("columntypes.choice");
    expect(text).not.toContain("#choice");
    expect(text).toMatch(/\| C +\| later +\|/);
  });

  test("Choice in the Type menu opens the dialog: a column of a list made #choice by The column's values; Cancel changes nothing", async ({ page }) => {
    await load(page);
    await header(page, 1).click({ button: "right" });
    await menu(page).getByTitle(/Change the column's type/).click();
    await expect(menu(page).locator(".swt-menu-item", { hasText: /^Choice$/ })).toHaveAttribute("aria-checked", "false");
    await expect(menu(page).locator(".swt-menu-segmented", { hasText: "Choice: status" }).getByTitle("Take the list status for this column")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await pickChoice(page);
    await expect(dialog(page).getByRole("radio", { name: /A list of its own/ })).toBeChecked();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await settled(page);
    expect(await markdown(page)).toContain("#choice-status");
    await pickChoice(page);
    await dialog(page).getByRole("radio", { name: /The column's values/ }).check();
    await expect(dialog(page).locator(".swt-choices-list")).toBeHidden();
    await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
    const text = await markdown(page);
    expect(text).toMatch(/\| Task +\| Status #choice +\|/);
    expect(text).toContain("columntypes.choice.status");
  });

  test("Choice picked for a column of no type opens the dialog on a list of its own, saved as the column's", async ({ page }) => {
    await load(page, ["| Task | Status |", "|---|---|", "| A | open |", "| B | done |", ""].join("\n"), 2);
    await pickChoice(page);
    await expect(dialog(page).getByRole("radio", { name: /A list of its own/ })).toBeChecked();
    await expect(dialog(page).locator(".swt-choices-value")).toHaveCount(2);
    await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
    const text = await markdown(page);
    expect(text).toMatch(/\| Task +\| Status #choice-status +\|/);
    expect(text).toContain(`columntypes.choice.status='["done","open"]'`);
  });
});
