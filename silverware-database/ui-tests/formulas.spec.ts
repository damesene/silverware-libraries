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
  await page.locator(".swd-formula-property-row", { hasText: /^Name/ }).locator(".swd-formula-property").click();
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

test("a formula on a phone's width: its field and panel first, a property found by its name typed", async ({ page, space }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  await page.locator(".swd-menu .swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: /^Properties$/ }) }).first().click();
  await page.locator(".swd-property-new-label").fill("Shout");
  await page.locator(".swd-property-new-type").selectOption("formula");
  await page.locator(".swd-property-add").click();
  const field = page.locator('[data-focus="formula"]');
  await expect(field).toBeFocused();
  // (The formula above the name in the details, its panel under it)
  const top = async (selector: string) => (await page.locator(`[data-property="new:1"] ${selector}`).boundingBox())!.y;
  expect(await top(".swd-prop-formula")).toBeLessThan(await top(".swd-property-label"));
  await expect(page.locator(".swd-formula-panel")).toBeVisible();
  // A property found by its name typed, offered in the list as typed and in the panel
  await field.pressSequentially("=UPPER(Na");
  await expect(page.locator(".swd-formula-property-row:not([hidden]) .swd-formula-property-name")).toHaveText(["Name"]);
  await page.locator(".swd-formula-property", { hasText: "Name" }).click();
  await expect(field).toHaveValue("=UPPER([@name]");
  await expect(field).toBeFocused();
  await field.pressSequentially(")");
  await expect(page.locator(".swd-formula-result")).toHaveText("FIX LOGIN");
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

test("silverware.database.items in a ${…}: the items in their order, a formula's values among their values, nil for no database", async ({ page, space }) => {
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    shout: { type: formula, label: Shout, formula: \"=UPPER([@name])\" }\n---\n";
  // (Before the index has the database a ${…} may be evaluated once: nil then, taken as no items)
  const lines = [
    "# Page",
    "",
    'Items: ${(function() local t = {} for _, it in ipairs(silverware.database.items("tasks") or {}) do t[#t + 1] = it.name .. "/" .. it.status .. "/" .. tostring(it.shout) end return table.concat(t, ", ") end)()}',
    "",
    'Pages: ${(function() local t = {} for _, it in ipairs(silverware.database.items("tasks") or {}) do t[#t + 1] = it.ref end return table.concat(t, ", ") end)()}',
    "",
    'Missing: ${tostring(silverware.database.items("nope"))}',
    "",
  ].join("\n");
  await space.open({ Page: lines, ...TASKS, "Page/db-tasks": rootPage }, "Page");
  const line = (start: string) => page.locator(".cm-line", { hasText: start });
  await expect(line("Items:")).toContainText("Items: Fix login/Todo/FIX LOGIN, Write docs/Done/WRITE DOCS");
  // (The test's pages are in a folder of its own)
  await expect(line("Pages:")).toContainText(`Pages: ${space.folder}/Page/db-tasks/Fix login, ${space.folder}/Page/db-tasks/Write docs`);
  await expect(line("Missing:")).toContainText("Missing: nil");
});

test("a select whose options are a formula's: its list picked from in a cell, the value written, its formula alone in the root page", async ({ page, space }) => {
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties:\n    status: { type: select, label: Status, options: [Todo, Done] }\n    next: { type: select, label: Next, optionsFormula: \"=[name]\" }\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", ...TASKS, "Page/db-tasks": rootPage }, "Page");
  const cell = page.locator(".swd-table tbody tr", { hasText: "Fix login" }).locator('td[data-key="next"]');
  await cell.click();
  const select = cell.locator("select");
  await expect(select.locator("option")).toContainText(["Fix login", "Write docs"]);
  await select.selectOption("Write docs");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("next: Write docs\n");
  await expect(cell).toHaveText("Write docs");
  expect(await space.saved("Page/db-tasks")).not.toMatch(/next: \{[^}]*options:/);
});

