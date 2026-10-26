// The toolbar by a selection (or at the caret) and the popup of every action under it
import { bar, barButton, caret, expect, lineBox, popup, select, selected, test, text } from "./helpers.ts";

// The command's key, as the playground binds it (SilverBullet binds the library page's command so)
const KEY = "Control+Shift+Q";

test.describe("The toolbar", () => {
  test("shows by a selection made, in rows (Turn into with its label above the icons), and goes when there is none", async ({ page }) => {
    await select(page, "Plain paragraph one");
    await expect(bar(page)).toBeVisible();
    await expect(bar(page).locator(".swb-row")).toHaveCount(2);
    await expect(bar(page).locator(".swb-row").first().locator(".swb-button")).toHaveText(["Paragraph"]);
    // Above the selection
    const toolbar = (await bar(page).boundingBox())!;
    const line = await lineBox(page, "Plain paragraph one");
    expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(line.y);
    await select(page, "Plain", 0);
    await expect(bar(page)).toBeHidden();
  });

  test("selected by dragging the mouse: shown once it is let go, not while dragging", async ({ page }) => {
    const line = await lineBox(page, "Select some text");
    await page.mouse.move(line.x + 2, line.y + line.height / 2);
    await page.mouse.down();
    await page.mouse.move(line.x + 60, line.y + line.height / 2, { steps: 5 });
    await page.waitForTimeout(400);
    await expect(bar(page)).toBeHidden();
    await page.mouse.up();
    await expect(bar(page)).toBeVisible();
    await page.screenshot({ path: "test-results/toolbar-bar.png" });
  });

  test("a format toggles: bold written around the selection, shown on, and taken off again", async ({ page }) => {
    await select(page, "some text");
    await expect(barButton(page, "formats.bold")).toHaveAttribute("aria-pressed", "false");
    await barButton(page, "formats.bold").click();
    expect(await text(page)).toContain("Select **some text** in this page");
    expect(await selected(page)).toBe("some text");
    await expect(barButton(page, "formats.bold")).toHaveAttribute("aria-pressed", "true");
    await barButton(page, "formats.bold").click();
    expect(await text(page)).toContain("Select some text in this page");
  });

  test("bold over two lines of a paragraph is one pair, pressed again taken off: the text as it was", async ({ page }) => {
    const lines = "Plain paragraph one.\nPlain paragraph two";
    await select(page, "paragraph one.\nPlain paragrap");
    await barButton(page, "formats.bold").click();
    await expect.poll(() => text(page)).toContain("Plain **paragraph one.\nPlain paragrap**h two");
    await expect(barButton(page, "formats.bold")).toHaveAttribute("aria-pressed", "true");
    await barButton(page, "formats.bold").click();
    await expect.poll(() => text(page)).toContain(lines);
  });

  test("a link made of the selection puts the caret where its url goes", async ({ page }) => {
    await select(page, "some text");
    await barButton(page, "formats.link").click();
    expect(await text(page)).toContain("Select [some text]() in this page");
    await page.keyboard.type("https://x.cz");
    expect(await text(page)).toContain("Select [some text](https://x.cz) in this page");
  });

  test("Turn into shows the lines' block format (several: Multiple types) and lists the block formats; one picked turns every line", async ({ page }) => {
    await select(page, "> A quote,\n> on two lines.\n\nPlain paragraph one.");
    await expect(barButton(page, "actions.turnInto")).toHaveText("Multiple types");
    await select(page, "Plain paragraph one.\nPlain paragraph two");
    await expect(barButton(page, "actions.turnInto")).toHaveText("Paragraph");
    await barButton(page, "actions.turnInto").click();
    const menu = page.locator(".swb-menu.swb-visible");
    await expect(menu.locator('[data-swb-action="formats.paragraph"]')).toHaveAttribute("aria-checked", "true");
    await menu.locator('[data-swb-action="formats.bullet"]').click();
    expect(await text(page)).toContain("- Plain paragraph one.\n- Plain paragraph two");
    await expect(menu).toHaveCount(0);
    await expect(barButton(page, "actions.turnInto")).toHaveText("Bullet list");
  });

  test("a press on it keeps the editor's selection and focus", async ({ page }) => {
    await select(page, "some text");
    await bar(page).locator(".swb-divider").first().click();
    expect(await selected(page)).toBe("some text");
    await expect(page.locator(".cm-content")).toBeFocused();
  });
});

