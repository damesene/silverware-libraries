// Silverware Assets DOCX in SilverBullet, with Silverware Assets: a Word document's preview its first page drawn smaller, its
// original a reader of the whole document (in the page and in Assets' side panel), a file it cannot read said so.
import { docxOf, expect, test } from "./helpers.ts";

const PAGES = [["The first page's words."], ["The second page's words."]];

test("a document's preview is its first page drawn smaller, as high as a preview, its frame as wide; its click the preview's", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/doc.docx|||{ view: preview }]]\n\nAfter\n` }, "Page", { "doc.docx": await docxOf(PAGES) });
  const preview = page.locator("#sb-main [data-swa-asset='docx'][data-swa-view='preview']");
  const shown = preview.locator(".swa-docx-preview[data-swa-docx-state='page'] .swa-docx-preview-page");
  await expect(shown).toBeVisible();
  await expect(shown.locator("section.swa-docx-docx")).toHaveCount(1);
  await expect(shown.locator("section.swa-docx-docx")).toContainText("The first page's words.");
  // A US Letter page (8.5 × 11 in) 160 px high, its frame as wide
  const box = (await shown.boundingBox())!;
  expect(Math.round(box.height)).toBe(160);
  expect(Math.abs(box.width / box.height - 8.5 / 11)).toBeLessThan(0.02);
  expect(Math.round((await preview.boundingBox())!.width)).toBe(Math.round(box.width));
  await page.evaluate(() => {
    const opened: string[] = [];
    (window as unknown as { opened: string[] }).opened = opened;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
  });
  await shown.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { opened: string[] }).opened.join(" "))).toContain("doc.docx");
});

test("a document's preview kept in the space as HTML once drawn, shown from there made safe", async ({ page, space }) => {
  await space.open({ Page: `# Page

![[${space.folder}/doc.docx|||{ view: preview }]]
` }, "Page", { "doc.docx": await docxOf(PAGES) });
  const preview = page.locator("#sb-main [data-swa-asset='docx'][data-swa-view='preview']");
  await expect(preview.locator(".swa-docx-preview[data-swa-docx-state='page'] section.swa-docx-docx")).toContainText("The first page's words.");
  await expect.poll(() => space.kept("doc.docx.html")).toContain("The first page's words.");
  // What is kept shown after, made safe as it is read (anyone who can write the space can write it)
  const kept = (await space.kept("doc.docx.html"))!;
  await space.writeKept("doc.docx.html", kept.replace("The first page's words.", 'Kept words.<img src="x" onerror="window.ran = 1">'));
  await page.reload();
  const section = preview.locator(".swa-docx-preview[data-swa-docx-state='page'] section.swa-docx-docx");
  await expect(section).toContainText("Kept words.");
  await expect(section.locator("img")).not.toHaveAttribute("onerror");
  expect(await page.evaluate(() => (window as unknown as { ran?: number }).ran)).toBeUndefined();
});

test("a document shown as the original is a reader of its pages in a box of the embed's height, fitted to its width, the page in view said, zoomed", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/doc.docx|Doc||{ view: embed }]]\n\nAfter\n` }, "Page", { "doc.docx": await docxOf(PAGES) });
  const reader = page.locator("#sb-main [data-swa-asset='docx'] .swa-docx-reader[data-swa-docx-state='pages']");
  await expect(reader).toBeVisible();
  expect(Math.round((await reader.boundingBox())!.height)).toBe(480);
  const pages = reader.locator("section.swa-docx-docx");
  await expect(pages).toHaveCount(2);
  await expect(pages.nth(0)).toContainText("The first page's words.");
  await expect(pages.nth(1)).toContainText("The second page's words.");
  await expect(reader.locator(".swa-docx-reader-label")).toHaveText("1 / 2");
  // Fitted: a page as wide as the reader less its room round it
  const scroller = (await reader.locator(".swa-docx-reader-scroll").boundingBox())!;
  const first = (await pages.nth(0).boundingBox())!;
  expect(first.width).toBeGreaterThan(scroller.width - 60);
  expect(first.width).toBeLessThanOrEqual(scroller.width);
  // Zoomed in: wider; scrolled to the end: the second page said
  await reader.getByRole("button", { name: "Zoom in" }).click();
  await expect(reader.locator(".swa-docx-reader-fit")).toHaveText("125%");
  await expect.poll(async () => Math.round(((await pages.nth(0).boundingBox())!.width / first.width) * 100)).toBe(125);
  await reader.locator(".swa-docx-reader-scroll").evaluate((one) => (one.scrollTop = one.scrollHeight));
  await expect(reader.locator(".swa-docx-reader-label")).toHaveText("2 / 2");
});

test("a document in the side panel is the reader filling it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/doc.docx|Doc||{ view: preview }]]\n\nAfter\n` }, "Page", { "doc.docx": await docxOf(PAGES) });
  const preview = page.locator("#sb-main [data-swa-asset='docx']");
  await expect(preview.locator(".swa-docx-preview[data-swa-docx-state='page']")).toBeVisible();
  await preview.hover();
  await preview.locator(".swa-more").click();
  await page.locator(".swa-popup .swa-menu-item", { hasText: "Show in a side panel" }).click();
  const panel = page.locator(".swa-peek");
  const reader = panel.locator(".swa-docx-reader[data-swa-docx-state='pages']");
  await expect(reader.locator("section.swa-docx-docx").first()).toContainText("The first page's words.");
  const body = (await panel.locator(".swa-panel-body").boundingBox())!;
  expect((await reader.boundingBox())!.height).toBeGreaterThan(body.height - 30);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("a file docx-preview cannot read: its preview its icon and name, its reader saying so", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/bad.docx|||{ view: preview }]]\n\n![[${space.folder}/bad.docx|Bad||{ view: embed }]]\n` }, "Page", { "bad.docx": "not a document" });
  const [preview, original] = [page.locator("#sb-main [data-swa-asset='docx'][data-swa-view='preview']"), page.locator("#sb-main [data-swa-asset='docx'][data-swa-view='embed']")];
  await expect(preview.locator(".swa-docx-preview[data-swa-docx-state='failed'] .swa-docx-preview-name")).toHaveText("bad.docx");
  await expect(original.locator(".swa-docx-reader[data-swa-docx-state='failed'] .swa-docx-reader-failed")).toContainText("This document cannot be shown here");
});
