// What Silverware Toolbar lays over the page (docs/silverware-core-work.md, step S, item 3): its bar by a selection,
// Turn into's list, the popup of every action, an action's panel, each on top whole (what the document has at its middle and corners, not
// visibility alone), Esc closing the top one alone. Over other plugins' surfaces: cross-plugin/ui-tests/stacking.
import { bar, barButton, expect, expectNoPageErrorsYet, ON_TOP, onTopAt, popup, select, selected, test } from "./helpers.ts";

test("its bar and the popup of every action, each on top whole; Esc closes the popup alone, the bar kept", async ({ page }) => {
  await select(page, "Plain paragraph one.\nPlain paragraph two");
  await expect(bar(page)).toBeVisible();
  expect(await onTopAt(bar(page))).toEqual(ON_TOP);
  await barButton(page, "actions.more").click();
  await expect(popup(page)).toBeVisible();
  expect(await onTopAt(popup(page))).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  // (The selection kept: the bar stays by it, not shown a moment before a late hide)
  await expect.poll(() => selected(page)).toBe("Plain paragraph one.\nPlain paragraph two");
  await expect(bar(page)).toBeVisible();
});

test("an action's panel (the emoji picker) on top whole; Esc closes it alone, the selection and the bar kept", async ({ page }) => {
  await select(page, "some text");
  await barButton(page, "actions.more").click();
  await popup(page).locator(".swb-search-field").fill("emoji");
  await page.keyboard.press("Enter");
  const panel = page.locator(".swb-panel.swb-visible");
  await expect(panel.locator(".swi-field")).toBeFocused();
  expect(await onTopAt(panel)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect.poll(() => selected(page)).toBe("some text");
  await expect(bar(page)).toBeVisible();
});

test("Turn into's list on top whole; Esc closes it alone, the bar kept (known: the bar hidden too)", async ({ page }) => {
  await select(page, "Plain paragraph one.\nPlain paragraph two");
  await barButton(page, "actions.turnInto").click();
  const list = page.locator(".swb-menu.swb-visible");
  await expect(list).toBeVisible();
  expect(await onTopAt(list)).toEqual(ON_TOP);
  await page.keyboard.press("Escape");
  await expect(list).toHaveCount(0);
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-26): Esc in Turn into's list hides the bar too, as the popup's and a panel's Esc do not: the list has no key handler and takes no focus, so the controller's key listener hides the bar (src/core/controller.ts onKey) and the Esc goes on to the editor, whose Escape collapses the selection; fixed by the core's one stack of overlays and keys (steps 4 and 6)");
  // (The state settled, not one read: the selection still held, then the bar by it)
  await expect.poll(() => selected(page), { timeout: 5_000 }).toBe("Plain paragraph one.\nPlain paragraph two");
  await expect(bar(page)).toBeVisible({ timeout: 5_000 });
});
