// On a touch screen (the "touch" project: a phone's viewport, touch events)
import type { Locator, Page } from "@playwright/test";
import { cell, expect, longPress, markdown, menu, menuTitle, setPage, startingOn, table, runSilverBulletCommand, tableIcon, tap, target, test } from "./helpers.ts";

test.describe("Touch", () => {
  test("a long press on a cell opens its menu", async ({ page }) => {
    await longPress(page, cell(page, 2, 0));
    await expect(menuTitle(page)).toHaveText(/^Cell: Name, row 2/);
  });

  test("a tap on cells selected opens their menu; a tap selects one cell", async ({ page }) => {
    await tap(page, cell(page, 1, 0));
    await expect(page.locator(".swt-selected")).toHaveCount(1);
    await page.keyboard.press("Shift+ArrowDown");
    await expect(page.locator(".swt-selected")).toHaveCount(2);
    await tap(page, cell(page, 1, 0));
    await expect(menuTitle(page)).toHaveText("2 cells");
    await expect(menu(page)).toHaveCount(1);
  });

  test("a tap on a choice of the list while typing a formula inserts it, the editor staying open", async ({ page }) => {
    // Select mode: the first tap selects the cell, the second edits it
    await tap(page, cell(page, 1, 3));
    await tap(page, cell(page, 1, 3));
    const field = page.locator(".swt-cell-editor");
    await expect(field).toBeFocused();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("=su");
    const sum = page.locator(".swt-formula-choice", { has: page.locator("code", { hasText: /^SUM$/ }) });
    await expect(sum).toBeVisible();
    await tap(page, sum);
    await expect(field).toHaveValue("=SUM(");
    await expect(field).toBeFocused();
  });

  test("Enter on the last row adds a row and edits it, the focus never let go of on the way: the keyboard stays", async ({ page }) => {
    const rows = await table(page).locator("tr[data-swt-row]").count();
    const last = cell(page, rows, 1);
    await tap(page, last);
    await tap(page, last);
    const field = page.locator(".swt-cell-editor");
    await expect(field).toBeFocused();
    // Whether the focus ever went nowhere (to the page's body: the keyboard would go)
    await page.evaluate(() => {
      (window as unknown as { lost: number }).lost = 0;
      document.addEventListener("focusout", (e) => {
        if (!(e as FocusEvent).relatedTarget) (window as unknown as { lost: number }).lost++;
      });
    });
    await page.keyboard.press("Control+a");
    await page.keyboard.type("7");
    await page.keyboard.press("Enter");
    await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(rows + 1);
    await expect(page.locator(".swt-cell-editor")).toBeFocused();
    expect(await page.evaluate(() => (window as unknown as { lost: number }).lost)).toBe(0);
  });

  test("the selection's handles show after a touch, the fill handle does not", async ({ page }) => {
    await tap(page, cell(page, 2, 1));
    await expect(page.locator(".swt-select-handle").first()).toBeVisible();
    await expect(page.locator(".swt-fill-handle")).toBeHidden();
  });
});

test.describe("Touch: the selection's handles", () => {
  // What a finger takes at each handle's middle: the handle itself, not the header held over the rows nor nothing past
  // the table's box (a theme's header opaque, a table's box clipped as a card)
  const takenAtHandles = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll(".swt-select-handle")].map((handle) => {
        const r = handle.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === handle;
      }),
    );

  test("on the first row under the header and on a whole row, each handle taken where it shows", startingOn("# Test\n\n| Header A | Header B |\n|---|---|\n| Cell A | Cell B |\n\nAfter\n"), async ({ page }) => {
    await tap(page, cell(page, 1, 0));
    await expect(page.locator(".swt-select-handle")).toHaveCount(2);
    await expect.poll(() => takenAtHandles(page)).toEqual([true, true]);
    // The whole row: its handles in its middle, inside the table at its bottom edge
    await page.keyboard.press("Shift+ArrowRight");
    await expect(page.locator(".swt-selected")).toHaveCount(2);
    await expect(page.locator(".swt-select-handle.swt-at-mid")).toHaveCount(2);
    await expect.poll(() => takenAtHandles(page)).toEqual([true, true]);
  });
});

