// What Silverware Tags lays over the page (docs/silverware-core-work.md, step S, item 3): the tags' manager, on top
// whole (what the document has at its middle and corners, not visibility alone), Esc closing it.
import { expect, ON_TOP, onTopAt, openManager, test } from "./helpers.ts";

test("the manager on top whole; Esc closes it", async ({ page }) => {
  // (The manager's window is the dialog itself, `.swg-workspace` its class)
  const window = await openManager(page, "todo");
  await expect(window).toHaveAttribute("role", "dialog");
  expect(await onTopAt(window)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(page.locator(".swg-workspace")).toHaveCount(0);
});
