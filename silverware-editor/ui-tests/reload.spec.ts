// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// init page again on the module already loaded (its window's keys for history kept once). After it the editor of a
// database's peek takes typing as before, once, and Ctrl+Z undoes one edit.
import { expect, fieldReady, item, peekField, reloadSpaceLua, root, test } from "./helpers.ts";

test("after System: Reload a peek's field is one editor, a word typed written once, Ctrl+Z undoing one edit", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0") }, "Page");
  await reloadSpaceLua(page);
  // (The database's modules started again, the peek's among them, as their start follows the init page: its menu's
  // Properties there)
  await page.locator(".swd-more").click();
  await expect(page.locator(".swd-menu:visible .swd-label", { hasText: /^Properties$/ })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-menu:visible")).toHaveCount(0);
  // (The editor is loaded once SilverBullet has started, when the browser is idle: a peek opened before keeps a plain
  // field while it is open; opened again until its field is the editor)
  await expect(async () => {
    if (await page.locator(".swd-peek").count()) await page.keyboard.press("Escape");
    await expect(page.locator(".swd-peek")).toHaveCount(0, { timeout: 1000 });
    await page.locator(".swd-list-name", { hasText: "Fix login" }).click({ timeout: 1000 });
    await expect(peekField(page).locator(".cm-content")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  const field = peekField(page);
  await expect(field).toHaveCount(1);
  await expect.poll(() => fieldReady(field)).toBe(true);
  const content = field.locator(".cm-content");
  await expect(content).toHaveCount(1);
  await content.click();
  await page.keyboard.type("Two");
  await expect(content).toHaveText("Two");
  await page.keyboard.press("Home");
  await page.keyboard.type("One ");
  await expect(content).toHaveText("One Two");
  // (A key's history twice would undo both edits)
  await page.keyboard.press("Control+z");
  await expect(content).toHaveText("Two");
});
