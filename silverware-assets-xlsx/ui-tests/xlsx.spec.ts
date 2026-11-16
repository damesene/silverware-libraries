// Silverware Assets XLSX in SilverBullet, with Silverware Assets: a workbook's preview its first sheet's first cells,
// shown full a reader of every sheet as a spreadsheet shows it (in the page and in Assets' side panel), a file it cannot
// read said so.
import { expect, test, xlsxOf } from "./helpers.ts";

/** Two sheets: Budget (a bold, filled title over two columns, numbers in formats, a formula, its first row frozen), Notes */
const BUDGET = () =>
  xlsxOf((workbook) => {
    const budget = workbook.addWorksheet("Budget", { views: [{ state: "frozen", ySplit: 1 }] });
    budget.getColumn(1).width = 20;
    budget.getColumn(2).width = 12;
    budget.mergeCells("A1:B1");
    const title = budget.getCell("A1");
    title.value = "Monthly budget";
    title.font = { bold: true, color: { argb: "FFFFFFFF" } };
    title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    title.alignment = { horizontal: "center" };
    const rows: [string, number][] = [
      ["Rent", 1200],
      ["Food", 345.5],
    ];
    rows.forEach(([name, amount], index) => {
      budget.getCell(index + 2, 1).value = name;
      const cell = budget.getCell(index + 2, 2);
      cell.value = amount;
      cell.numFmt = "#,##0.00";
    });
    budget.getCell("A4").value = "Total";
    budget.getCell("B4").value = { formula: "SUM(B2:B3)", result: 1545.5 };
    budget.getCell("B4").numFmt = "#,##0.00";
    budget.getCell("A5").value = "Saved";
    budget.getCell("B5").value = 0.125;
    budget.getCell("B5").numFmt = "0.0%";
    for (let row = 6; row <= 60; row++) budget.getCell(row, 1).value = `Line ${row}`;
    workbook.addWorksheet("Notes").getCell("A1").value = "Written on the second sheet";
  });

test("a workbook's preview is its first sheet's first cells, drawn small in a preview's room; its click the preview's", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/budget.xlsx|||{ view: preview }]]\n\nAfter\n` }, "Page", { "budget.xlsx": await BUDGET() });
  const preview = page.locator("#sb-main [data-swa-type='xlsx'][data-swa-view='preview']");
  const sheet = preview.locator(".swa-xlsx-preview[data-swa-xlsx-state='sheet'] table.swa-xlsx-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Monthly budget");
  await expect(sheet).toContainText("1,200.00");
  // No letters or numbers in a preview; as high as a preview (160 px by default)
  await expect(sheet.locator("th")).toHaveCount(0);
  expect(Math.round((await preview.locator(".swa-xlsx-preview").boundingBox())!.height)).toBe(160);
  await page.evaluate(() => {
    const opened: string[] = [];
    (window as unknown as { opened: string[] }).opened = opened;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
  });
  await preview.locator(".swa-xlsx-preview").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { opened: string[] }).opened.join(" "))).toContain("budget.xlsx");
});

test("a workbook's preview grows with the content's scale (files zoomed with the font: 150 %) at once, nothing drawn again", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/budget.xlsx|||{ view: preview }]]\n\nAfter\n` }, "Page", { "budget.xlsx": await BUDGET() });
  const preview = page.locator("#sb-main [data-swa-type='xlsx'][data-swa-view='preview'] .swa-xlsx-preview");
  const sheet = preview.locator("table.swa-xlsx-sheet");
  await expect(sheet).toBeVisible();
  expect(Math.round((await preview.boundingBox())!.height)).toBe(160);
  const cellWidth = (await sheet.locator("td").first().boundingBox())!.width;
  // (A frame later, nothing drawn again: its sizes CSS following the scale, as an image's)
  const nextFrame = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.evaluate(() => document.documentElement.style.setProperty("--sw-content-scale", "1.5"));
  await nextFrame();
  expect(Math.round((await preview.boundingBox())!.height)).toBe(240);
  // (Its cells drawn larger too, as its zoom follows the scale)
  expect(Math.abs((await sheet.locator("td").first().boundingBox())!.width - cellWidth * 1.5)).toBeLessThan(2);
  await page.evaluate(() => document.documentElement.style.removeProperty("--sw-content-scale"));
});

test("a workbook's preview kept in the space as HTML once drawn, shown from there", async ({ page, space }) => {
  await space.open({ Page: `# Page

![[${space.folder}/budget.xlsx|||{ view: preview }]]
` }, "Page", { "budget.xlsx": await BUDGET() });
  const sheet = page.locator("#sb-main [data-swa-type='xlsx'] .swa-xlsx-preview[data-swa-xlsx-state='sheet'] table.swa-xlsx-sheet");
  await expect(sheet).toContainText("Monthly budget");
  await expect.poll(() => space.kept("budget.xlsx.html")).toContain("Monthly budget");
  const kept = (await space.kept("budget.xlsx.html"))!;
  await space.writeKept("budget.xlsx.html", kept.replace("Monthly budget", "Kept budget"));
  await page.reload();
  await expect(sheet).toContainText("Kept budget");
  await expect(sheet).toContainText("1,200.00");
});