test.describe("The popup of every action", () => {
  test("the key opens it under the toolbar, its search focused: typed words find, arrows pick, Enter runs, the editor focused after", async ({ page }) => {
    await select(page, "First item\n- Second item with [a link](https://silverbullet.md)\n- Third item");
    await page.keyboard.press(KEY);
    await expect(popup(page)).toBeVisible();
    // Under the toolbar, which stays
    await expect(bar(page)).toBeVisible();
    const toolbar = (await bar(page).boundingBox())!;
    expect((await popup(page).boundingBox())!.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height);
    const search = popup(page).locator(".swb-search-field");
    await expect(search).toBeFocused();
    await page.screenshot({ path: "test-results/toolbar-popup.png" });
    await search.fill("num");
    // First, the format (SilverBullet's commands it finds too come after it)
    await expect(popup(page).locator(".swb-option").first()).toHaveText("Numbered list");
    await expect(popup(page).locator(".swb-option.swb-current")).toHaveText("Numbered list");
    await page.keyboard.press("Enter");
    await expect(popup(page)).toBeHidden();
    expect(await text(page)).toContain("1. First item\n2. Second item with [a link](https://silverbullet.md)\n3. Third item");
    await expect(page.locator(".cm-content")).toBeFocused();
  });

  test("its keys: ↓ goes along the actions offered; Esc closes it, the toolbar stays and the editor has the selection again; a second Esc hides the toolbar", async ({ page }) => {
    await select(page, "The end");
    await page.keyboard.press(KEY);
    const current = popup(page).locator(".swb-option.swb-current");
    await expect(current).toHaveAttribute("data-swb-action", "formats.bold");
    await page.keyboard.press("ArrowDown");
    await expect(current).toHaveAttribute("data-swb-action", "formats.italic");
    await page.keyboard.press("Escape");
    await expect(popup(page)).toBeHidden();
    await expect(bar(page)).toBeVisible();
    await expect(page.locator(".cm-content")).toBeFocused();
    expect(await selected(page)).toBe("The end");
    await page.keyboard.press("Escape");
    await expect(bar(page)).toBeHidden();
  });

  test("Turn into is one item: Enter opens its block formats in its place, Esc goes back; typed, they are found at once", async ({ page }) => {
    await select(page, "Plain paragraph one.");
    await page.keyboard.press(KEY);
    const options = popup(page).locator(".swb-option");
    await expect(options.filter({ hasText: "Bullet list" })).toHaveCount(0);
    const turnInto = popup(page).locator('[data-swb-action="actions.turnInto"]');
    await turnInto.hover();
    await page.keyboard.press("Enter");
    await expect(popup(page).locator(".swb-back")).toHaveText("Turn into");
    await expect(options.first()).toHaveAttribute("data-swb-action", "formats.paragraph");
    await page.keyboard.press("Escape");
    await expect(popup(page).locator(".swb-back")).toHaveCount(0);
    await expect(popup(page).locator(".swb-option.swb-current")).toHaveAttribute("data-swb-action", "actions.turnInto");
    await popup(page).locator(".swb-search-field").fill("quo");
    await expect(options.first()).toHaveText("Quote");
    await expect(popup(page).locator(".swb-option.swb-current")).toHaveText("Quote");
    await page.keyboard.press("Enter");
    expect(await text(page)).toContain("> Plain paragraph one.");
  });

  test("SilverBullet's commands: not listed as it opens, found by their name typed, run on the selection", async ({ page }) => {
    await select(page, "some text");
    await page.keyboard.press(KEY);
    await expect(popup(page).locator(".swb-group", { hasText: "Commands" })).toHaveCount(0);
    await popup(page).locator(".swb-search-field").fill("text bold");
    await expect(popup(page).locator('[data-swb-action="commands.Text: Bold"]')).toBeVisible();
    await popup(page).locator('[data-swb-action="commands.Text: Bold"]').click();
    await expect.poll(() => text(page)).toContain("Select **some text** in this page");
  });

  test("… in the toolbar opens it, and closes it again; a click on an action runs it", async ({ page }) => {
    await select(page, "struck", 6);
    await bar(page).locator(".swb-more").click();
    await expect(popup(page)).toBeVisible();
    await bar(page).locator(".swb-more").click();
    await expect(popup(page)).toBeHidden();
    await bar(page).locator(".swb-more").click();
    await popup(page).locator('[data-swb-action="formats.wikiLink"]').click();
    expect(await text(page)).toContain("~~[[struck]]~~");
  });
});

test.describe("The toolbar at the caret", () => {
  test("the key without a selection shows it at the caret, the popup open; its buttons show the formats around the caret", async ({ page }) => {
    await caret(page, "a link](", -2);
    await page.keyboard.press(KEY);
    await expect(popup(page)).toBeVisible();
    await expect(bar(page)).toBeVisible();
    await expect(barButton(page, "formats.link")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(popup(page)).toBeHidden();
    await expect(bar(page)).toBeVisible();
    // A click on Link takes the link the caret is in off, its text kept
    await barButton(page, "formats.link").click();
    expect(await text(page)).toContain("- Second item with a link\n");
  });

  test("a format at the caret works on the word it is in, as if selected, the caret staying where it was", async ({ page }) => {
    await caret(page, "some text", 2);
    await page.keyboard.press(KEY);
    await page.keyboard.press("Escape");
    await expect(barButton(page, "formats.bold")).toHaveAttribute("aria-pressed", "false");
    await barButton(page, "formats.bold").click();
    await expect.poll(() => text(page)).toContain("Select **some** text");
    await page.keyboard.type("X");
    await expect.poll(() => text(page)).toContain("Select **soXme** text");
  });

  test("goes as text is typed", async ({ page }) => {
    await caret(page, "The end", 3);
    await page.keyboard.press(KEY);
    await page.keyboard.press("Escape");
    await expect(bar(page)).toBeVisible();
    await page.keyboard.type("x");
    await expect(bar(page)).toBeHidden();
    expect(await text(page)).toContain("Thex end");
  });
});
