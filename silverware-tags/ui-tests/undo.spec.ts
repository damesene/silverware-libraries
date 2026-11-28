// Each change of the tags' manager applied, then undone (docs/silverware-core-work.md, step S, item 4: the workspace's
// actions and their writes recorded against today's code before it is rewritten): what the change wrote, every page
// whole (the pages it changed, the others as they were), then every page back exactly as it was by its Undo, reviewed
// first.
import type { Locator, Page } from "@playwright/test";
import { SAMPLE_PAGES } from "../../playground/tags-sample.ts";
import { addPages, command, expect, openManager, pageName, pageText, test } from "./helpers.ts";

/** Every page's text, by its name in the sample (`extra`: pages a test added) */
async function texts(page: Page, extra: readonly string[] = []): Promise<Record<string, string>> {
  const names = [...Object.keys(SAMPLE_PAGES), ...extra];
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name, await pageText(page, name)] as const)));
}

/**
 * Once the change is applied (its Undo offered: shown after the writes are done), every page as `before` but those
 * `written`, each whole; then undone through the window's Undo (reviewed first, its title `title`, then applied), every
 * page back as `before`, nothing left to undo once the review is gone
 */
async function writtenThenUndone(page: Page, window: Locator, before: Record<string, string>, written: Record<string, string>, title: string): Promise<void> {
  const extra = Object.keys(before).filter((name) => !(name in SAMPLE_PAGES));
  await expect(window.locator(".swg-undo")).toBeVisible();
  await expect.poll(() => texts(page, extra)).toEqual({ ...before, ...written });
  await window.locator(".swg-undo").click();
  await expect(window.locator(".swg-review-title")).toHaveText(title);
  await window.locator(".swg-apply").click();
  await expect.poll(() => texts(page, extra)).toEqual(before);
  await expect(window.locator(".swg-review-title")).toHaveCount(0);
  await expect(window.locator(".swg-undo")).toHaveCount(0);
}

test("Remove tag applied, then undone: every page as it was", async ({ page }) => {
  const before = await texts(page);
  const window = await openManager(page, "idea");
  await window.locator('[data-swg-tag="idea"] .swg-tag-row').click();
  await window.locator('[data-swg-action="remove"]').click();
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Journal/2026-10-30")).toContain("Thinking about idea of a garden.");
  await writtenThenUndone(
    page,
    window,
    before,
    {
      "Projects/Beta": "---\ntags: [project/beta]\n---\n# Beta\n\nOn hold. idea\n",
      "Journal/2026-10-30": "Thinking about idea of a garden.\n\n```\n#notatag in code\n```\n",
    },
    "Undo: Remove #idea",
  );
});

test("several tags merged into one, then undone: every page as it was", async ({ page }) => {
  const before = await texts(page);
  const window = await openManager(page, "idea");
  await window.locator('[data-swg-tag="idea"] .swg-tag-row').click();
  await window.locator('[data-swg-tag="plan"] .swg-tag-row').click({ modifiers: ["Control"] });
  await window.locator('[data-swg-action="rename.merge"]').click();
  const into = window.locator(".swg-ask .swg-field");
  await into.fill("thoughts");
  await into.press("Enter");
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Projects/Alpha/Plan")).toContain("#project/alpha #thoughts");
  await writtenThenUndone(
    page,
    window,
    before,
    {
      "Projects/Alpha/Plan": "#project/alpha #thoughts\n\nThe plan of Alpha.\n\n- Phase one #milestone\n- Phase two #milestone\n",
      "Projects/Beta": "---\ntags: [project/beta]\n---\n# Beta\n\nOn hold. #thoughts\n",
      "Journal/2026-10-30": "Thinking about #thoughts of a garden.\n\n```\n#notatag in code\n```\n",
    },
    "Undo: Merge #idea #plan into #thoughts",
  );
});

test("Cleanup's merge, then undone: every page as it was, the pages it added too", async ({ page }) => {
  await addPages(page, { "Notes/One": "#Idea\n\nAn idea.\n", "Notes/Two": "#ideas\n\nMore.\n" });
  const before = await texts(page, ["Notes/One", "Notes/Two"]);
  const window = await openManager(page, "todo");
  await window.locator('[data-swg-view="cleanup"]').click();
  const group = window.locator(".swg-cleanup-group", { has: page.locator('[data-swg-chip="ideas"]') });
  await group.locator('[data-swg-action="cleanup.merge"]').click();
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Notes/One")).toBe("#idea\n\nAn idea.\n");
  await writtenThenUndone(
    page,
    window,
    before,
    {
      "Notes/One": "#idea\n\nAn idea.\n",
      "Notes/Two": "#idea\n\nMore.\n",
    },
    "Undo: Merge #idea #Idea #ideas into #idea",
  );
});

