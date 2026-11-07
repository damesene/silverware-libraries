import { editorText, expect, item, root, runCommand, test, waitForIndex } from "./helpers.ts";

// (The test's own view named: the built-in ones come first in the switcher)
const BLOCK = "```silverware-database\nid: tasks\nview: names\n```\n";
const TASKS = { "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0"), "Page/db-tasks/Write docs": item("Done", "a1") };

test("a block draws its database: the views on to switch, the one shown its items", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await expect(page.locator(".swd-switch")).toHaveCount(5);
  expect(await page.locator(".swd-switch").evaluateAll((all) => all.map((one) => (one as HTMLElement).dataset.view))).toEqual(["table", "list", "kanban", "names", "count"]);
  await expect(page.locator('.swd-switch[aria-pressed="true"]')).toHaveAttribute("data-view", "names");
  await expect(page.locator(".test-item")).toHaveText(["Fix login", "Write docs"]);
});

test("a view picked is written into the block it was picked in, the place drawn anew from it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await page.locator('.swd-switch[data-view="count"]').click();
  await expect(page.locator(".test-count")).toHaveText("2 of 2");
  await expect.poll(() => space.saved("Page")).toBe("# Page\n\n```silverware-database\nid: tasks\nview: count\n```\n");
});

test("actions one after another are each written into the block, SilverBullet's controls of it hidden", async ({ page, space }) => {
  await space.open({ Page: `# Page

${BLOCK}`, ...TASKS }, "Page");
  await page.locator('.swd-switch[data-view="count"]').click();
  await expect.poll(() => space.saved("Page")).toContain("view: count");
  await page.locator('.swd-switch[data-view="names"]').click();
  await expect.poll(() => space.saved("Page")).toContain("view: names");
  await page.locator('.swd-switch[data-view="list"]').click();
  await expect.poll(() => space.saved("Page")).toContain("view: list");
  await expect(page.locator(".swd-place")).toHaveCount(1);
  for (const control of await page.locator(".swd-widget .button-bar button, .swd-widget .sb-widget-menu-bar button, .sb-code-copy-button").all()) await expect(control).toBeHidden();
});

test("a press beside the block, on its lines, does not show its markdown", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}\nAfter\n`, ...TASKS }, "Page");
  await expect(page.locator(".test-item")).toHaveCount(2);
  const widget = (await page.locator(".swd-widget").boundingBox())!;
  const place = (await page.locator(".swd-place").boundingBox())!;
  const closing = (await page.locator(".cm-line.sb-fenced-code-hide").first().boundingBox())!;
  // In the widget's margin above the place, and on the closing fence hidden under it
  for (const [x, y] of [
    [widget.x + 40, (widget.y + place.y) / 2],
    [closing.x + 40, closing.y + closing.height / 2],
  ]) {
    await page.mouse.click(x!, y!);
    await expect(page.locator(".swd-place")).toBeVisible();
    await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(0);
  }
});

test("an item added is written as a page of the database and shown at once, and still once the index has it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await page.locator(".test-add").click();
  await expect(page.locator(".test-item")).toHaveCount(3);
  // (SilverBullet tells of the page indexed before a query has it: the item stays shown through that, and once the index has it)
  const added = (await page.locator(".test-item").last().textContent())!;
  await waitForIndex(page, "db", `${space.folder}/Page/db-tasks/${added}`);
  await expect(page.locator(".test-item")).toHaveCount(3);
  expect(await space.saved(`Page/db-tasks/${added}`)).toBe("---\ntags: [db]\n_database:\n  rank: a2\n---\n");
});

test("the command New database makes its root page beside the page open and its block at the cursor", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\ntext\n" }, "Page");
  // (The page's text loaded first: loading it puts the cursor at its start)
  await expect.poll(() => editorText(page)).toBe("# Page\n\ntext\n");
  await page.evaluate(() => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { length: number } }; dispatch(spec: unknown): void } } }).client.editorView;
    view.dispatch({ selection: { anchor: view.state.doc.length } });
  });
  await runCommand(page, "Silverware Database: New database");
  const field = page.locator(".sb-modal-box input").first();
  await field.fill("Ideas");
  await field.press("Enter");
  await expect(page.locator(".swd-place")).toHaveCount(1);
  await expect.poll(() => space.saved("Page/db-ideas")).toContain("  id: ideas\n  name: Ideas\n");
  expect(await editorText(page)).toBe("# Page\n\ntext\n\n```silverware-database\nid: ideas\n```\n");
  // A new database shows its first view, the table
  await expect(page.locator('.swd-switch[aria-pressed="true"]')).toHaveAttribute("data-view", "table");
});

test("a block in a list item is not written, said why, the page as it was", async ({ page, space }) => {
  const listed = "# Page\n\n- item\n  ```silverware-database\n  id: tasks\n  view: names\n  ```\n- next\n";
  await space.open({ Page: listed, ...TASKS }, "Page");
  await page.locator('.swd-switch[data-view="count"]').click();
  await expect(page.locator(".sb-notifications")).toContainText("indented");
  expect(await space.saved("Page")).toBe(listed);
});

test("of two blocks written alike, the one a view is picked in is written", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}\ntext between\n\n${BLOCK}`, ...TASKS }, "Page");
  await expect(page.locator(".swd-place")).toHaveCount(2);
  await page.locator(".swd-place").nth(1).locator('.swd-switch[data-view="count"]').click();
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${BLOCK}\ntext between\n\n\`\`\`silverware-database\nid: tasks\nview: count\n\`\`\`\n`);
});

