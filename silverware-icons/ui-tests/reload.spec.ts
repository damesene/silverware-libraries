// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// API page again (its definitions reset, `silverware.icons.api` made again). After it the API answers as before, a
// set of the space's own too, defined once. (Whether its script ran again is not told: the registry keeps the sets of
// before until a new one comes, src/registry.ts `anewDefinitions`, so a set whose script is gone stays too; and
// SilverBullet was seen running a deleted page's block again after a load of the page, 2026-11-28.)
import type { Page } from "@playwright/test";
import { expect, inLibrary, onSilverBullet, reloadSpaceLua, test } from "./helpers.ts";

test("after System: Reload the API draws and names an icon as before", async ({ page, open }) => {
  test.skip(!onSilverBullet, "the API page is SilverBullet's");
  await open("# Icons\n\nLabel: ${silverware.icons.api.text('lucide:house')}\n");
  await expect(page.locator(".cm-content")).toContainText("Label: House");
  await reloadSpaceLua(page);
  const evaluate = (expression: string) =>
    page.evaluate(async (expression) => String(await (window as unknown as { client: { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } } }).client.clientSystem.localSyscall("lua.evalExpression", [expression])), expression);
  await expect.poll(() => evaluate("silverware.icons.api.text('lucide:house')")).toBe("House");
  await expect.poll(() => evaluate("silverware.icons.api.markup('lucide:home', 'x')")).toContain('data-swi-state="drawn"');
});

/** A Lua expression's value as Space Lua gives it now, as text */
const evaluate = (page: Page, expression: string) =>
  page.evaluate(async (expression) => String(await (window as unknown as { client: { clientSystem: { localSyscall(name: string, args: unknown[]): Promise<unknown> } } }).client.clientSystem.localSyscall("lua.evalExpression", [expression])), expression);

// A set of the space's own (the library page's example, "A set of your own") and the script defining it
const SET = 'export default { name: "mine", label: "Mine", kind: "svg", icons: [{ name: "star", keywords: ["favourite"], nodes: ["M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z"] }] };\n';
const SCRIPT = '```space-lua\nsilverware.icons.defineSets(js.importFromSpace("Library/UiIcons/my-icons.js"))\n```\n';

test("a set of the space's own defined by its script, still answering after System: Reload, defined once", async ({ page, open }) => {
  test.skip(!onSilverBullet, "Space Lua is SilverBullet's");
  await inLibrary({ "my-icons.js": SET, "Mine.md": SCRIPT });
  // (Its API answering: SilverBullet loaded, Space Lua run)
  await open("# Icons\n\nLabel: ${silverware.icons.api.text('lucide:house')}\n");
  await expect(page.locator(".cm-content")).toContainText("Label: House");
  await reloadSpaceLua(page);
  await expect.poll(() => evaluate(page, "silverware.icons.api.text('mine:star')")).toBe("Star");
  await expect.poll(() => evaluate(page, "silverware.icons.api.markup('mine:star', 'x')")).toContain('data-swi-state="drawn"');
  // Loaded again: answering the same, its script run once (twice in one load is said: "sets defined again")
  await reloadSpaceLua(page);
  await expect.poll(() => evaluate(page, "silverware.icons.api.text('mine:star')")).toBe("Star");
  await expect(page.locator(".sb-notifications")).not.toContainText("defined again");
});
