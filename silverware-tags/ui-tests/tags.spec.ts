import { addPages, command, dialog, expect, openManager, openPage, pageName, pageText, test } from "./helpers.ts";

test("the manager shows the tags as a tree and a tag's pages", async ({ page }) => {
  const manager = await openManager(page, "todo");
  // project/alpha under project, a level of its own
  await manager.locator('[data-swg-tag="project"] .swg-tree-toggle').click();
  await manager.locator('[data-swg-tag="project/alpha"] .swg-tag-row').click();
  await expect(manager.locator(".swg-detail-name")).toHaveText("#project/alpha");
  await expect(manager.locator(".swg-pages .swg-page-link")).toHaveText([pageName("Meetings/2026-10-01"), pageName("Projects/Alpha"), pageName("Projects/Alpha/Plan")]);
  // The search cuts the tree to what holds it
  await manager.locator(".swg-search").fill("mile");
  await expect(manager.locator(".swg-tag-item")).toHaveCount(1);
  await expect(manager.locator(".swg-detail-name")).toHaveText("#milestone");
});

test("a rename is previewed, applied everywhere and undone", async ({ page }) => {
  const manager = await openManager(page, "todo");
  await manager.locator('[data-swg-tag="todo"] .swg-tag-row').click();
  await manager.locator('[data-swg-action="rename"]').click();
  const rename = dialog(page, "swg-small");
  await rename.locator(".swg-field").fill("task/open");
  await rename.locator(".swg-primary").click();
  const preview = dialog(page, "swg-preview-dialog");
  await expect(preview.locator(".swg-preview-page")).toHaveCount(3);
  // Nothing written before Apply
  expect(await pageText(page, "Projects/Alpha")).toContain("#todo");
  await preview.locator(".swg-apply").click();
  await expect(preview).toHaveCount(0);
  await expect.poll(() => pageText(page, "Projects/Alpha")).toContain("- [ ] Write the brief #task/open");
  expect(await pageText(page, "Meetings/2026-10-01")).toContain("| Ann | the brief #task/open |");
  // The manager shows the new name; its Undo puts every page back
  await expect(manager.locator(".swg-detail-name")).toHaveText("#task/open");
  await manager.locator(".swg-undo").click();
  await expect.poll(() => pageText(page, "Projects/Alpha")).toContain("- [ ] Write the brief #todo");
  expect(await pageText(page, "Meetings/2026-10-15")).toContain("#todo");
});

test("a rename into a tag that exists merges them in the frontmatter", async ({ page }) => {
  const manager = await openManager(page, "active");
  await manager.locator('[data-swg-tag="active"] .swg-tag-row').click();
  await manager.locator('[data-swg-action="rename"]').click();
  const rename = dialog(page, "swg-small");
  await rename.locator(".swg-field").fill("project/alpha");
  await expect(rename.locator(".swg-note")).toContainText("the two become one");
  await page.keyboard.press("Enter");
  await dialog(page, "swg-preview-dialog").locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Projects/Alpha")).toContain("tags:\n  - project/alpha\n---");
});

test("tag pages: a folder picks its pages, the tags go into their frontmatter", async ({ page }) => {
  await command(page, "Silverware Tags: Tag pages");
  const assign = dialog(page, "swg-assign");
  await expect(assign).toBeVisible();
  const folder = pageName("Meetings");
  // (Against SilverBullet the sample is under a folder of its own: opened first)
  if (folder !== "Meetings") await assign.locator(`[data-swg-page="${folder.split("/")[0]}"] > .swg-tree-row .swg-tree-toggle`).click();
  await assign.locator(`[data-swg-page="${folder}"] > .swg-tree-row .swg-tree-box`).check();
  await expect(assign.locator(".swg-note")).toHaveText("2 pages picked");
  const add = assign.locator('.swg-chips[data-swg-kind="add"] input');
  await add.fill("review");
  await add.press("Enter");
  await expect(assign.locator('.swg-chip[data-swg-chip="review"]')).toBeVisible();
  await assign.locator(".swg-primary").click();
  const preview = dialog(page, "swg-preview-dialog");
  await expect(preview.locator(".swg-preview-page")).toHaveCount(2);
  await preview.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Meetings/2026-10-01")).toContain("tags: meeting, project/alpha, review\n");
  // A page without a frontmatter gets one; its tag line stays
  expect(await pageText(page, "Meetings/2026-10-15")).toBe("---\ntags:\n  - review\n---\n#meeting\n\n- [ ] Send the notes #todo\n");
});

test("a preview cancelled writes nothing", async ({ page }) => {
  const manager = await openManager(page, "idea");
  await manager.locator('[data-swg-tag="idea"] .swg-tag-row').click();
  await manager.locator('[data-swg-action="remove"]').click();
  await dialog(page, "swg-small").locator(".swg-primary").click();
  const preview = dialog(page, "swg-preview-dialog");
  await expect(preview.locator(".swg-preview-page")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  expect(await pageText(page, "Journal/2026-10-30")).toContain("#idea");
  // Delete applied: taken off with the space beside it
  await manager.locator('[data-swg-action="remove"]').click();
  await dialog(page, "swg-small").locator(".swg-primary").click();
  await preview.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Journal/2026-10-30")).toContain("Thinking about of a garden.");
});

test("page tags: the open page's tags edited, saved through the editor", async ({ page }) => {
  await openPage(page, "Projects/Alpha/Plan");
  await command(page, "Silverware Tags: Page tags");
  const tags = dialog(page, "swg-small");
  await expect(tags.locator(".swg-chip")).toHaveCount(2);
  await tags.locator('.swg-chip[data-swg-chip="plan"] .swg-chip-remove').click();
  await tags.locator(".swg-chips-input").fill("draft");
  await tags.locator(".swg-chips-input").press("Enter");
  await tags.locator(".swg-primary").click();
  await expect.poll(() => pageText(page, "Projects/Alpha/Plan")).toBe("---\ntags:\n  - draft\n---\n#project/alpha\n\nThe plan of Alpha.\n\n- Phase one #milestone\n- Phase two #milestone\n");
});

test("a tag on hundreds of pages: its pages listed a hundred at first, all previewed and renamed", async ({ page }) => {
  const many = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`Many/${String(i).padStart(3, "0")}`, `#bulk\n\nPage ${i}.\n`]));
  await addPages(page, many);
  const manager = await openManager(page, "bulk");
  await manager.locator('[data-swg-tag="bulk"] .swg-tag-row').click();
  await expect(manager.locator(".swg-pages .swg-page-link")).toHaveCount(100);
  await manager.locator(".swg-more").click();
  await expect(manager.locator(".swg-pages .swg-page-link")).toHaveCount(150);
  await manager.locator('[data-swg-action="rename"]').click();
  await dialog(page, "swg-small").locator(".swg-field").fill("batch");
  await page.keyboard.press("Enter");
  const preview = dialog(page, "swg-preview-dialog");
  await expect(preview.locator(".swg-preview-page")).toHaveCount(150);
  // The first few open with their lines, the rest made as they are opened
  await expect(preview.locator(".swg-diff-run")).toHaveCount(3);
  await preview.locator('.swg-preview-page[data-swg-page$="Many/149"] summary').click();
  await expect(preview.locator(".swg-diff-run")).toHaveCount(4);
  await preview.locator(".swg-apply").click();
  await expect(preview).toHaveCount(0);
  await expect.poll(() => pageText(page, "Many/149")).toBe("#batch\n\nPage 149.\n");
  expect(await pageText(page, "Many/000")).toBe("#batch\n\nPage 0.\n");
});
