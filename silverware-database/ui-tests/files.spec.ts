// Files & media (docs/silverware-database-files.md) against SilverBullet, every plugin installed (Silverware Assets
// among them): a value's files drawn in a table's cell and the peek's row, a file opened by a press.
import { expect, test } from "./helpers.ts";

// A pixel of PNG, each image of the test one
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const ROOT = "---\ntags: [db-root]\n_database:\n  id: files\n  name: Files\n  version: 1\n  properties:\n    photos: { type: files, label: Photos }\n---\n";
const withFiles = (folder: string, rank: string, files: readonly string[]) => `---\ntags: [db]\nphotos:\n${files.map((one) => `  - "[[${folder}/files/${one}]]"`).join("\n")}\n_database:\n  rank: ${rank}\n---\n`;

test("a value's files: a table's cell draws three and counts the rest, a press opens one in the side panel, not the cell's editor; the peek draws every one larger", async ({ page, space }) => {
  const names = ["a.png", "b.png", "c.png", "report.pdf"];
  await space.open(
    { Page: "# Page\n\n```silverware-database\nid: files\nview: table\n```\n", "Page/db-files": ROOT, "Page/db-files/Holiday": withFiles(space.folder, "a0", names) },
    "Page",
    Object.fromEntries(names.map((name) => [`files/${name}`, name.endsWith(".png") ? PNG : "%PDF-1.4\n"])),
  );
  const cell = page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator('td[data-key="photos"]');
  const buttons = cell.locator(".swd-media-button");
  await expect(buttons).toHaveCount(3);
  await expect(cell.locator(".swd-media-more")).toHaveText("+1");
  await expect(cell.locator(".swd-media-more")).toHaveAttribute("title", "report.pdf");
  // (Each image itself, fitted in the line: no higher than it)
  const image = buttons.first().locator("img");
  await expect(image).toHaveAttribute("src", /files\/a\.png$/);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.style.height)).toBe("28px");
  expect((await cell.locator(".swd-media-strip").boundingBox())!.height).toBeLessThanOrEqual(28.5);
  // A file pressed: in Silverware Assets' side panel, the cell not edited
  await buttons.nth(1).click();
  await expect(page.locator(".swa-side-panel .swa-panel-title")).toHaveText("b.png");
  await expect(page.locator(".swa-side-panel .swa-panel-body img")).toBeVisible();
  await expect(cell.locator(".swd-editor")).toHaveCount(0);
  await expect(page.locator(".swd-floated")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".swa-side-panel")).toHaveCount(0);
  // The peek: every file, larger, a pencil after them to edit the value
  await page.locator(".swd-table tbody tr", { hasText: "Holiday" }).locator(".swd-open").click();
  const row = page.locator('.swd-peek .swd-peek-value[data-key="photos"]');
  await expect(row.locator(".swd-media-button")).toHaveCount(4);
  await expect(row.locator(".swd-media-more")).toHaveCount(0);
  await expect(row.locator(".swd-peek-edit")).toHaveCount(1);
  const large = row.locator(".swd-media-button").first().locator("img");
  await expect.poll(() => large.evaluate((img: HTMLImageElement) => img.complete && img.style.height)).toBe("180px");
  // (A file that is no image: its icon and name, or its preview where a type keeps one)
  await expect(row.locator(".swd-media-button").nth(3)).toHaveAttribute("aria-label", "Open report.pdf");
  // A press on a file there opens it too, the peek kept
  await row.locator(".swd-media-button").nth(2).click();
  await expect(page.locator(".swa-side-panel .swa-panel-title")).toHaveText("c.png");
  await expect(page.locator(".swd-peek")).toBeVisible();
  await expect(row.locator(".swd-editor")).toHaveCount(0);
});

test("a board's card narrower than its files: they shrink, their names cut, the rest's count whole within the card", async ({ page, space }) => {
  const root = ROOT.replace("    photos:", "    status: { type: select, label: Status, options: [Todo] }\n    photos:");
  const names = ["first report.pdf", "second report.pdf", "third report.pdf", "fourth.pdf"];
  const card = withFiles(space.folder, "a0", names).replace("photos:", "status: Todo\nphotos:");
  await space.open(
    { Page: "# Page\n\n```silverware-database\nid: files\nview: board\nboard.hiddenProperties: []\n```\n", "Page/db-files": root, "Page/db-files/Reports": card },
    "Page",
    Object.fromEntries(names.map((name) => [`files/${name}`, "%PDF-1.4\n"])),
  );
  const value = page.locator(".swd-board-card", { hasText: "Reports" }).locator('.swd-board-value[data-key="photos"]');
  await expect(value.locator(".swd-media-button")).toHaveCount(3);
  const box = (await page.locator(".swd-board-card", { hasText: "Reports" }).boundingBox())!;
  const more = (await value.locator(".swd-media-more").boundingBox())!;
  expect(more.width).toBeGreaterThan(0);
  expect(more.x + more.width).toBeLessThanOrEqual(box.x + box.width);
  await expect(value.locator(".swd-media-more")).toHaveText("+1");
});
