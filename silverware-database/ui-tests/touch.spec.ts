import { expect, item, root, test } from "./helpers.ts";

// On a phone (the "touch" project: a Pixel 7, pressed by a finger)
const TASKS = { "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0"), "Page/db-tasks/Write docs": item("Done", "a1") };

test("the item's panel opened on a phone, by + New and by Open, leaves the page where it was as it closes", async ({ page, space }) => {
  // (A database under a long page: scrolled down to it)
  const above = Array.from({ length: 80 }, (_, n) => `Line ${n} of the text above the database.`).join("\n\n");
  await space.open({ Page: `# Page\n\n${above}\n\n\`\`\`silverware-database\nid: tasks\nview: table\n\`\`\`\n`, ...TASKS }, "Page");
  await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller")!;
    scroller.scrollTop = scroller.scrollHeight;
  });
  const add = page.locator(".swd-table-add").first();
  await expect(add).toBeVisible();
  const scrolled = () => page.evaluate(() => Math.round(document.querySelector(".cm-scroller")!.scrollTop));
  const at = await scrolled();
  expect(at).toBeGreaterThan(1000);
  // + New: the item added in the panel, its name to type; closed, the page as it was (the editor never given the focus,
  // which would scroll it to its cursor)
  await add.tap();
  await expect(page.locator(".swd-peek-name")).toBeFocused();
  await page.locator(".swd-peek-close").tap();
  await expect(page.locator(".swd-peek")).toHaveCount(0);
  await expect(page.locator(".swd-table tbody tr[data-item]")).toHaveCount(3);
  await expect(page.locator(".cm-content :focus")).toHaveCount(0);
  expect(await scrolled()).toBe(at);
  // Open: the same
  await page.locator(".swd-table tbody tr", { hasText: "Write docs" }).locator(".swd-open").tap();
  await expect(page.locator(".swd-peek-name")).toHaveValue("Write docs");
  await page.locator(".swd-peek-close").tap();
  await expect(page.locator(".swd-peek")).toHaveCount(0);
  await expect(page.locator(".cm-content :focus")).toHaveCount(0);
  expect(await scrolled()).toBe(at);
});
