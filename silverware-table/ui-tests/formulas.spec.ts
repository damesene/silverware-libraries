import type { Page } from "@playwright/test";
import { cell, cursorLine, expect, header, markdown, openPage, pickerOfCommand, reload, rendersAnew, setOtherPage, setPage, target, test } from "./helpers.ts";

test.describe("Formulas", () => {
  test("a formula with a comparison and texts shows its result and is written as typed", async ({ page }) => {
    // Pear (Qty 3): its Origin made a formula
    await cell(page, 1, 3).dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type('=IF([@qty]>5, "many", "few")');
    await rendersAnew(page, async () => {
      // Tab saves (and opens the next cell's editor, which Esc leaves)
      await page.keyboard.press("Tab");
      await page.keyboard.press("Escape");
    });
    await expect(cell(page, 1, 3)).toHaveText("few");
    // Its quotes as typed (the value in apostrophes), its > as &gt; (SilverBullet ends a tag at its first >)
    expect(await markdown(page)).toContain(`few <meta formulas.f='=IF([@qty]&gt;5, "many", "few")'>`);
    // Rendered again from the page as stored: the tag hides whole, no part of the formula shows
    await reload(page);
    await expect(cell(page, 1, 3)).toHaveText("few");
  });

  test("the table's columns offered after [@ by their names, put in by their keys; none once the caret is moved into a reference", async ({ page }) => {
    const field = page.locator(".swt-cell-editor");
    const choices = page.locator(".swt-formula-choice code");
    await cell(page, 1, 3).dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("=[@p");
    await expect(choices).toHaveText(["Price"]);
    await page.keyboard.press("Tab");
    await expect(field).toHaveValue("=[@price]");
    await expect(choices).toHaveCount(0);
    // The caret moved back into the reference: nothing offered, Tab moves on, the reference as it was
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft");
    await expect(choices).toHaveCount(0);
    await rendersAnew(page, async () => {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Escape");
    });
    expect(await markdown(page)).toContain(`<meta formulas.f='=[@price]'>`);
  });

  test("a column's name selected in a reference and deleted: what is typed there offers the columns, the one picked closing it", async ({ page }) => {
    const field = page.locator(".swt-cell-editor");
    const choices = page.locator(".swt-formula-choice code");
    await cell(page, 1, 3).dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("=[@price]*2");
    await field.evaluate((input: HTMLInputElement) => input.setSelectionRange(3, 8));
    await page.keyboard.press("Backspace");
    await expect(field).toHaveValue("=[@]*2");
    await page.keyboard.type("p");
    await expect(choices).toHaveText(["Price"]);
    await page.keyboard.press("Tab");
    await expect(field).toHaveValue("=[@price]*2");
  });

  test("the list of names typed: Tab inserts the one picked, Enter saves the formula as typed", async ({ page }) => {
    const field = page.locator(".swt-cell-editor");
    const choices = page.locator(".swt-formula-choice code");
    await cell(page, 1, 3).dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("=su");
    await expect(choices.first()).toHaveText("SUBSTITUTE");
    await expect(choices.filter({ hasText: /^SUM$/ })).toHaveCount(1);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(field).toHaveValue("=SUM(");
    await expect(choices).toHaveCount(0);
    // A name the list offers things for, saved as typed with Enter: no function is put in its place
    await page.keyboard.press("Control+a");
    await page.keyboard.type("=ro");
    await expect(choices.first()).toBeVisible();
    await rendersAnew(page, () => page.keyboard.press("Enter"));
    expect(await markdown(page)).toContain(`<meta formulas.f='=ro'>`);
  });

  test("pointing at a header's sort button gives its column and sorts nothing", async ({ page }) => {
    const field = page.locator(".swt-cell-editor");
    await cell(page, 1, 3).dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("=SUM(");
    const before = await cell(page, 1, 0).textContent();
    await header(page, 1).hover();
    await header(page, 1).locator(".swt-sort").click();
    await expect(field).toHaveValue("=SUM([qty]");
    await expect(field).toBeFocused();
    // Not sorted: the first row is the one before
    await expect(cell(page, 1, 0)).toHaveText(before ?? "");
    await expect(header(page, 1).locator(".swt-sort.swt-active")).toHaveCount(0);
  });
});

