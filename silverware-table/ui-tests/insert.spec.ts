import { bodyRows, cell, expect, header, hoverCell, markdown, markTable, rendersAnew, settled, test } from "./helpers.ts";

test.describe("Inserting rows with a +", () => {
  test("the + left of the table inserts a row at the border nearest the pointer", async ({ page }) => {
    await hoverCell(page, cell(page, 1, 0));
    const first = (await cell(page, 1, 0).boundingBox())!;
    // Left of the row grips, on the border under the first row
    await page.mouse.move(first.x - 20, first.y + first.height - 1, { steps: 4 });
    const plus = page.locator(".swt-insert:not(.swt-quiet).swt-visible");
    await expect(plus).toHaveCount(1);
    await rendersAnew(page, () => plus.click());
    await expect(bodyRows(page)).toHaveCount(7);
    // The new row under Pear, its first cell edited
    await expect(page.locator(".swt-cell-editor")).toBeFocused();
    expect(await markdown(page)).toMatch(/\| Pear[^\n]*\n\| +\| +\| +\| +\|\n\| apple/);
  });

  test("the + shows quiet until the pointer is on it, and a press near it inserts nothing", async ({ page }) => {
    await hoverCell(page, cell(page, 1, 0));
    const first = (await cell(page, 1, 0).boundingBox())!;
    // In the band left of the row grips, on the border under the first row, left of the + there
    await page.mouse.move(first.x - 30, first.y + first.height - 1, { steps: 4 });
    const plus = page.locator(".swt-insert:not(.swt-quiet).swt-visible");
    await expect(plus).toHaveCount(1);
    const box = (await plus.boundingBox())!;
    // Not on the + itself
    expect(first.x - 30).toBeLessThan(box.x);
    const look = () => plus.evaluate((el) => getComputedStyle(el).borderStyle);
    const line = page.locator(".swt-insert-line.swt-visible");
    expect(await look()).toBe("dashed");
    await expect(line).not.toHaveClass(/swt-lit/);
    const before = await markdown(page);
    await markTable(page);
    await page.mouse.down();
    await page.mouse.up();
    await settled(page);
    await expect(page.locator("table[data-test-old]")).toHaveCount(1);
    expect(await markdown(page)).toBe(before);
    // On the +: lit, its line too
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
    await expect.poll(look).not.toBe("dashed");
    await expect(line).toHaveClass(/swt-lit/);
  });

  test("the quiet + under the last row adds a row at the end", async ({ page }) => {
    await hoverCell(page, bodyRows(page).last().locator("td").first());
    const quiet = page.locator(".swt-insert.swt-quiet.swt-visible");
    await expect(quiet.first()).toBeVisible();
    await rendersAnew(page, () => quiet.first().click());
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
