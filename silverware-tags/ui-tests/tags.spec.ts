import { addPages, command, expect, openManager, openPage, pageName, pageText, panelRow, test } from "./helpers.ts";

test("the window shows the tags as a tree and a tag's pages", async ({ page }) => {
  const window = await openManager(page, "todo");
  // project/alpha under project, a level of its own
  await window.locator('[data-swg-tag="project"] .swg-tree-toggle').click();
  await window.locator('[data-swg-tag="project/alpha"] .swg-tag-row').click();
  await expect(window.locator(".swg-name-field")).toHaveValue("project/alpha");
  await expect(window.locator(".swg-pages .swg-page-link")).toHaveText([pageName("Meetings/2026-10-01"), pageName("Projects/Alpha"), pageName("Projects/Alpha/Plan")]);
  // The search cuts the tree to what holds it
  await window.locator(".swg-search").fill("mile");
  await expect(window.locator(".swg-tag-item")).toHaveCount(1);
  await expect(window.locator(".swg-name-field")).toHaveValue("milestone");
});

test("a rename typed into the tag's name is reviewed in the window, applied everywhere and undone", async ({ page }) => {
  const window = await openManager(page, "todo");
  await window.locator('[data-swg-tag="todo"] .swg-tag-row').click();
  await window.locator(".swg-name-field").fill("task/open");
  await expect(window.locator(".swg-name-actions .swg-note")).toContainText("Renames it on");
  await window.locator(".swg-name-field").press("Enter");
  // The review in the same window: one dialog
  await expect(window.locator(".swg-preview-page")).toHaveCount(3);
  await expect(page.locator(".swg-dialog")).toHaveCount(1);
  // Nothing written before Apply
  expect(await pageText(page, "Projects/Alpha")).toContain("#todo");
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Projects/Alpha")).toContain("- [ ] Write the brief #task/open");
  expect(await pageText(page, "Meetings/2026-10-01")).toContain("| Ann | the brief #task/open |");
  // Back in the tags, the new name shown; Undo puts every page back
  await expect(window.locator(".swg-name-field")).toHaveValue("task/open");
  await window.locator(".swg-undo").click();
  await expect.poll(() => pageText(page, "Projects/Alpha")).toContain("- [ ] Write the brief #todo");
  expect(await pageText(page, "Meetings/2026-10-15")).toContain("#todo");
});

test("a rename into a tag that exists says it merges, and merges them in the frontmatter", async ({ page }) => {
  const window = await openManager(page, "active");
  await window.locator('[data-swg-tag="active"] .swg-tag-row').click();
  await window.locator(".swg-name-field").fill("project/alpha");
  await expect(window.locator(".swg-name-actions .swg-note")).toContainText("the two become one");
  await window.locator(".swg-rename").click();
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Projects/Alpha")).toContain("tags:\n  - project/alpha\n---");
});

