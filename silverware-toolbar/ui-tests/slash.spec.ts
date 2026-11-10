// The slash module's action: "/" written at the cursor and the editor's completion started, as typing "/" does
import { barButton, expect, onSilverBullet, popup, select, test, text } from "./helpers.ts";

test.describe("Slash commands", () => {
  test("run from the list of every action: / after the selection (a space before it after a word), the slash commands offered; Esc closes them", async ({ page }) => {
    await select(page, "some text");
    await barButton(page, "actions.more").click();
    await popup(page).locator(".swb-search-field").fill("slash");
    await page.keyboard.press("Enter");
    await expect.poll(() => text(page)).toContain("Select some text / in this page");
    const completion = page.locator(".cm-tooltip-autocomplete");
    await expect(completion).toBeVisible();
    await expect(completion.locator("li").first()).toBeVisible();
    if (!onSilverBullet) {
      // The playground's own: one picked takes the "/" and writes its text
      await completion.locator("li", { hasText: "hr" }).click();
      await expect.poll(() => text(page)).toContain("Select some text --- in this page");
      return;
    }
    await page.keyboard.press("Escape");
    await expect(completion).toHaveCount(0);
  });
});
