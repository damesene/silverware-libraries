// The picker's keys (docs/silverware-core-work.md, step S, item 4: recorded against today's code before the picker is
// rewritten): the current icon held within the icons shown; → and ← the search's own while it holds text, until ↓
// goes into the icons, and the icons' at once while it is empty; a key typed giving them back to the search; Enter
// picking the current one.
import { expect, picker, shownValues, test } from "./helpers.ts";

test.describe("The picker's keys @playground", () => {
  test("the current icon stays within those shown: ↑ and ← at the first, ↓ past the last row at the last; → in the search moves its caret alone", async ({ page }) => {
    const field = picker(page).locator(".swi-field");
    await expect(field).toBeFocused();
    await field.fill("house");
    const current = picker(page).locator(".swi-item.swi-current");
    const values = await shownValues(page);
    expect(values.length).toBeGreaterThan(1);
    const now = () => current.getAttribute("data-swi-value");
    await expect.poll(now).toBe(values[0]);
    // → before ↓: the search's, its caret moved, the current icon as it was
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    expect(await field.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(1);
    await expect.poll(now).toBe(values[0]);
    // ↑ and ← at the first: still the first
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(now).toBe(values[0]);
    // ↓ past the last row: the last
    for (let n = 0; n < values.length + 2; n++) await page.keyboard.press("ArrowDown");
    await expect.poll(now).toBe(values[values.length - 1]);
    await page.keyboard.press("ArrowRight");
    await expect.poll(now).toBe(values[values.length - 1]);
    await page.keyboard.press("Enter");
    await expect(page.locator("#value")).toHaveText(new RegExp(`^${values[values.length - 1]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(`));
  });

  test("with the search empty → and ← move the current icon at once; a key typed after ↓ gives the arrows back to the search", async ({ page }) => {
    const field = picker(page).locator(".swi-field");
    await expect(field).toBeFocused();
    const current = picker(page).locator(".swi-item.swi-current");
    const values = await shownValues(page);
    const now = () => current.getAttribute("data-swi-value");
    await expect.poll(now).toBe(values[0]);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect.poll(now).toBe(values[2]);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(now).toBe(values[1]);
    // Typed: the search's again, its → the caret's (the current icon the first found)
    await page.keyboard.press("ArrowDown");
    await page.keyboard.type("house");
    const found = await shownValues(page);
    await expect.poll(now).toBe(found[0]);
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    expect(await field.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(1);
    await expect.poll(now).toBe(found[0]);
  });
});