test("a workbook shown full is a reader of its sheets as a spreadsheet shows them: formats, a merged title, the frozen row held, its tabs, zoom", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/budget.xlsx|Budget||{ view: full }]]\n\nAfter\n` }, "Page", { "budget.xlsx": await BUDGET() });
  const reader = page.locator("#sb-main [data-swa-type='xlsx'] .swa-xlsx-reader[data-swa-xlsx-state='sheet']");
  await expect(reader).toBeVisible();
  expect(Math.round((await reader.boundingBox())!.height)).toBe(480);
  const sheet = reader.locator("table.swa-xlsx-sheet");
  // The letters and numbers, the merged and filled title, numbers by their formats at the right, a formula's result
  await expect(sheet.locator(".swa-xlsx-sheet-letters th")).toHaveText(["", "A", "B"]);
  const title = sheet.locator("td", { hasText: "Monthly budget" });
  await expect(title).toHaveAttribute("colspan", "2");
  await expect(title).toHaveCSS("background-color", "rgb(31, 78, 121)");
  await expect(title).toHaveCSS("font-weight", "700");
  await expect(sheet.locator("td", { hasText: "345.50" })).toHaveCSS("text-align", "right");
  await expect(sheet.locator("td", { hasText: "1,545.50" })).toHaveCount(1);
  await expect(sheet.locator("td", { hasText: "12.5%" })).toHaveCount(1);
  // The frozen first row held as the sheet scrolls, under the letters
  await expect(sheet).toHaveAttribute("data-swa-xlsx-held", "");
  const scroller = reader.locator(".swa-xlsx-reader-scroll");
  await scroller.evaluate((one) => (one.scrollTop = 400));
  // (A letter's cell: the row of them moves, its cells are held)
  const letters = (await sheet.locator(".swa-xlsx-sheet-letters th").nth(1).boundingBox())!;
  expect(Math.abs((await title.boundingBox())!.y - (letters.y + letters.height))).toBeLessThan(2);
  // Its number with it, over the numbers' column scrolled under it
  const number = sheet.locator(".swa-xlsx-sheet-number", { hasText: /^1$/ });
  expect(Math.abs((await number.boundingBox())!.y - (letters.y + letters.height))).toBeLessThan(2);
  // Its tabs: the second sheet shown by its tab
  await expect(reader.locator(".swa-xlsx-reader-tab")).toHaveText(["Budget", "Notes"]);
  await expect(reader.locator(".swa-xlsx-reader-tab", { hasText: "Budget" })).toHaveAttribute("aria-pressed", "true");
  await reader.locator(".swa-xlsx-reader-tab", { hasText: "Notes" }).click();
  await expect(sheet).toContainText("Written on the second sheet");
  // Zoomed in: wider
  const before = (await sheet.boundingBox())!.width;
  await reader.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(async () => Math.round(((await sheet.boundingBox())!.width / before) * 100)).toBe(125);
});

test("a workbook in the side panel is the reader filling it", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/budget.xlsx|Budget||{ view: preview }]]\n\nAfter\n` }, "Page", { "budget.xlsx": await BUDGET() });
  const preview = page.locator("#sb-main [data-swa-type='xlsx']");
  await expect(preview.locator(".swa-xlsx-preview[data-swa-xlsx-state='sheet']")).toBeVisible();
  await preview.hover();
  await preview.locator(".swa-more").click();
  await page.locator(".swa-popup .swa-menu-item", { hasText: "Open in side panel" }).click();
  const panel = page.locator(".swa-side-panel");
  const reader = panel.locator(".swa-xlsx-reader[data-swa-xlsx-state='sheet']");
  await expect(reader.locator("table.swa-xlsx-sheet")).toContainText("Monthly budget");
  const body = (await panel.locator(".swa-panel-body").boundingBox())!;
  expect((await reader.boundingBox())!.height).toBeGreaterThan(body.height - 30);
  // A shortcut of SilverBullet's pressed in the reader (its zoom's button focused): it does nothing there, said so
  await reader.locator(".swa-xlsx-reader-fit").click();
  await page.keyboard.press("Control+k");
  await expect(page.locator(".sb-notifications")).toContainText("Navigate: Page Picker doesn't work here");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("a file ExcelJS cannot read: its preview its icon and name, its reader saying so", async ({ page, space }) => {
  await space.open({ Page: `# Page\n\n![[${space.folder}/bad.xlsx|||{ view: preview }]]\n\n![[${space.folder}/bad.xlsx|Bad||{ view: full }]]\n` }, "Page", { "bad.xlsx": "not a workbook" });
  const [preview, full] = [page.locator("#sb-main [data-swa-type='xlsx'][data-swa-view='preview']"), page.locator("#sb-main [data-swa-type='xlsx'][data-swa-view='full']")];
  await expect(preview.locator(".swa-xlsx-preview[data-swa-xlsx-state='failed'] .swa-xlsx-preview-name")).toHaveText("bad.xlsx");
  await expect(full.locator(".swa-xlsx-reader[data-swa-xlsx-state='failed'] .swa-xlsx-reader-failed")).toContainText("This workbook cannot be shown here");
});
