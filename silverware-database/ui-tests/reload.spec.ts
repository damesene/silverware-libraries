// SilverBullet's System: Reload (docs/silverware-core-work.md, step S, item 2): Space Lua loaded again runs the
// init page again on the module already loaded: the store, writer and core kept (made once per window), the modules
// stopped and made anew. After it the database works as before, once, and Undo still undoes.
import type { Page } from "@playwright/test";
import { boxOf, caretAtEnd, expect, expectNoPageErrorsYet, fieldReady, item, reloadSpaceLua, root, test } from "./helpers.ts";

const TASKS = { "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": item("Todo", "a0"), "Page/db-tasks/Write docs": item("Done", "a1") };
const BLOCK = "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n";

/**
 * The modules started again after a reload (their start is after the init page returns): the place's menu with one
 * Properties, the properties module's (two: the modules started twice), closed by Esc
 */
async function modulesStarted(page: Page): Promise<void> {
  const menu = page.locator(".swd-menu:visible");
  await page.locator(".swd-more").click();
  await expect(menu.locator(".swd-menu-item").filter({ has: page.locator(".swd-label", { hasText: /^Properties$/ }) })).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
}

test("after System: Reload Undo still brings back an item removed before it", async ({ page, space }) => {
  await space.open({ Page: BLOCK, ...TASKS }, "Page");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  await page.locator(".swd-peek-remove").click();
  // (SilverBullet's own question: Ok)
  const prompt = page.locator("dialog.sb-modal-box .sb-prompt");
  await prompt.locator(".sb-prompt-buttons button", { hasText: "Ok" }).click();
  await expect(page.locator(".swd-list-name")).toHaveText(["Write docs"]);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toBeUndefined();
  await reloadSpaceLua(page);
  await modulesStarted(page);
  await page.locator(".swd-undo").click();
  await expect(page.locator(".swd-list-name")).toHaveText(["Fix login", "Write docs"]);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("status: Todo");
});

test("after System: Reload the place's menu and a peek open once, the peek closed by one Esc", async ({ page, space }) => {
  await space.open({ Page: BLOCK, ...TASKS }, "Page");
  await reloadSpaceLua(page);
  await modulesStarted(page);
  const peek = page.locator(".swd-peek");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  await expect(peek).toHaveCount(1);
  await expect(page.locator(".swd-peek-name")).toHaveValue("Fix login");
  await page.keyboard.press("Escape");
  await expect(peek).toHaveCount(0);
});

test("System: Reload with a peek open: what was typed in it written once; the peek kept open (known: closed)", async ({ page, space }) => {
  await space.open({ Page: BLOCK, ...TASKS }, "Page");
  await page.locator(".swd-list-name", { hasText: "Fix login" }).click();
  const peek = page.locator(".swd-peek");
  const body = peek.locator(".swd-peek-body");
  await expect.poll(() => fieldReady(body)).toBe(true);
  await body.click();
  await page.keyboard.type("Typed before the reload");
  await reloadSpaceLua(page);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toContain("Typed before the reload");
  expect((await space.saved("Page/db-tasks/Fix login"))!.split("Typed before the reload")).toHaveLength(2);
  expectNoPageErrorsYet(page);
  test.fail(true, "Known (2026-11-26): System: Reload closes a database's peek open (its modules made anew); kept once the peek's state is the core's (steps 6 and 10)");
  await expect(peek).toHaveCount(1);
  await expect(page.locator(".swd-peek-name")).toHaveValue("Fix login");
});

test("after System: Reload a press beside the block, in its margin and right of the text, shows no markdown and writes nothing; the caret where it lands", async ({ page, space }) => {
  const text = `${BLOCK}\nAfter\n`;
  await space.open({ Page: text, ...TASKS }, "Page");
  await expect(page.locator(".swd-list-name")).toHaveCount(2);
  await reloadSpaceLua(page);
  await modulesStarted(page);
  type View = { state: { selection: { main: { head: number } }; doc: { length: number } }; hasFocus: boolean };
  const caret = () => page.evaluate(() => {
    const view = (window as unknown as { client: { editorView: View } }).client.editorView;
    return { head: view.state.selection.main.head, end: view.state.doc.length, focused: view.hasFocus };
  });
  const widget = page.locator(".swd-widget").first();
  const content = page.locator(".cm-content");
  const points: readonly (readonly [string, () => Promise<readonly [number, number]>])[] = [
    ["the widget's margin", async () => {
      const [w, p] = [await boxOf(widget), await boxOf(page.locator(".swd-place").first())];
      // (A margin there to press, not the place itself)
      expect(p.y - w.y).toBeGreaterThanOrEqual(4);
      return [w.x + 40, (w.y + p.y) / 2];
    }],
    ["right of the content", async () => {
      const [w, c] = [await boxOf(widget), await boxOf(content)];
      return [c.x + c.width + 20, w.y + w.height / 2];
    }],
  ];
  const landed: Record<string, unknown> = {};
  for (const [where, at] of points) {
    await caretAtEnd(page);
    const [x, y] = await at();
    await page.mouse.click(x, y);
    await expect(page.locator(".swd-place")).toBeVisible();
    await expect(page.locator(".cm-line", { hasText: "```silverware-database" })).toHaveCount(0);
    landed[where] = await caret();
  }
  test.info().annotations.push({ type: "landed", description: JSON.stringify(landed) });
  // (As today: the caret left where it was, at the page's end, and the editor not given the focus)
  const kept = { head: text.length, end: text.length, focused: false };
  expect(landed).toEqual({ "the widget's margin": kept, "right of the content": kept });
  // (Then a letter typed at the end, written for sure: the page holds it alone, so whatever a press wrote, even late,
  // would be in it too)
  await page.locator(".cm-line", { hasText: "After" }).click();
  await page.keyboard.press("End");
  await page.keyboard.type("Z");
  await expect.poll(() => space.saved("Page")).toBe(text.replace("After\n", "AfterZ\n"));
});
