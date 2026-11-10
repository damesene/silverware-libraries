// Silverware Icons: the picker (its sets as tabs, a set's groups, the search, the keys, those used last) and an icon
// drawn as the plugins draw it; against SilverBullet, its API from Space Lua
import { expect, onSilverBullet, picker, shownValues, test } from "./helpers.ts";

test.describe("The picker @playground", () => {
  test("Lucide's icons in one grid, its 43 categories a dropdown; one picked drawn in the text's color, as the plugins draw it", async ({ page }) => {
    const tabs = picker(page).locator(".swi-set");
    await expect(tabs).toHaveText(["Icons", "Emoji"]);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    expect((await shownValues(page)).length).toBeGreaterThan(2000);
    const select = picker(page).locator(".swi-group-select");
    await expect(select.locator("option")).toHaveCount(44);
    await select.selectOption({ label: "Arrows" });
    await expect(picker(page).locator(".swi-section")).toHaveText("Arrows");
    expect(await shownValues(page)).toContain("lucide:arrow-up");
    await picker(page).locator('[data-swi-value="lucide:arrow-up"]').click();
    await expect(page.locator("#value")).toHaveText("lucide:arrow-up (Arrow up)");
    // In a button that is on: the accent's color, the icon's lines in it
    const on = page.locator(".sample.button.on svg");
    const color = await page.locator(".sample.button.on").evaluate((b) => getComputedStyle(b).color);
    expect(await on.evaluate((svg) => getComputedStyle(svg).stroke)).toBe(color);
  });

  test("the search by name and keyword, ↓ and arrows into the icons, Enter picks; used last first after", async ({ page }) => {
    const field = picker(page).locator(".swi-field");
    await expect(field).toBeFocused();
    await field.fill("building");
    expect(await shownValues(page)).toContain("lucide:house");
    await field.fill("house");
    // (↓ a row down, → the next: the one marked current is picked)
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    const current = picker(page).locator(".swi-item.swi-current");
    const second = (await current.getAttribute("data-swi-value"))!;
    expect(second).not.toBe((await shownValues(page))[0]);
    await page.keyboard.press("Enter");
    await expect(page.locator("#value")).toContainText(second);
    await field.fill("");
    await expect(picker(page).locator(".swi-section").first()).toHaveText("Used last");
    expect((await shownValues(page))[0]).toBe(second);
  });

  test("emoji: their groups a row of their icons over the search, the tab used last open again; emoji only, no tabs", async ({ page }) => {
    await picker(page).locator('.swi-set[data-swi-set="emoji"]').click();
    const groups = picker(page).locator(".swi-group");
    await expect(groups).toHaveCount(10);
    await expect(picker(page).locator(".swi-group-select")).toHaveCount(0);
    await groups.nth(5).click();
    await expect(picker(page).locator(".swi-section")).toHaveText("Travel & places");
    await picker(page).locator(".swi-item").first().click();
    await expect(page.locator("#value")).not.toContainText(":");
    await page.reload();
    await expect(picker(page).locator('.swi-set[aria-selected="true"]')).toHaveText("Emoji");
    await page.locator("#emoji-only").check();
    await expect(picker(page).locator(".swi-set")).toHaveCount(0);
    await expect(picker(page).locator(".swi-group")).toHaveCount(10);
  });
});

test.describe("The API in SilverBullet", () => {
  test("from Space Lua: an icon's label, a set's icon drawn once its set is in", async ({ page, open }) => {
    test.skip(!onSilverBullet, "the API page is SilverBullet's");
    await open("# Icons\n\nLabel: ${silverware.icons.api.text('lucide:house')}\n");
    await expect(page.locator(".cm-content")).toContainText("Label: House");
    await expect
      .poll(() => page.evaluate(async () => String(await (window as unknown as { client: { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } } }).client.clientSystem.localSyscall("lua.evalExpression", ["silverware.icons.api.markup('lucide:home', 'x')"]))))
      .toContain('data-swi-state="drawn"');
  });
});
