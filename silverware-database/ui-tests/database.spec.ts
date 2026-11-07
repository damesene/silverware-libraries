import { editorText, expect, item, root, runCommand, test, waitForIndex } from "./helpers.ts";

const BLOCK = "```silverware-database\nid: tasks\n```\n";
const TASKS = { "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0"), "Page/db-tasks/Write docs": item("Done", "a1") };

test("a block draws its database: the views on to switch, the one shown its items", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await expect(page.locator(".swd-switch")).toHaveCount(2);
  await expect(page.locator('.swd-switch[aria-pressed="true"]')).toHaveAttribute("data-view", "names");
  await expect(page.locator(".test-item")).toHaveText(["Fix login", "Write docs"]);
});

test("a view picked is written into the block it was picked in, the place drawn anew from it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n${BLOCK}`, ...TASKS }, "Page");
  await page.locator('.swd-switch[data-view="count"]').click();
  await expect(page.locator(".test-count")).toHaveText("2 of 2");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n\`\`\`silverware-database\nid: tasks\nview: count\n\`\`\`\n`);
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
});

test("a block in a list item is not written, said why, the page as it was", async ({ page, space }) => {
  const listed = "# Page\n\n- item\n  ```silverware-database\n  id: tasks\n  ```\n- next\n";
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
  await expect(page.locator(".swd-switch")).toHaveCount(2);
  await runCommand(page, "Silverware Database: Settings");
  await page.locator('.swd-settings [data-swd-view="count"]').click();
  await page.locator(".swd-settings-save").click();
  await expect(page.locator(".swd-settings")).toHaveCount(0);
  // (In a block of its own: the Configuration Manager writes its block anew from what its schema shows)
  await expect.poll(() => space.config()).toContain('-- managed-by: silverware-database');
  expect(await space.config()).toContain('config.set("silverware.database.views.count.enabled", false)');
  await expect(page.locator(".swd-switch")).toHaveCount(1);
});
