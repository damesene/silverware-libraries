// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// API page again (its definitions reset, `silverware.icons.api` made again). After it the API answers as before.
import { expect, onSilverBullet, reloadSpaceLua, test } from "./helpers.ts";

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
