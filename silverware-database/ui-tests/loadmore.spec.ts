import { ranksInOrder } from "../src/domain/rank.ts";
import { expect, item, root, runCommand, test } from "./helpers.ts";

// Load more (docs/silverware-database-load-more.md) in SilverBullet: how many items show at first set in the settings
// (kept in CONFIG, read as the place is drawn), a press drawing the next, what was loaded kept through a write of an item
// loaded (SilverBullet drawing the block anew as the index changes)

test("load more: items shown at first set in the settings, a press drawing the next with the focus on the first, a value changed in a row loaded kept drawn", async ({ page, space }) => {
  const ranks = ranksInOrder(25);
  const items = Object.fromEntries(ranks.map((rank, n) => [`Page/db-tasks/Item ${String(n + 1).padStart(2, "0")}`, item("Todo", rank)]));
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: table\n```\n", "Page/db-tasks": root("tasks", "Tasks"), ...items }, "Page");
  const rows = page.locator(".swd-table tbody tr[data-item]");
  await expect(rows).toHaveCount(25);
  await runCommand(page, "Silverware Database: Settings");
  await page.locator('[data-swd-setting="silverware.database.pageSize"]').fill("10");
  await page.locator(".swd-settings-save").click();
  await expect(page.locator(".swd-settings")).toHaveCount(0);
  await expect.poll(() => space.config()).toContain('config.set("silverware.database.pageSize", 10)');
  await expect(rows).toHaveCount(10);
  await expect(page.locator(".swd-load-more-count")).toHaveText("10 of 25");
  await page.locator(".swd-load-more-button").click();
  await expect(rows).toHaveCount(20);
  await expect(page.locator(":focus")).toHaveCount(1);
  await expect(rows.filter({ has: page.locator(":focus") })).toContainText("Item 11");
  // A value of a row loaded changed: its page written, the block drawn anew by SilverBullet with what was loaded
  const cell = rows.filter({ hasText: "Item 15" }).locator('[data-key="status"]');
  await cell.click();
  await cell.locator("select").selectOption("Done");
  await expect.poll(() => space.saved("Page/db-tasks/Item 15")).toContain("status: Done");
  await expect(cell).toHaveText("Done");
  await expect(rows).toHaveCount(20);
  await expect(page.locator(".swd-load-more-count")).toHaveText("20 of 25");
});