test.describe("Touch: moving a table on the sheet", () => {
  test("a tap on a table's cell shows its move handle; Move table… in the cell's menu, then a tap, moves it", startingOn("# Test\n\n| Item | Qty |\n|---|---|\n| Pear | 3 |\n| <meta core.table core.name='a' sheet.name='Plan' sheet.at='A1'> |\n\n| City |\n|---|\n| Brno |\n| <meta core.table core.name='b' sheet.name='Plan' sheet.at='D1'> |\n"), async ({ page }) => {
    await expect(table(page, 1).locator("tr[data-swt-row]")).toHaveCount(1);
    await tap(page, cell(page, 1, 0));
    await (await tableIcon(page, "Sheet view")).click();
    const a = page.locator(".sb-table-widget.swt-drawn.swt-sheet-table:not(.swt-stand-in)", { hasText: "Pear" });
    await expect(a).toBeVisible();
    // (Not the cell selected in the page, which a tap would edit)
    const first = a.locator("tr[data-swt-row='1'] > td").nth(1);
    await tap(page, first);
    await expect(page.locator(".swt-sheet-grab.swt-visible")).toBeVisible();
    await longPress(page, first);
    await tap(page, page.locator(".swt-menu .swt-menu-item", { hasText: "Move table…" }));
    // Four rows under a's last row, in its second column: B6
    const box = (await first.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 4.5);
    await expect.poll(() => markdown(page)).toContain("<meta core.table core.name='a' sheet.name='Plan' sheet.at='B6'>");
  });

  test("a long press on an empty cell of the sheet opens its menu: Add table here", startingOn("# Test\n\n| Item | Qty |\n|---|---|\n| Pear | 3 |\n| <meta core.table core.name='a' sheet.name='Plan' sheet.at='A1'> |\n\n| Code |\n|---|\n| X1 |\n"), async ({ page }) => {
    await expect(table(page, 1).locator("tr[data-swt-row]")).toHaveCount(1);
    await tap(page, cell(page, 1, 0));
    await (await tableIcon(page, "Sheet view")).click();
    const a = page.locator(".sb-table-widget.swt-drawn.swt-sheet-table:not(.swt-stand-in)", { hasText: "Pear" });
    await expect(a).toBeVisible();
    // Three rows under a's last row, in its first column: A6
    const box = (await a.locator("tr[data-swt-row='1'] > td").first().boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 3.5);
    const empty = page.locator(".swt-sheet-cell");
    await expect(empty).toBeVisible();
    await longPress(page, empty);
    await expect(menuTitle(page)).toHaveText("Cell A5");
    await tap(page, page.locator(".swt-menu .swt-menu-item", { hasText: "Add table here" }));
    await tap(page, page.locator(".swt-menu .swt-menu-item", { hasText: "Code" }));
    await expect.poll(() => markdown(page)).toMatch(/<meta core.table core.name='\w+' sheet.name='Plan' sheet.at='A5'>/);
    await expect(page.locator(".swt-cell-editor")).toHaveCount(0);
  });
});

