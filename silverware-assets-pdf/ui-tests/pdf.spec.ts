// Silverware Assets PDF in SilverBullet, with Silverware Assets: a PDF's preview its first page as an image, its original and
// Assets' side panel the browser's own viewer, the browser's viewer for a preview pdf.js cannot read.
import { BLUE, expect, middleColour, nearColour, pdfOf, RED, test } from "./helpers.ts";

test("a PDF's preview is its first page as an image, as high as a preview, its frame as wide; its click the preview's", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/doc.pdf|||{ view: preview }]]\n\nAfter\n` }, "Page", { "doc.pdf": pdfOf([RED, BLUE]) });
  const preview = page.locator("#sb-main [data-swa-asset='pdf'][data-swa-view='preview']");
  const image = preview.locator(".swa-pdf-preview[data-swa-pdf-state='page'] > img");
  await expect(image).toBeVisible();
  // Its page's proportions (200 × 300), 160 px high (a preview's height by default), the first page's red
  const box = (await image.boundingBox())!;
  expect(Math.round(box.height)).toBe(160);
  expect(Math.abs(box.width / box.height - 2 / 3)).toBeLessThan(0.02);
  // (Kept as WebP, lossy: red within a few levels)
  expect(nearColour(await middleColour(page, "#sb-main .swa-pdf-preview > img"), [255, 0, 0])).toBe(true);
  // The frame as wide as the page drawn: its "…" at the page's corner
  expect(Math.round((await preview.boundingBox())!.width)).toBe(Math.round(box.width));
  // No viewer in it, nothing laid over it: its click the preview's (open in a new tab, by default)
  await expect(preview.locator(".swa-pdf-preview object, .swa-shield")).toHaveCount(0);
  await page.evaluate(() => {
    const opened: string[] = [];
    (window as unknown as { opened: string[] }).opened = opened;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
  });
  await image.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { opened: string[] }).opened.join(" "))).toContain("doc.pdf");
});

test("a PDF's preview kept in the space once drawn, shown from there; Regenerate preview in its menu draws and keeps it again", async ({ page, space }) => {
  await space.open({ Page: `# Page

![[${space.folder}/doc.pdf|||{ view: preview }]]
` }, "Page", { "doc.pdf": pdfOf([RED, BLUE]) });
  const preview = page.locator("#sb-main [data-swa-asset='pdf'][data-swa-view='preview']");
  await expect(preview.locator(".swa-pdf-preview[data-swa-pdf-state='page'] > img")).toBeVisible();
  // (WebP in Chromium; its longer side 600 px, shown at a preview's height)
  await expect.poll(() => space.kept("doc.pdf.webp")).toBeGreaterThan(0);
  const first = (await space.kept("doc.pdf.webp"))!;
  // Drawn again from what is kept: the same page
  await page.reload();
  await expect(preview.locator(".swa-pdf-preview[data-swa-pdf-state='page'] > img")).toBeVisible();
  expect(nearColour(await middleColour(page, "#sb-main .swa-pdf-preview > img"), [255, 0, 0])).toBe(true);
  expect(await space.kept("doc.pdf.webp")).toBe(first);
  await preview.hover();
  await preview.locator(".swa-more").click();
  await page.locator(".swa-popup .swa-menu-item", { hasText: "Regenerate preview" }).click();
  await expect.poll(async () => (await space.kept("doc.pdf.webp")) ?? 0).toBeGreaterThan(first);
  await expect(preview.locator(".swa-pdf-preview[data-swa-pdf-state='page'] > img")).toBeVisible();
});

test("a PDF shown as the original, in the side panel too, is the browser's own viewer: no page drawn of its own", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/doc.pdf|Doc||{ view: preview }]]\n\n![[${space.folder}/doc.pdf|Doc||{ view: embed }]]\n` }, "Page", { "doc.pdf": pdfOf([RED]) });
  const original = page.locator("#sb-main [data-swa-asset='pdf'][data-swa-view='embed']");
  await expect(original.locator("object:visible")).toHaveCount(1);
  await expect(original.locator(".swa-pdf-preview, canvas")).toHaveCount(0);
  const preview = page.locator("#sb-main [data-swa-asset='pdf'][data-swa-view='preview']");
  await expect(preview.locator(".swa-pdf-preview[data-swa-pdf-state='page']")).toBeVisible();
  await preview.hover();
  await preview.locator(".swa-more").click();
  await page.locator(".swa-popup .swa-menu-item", { hasText: "Show in a side panel" }).click();
  const panel = page.locator(".swa-peek");
  await expect(panel.locator(".swa-panel-body object")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("a PDF pdf.js cannot read: its preview the browser's viewer, the preview's click still its own", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/doc.pdf|||{ view: preview }]]\n\n![[${space.folder}/doc.pdf|Doc||{ view: embed }]]\n` }, "Page", { "doc.pdf": "%PDF-1.4\n" });
  const [preview, original] = [page.locator("#sb-main [data-swa-asset='pdf'][data-swa-view='preview']"), page.locator("#sb-main [data-swa-asset='pdf'][data-swa-view='embed']")];
  await expect(preview.locator(".swa-pdf-preview[data-swa-pdf-state='viewer'] > object")).toHaveCount(1);
  await expect(preview.locator(".swa-shield")).toHaveCount(1);
  await expect(original.locator("object:visible")).toHaveCount(1);
});