test("by page: a tag added and one taken off the pages picked, then undone: every page as it was", async ({ page }) => {
  const before = await texts(page);
  await command(page, "Silverware Tags: Tag pages");
  const window = page.locator(".swg-workspace");
  const folder = pageName("Meetings");
  // (Against SilverBullet the sample is under a folder of its own: opened first)
  if (folder !== "Meetings") await window.locator(`[data-swg-page="${folder.split("/")[0]}"] > .swg-tree-row .swg-tree-toggle`).click();
  await window.locator(`[data-swg-page="${folder}"] > .swg-tree-row .swg-tree-box`).check();
  await window.locator('.swg-their-tags [data-swg-chip="meeting"] .swg-chip-remove').click();
  const add = window.locator('.swg-chips[data-swg-kind="add"] input');
  await add.fill("review");
  await add.press("Enter");
  await window.locator(".swg-review-changes").click();
  await window.locator(".swg-apply").click();
  await expect.poll(() => pageText(page, "Meetings/2026-10-15")).toBe("---\ntags: [review]\n---\n- [ ] Send the notes #todo\n");
  await writtenThenUndone(
    page,
    window,
    before,
    {
      "Meetings/2026-10-01": "---\ntags: project/alpha, review\n---\nWe agreed on the scope. #decision\n\n| Who | What |\n|---|---|\n| Ann | the brief #todo |\n",
      "Meetings/2026-10-15": "---\ntags: [review]\n---\n- [ ] Send the notes #todo\n",
    },
    "Undo: Tags of 2 pages: add #review, remove #meeting",
  );
});

test("a rename typed into the tag's name applied, then undone: every page whole, then as it was", async ({ page }) => {
  const before = await texts(page);
  const window = await openManager(page, "todo");
  await window.locator('[data-swg-tag="todo"] .swg-tag-row').click();
  await window.locator(".swg-name-field").fill("task/open");
  await window.locator(".swg-name-field").press("Enter");
  await window.locator(".swg-apply").click();
  await expect(window.locator(".swg-name-field")).toHaveValue("task/open");
  await writtenThenUndone(
    page,
    window,
    before,
    {
      "Projects/Alpha": "---\ntitle: Project Alpha\ntags:\n  - project/alpha\n  - active\n---\n# Alpha\n\n- [ ] Write the brief #task/open\n- [x] Kick-off #done\n",
      "Meetings/2026-10-01": "---\ntags: meeting, project/alpha\n---\nWe agreed on the scope. #decision\n\n| Who | What |\n|---|---|\n| Ann | the brief #task/open |\n",
      "Meetings/2026-10-15": "#meeting\n\n- [ ] Send the notes #task/open\n",
    },
    "Undo: Rename #todo to #task/open",
  );
});

test("the command Undo last change after the window is closed: reviewed, then every page as it was", async ({ page }) => {
  const before = await texts(page);
  const window = await openManager(page, "idea");
  await window.locator('[data-swg-tag="idea"] .swg-tag-row').click();
  await window.locator('[data-swg-action="remove"]').click();
  await window.locator(".swg-apply").click();
  await expect(window.locator(".swg-undo")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".swg-workspace")).toHaveCount(0);
  await command(page, "Silverware Tags: Undo last change");
  const undo = page.locator(".swg-workspace");
  await expect(undo.locator(".swg-review-title")).toHaveText("Undo: Remove #idea");
  await undo.locator(".swg-apply").click();
  await expect.poll(() => texts(page)).toEqual(before);
  await expect(undo.locator(".swg-review-title")).toHaveCount(0);
  await expect(undo.locator(".swg-undo")).toHaveCount(0);
});

test("Undo of a change whose page was changed since: that page left alone and said, the others as they were", async ({ page }) => {
  const before = await texts(page);
  const window = await openManager(page, "idea");
  await window.locator('[data-swg-tag="idea"] .swg-tag-row').click();
  await window.locator('[data-swg-action="remove"]').click();
  await window.locator(".swg-apply").click();
  await expect(window.locator(".swg-undo")).toBeVisible();
  // One of its pages changed after it (as by hand, through SilverBullet)
  const changed = "Thinking about idea of a garden. Later.\n\n```\n#notatag in code\n```\n";
  await addPages(page, { "Journal/2026-10-30": changed });
  await window.locator(".swg-undo").click();
  await expect(window.locator(".swg-review-title")).toHaveText("Undo: Remove #idea");
  // (The review: the other page put back, the changed one said left alone)
  await expect(window.locator(".swg-workspace-body")).toContainText(`${pageName("Journal/2026-10-30")}: changed since it was written: left as it is`);
  await expect(window.locator(".swg-workspace-body")).toContainText("1 tag on 1 page change");
  await window.locator(".swg-apply").click();
  await expect.poll(() => texts(page)).toEqual({ ...before, "Journal/2026-10-30": changed });
  await expect(window.locator(".swg-review-title")).toHaveCount(0);
  await expect(window.locator(".swg-undo")).toHaveCount(0);
});