test("the settings turn a view off: saved in CONFIG, the switcher without it at once", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await expect(page.locator(".swd-switch")).toHaveCount(5);
  await runCommand(page, "Silverware Database: Settings");
  await page.locator('.swd-settings [data-swd-view="count"]').click();
  await page.locator(".swd-settings-save").click();
  await expect(page.locator(".swd-settings")).toHaveCount(0);
  // (In a block of its own: the Configuration Manager writes its block anew from what its schema shows)
  await expect.poll(() => space.config()).toContain('-- managed-by: silverware-database');
  expect(await space.config()).toContain('config.set("silverware.database.views.count.enabled", false)');
  await expect(page.locator(".swd-switch")).toHaveCount(4);
});

test("the table edits a value in place, written into the item's page", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\n```\n", ...TASKS }, "Page");
  const cell = page.locator('.swd-table tbody tr:first-child [data-key="status"]');
  await cell.click();
  await cell.locator("select").selectOption("Done");
  await expect(cell).toHaveText("Done");
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toBe("---\ntags: [db]\nstatus: Done\n_database:\n  rank: a0\n---\n");
});

test("the kanban moves a card to another column, its value written", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: kanban\n```\n", ...TASKS }, "Page");
  await expect(page.locator(".swd-kanban-column")).toHaveCount(3);
  await page.locator('.swd-kanban-column[data-value="Todo"] .swd-kanban-move').selectOption({ label: "Done" });
  await expect(page.locator('.swd-kanban-column[data-value="Done"] .swd-kanban-name')).toHaveText(["Write docs", "Fix login"]);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: Done\n");
});

test("the Properties dialog adds a property and changes a type, the change of items shown before it is written", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-properties-button").click();
  await page.locator(".swd-property-new-label").fill("Estimate");
  await page.locator(".swd-property-new-type").selectOption("number");
  await page.locator(".swd-property-add").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("    estimate: { type: number, label: Estimate }\n");
  await page.locator('[data-property="status"] .swd-property-type').selectOption("text");
  await expect(page.locator(".swd-property-review")).toContainText("Change the type of Status: no item's value changes");
  // Nothing written until applied
  expect(await space.saved("Page/db-tasks")).toContain("status: { type: select");
  await page.locator(".swd-property-apply").click();
  await expect.poll(() => space.saved("Page/db-tasks")).toContain("status: { type: text");
});

test("the peek shows an item beside the page, its content written as it is left, no key reaching the page", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", ...TASKS }, "Page");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  await expect(page.locator(".swd-peek")).toBeVisible();
  await expect(page.locator(".swd-peek-name")).toHaveValue("Fix login");
  const body = page.locator(".swd-peek-body");
  await expect(body).toBeEditable();
  await body.fill("Steps to fix\n");
  await body.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-peek")).toHaveCount(0);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("Steps to fix\n");
  expect(await space.saved("Page")).toBe("# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n");
});

test("a type of the user's shows and reads its values, one that fails shows them as kept, a view's definition given HELPERS", async ({ page, space }) => {
  const rootPage = "---\ntags: [db-root]\n_database:\n  id: rated\n  name: Rated\n  format: 1\n  properties:\n    rating: { type: stars, label: Rating }\n    odd: { type: broken, label: Odd }\n---\n";
  const one = "---\ntags: [db]\nrating: 3\nodd: kept\n_database:\n  rank: a0\n---\n";
  await space.open({ Page: "# Page\n\n```silverware-database\nid: rated\nview: table\n```\n", "Page/db-rated": rootPage, "Page/db-rated/One": one }, "Page");
  const rating = page.locator('tbody tr:first-child [data-key="rating"]');
  await expect(rating).toHaveText("★★★");
  await expect(page.locator('tbody tr:first-child [data-key="odd"]')).toHaveText("kept");
  await rating.click();
  const field = rating.locator("input");
  await field.fill("5");
  await field.press("Enter");
  await expect.poll(() => space.saved("Page/db-rated/One")).toContain("rating: 5\n");
  await expect(page.locator('tbody tr:first-child [data-key="rating"]')).toHaveText("★★★★★");
  await page.locator('.swd-switch[data-view="count"]').click();
  await expect(page.locator(".test-count")).toHaveAttribute("title", "helpers: function");
});