test("Esc puts the name typed back, then goes back from a review, then closes the window", async ({ page }) => {
  const window = await openManager(page, "plan");
  await window.locator('[data-swg-tag="plan"] .swg-tag-row').click();
  const name = window.locator(".swg-name-field");
  await name.fill("plans");
  await name.press("Escape");
  await expect(name).toHaveValue("plan");
  await name.fill("plans");
  await name.press("Enter");
  await expect(window.locator(".swg-apply")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(window.locator(".swg-apply")).toHaveCount(0);
  await expect(window.locator('[data-swg-view="tags"]')).toBeVisible();
  expect(await pageText(page, "Projects/Alpha/Plan")).toContain("#plan");
  await page.keyboard.press("Escape");
  await expect(window).toHaveCount(0);
});

test("by page: a folder picks its pages, their tags shown with counts, a tag added and one taken off them all", async ({ page }) => {
  await command(page, "Silverware Tags: Tag pages");
  const window = page.locator(".swg-workspace");
  await expect(window.locator('[data-swg-view="pages"]')).toHaveAttribute("aria-selected", "true");
  const folder = pageName("Meetings");
  // (Against SilverBullet the sample is under a folder of its own: opened first)
  if (folder !== "Meetings") await window.locator(`[data-swg-page="${folder.split("/")[0]}"] > .swg-tree-row .swg-tree-toggle`).click();
  await window.locator(`[data-swg-page="${folder}"] > .swg-tree-row .swg-tree-box`).check();
  await expect(window.locator(".swg-detail-name")).toHaveText("2 pages picked");
  // Their own tags: #meeting on both, #project/alpha on one
  await expect(window.locator('.swg-their-tags [data-swg-chip="meeting"]')).toBeVisible();
  await expect(window.locator('.swg-their-tags [data-swg-chip="project/alpha"] .swg-chip-count')).toHaveText("1/2");
  await window.locator('.swg-their-tags [data-swg-chip="meeting"] .swg-chip-remove').click();
  await expect(window.locator('.swg-their-tags [data-swg-chip="meeting"]')).toHaveClass(/swg-removing/);
  const add = window.locator('.swg-chips[data-swg-kind="add"] input');
  await add.fill("review");
  await add.press("Enter");
  await window.locator(".swg-review-changes").click();
  await expect(window.locator(".swg-preview-page")).toHaveCount(2);
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Meetings/2026-10-01")).toContain("tags: project/alpha, review\n");
  // A page without a frontmatter gets one; its tag line, left with no tag, goes
  expect(await pageText(page, "Meetings/2026-10-15")).toBe("---\ntags:\n  - review\n---\n- [ ] Send the notes #todo\n");
  // Back in the view, the same pages picked, nothing left to change
  await expect(window.locator('.swg-their-tags [data-swg-chip="review"]')).toBeVisible();
  await expect(window.locator(".swg-review-changes")).toBeDisabled();
});

test("Delete tag is reviewed; Back writes nothing, Apply takes it off with the space beside it", async ({ page }) => {
  const window = await openManager(page, "idea");
  await window.locator('[data-swg-tag="idea"] .swg-tag-row').click();
  await window.locator('[data-swg-action="remove"]').click();
  await expect(window.locator(".swg-preview-page")).toHaveCount(2);
  await window.locator(".swg-back").click();
  expect(await pageText(page, "Journal/2026-10-30")).toContain("#idea");
  await window.locator('[data-swg-action="remove"]').click();
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Journal/2026-10-30")).toContain("Thinking about of a garden.");
});

test("Page tags: the window by page with the page open picked, its tags changed", async ({ page }) => {
  await openPage(page, "Projects/Alpha/Plan");
  await command(page, "Silverware Tags: Page tags");
  const window = page.locator(".swg-workspace");
  await expect(window.locator(".swg-detail-name")).toHaveText(pageName("Projects/Alpha/Plan"));
  await expect(window.locator(".swg-their-tags .swg-chip")).toHaveCount(2);
  await window.locator('.swg-their-tags [data-swg-chip="plan"] .swg-chip-remove').click();
  const add = window.locator('.swg-chips[data-swg-kind="add"] input');
  await add.fill("draft");
  await add.press("Enter");
  await window.locator(".swg-review-changes").click();
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Projects/Alpha/Plan")).toBe("---\ntags:\n  - draft\n---\n#project/alpha\n\nThe plan of Alpha.\n\n- Phase one #milestone\n- Phase two #milestone\n");
});

test("a tag on hundreds of pages: its pages listed a hundred at first, all reviewed and renamed", async ({ page }) => {
  const many = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`Many/${String(i).padStart(3, "0")}`, `#bulk\n\nPage ${i}.\n`]));
  await addPages(page, many);
  const window = await openManager(page, "bulk");
  await window.locator('[data-swg-tag="bulk"] .swg-tag-row').click();
  await expect(window.locator(".swg-pages .swg-page-link")).toHaveCount(100);
  await window.locator(".swg-more").click();
  await expect(window.locator(".swg-pages .swg-page-link")).toHaveCount(150);
  await window.locator(".swg-name-field").fill("batch");
  await window.locator(".swg-name-field").press("Enter");
  await expect(window.locator(".swg-preview-page")).toHaveCount(150);
  // The first few open with their lines, the rest made as they are opened
  await expect(window.locator(".swg-diff-run")).toHaveCount(3);
  await window.locator('.swg-preview-page[data-swg-page$="Many/149"] summary').click();
  await expect(window.locator(".swg-diff-run")).toHaveCount(4);
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Many/149")).toBe("#batch\n\nPage 149.\n");
  expect(await pageText(page, "Many/000")).toBe("#batch\n\nPage 0.\n");
});

test("the tags' panel: a tag picked opens the window at it, F2 with its name to type", async ({ page }) => {
  await (await panelRow(page, "todo")).click();
  const window = page.locator(".swg-workspace");
  await expect(window.locator(".swg-name-field")).toHaveValue("todo");
  await page.keyboard.press("Escape");
  await expect(window).toHaveCount(0);
  const row = await panelRow(page, "milestone");
  await row.focus();
  await row.press("F2");
  await expect(window.locator(".swg-name-field")).toBeFocused();
  await expect(window.locator(".swg-name-field")).toHaveValue("milestone");
});

test("the tags' panel: a tag dragged onto a level is renamed under it, reviewed first", async ({ page }) => {
  const idea = await panelRow(page, "idea");
  await idea.dragTo(await panelRow(page, "project"));
  const window = page.locator(".swg-workspace");
  await expect(window.locator(".swg-review-title")).toHaveText("Rename #idea to #project/idea");
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Journal/2026-10-30")).toContain("Thinking about #project/idea of a garden.");
});

test("SilverBullet's own tags apart: Meta in the window, its meta pages not by page", async ({ page }) => {
  await addPages(page, { "Templates/Note": "---\ntags: meta/template\n---\nA template.\n" });
  const window = await openManager(page, "todo");
  await expect(window.locator('[data-swg-tag="meta"]')).toHaveCount(0);
  await window.locator('[data-swg-segment="meta"]').click();
  await expect(window.locator('[data-swg-tag="meta"]')).toBeVisible();
  await expect(window.locator('[data-swg-tag="todo"]')).toHaveCount(0);
  await window.locator('[data-swg-view="pages"]').click();
  await expect(window.locator(`[data-swg-page="${pageName("Templates")}"]`)).toHaveCount(0);
});
