// What Silverware Database lays over its views and its peek (docs/silverware-core-work.md, step S, item 3): the
// place's menu, the Properties dialog, a value's files' popup, the peek's color picker, each on top whole (what the
// document has at its middle and corners, not visibility alone), Esc closing the top one alone.
import { boxOf, expect, item, ON_TOP, onTopAt, root, test } from "./helpers.ts";

const TASKS = { "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0"), "Page/db-tasks/Write docs": item("Done", "a1") };
const BLOCK = (view: string) => `# Page\n\n\`\`\`silverware-database\nid: tasks\nview: ${view}\n\`\`\`\n`;
// A pixel of PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

test("the place's menu and the Properties dialog from it, each on top whole; Esc closes the menu alone, then the dialog", async ({ page, space }) => {
  await space.open({ Page: BLOCK("table"), ...TASKS }, "Page");
  await page.locator(".swd-more").click();
  const menu = page.locator(".swd-menu:visible");
  await expect(menu).toHaveCount(1);
  expect(await onTopAt(menu)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await page.locator(".swd-more").click();
  await menu.locator(".swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: /^Properties$/ }) }).first().click();
  const dialog = page.locator('[role="dialog"]').filter({ has: page.locator(".swd-properties") });
  await expect(dialog).toBeVisible();
  expect(await onTopAt(dialog)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".swd-table")).toBeVisible();
});

test("a value's files' popup over a table and a file's menu over it, each on top whole; Esc closes the menu, then the popup", async ({ page, space }) => {
  const files = "---\ntags: [db-root]\n_database:\n  id: files\n  name: Files\n  version: 1\n  properties:\n    photos: { type: files, label: Photos }\n---\n";
  const holiday = `---\ntags: [db]\nphotos:\n  - "[[${space.folder}/files/a.png]]"\n_database:\n  rank: a0\n---\n`;
  await space.open({ Page: "# Page\n\n```silverware-database\nid: files\nview: table\n```\n", "Page/db-files": files, "Page/db-files/Holiday": holiday }, "Page", { "files/a.png": PNG });
  const cell = page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator('td[data-key="photos"]');
  await expect(cell.locator(".swd-media-button")).toHaveCount(1);
  // A press in the cell beside the files: the popup
  const box = await boxOf(cell);
  await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
  const popup = page.locator(".swd-editor-files");
  await expect(popup.locator(".swd-files-row")).toHaveCount(1);
  expect(await onTopAt(popup)).toEqual(ON_TOP);
  // A file's menu over the popup: on top whole, its Esc closing it alone
  await popup.getByRole("button", { name: "a.png: its menu" }).click();
  const rowMenu = popup.locator(".swd-files-menu:visible");
  await expect(rowMenu).toHaveCount(1);
  expect(await onTopAt(rowMenu)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(rowMenu).toHaveCount(0);
  await expect(popup.locator(".swd-files-row")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(page.locator(".swd-table")).toBeVisible();
});

test("the peek's color picker on top whole; Esc closes it alone, the peek kept", async ({ page, space }) => {
  await space.open({ Page: BLOCK("list"), ...TASKS }, "Page");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  const peek = page.locator(".swd-peek");
  await expect(peek).toBeVisible();
  expect(await onTopAt(peek)).toEqual(ON_TOP);
  await peek.locator(".swd-peek-color").click();
  const picker = page.locator(".swd-pop").filter({ has: page.locator(".swd-peek-pop-color") });
  await expect(picker).toBeVisible();
  expect(await onTopAt(picker)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(peek.locator(".swd-peek-color")).toBeFocused();
  await expect(peek).toBeVisible();
});
