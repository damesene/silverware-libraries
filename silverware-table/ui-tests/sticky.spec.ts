// The header held at the top of the page's view as a long table scrolls past
import type { Page } from "@playwright/test";
import { expect, setPage, setSettings, settled, table, tableIcon, test } from "./helpers.ts";

test.describe("Rows pinned to the bottom", () => {
  test("a scroller with a bottom padding (as SilverBullet's, to scroll past the end): the row at the table's bottom while it is in view", async ({ page }) => {
    await page.addStyleTag({ content: ".cm-scroller { padding-bottom: 360px !important; }" });
    // Low in the view: within its bottom 360px, which the padding takes from sticky positioning
    const filler = Array.from({ length: 6 }, (_, i) => `Line ${i + 1} of text above the table.`).join("\n\n");
    await setPage(page, `# T\n\n${filler}\n\n| Customer | Bags |\n|---|--:|\n| A | 6 |\n| B | 2 |\n| Total | 8 |\n| <meta core.table core.pin-bottom='1'> |\n\nMore text.\n`);
    await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(3);
    const at = await table(page).evaluate((w) => {
      const t = w.querySelector("table")!;
      return { table: t.getBoundingClientRect().bottom, foot: t.tFoot!.getBoundingClientRect().bottom, view: document.querySelector(".cm-scroller")!.getBoundingClientRect().bottom };
    });
    // (The table wholly in view, its bottom within the view's bottom 360px)
    expect(at.table).toBeLessThan(at.view);
    expect(at.table).toBeGreaterThan(at.view - 360);
    expect(Math.round(at.foot)).toBe(Math.round(at.table));
  });
});

test.describe("The held header and the rows pinned to the bottom", () => {
  test("the table's end going up past the view's top: the header gives way to the bottom rows, never under them", async ({ page }) => {
    const rows = Array.from({ length: 6 }, (_, i) => `| Row ${i + 1} | ${i} |`).join("\n");
    const filler = (lines: number) => Array.from({ length: lines }, (_, i) => `Line ${i + 1}.`).join("\n\n");
    // Little text above (SilverBullet's editor leaves a table far below the view out of the document), room to scroll below
    await setPage(page, `# T\n\n${filler(6)}\n\n| Name | Qty |\n|---|---|\n${rows}\n| Total | 15 |\n| <meta core.table core.pin-bottom='1'> |\n\n${filler(30)}\n`);
    await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(7);
    // The table's top at the view's top, then up by steps until it is gone
    const start = await table(page).evaluate((w) => {
      const scroller = document.querySelector(".cm-scroller")!;
      return scroller.scrollTop + w.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    });
    for (let step = 0; step < 14; step++) {
      await page.evaluate((top) => (document.querySelector(".cm-scroller")!.scrollTop = top), start + step * 25);
      // (Measured once what the scroll moves is placed: its frames, not a time)
      await settled(page);
      const at = await table(page).evaluate((w) => {
        const t = w.querySelector("table")!;
        return { head: t.tHead!.getBoundingClientRect().bottom, foot: t.tFoot!.getBoundingClientRect().top };
      });
      expect(at.head).toBeLessThanOrEqual(at.foot + 0.5);
    }
  });
});