test.describe("Touch: a dialog taller than the screen", () => {
  // What a dialog must show on a phone: within the window, its Save in view, what does not fit scrolling in its body
  async function fitsTheScreen(page: Page, dialog: Locator): Promise<void> {
    const view = page.viewportSize()!;
    const box = (await dialog.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1);
    await expect(dialog.locator(".swt-dialog-primary")).toBeInViewport();
    const body = dialog.locator(".swt-dialog-body");
    const scrolls = await body.evaluate((b) => b.scrollHeight > b.clientHeight);
    expect(scrolls).toBe(true);
    await body.evaluate((b) => (b.scrollTop = b.scrollHeight));
    expect(await body.evaluate((b) => b.scrollTop)).toBeGreaterThan(0);
  }

  test("the rules of conditional formatting: a rule of many keywords edited, Save in view, the rest scrolled to", async ({ page }) => {
    const rows = Array.from({ length: 8 }, (_, i) => `{"pattern":"word${i}","style":{"fill":"green"}}`).join(",");
    await setPage(page, `| Item | Status |\n|---|---|\n| Pear | word1 |\n| Fig | word2 |\n| <meta core.table conditions.-c-status.rules='[{"format":["byPattern",{"rows":[${rows}]}]}]'> |\n`);
    await tap(page, cell(page, 1, 0));
    // (Its icon in the toolbar of a table with rules, the bar shown once placed)
    await tap(page, page.locator('.swt-bar.swt-visible button[aria-label="Conditional formatting"]'));
    const dialog = page.locator(".swt-cf-dialog");
    await expect(dialog).toBeVisible();
    await tap(page, dialog.locator(".swt-cf-summary").first());
    await expect(dialog.locator(".swt-cf-list-row")).toHaveCount(8);
    await fitsTheScreen(page, dialog);
  });

  test("a pivot's settings with its preview: Save in view, the rest scrolled to", async ({ page }) => {
    const source = Array.from({ length: 30 }, (_, i) => `| R${i} | ${i} |`).join("\n");
    await setPage(page, `| Region | Revenue |\n|---|--:|\n${source}\n| <meta core.table core.name='orders'> |\n\n| Region | Sum of Revenue |\n|---|--:|\n| R0 | 0 |\n| <meta core.table pivot.source='orders' pivot.rows='region' pivot.values='SUM([revenue])'> |\n`);
    await cell(page, 1, 0, 1).scrollIntoViewIfNeeded();
    await tap(page, cell(page, 1, 0, 1));
    await tap(page, page.locator('.swt-bar.swt-visible button[aria-label="Pivot settings…"]'));
    const dialog = page.locator(".swt-pivot-dialog");
    await expect(dialog.locator(".swt-pivot-table")).toBeVisible();
    await fitsTheScreen(page, dialog);
  });
});

test.describe("SilverBullet's space tree over the page", () => {
  test("opened over a table on a phone: the table's toolbar and grips, where the tree then lies, gone from over it, none taking a tap meant for the tree; closed, the toolbar and grips back", startingOn("# Test\n\n| Header A | Header B |\n|---|---|\n| Cell A | Cell B |\n| Cell C | Cell D |\n\nAfter\n"), async ({ page }) => {
    test.skip(target !== "silverbullet", "SilverBullet's own panel");
    await tap(page, cell(page, 1, 0));
    const shown = page.locator(".swt-floating.swt-visible:not(.swt-out-of-view)");
    await expect(page.locator(".swt-bar.swt-visible")).toBeVisible();
    await expect(page.locator(".swt-grip.swt-visible").first()).toBeVisible();
    const boxesOf = () => shown.evaluateAll((all) => all.map((one) => one.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom })));
    const before = await boxesOf();
    test.skip(!(await runSilverBulletCommand(page, "Navigate: Tree")), "a SilverBullet without the space tree (2.12.1)");
    const tree = page.locator(".sb-nav-root");
    await expect(tree).toBeVisible();
    const panel = (await tree.boundingBox())!;
    const over = (boxes: readonly { left: number; right: number; top: number; bottom: number }[]) =>
      boxes.filter((r) => r.left < panel.x + panel.width && r.right > panel.x && r.top < panel.y + panel.height && r.bottom > panel.y).length;
    // (Where the tree lies now the controls were: else this test tests nothing)
    expect(over(before)).toBeGreaterThan(0);
    // Nothing of the table's floating over the tree: each control shown lies beside it
    await expect.poll(async () => over(await boxesOf())).toBe(0);
    // Closed by its own ×: the toolbar back over its table
    await tap(page, tree.getByRole("button", { name: "Close", exact: true }));
    await expect(tree).toBeHidden();
    await expect(page.locator(".swt-bar.swt-visible:not(.swt-out-of-view)")).toBeVisible();
    await expect(page.locator(".swt-grip.swt-visible").first()).toBeVisible();
  });
});
