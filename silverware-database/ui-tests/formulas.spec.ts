import { expect, item, root, test } from "./helpers.ts";

// A database's formula properties (docs/silverware-database-formulas.md): made in Properties, kept in the root page
// alone, their values calculated in the views
const TASKS = { "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0"), "Page/db-tasks/Write docs": item("Done", "a1") };

test("a formula made in Properties: a property's button puts it in, its result shown as typed, kept in the root page, its values in the table", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await page.locator(".swd-menu .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: /^Properties$/ }) }).first().click();
  await page.locator(".swd-property-new-label").fill("Shout");
  await page.locator(".swd-property-new-type").selectOption("formula");
  await page.locator(".swd-property-add").click();
  const field = page.locator('[data-focus="formula"]');
  await expect(field).toBeFocused();
  await field.pressSequentially("=UPP");
  // (The function offered as typed, put in by Enter)
  await expect(page.locator(".swd-formulafield-choice-active")).toContainText("UPPER");
  await page.keyboard.press("Enter");
  await page.locator(".swd-formula-property", { hasText: /^Name$/ }).click();
  await field.pressSequentially(")");
  await expect(field).toHaveValue("=UPPER([@name])");
  await expect(page.locator(".swd-formula-result")).toHaveText("FIX LOGIN");
  await page.locator(".swd-properties-save").click();
  await expect(page.locator(".swd-properties")).toHaveCount(0);
  await expect.poll(() => space.saved("Page/db-tasks")).toMatch(/shout: \{ type: formula, label: Shout, formula: "?=UPPER\(\[@name\]\)"? \}/);
  const cell = (name: string) => page.locator(".swd-table tbody tr", { hasText: name }).locator('td[data-key="shout"]');
  await expect(cell("Write docs")).toHaveText("WRITE DOCS");
  // (No value of it in an item's page)
  expect(await space.saved("Page/db-tasks/Fix login")).not.toContain("shout");
});

test("a formula read: ƒ in its column's header, its formula over it, an error's cell its code with why, its formula in the item's panel", async ({ page, space }) => {
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    qty: { type: number, label: Qty }\n    half: { type: formula, label: Half, formula: \"=10/[@qty]\" }\n---\n";
  const withQty = (status: string, rank: string, qty: number) => item(status, rank).replace("_database:", `qty: ${qty}\n_database:`);
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", "Page/db-tasks": rootPage, "Page/db-tasks/Fix login": withQty("Todo", "a0", 4), "Page/db-tasks/Write docs": withQty("Done", "a1", 0) }, "Page");
  const head = page.locator(".swd-table th", { hasText: "Half" });
  await expect(head.locator(".swd-table-head-formula")).toBeVisible();
  await expect(head.locator(".swd-table-sort")).toHaveAttribute("title", "Half = 10/[@qty]\nSort by Half");
  const cell = (name: string) => page.locator(".swd-table tbody tr", { hasText: name }).locator('td[data-key="half"]');
  await expect(cell("Fix login")).toHaveText("2.5");
  await expect(cell("Write docs")).toHaveText("#DIV/0!");
  await expect(cell("Write docs")).toHaveClass(/swd-formula-error/);
  await expect(cell("Write docs")).toHaveAttribute("title", /^#DIV\/0!: /);
  // Read only: a press edits nothing
  await cell("Fix login").click();
  await expect(cell("Fix login").locator("input")).toHaveCount(0);
  // The item's panel: its ƒ, its formula over its name, an error's value its code with why
  const row = page.locator(".swd-table tbody tr", { hasText: "Write docs" });
  await row.locator(".swd-table-name").hover();
  await row.locator(".swd-open").click();
  const label = page.locator('.swd-peek .swd-peek-row[data-property="half"] .swd-peek-label');
  await expect(label).toHaveAttribute("title", "Half = 10/[@qty]\nEdit its formula");
  const value = page.locator('.swd-peek .swd-peek-value[data-key="half"]');
  await expect(value).toHaveText("#DIV/0!");
  await expect(value).toHaveClass(/swd-invalid/);
  await expect(value).toHaveAttribute("title", /^#DIV\/0!: /);
});