test.describe("Formulas from Space Lua", () => {
  // Space Lua's ${…}: SilverBullet's
  test.skip(target !== "silverbullet", "SilverBullet only");

  // A table of each test's own name: a page of a test before is deleted, and the index may still have its table
  const ORDERS = (name: string) => ["| Customer | Qty |", "|---|--:|", "| Anna | 3 |", "| Petr | 2 |", `| <meta core.table core.name='${name}'> |`, ""];
  const line = (page: Page, start: string) => page.locator(".cm-line", { hasText: start });

  test("silverware.table.evaluateText in a ${…} of a page opened from another page reads that page's tables", async ({ page }) => {
    // As the page is opened, the editor still holds the page left: the formula must not be calculated on it
    const orders = ["# Orders", "", ...ORDERS("orders"), 'Customers: ${silverware.table.evaluateText("orders![customer]")}', ""].join("\n");
    await setOtherPage(page, "UiTests/Orders", orders);
    await openPage(page, "UiTests/Orders");
    await expect(line(page, "Customers:")).toContainText("Customers: Anna, Petr");
  });

  test("evaluate gives Lua the values, evaluateText the page an error that is no hashtag", async ({ page }) => {
    const values = [
      "# Values",
      "",
      ...ORDERS("values"),
      'Sum: ${(function() local s = 0 for _, q in ipairs(silverware.table.evaluate("values![qty]")) do s = s + q end return s end)()}',
      "",
      'Missing: ${(function() local v, e = silverware.table.evaluate("nope!A1") return tostring(v) .. " " .. e.code end)()}',
      "",
      'Error: ${silverware.table.evaluateText("nope!A1")}',
      "",
    ].join("\n");
    await setPage(page, values);
    await expect(line(page, "Sum:")).toContainText("Sum: 5");
    await expect(line(page, "Missing:")).toContainText("Missing: nil #REF!");
    await expect(line(page, "Error:")).toContainText("Error: #REF!");
    await expect(line(page, "Error:").locator(".sb-hashtag, .hashtag")).toHaveCount(0);
  });

  test("an alias of each gives what its function gives, the formulas in their calls followed as a column is renamed", async ({ page }) => {
    const aliases = [
      "# Aliases",
      "",
      ...ORDERS("aliases"),
      'Both: ${(function() silverware.table.evaluateAlias("uiev") silverware.table.evaluateTextAlias("uite") return uite("aliases![qty]") .. " / " .. uiev("aliases!B1") + 1 end)()}',
      "",
      'Text: ${silverware.table.evaluateText("aliases![qty]")}',
      "",
    ].join("\n");
    await setPage(page, aliases);
    await expect(line(page, "Both:")).toContainText("Both: 3, 2 / 4");
    // Qty renamed Amount: the formulas in every call of either function and their aliases follow
    await header(page, 1).dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Amount");
    await rendersAnew(page, () => page.keyboard.press("Enter"));
    const text = await markdown(page);
    expect(text).toContain('uite("aliases![amount]")');
    expect(text).toContain('silverware.table.evaluateText("aliases![amount]")');
    expect(text).toContain('uiev("aliases!B1")');
  });

  test("errorsText shows a page's formula errors as a table, the error no hashtag; Find formula errors opens its row", async ({ page }) => {
    const errors = [
      "# Errors",
      "",
      "| Item | Total |",
      "|---|---|",
      "| Pear | \\#REF! <meta formulas.f='=nope!A1'> |",
      "| <meta core.table core.name='errs'> |",
      "",
      "List: ${silverware.table.errorsText(editor.getCurrentPage())}",
      "",
    ].join("\n");
    await setOtherPage(page, "UiTests/Errors", errors);
    await openPage(page, "UiTests/Errors");
    const list = line(page, "List:").locator("table");
    await expect(list).toContainText("there is no table named nope");
    await expect(list.locator(".sb-hashtag, .hashtag")).toHaveCount(0);
    // The command: the space's errors, this page's among them; picked, its row with the cursor
    const picker = await pickerOfCommand(page, "Silverware Table: Find formula errors");
    await expect(picker).toContainText("UiTests/Errors · B1 #REF!");
    await page.keyboard.type("Errors");
    await page.keyboard.press("Enter");
    await expect.poll(() => cursorLine(page)).toContain("| Pear |");
  });

  test("errors gives a script the page's errors as records; errorsText says when a page has none", async ({ page }) => {
    await setOtherPage(page, "UiTests/Clean", ["| Qty |", "|---|", "| 2 <meta formulas.f='=1+1'> |", ""].join("\n"));
    const records = [
      "# Records",
      "",
      "| Item | Total |",
      "|---|---|",
      "| Pear | \\#REF! <meta formulas.f='=nope!A1'> |",
      "| <meta core.table core.name='recs'> |",
      "",
      'Found: ${(function() local e = silverware.table.errors(editor.getCurrentPage()) return #e .. " " .. e[1].cell .. " in " .. e[1].table end)()}',
      "",
      'Clean: ${silverware.table.errorsText("UiTests/Clean")}',
      "",
    ].join("\n");
    await setPage(page, records);
    await expect(line(page, "Found:")).toContainText("Found: 1 B1 in recs");
    await expect(line(page, "Clean:")).toContainText("Clean: No formula errors");
  });
});
