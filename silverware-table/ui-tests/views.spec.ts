import { cell, expect, header, hoverCell, markdown, notification, rendersAnew, setPage, table, tableIcon, test } from "./helpers.ts";

const TASKS = `| Name | Assignee | Hours |
|---|---|--:|
| Write | anna | 3 |
| Test | petr | 1 |
| Ship | anna | 2 |
| <meta core.table core.name='tasks'> |`;

const PAGE = `# Views

${TASKS}

| Assignee |
|---|
| anna |
| <meta core.table core.name='people' view.formula='=SORT(UNIQUE(tasks![assignee]))'> |
`;

test.describe("Views", () => {
  test.beforeEach(async ({ page }) => {
    await setPage(page, PAGE);
  });

  test("a view says it is out of date in its tab; Refresh view writes it, an edit of its source writes it anew", async ({ page }) => {
    await expect(cell(page, 1, 0, 1)).toHaveText("anna");
    await page.mouse.move(2, 2);
    const tabs = page.locator(".swt-table-label.swt-visible");
    // Written before petr had a task: out of date
    await expect(tabs).toHaveText(["tasks", "View · Out of date · people"]);
    await hoverCell(page, cell(page, 1, 0, 1));
    const refresh = page.locator('.swt-bar.swt-visible button[aria-label="Refresh view"]');
    await expect(refresh).toHaveClass(/swt-attention/);
    await rendersAnew(page, () => refresh.click(), 1);
    await expect(table(page, 1).locator("tr[data-swt-row]")).toHaveText([/anna/, /petr/]);
    // An edit of the source: the view written anew with it, in the same edit
    await cell(page, 2, 1).dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("eva");
    await rendersAnew(page, () => page.keyboard.press("Enter"), 1);
    await expect(table(page, 1).locator("tr[data-swt-row]")).toHaveText([/anna/, /eva/]);
    // A cell of the view: no editor, said why, its settings open instead
    await cell(page, 1, 0, 1).dblclick();
    await expect(page.locator(".swt-cell-editor")).toHaveCount(0);
    await expect(notification(page, /is a view/)).toBeVisible();
    await expect(page.locator(".swt-view-dialog")).toBeVisible();
  });

  test("Insert view… shows the table its formula makes as it is typed, fx puts a function in, Insert writes it under its source", async ({ page }) => {
    await expect(cell(page, 1, 0)).toHaveText("Write");
    await hoverCell(page, cell(page, 1, 0));
    await (await tableIcon(page, "Insert view…")).click();
    const dialog = page.locator(".swt-view-dialog");
    const field = dialog.locator('input[aria-label="Formula"]');
    await expect(field).toHaveValue("=tasks![#Data]");
    await expect(dialog.locator(".swt-view-size")).toHaveText("3 rows × 3 columns");
    // Of one height: a preview of fewer rows, or none (an error), moves nothing
    const box = await dialog.boundingBox();
    await field.fill("=SUM(tasks![hours])");
    await expect(dialog.locator(".swt-view-size")).toHaveText("1 row × 1 column");
    expect(await dialog.boundingBox()).toEqual(box);
    await field.fill("=nothing![#Data]");
    await expect(dialog.locator(".swt-view-none")).toBeVisible();
    expect(await dialog.boundingBox()).toEqual(box);
    // fx: the Functions dialog, the function picked put in where the caret was
    await field.fill("=");
    await dialog.locator('button[aria-label="Functions"]').click();
    const functions = page.locator(".swt-functions-dialog");
    await functions.locator('input[aria-label="Search functions"]').fill("FILTER");
    await functions.locator('input[aria-label="Search functions"]').press("Enter");
    await expect(functions).toHaveCount(0);
    await expect(page.locator(".swt-view-dialog input[aria-label=\"Formula\"]")).toHaveValue("=FILTER(");
    await page.locator('.swt-view-dialog input[aria-label="Formula"]').fill('=FILTER(tasks![#Data], tasks![assignee] = "anna")');
    await expect(page.locator(".swt-view-dialog .swt-view-table tbody tr")).toHaveText([/Write\s*anna\s*3/, /Ship\s*anna\s*2/]);
    await page.locator('.swt-view-dialog input[aria-label="Name"]').fill("annas");
    await page.locator(".swt-view-dialog .swt-dialog-primary").click();
    await expect(page.locator(".swt-view-dialog")).toHaveCount(0);
    await expect.poll(() => markdown(page)).toContain(`view.formula='=FILTER(tasks![#Data], tasks![assignee] = "anna")' core.name='annas'`);
    await expect(cell(page, 2, 0, 1)).toHaveText("Ship");
  });

  test("a view of HSTACK: its headers by its parts' columns, a column calculated beside them shown as markdown", async ({ page }) => {
    await expect(cell(page, 1, 0)).toHaveText("Write");
    await hoverCell(page, cell(page, 1, 0));
    await (await tableIcon(page, "Insert view…")).click();
    const dialog = page.locator(".swt-view-dialog");
    await dialog.locator('input[aria-label="Formula"]').fill('=HSTACK(tasks![name], tasks![hours], "[[" & tasks![assignee] & "]]")');
    await expect(dialog.locator(".swt-view-size")).toHaveText("3 rows × 3 columns");
    await expect(dialog.locator(".swt-view-table thead th")).toHaveText(["Name", "Hours", "C"]);
    await dialog.locator(".swt-dialog-primary").click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => markdown(page)).toMatch(/\| Write \| +3 \| \[\[anna\]\] \|/);
    const view = table(page, 1);
    for (const [column, name] of ["Name", "Hours", "C"].entries()) await expect(header(page, column, 1).locator(".swt-head-name")).toHaveText(name);
    // The page as a link, as SilverBullet renders [[…]]
    await expect(view.locator('tr[data-swt-row="1"] > td').nth(2).locator("a")).toHaveText("anna");
  });
});
