// Sources of the space: tables a space-lua block gives (silverware.table.defineSource),
// read in formulas as @name. The playground has fixed sources (tasks, projects),
// SilverBullet those a script of the test defines alike; a query's source read anew
// as a page is indexed: SilverBullet only.
import { cell, defineSources, expect, hoverCell, markdown, reload, rendersAnew, setOtherPage, setPage, tableIcon, target, test } from "./helpers.ts";

// The playground's sources (playground/playground.ts: kept in step with it), as a script defines them in SilverBullet
const SCRIPT = [
  "```space-lua",
  'silverware.table.defineSource("tasks", { columns = { "name", "page", "due", "done", "tags" } }, function()',
  "  return {",
  '    { name = "Write the plan", page = "Projects/Atlas", due = "2025-11-10", done = true, tags = { "planning" } },',
  '    { name = "Review the budget", page = "Projects/Atlas", due = "2025-11-14", done = false, tags = { "money", "review" } },',
  '    { name = "Call the printer", page = "Projects/Beacon", due = "2025-11-12", done = false },',
  '    { name = "Order paper", page = "Projects/Beacon", due = "2025-11-20", done = false, tags = { "money" } },',
  '    { name = "Send the invoice", page = "Projects/Comet", due = "2025-11-08", done = true, tags = { "money" } },',
  "  }",
  "end)",
  'silverware.table.defineSource("projects", function() return { "Atlas", "Beacon", "Comet" } end)',
  "```",
  "",
].join("\n");

const PAGE = "| Open | Note |\n|---|---|\n| | x |\n";

test.describe("Sources of the space", () => {
  test.beforeEach(async ({ page }) => {
    await defineSources(page, SCRIPT);
  });

  test("@ offers the sources as a formula is typed, and their columns in their brackets; the formula reads them", async ({ page }) => {
    await setPage(page, PAGE);
    await expect(cell(page, 1, 1)).toHaveText("x");
    const field = page.locator(".swt-cell-editor");
    const choices = page.locator(".swt-formula-choice code");
    await cell(page, 1, 0).dblclick();
    await expect(field).toBeFocused();
    await page.keyboard.type('=COUNTIFS(@');
    await expect(choices).toHaveText(["@projects", "@tasks"]);
    await page.keyboard.type("t");
    await expect(choices).toHaveText(["@tasks"]);
    await page.keyboard.press("Tab");
    await page.keyboard.type("[d");
    await expect(choices).toHaveText(["due", "done"]);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(field).toHaveValue("=COUNTIFS(@tasks[done]");
    await page.keyboard.type(', "FALSE")');
    // Tab saves (and opens the next cell's editor, which Esc leaves)
    await rendersAnew(page, async () => {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Escape");
    });
    await expect(cell(page, 1, 0)).toHaveText("3");
    expect(await markdown(page)).toContain(`3 <meta formulas.f='=COUNTIFS(@tasks[done], "FALSE")'>`);
  });

  test("Insert pivot table… offers the space's sources as a group of their own, the pivot written of @tasks", async ({ page }) => {
    await setPage(page, "# Pivots\n\n| Note |\n|---|\n| Tasks by page |\n");
    await expect(cell(page, 1, 0)).toHaveText("Tasks by page");
    await hoverCell(page, cell(page, 1, 0));
    await (await tableIcon(page, "Insert pivot table…")).click();
    const dialog = page.locator(".swt-pivot-dialog");
    const source = dialog.locator('select[aria-label="Source"]');
    await expect(source.locator('optgroup[label="Sources of the space"] option')).toHaveText(["@projects", "@tasks"]);
    await source.selectOption("@tasks");
    await dialog.locator('select[aria-label="Row 1 column"]').selectOption("page");
    await dialog.locator('select[aria-label="Value 1 column"]').selectOption("name");
    await dialog.locator('select[aria-label="Value 1 function"]').selectOption("COUNTA");
    await expect(dialog.locator(".swt-pivot-table tr").nth(1)).toHaveText(/Projects\/Atlas\s*2/);
    await dialog.locator(".swt-dialog-primary").click();
    await expect.poll(() => markdown(page)).toContain("pivot.source='@tasks'");
    await expect(cell(page, 1, 1, 1)).toHaveText("2");
  });

  test("a source from a query is read anew as a page is indexed: Recalculate highlighted, nothing written until it is pressed", async ({ page }) => {
    test.skip(target !== "silverbullet", "Space Lua and its index: SilverBullet only");
    await setOtherPage(page, "UiTests/Alpha", "#uiproject\n");
    await setOtherPage(
      page,
      "UiTests/QueryScript",
      ["```space-lua", 'silverware.table.defineSource("uiprojects", function()', '  return query[[from p = index.tag "uiproject" select { name = p.name }]]', "end)", "```", ""].join("\n"),
    );
    await reload(page);
    await setPage(page, "| Count |\n|---|\n| 1 <meta formulas.f='=COUNTA(@uiprojects[name])'> |\n");
    await expect(cell(page, 1, 0)).toHaveText("1");
    const recalc = page.locator('.swt-bar button[aria-label="Recalculate"]');
    await cell(page, 1, 0).hover();
    await expect(recalc).not.toHaveClass(/swt-attention/);
    // A page of the tag made: the source gives it once indexed, the table out of date
    await setOtherPage(page, "UiTests/Beta", "#uiproject\n");
    await cell(page, 1, 0).hover();
    await expect(recalc).toHaveClass(/swt-attention/, { timeout: 10_000 });
    expect(await markdown(page)).toContain("| 1 <meta");
    await rendersAnew(page, () => recalc.click());
    await expect(cell(page, 1, 0)).toHaveText("2");
  });
});