test.describe("The held header", () => {
  test("a table near the page's top: its header where the table starts, the page not scrolled, its first row not covered", async ({ page }) => {
    await setPage(page, "Intro\n| Name | Qty |\n|---|---|\n| Pear | 3 |\n| Fig | 2 |\n\nText under.\n");
    await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(2);
    const at = await table(page).evaluate((w) => {
      const r = (e: Element) => e.getBoundingClientRect();
      return { view: r(document.querySelector(".cm-scroller")!).top, table: r(w.querySelector("table")!).top, head: r(w.querySelector("thead")!), row: r(w.querySelector("tbody tr")!).top };
    });
    // (Nearer the view's top than the room for the toolbar: the case)
    expect(at.table - at.view).toBeLessThan(66);
    expect(Math.round(at.head.top)).toBe(Math.round(at.table));
    expect(at.row).toBeGreaterThanOrEqual(at.head.bottom - 0.5);
    // The toolbar above the header (less of a gap, the room being small), not over its names
    await table(page).locator("tbody tr td").first().hover();
    const bar = (await page.locator(".swt-bar.swt-visible").boundingBox())!;
    expect(bar.y + bar.height).toBeLessThanOrEqual(at.head.top + 0.5);
    expect(bar.y).toBeGreaterThanOrEqual(at.view - 0.5);
  });

  test("a table with a maximum height: a thin scrollbar of its own; held by the page, its scrollbar clear (none up past the header), its width kept; back as its top is in view", async ({ page }) => {
    await setSettings(page, { "silverware.table.maxHeight": 300 });
    const rows = Array.from({ length: 40 }, (_, i) => `| Row ${i + 1} | ${i * 3} |`).join("\n");
    const filler = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}.`).join("\n\n");
    await setPage(page, `# Test\n\nText above.\n\n| Name | Qty |\n|---|---|\n${rows}\n\n${filler}\n`);
    await expect(table(page).locator("tr[data-swt-row]").first()).toBeVisible();
    const look = () =>
      table(page).evaluate((w) => ({ width: getComputedStyle(w).scrollbarWidth, color: getComputedStyle(w).scrollbarColor, inner: w.clientWidth, held: w.classList.contains("swt-held-by-page") }));
    const before = await look();
    expect(before.width).toBe("thin");
    expect(before.held).toBe(false);
    expect(before.color).not.toMatch(/^transparent transparent$|rgba\(0, 0, 0, 0\) rgba\(0, 0, 0, 0\)/);
    // The page scrolled so the box's top is 100 px above the view's top: the header held by the page
    await page.evaluate(() => {
      const scroller = document.querySelector(".cm-scroller")!;
      const box = document.querySelector(".sb-table-widget")!;
      scroller.scrollTop += box.getBoundingClientRect().top - scroller.getBoundingClientRect().top + 100;
    });
    await settled(page);
    await expect(table(page).locator("thead")).toHaveClass(/swt-stuck/);
    const held = await look();
    expect(held.held).toBe(true);
    expect(held.color).toMatch(/^transparent transparent$|rgba\(0, 0, 0, 0\) rgba\(0, 0, 0, 0\)/);
    expect(held.inner).toBe(before.inner);
    // The box's top in view again: its scrollbar back
    await page.evaluate(() => {
      const scroller = document.querySelector(".cm-scroller")!;
      const box = document.querySelector(".sb-table-widget")!;
      scroller.scrollTop += box.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 150;
    });
    await settled(page);
    expect((await look()).held).toBe(false);
  });

  test("a table with a maximum height, its box taken up past the view's top: its header held no further than the box, gone with it, no dot of the + left", async ({ page }) => {
    await setSettings(page, { "silverware.table.maxHeight": 300 });
    const rows = Array.from({ length: 40 }, (_, i) => `| Row ${i + 1} | ${i * 3} |`).join("\n");
    const filler = Array.from({ length: 40 }, (_, i) => `Line ${i + 1}.`).join("\n\n");
    await setPage(page, `# Test\n\nText above.\n\n| Name | Qty |\n|---|---|\n${rows}\n\n${filler}\n`);
    // A cell selected: the table has the focus, its dots show
    await table(page).locator("tr[data-swt-row]").first().locator("td").first().click();
    const dots = page.locator(".swt-insert-dots.swt-visible > span:not([hidden])");
    await expect(dots.first()).toBeVisible();
    // The page scrolled so the box's bottom is 20 px above the view's top (its table, longer, still below it)
    await page.evaluate(() => {
      const scroller = document.querySelector(".cm-scroller")!;
      const box = document.querySelector(".sb-table-widget")!;
      scroller.scrollTop += box.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top + 20;
    });
    await settled(page);
    const at = await table(page).evaluate((w) => ({ head: w.querySelector("thead")!.getBoundingClientRect().bottom, box: w.getBoundingClientRect().bottom, view: document.querySelector(".cm-scroller")!.getBoundingClientRect().top }));
    expect(at.box).toBeLessThan(at.view);
    expect(at.head).toBeLessThanOrEqual(at.box + 0.5);
    await expect(dots).toHaveCount(0);
  });

  test("the room above it is covered whole in the page's color: no row shows between the view's top and the header", async ({ page }) => {
    const rows = Array.from({ length: 60 }, (_, i) => `| Row ${i + 1} | ${i * 3} |`).join("\n");
    await setPage(page, `# Test\n\nText above.\n\n| Name | Qty |\n|---|---|\n${rows}\n\nText below.\n`);
    await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(60);
    await page.evaluate(() => (document.querySelector(".cm-scroller")!.scrollTop = 913));
    await expect(table(page).locator("thead")).toHaveClass(/swt-stuck/);
    const view = await page.locator(".cm-scroller").evaluate((s) => s.getBoundingClientRect().top);
    await expectCovered(page, view);
  });

  test("full screen, a theme collapsing the table's borders: no row shows above the held header", async ({ page }) => {
    const rows = Array.from({ length: 60 }, (_, i) => `| Row ${i + 1} | ${i * 3} |`).join("\n");
    await setPage(page, `# Test\n\n| Name | Qty |\n|---|---|\n${rows}\n`);
    await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(60);
    // (border-collapse: collapse, as a theme of the user's has it: the browser paints no box-shadow of a cell then)
    await page.addStyleTag({ content: ".sb-table-widget table { border-collapse: collapse; }" });
    await table(page).locator("tbody tr td").first().hover();
    await (await tableIcon(page, "Full screen")).click();
    const box = page.locator(".sb-table-widget.swt-over-window");
    await expect(box).toBeVisible();
    await box.evaluate((b) => (b.scrollTop = 600));
    const top = await box.evaluate((b) => b.getBoundingClientRect().top);
    await expectCovered(page, top);
  });
});

// From `top` down to the held header's top (but the columns' letters, which are drawn there), the page's color
// alone: read from the pixels, as what failed was the browser not painting a cover it had
async function expectCovered(page: Page, top: number): Promise<void> {
  const head = (await table(page).locator("thead").boundingBox())!;
  const first = (await table(page).locator("thead tr").first().locator("> td").first().boundingBox())!;
  // The rows' band between the view's top and the letters (the letters sit just above the header)
  const band = { x: Math.ceil(first.x + 2), y: Math.ceil(top + 1), width: Math.floor(head.width - 4), height: Math.floor(head.y - top - 30) };
  expect(band.height).toBeGreaterThan(10);
  const shot = (await page.screenshot({ clip: band })).toString("base64");
  const colors = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, img.width, img.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < px.length; i += 4) seen.add((px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!);
    return seen.size;
  }, shot);
  expect(colors).toBe(1);
}
