import { bodyRows, cell, cursorLine, expect, header, hoverCell, markdown, markTable, rendersAnew, setPage, settled, table, test } from "./helpers.ts";

test.describe("Another plugin's over the window", () => {
  test("a table under what another plugin shows over the window (a database's peek) shows no + and no toolbar there", async ({ page }) => {
    // A cell selected: the table has the focus
    await cell(page, 1, 0).click();
    await hoverCell(page, cell(page, 1, 0));
    const first = (await cell(page, 1, 0).boundingBox())!;
    await page.mouse.move(first.x - 13, first.y + first.height - 1, { steps: 4 });
    await expect(page.locator(".swt-insert.swt-visible")).toHaveCount(1);
    // Laid over the whole window, marked as the plugins mark what they show over it (shared/overwindow.ts)
    await page.evaluate(() => {
      const over = document.createElement("div");
      over.setAttribute("data-silverware-over-window", "");
      over.style.cssText = "position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.05)";
      document.body.append(over);
    });
    await page.mouse.move(first.x - 25, first.y + first.height - 1, { steps: 4 });
    await expect(page.locator(".swt-insert.swt-visible")).toHaveCount(0);
    await page.mouse.move(first.x + 10, first.y + 5, { steps: 4 });
    await expect(page.locator(".swt-bar.swt-visible")).toHaveCount(0);
  });
});

test.describe("Inserting rows with a +", () => {
  test("the + near a dot left of the table inserts a row at that border", async ({ page }) => {
    // A cell selected: the table has the focus
    await cell(page, 1, 0).click();
    await hoverCell(page, cell(page, 1, 0));
    const first = (await cell(page, 1, 0).boundingBox())!;
    // Left of the row grips, by the dot on the border under the first row
    await page.mouse.move(first.x - 13, first.y + first.height - 1, { steps: 4 });
    const plus = page.locator(".swt-insert.swt-visible");
    await expect(plus).toHaveCount(1);
    await rendersAnew(page, () => plus.click());
    await expect(bodyRows(page)).toHaveCount(7);
    // The new row under Pear, its first cell edited
    await expect(page.locator(".swt-cell-editor")).toBeFocused();
    expect(await markdown(page)).toMatch(/\| Pear[^\n]*\n\| +\| +\| +\| +\|\n\| apple/);
  });

  test("dots show only while the table has the focus, a + only near one with its line, and a press beside it inserts nothing", async ({ page }) => {
    const dots = page.locator(".swt-insert-dots.swt-visible > span:not([hidden])");
    const plus = page.locator(".swt-insert.swt-visible");
    const line = page.locator(".swt-insert-line.swt-visible");
    const first = (await cell(page, 1, 0).boundingBox())!;
    const border = first.y + first.height - 1;
    // Hovered only: no dots, and no + where the dot would be
    await hoverCell(page, cell(page, 1, 0));
    await page.mouse.move(first.x - 13, border, { steps: 4 });
    await expect(dots).toHaveCount(0);
    await expect(plus).toHaveCount(0);
    // A cell selected: a dot on each border, left of the table and above it
    await cell(page, 1, 0).click();
    await expect(dots.first()).toBeVisible();
    // Near the dot: the +, its line with it
    await page.mouse.move(first.x - 13, border, { steps: 4 });
    await expect(plus).toHaveCount(1);
    await expect(line).toHaveCount(1);
    // Out in the band past the dot: neither, and a press there writes nothing
    await page.mouse.move(first.x - 28, border, { steps: 2 });
    await expect(plus).toHaveCount(0);
    await expect(line).toHaveCount(0);
    const before = await markdown(page);
    await markTable(page);
    await page.mouse.down();
    await page.mouse.up();
    await settled(page);
    await expect(page.locator("table[data-test-old]")).toHaveCount(1);
    expect(await markdown(page)).toBe(before);
    // Away from the table (its controls gone), then straight to a dot from outside it: the + there
    await page.mouse.move(Math.max(2, first.x - 200), border, { steps: 4 });
    await expect(page.locator(".swt-grip.swt-visible")).toHaveCount(0);
    await page.mouse.move(first.x - 13, border, { steps: 8 });
    await expect(plus).toHaveCount(1);
    // Esc ends the selection: the table has the focus no more, its dots go
    await page.keyboard.press("Escape");
    await expect(dots).toHaveCount(0);
  });

  test("the dot under the last row brings up a + adding a row at the end", async ({ page }) => {
    const last = bodyRows(page).last().locator("td").first();
    await last.click();
    await hoverCell(page, last);
    const box = (await last.boundingBox())!;
    await page.mouse.move(box.x - 13, box.y + box.height + 1, { steps: 4 });
    const plus = page.locator(".swt-insert.swt-visible");
    await expect(plus).toHaveCount(1);
    await rendersAnew(page, () => plus.click());
    await expect(bodyRows(page)).toHaveCount(7);
    expect(await markdown(page)).toMatch(/\| Šípek[^\n]*\n\| +\| +\| +\| +\|\n/);
  });

  test("a dialog over the band above the header takes its own press: no column is inserted", async ({ page }) => {
    await hoverCell(page, cell(page, 1, 1));
    const head = (await header(page, 1).boundingBox())!;
    // A modal dialog over the band, as the host shows its own (SilverBullet's confirm, above the page's top)
    await page.evaluate(({ x, y }) => {
      const dialog = document.createElement("dialog");
      dialog.style.cssText = `position: fixed; inset: auto; margin: 0; padding: 0; left: ${x}px; top: ${y}px; width: 80px; height: 20px`;
      const ok = document.createElement("button");
      ok.textContent = "Ok";
      ok.style.cssText = "width: 100%; height: 100%";
      ok.onclick = () => dialog.close();
      dialog.append(ok);
      document.body.append(dialog);
      dialog.showModal();
    }, { x: head.x + head.width - 40, y: head.y - 24 });
    const before = await markdown(page);
    await markTable(page);
    await page.getByRole("button", { name: "Ok" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await settled(page);
    await expect(page.locator("table[data-test-old]")).toHaveCount(1);
    expect(await markdown(page)).toBe(before);
  });
});

test("a press on the text right above a table, in the band of its +, is the text's", async ({ page }) => {
  // No empty line between: the band above the header reaches over the text
  await setPage(page, "# Test\n\nText right above the table.\n| Name | Qty |\n|---|---|\n| Pear | 3 |\n| Fig | 2 |\n");
  await expect(table(page).locator("tr[data-swt-row]")).toHaveCount(2);
  const line = page.locator(".cm-line", { hasText: "Text right above the table." });
  // Coming from the table: hovered, the band above its header is the +'s
  await hoverCell(page, cell(page, 1, 1));
  const head = (await header(page, 1).boundingBox())!;
  const text = (await line.boundingBox())!;
  expect(text.y + text.height).toBeGreaterThan(head.y - 20);
  await page.mouse.move(head.x + head.width / 2, Math.max(text.y + 2, head.y - 18), { steps: 4 });
  await page.mouse.down();
  await page.mouse.up();
  // The editor's cursor on the text's line
  await expect.poll(() => cursorLine(page)).toBe("Text right above the table.");
});
