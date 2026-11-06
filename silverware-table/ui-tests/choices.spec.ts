// The choice column type: Choice picked in the Type menu opens the Choices
// dialog (as the pencil of the column's Type row does): the column's values
// (#choice) or a list of its own (a new one from the column's values), a value
// renamed there renamed in the cells;
// the table's lists under Choice in the Type menu, deleted there (one columns take asked first, those columns then without a type)
import type { Page } from "@playwright/test";
import { answerConfirm, bodyRows, cell, columnCells, defineSources, drag, expect, header, markdown, menu, rendersAnew, setOtherPage, setPage, settled, target, test } from "./helpers.ts";

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

  test("a value is dragged by its grip to another place, the list saved in that order", async ({ page }) => {
    await load(page);
    await openChoices(page);
    const rows = dialog(page).locator(".swt-choices-row");
    await drag(page, rows.nth(2).locator(".swt-choices-grip"), rows.nth(0).locator(".swt-choices-grip"));
    await expect(dialog(page).locator(".swt-choices-value").first()).toHaveValue("done");
    await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
    expect(await markdown(page)).toContain(`columntypes.choice.status='["done","open","in progress"]'`);
  });

  test("a long list scrolls while a value is held near its top: the last value dragged to the first place", async ({ page }) => {
    const values = Array.from({ length: 40 }, (_, i) => `v${i + 1}`);
    const list = `| <meta core.table columntypes.choice.many='${JSON.stringify(values)}'> |`;
    await load(page, ["| Task | Status #choice-many |", "|---|---|", "| A | v1 |", list, ""].join("\n"), 1);
    await openChoices(page);
    const box = dialog(page).locator(".swt-choices-values");
    await box.evaluate((e) => (e.scrollTop = e.scrollHeight));
    const grip = dialog(page).locator(".swt-choices-row").last().locator(".swt-choices-grip");
    const from = (await grip.boundingBox())!;
    const top = (await box.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, top.y + 4, { steps: 8 });
    await expect.poll(() => box.evaluate((e) => e.scrollTop)).toBe(0);
    await page.mouse.move(from.x + from.width / 2, top.y + 2);
    await page.mouse.up();
    await expect(dialog(page).locator(".swt-choices-value").first()).toHaveValue("v40");
  });

  test("the dialog keeps its least height with the list's fields hidden", async ({ page }) => {
    await load(page);
    await openChoices(page);
    await dialog(page).getByRole("radio", { name: /Column's values/ }).check();
    await expect(dialog(page).locator(".swt-choices-list")).toBeHidden();
    // min(520px, the window's height − 32px), as the style page says
    const least = Math.min(520, page.viewportSize()!.height - 32);
    expect((await dialog(page).boundingBox())!.height).toBeGreaterThanOrEqual(least - 1);
  });

  test("a #choice column opens on its values; Own list makes one from them, named after the column", async ({ page }) => {
    await load(page, ["| Task | Stav úkolu #choice |", "|---|---|", "| A | done |", "| B | open |", "| C | done |", ""].join("\n"));
    await openChoices(page);
    await expect(dialog(page).getByRole("radio", { name: /Column's values/ })).toBeChecked();
    await dialog(page).getByRole("radio", { name: /Own list/ }).check();
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

  test("Choice in the Type menu opens the dialog: a column of a list made #choice by Column's values; Cancel changes nothing", async ({ page }) => {
    await load(page);
    await header(page, 1).click({ button: "right" });
    await menu(page).getByTitle(/Change the column's type/).click();
    await expect(menu(page).locator(".swt-menu-item", { hasText: /^Choice$/ })).toHaveAttribute("aria-checked", "false");
    await expect(menu(page).locator(".swt-menu-segmented", { hasText: "Choice: status" }).getByTitle("Take the list status for this column")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await pickChoice(page);
    await expect(dialog(page).getByRole("radio", { name: /Own list/ })).toBeChecked();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await settled(page);
    expect(await markdown(page)).toContain("#choice-status");
    await pickChoice(page);
    await dialog(page).getByRole("radio", { name: /Column's values/ }).check();
    await expect(dialog(page).locator(".swt-choices-list")).toBeHidden();
    await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
    const text = await markdown(page);
    expect(text).toMatch(/\| Task +\| Status #choice +\|/);
    expect(text).toContain("columntypes.choice.status");
  });

  test.describe("a list from a source of the space or a formula", () => {
    test.beforeEach(async ({ page }) => {
      await defineSources(page);
    });

    const PROJECTS = ["| Task | Project |", "|---|---|", "| A | Atlas |", "| B | Delta |", ""].join("\n");

    test("a source picked over the formula writes its formula: the column checks its values, the editor offers them", async ({ page }) => {
      await load(page, PROJECTS, 2);
      await pickChoice(page);
      await dialog(page).getByRole("radio", { name: /^Formula$/ }).check();
      await dialog(page).getByRole("combobox", { name: "Source", exact: true }).selectOption("projects");
      await expect(dialog(page).locator(".swt-choices-name")).toHaveValue("projects");
      await expect(dialog(page).getByLabel("Source's column")).toBeHidden();
      await expect(dialog(page).getByRole("textbox", { name: "Formula" })).toHaveValue("=@projects");
      await expect(dialog(page).locator(".swt-choices-readonly")).toHaveText(["Atlas", "Beacon", "Comet"]);
      await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
      const text = await markdown(page);
      expect(text).toMatch(/\| Task +\| Project #choice-projects +\|/);
      expect(text).toContain("columntypes.choice.projects='=@projects'");
      await expect(columnCells(page, 1).nth(1)).toHaveClass(/swt-type-invalid/);
      await expect(columnCells(page, 1).nth(0)).not.toHaveClass(/swt-type-invalid/);
      await cell(page, 2, 1).dblclick();
      await expect(page.locator(".swt-choices .swt-choice")).toHaveText(["Atlas", "Beacon", "Comet"]);
    });

    test("a source of several columns asks for its column; a list of a source opens on it again", async ({ page }) => {
      await load(page, PROJECTS, 2);
      await pickChoice(page);
      await dialog(page).getByRole("radio", { name: /^Formula$/ }).check();
      await dialog(page).getByRole("combobox", { name: "Source", exact: true }).selectOption("tasks");
      await dialog(page).getByLabel("Source's column").selectOption({ label: "page" });
      await expect(dialog(page).getByRole("textbox", { name: "Formula" })).toHaveValue("=@tasks[page]");
      await expect(dialog(page).locator(".swt-choices-readonly")).toHaveText(["Projects/Atlas", "Projects/Beacon", "Projects/Comet"]);
      await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
      expect(await markdown(page)).toContain("columntypes.choice.tasks='=@tasks[page]'");
      await openChoices(page);
      await expect(dialog(page).getByRole("radio", { name: /^Formula$/ })).toBeChecked();
      await expect(dialog(page).getByRole("combobox", { name: "Source", exact: true })).toHaveValue("tasks");
      await expect(dialog(page).getByLabel("Source's column").locator("option:checked")).toHaveText("page");
    });

    test("Formula: a formula of one's own, its values shown as it is typed, why it gives none said", async ({ page }) => {
      await load(page, PROJECTS, 2);
      await pickChoice(page);
      await dialog(page).getByRole("radio", { name: /^Formula$/ }).check();
      const field = dialog(page).getByRole("textbox", { name: "Formula" });
      await field.fill("=@tasks");
      // A formula reading a source alone shows it over the field; any other, none
      const source = dialog(page).getByRole("combobox", { name: "Source", exact: true });
      await expect(source).toHaveValue("tasks");
      await expect(dialog(page).locator(".swt-choices-preview .swt-choices-empty")).toContainText("the result has 5 columns: pick one");
      await field.fill("=SORT(UNIQUE(@tasks[page]), 1, -1)");
      await expect(source).toHaveValue("");
      await expect(dialog(page).locator(".swt-choices-readonly")).toHaveText(["Projects/Comet", "Projects/Beacon", "Projects/Atlas"]);
      // The name's field keeps its width as the name changes (the hashtag it makes is under it)
      const name = dialog(page).locator(".swt-choices-name");
      const width = (await name.boundingBox())!.width;
      await name.fill("pages-of-every-project-in-the-space");
      expect((await name.boundingBox())!.width).toBe(width);
      await name.fill("pages");
      await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
      const text = await markdown(page);
      expect(text).toMatch(/\| Task +\| Project #choice-pages +\|/);
      expect(text).toContain("columntypes.choice.pages='=SORT(UNIQUE(@tasks[page]), 1, -1)'");
      await openChoices(page);
      await expect(dialog(page).getByRole("radio", { name: /^Formula$/ })).toBeChecked();
      await expect(dialog(page).getByRole("textbox", { name: "Formula" })).toHaveValue("=SORT(UNIQUE(@tasks[page]), 1, -1)");
    });

    test("a list made by a formula is under Choice in the Type menu, its formula in its hint, taken for another column there", async ({ page }) => {
      await load(page, ["| Task | Next | Project #choice-projects |", "|---|---|---|", "| A | Delta | Atlas |", "| <meta core.table columntypes.choice.projects='=@projects'> |", ""].join("\n"), 1);
      await header(page, 1).click({ button: "right" });
      await menu(page).getByTitle("Choose how the column's cells show").click();
      const row = menu(page).locator(".swt-menu-segmented", { hasText: "Choice: projects" });
      await expect(row.locator(".swt-label")).toHaveAttribute("title", "=@projects · Used by Project");
      await rendersAnew(page, () => row.getByTitle("Take the list projects for this column").click());
      expect(await markdown(page)).toMatch(/\| Next #choice-projects +\|/);
      await expect(columnCells(page, 1).nth(0)).toHaveClass(/swt-type-invalid/);
    });

    test("a source from a query: its list read anew once a page of its tag is indexed", async ({ page }) => {
      test.skip(target !== "silverbullet", "Space Lua and its index: SilverBullet only");
      await setOtherPage(page, "UiTests/Alpha", "#uichoice\n");
      await defineSources(
        page,
        [
          "```space-lua",
          'silverware.table.defineSource({ name = "uichoices", data = function() return query[[from p = index.tag "uichoice" select p.name]] end })',
          "```",
          "",
        ].join("\n"),
      );
      await load(page, ["| Task | Project #choice-uichoices |", "|---|---|", "| A | UiTests/Alpha |", "| B | UiTests/Beta |", "| <meta core.table columntypes.choice.uichoices='=@uichoices'> |", ""].join("\n"), 2);
      await expect(columnCells(page, 1).nth(0)).not.toHaveClass(/swt-type-invalid/);
      await expect(columnCells(page, 1).nth(1)).toHaveClass(/swt-type-invalid/);
      await setOtherPage(page, "UiTests/Beta", "#uichoice\n");
      await expect(columnCells(page, 1).nth(1)).not.toHaveClass(/swt-type-invalid/, { timeout: 10_000 });
      await cell(page, 1, 1).dblclick();
      const choices = page.locator(".swt-choices .swt-choice");
      await expect(choices).toHaveCount(2);
      expect((await choices.allTextContents()).sort()).toEqual(["UiTests/Alpha", "UiTests/Beta"]);
    });
  });

  test("Choice picked for a column of no type opens the dialog on a list of its own, saved as the column's", async ({ page }) => {
    await load(page, ["| Task | Status |", "|---|---|", "| A | open |", "| B | done |", ""].join("\n"), 2);
    await pickChoice(page);
    await expect(dialog(page).getByRole("radio", { name: /Own list/ })).toBeChecked();
    await expect(dialog(page).locator(".swt-choices-value")).toHaveCount(2);
    await rendersAnew(page, () => dialog(page).getByRole("button", { name: "Save" }).click());
    const text = await markdown(page);
    expect(text).toMatch(/\| Task +\| Status #choice-status +\|/);
    expect(text).toContain(`columntypes.choice.status='["done","open"]'`);
  });
});
