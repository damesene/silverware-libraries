// Silverware Editor's field in each host (docs/silverware-core-work.md, step S, item 4: recorded against today's code
// before the hosts' UI is rewritten): the same keys typed in a grid's cell and in a database's peek write the markdown
// SilverBullet's own editor writes for them in the page: a list continued by Enter, its empty item taken off by the
// next, the text typed then on the line after the list (no blank line: Markdown reads it as the item's, as the page
// does too). And the keys each host gives the field: Ctrl+Z and Ctrl+Y, Ctrl+Enter, a shortcut of SilverBullet's
// kept from it and said.
import type { Locator, Page } from "@playwright/test";
import { cellField, expect, fieldReady, gridsDrawn, item, peekField, root, test } from "./helpers.ts";

const TYPED = "- one\n- two\nText";

/** The keys of a list of two items, the list ended and a line of text after it, typed over the field's text */
async function typeList(page: Page, field: Locator): Promise<void> {
  await expect.poll(() => fieldReady(field)).toBe(true);
  await page.keyboard.press("Control+a");
  await page.keyboard.type("- one");
  await page.keyboard.press("Enter");
  await page.keyboard.type("two");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Text");
}

/**
 * A grid's first cell opened in the editor, focused (the editor is loaded once SilverBullet has started, when the
 * browser is idle: a cell opened before is a plain field, which continues no list; opened again until it is the editor)
 */
async function cellOpened(page: Page): Promise<Locator> {
  await gridsDrawn(page);
  await expect(async () => {
    if (await cellField(page).count()) await page.keyboard.press("Escape");
    await page.locator("#sb-main .swl-grid-cell").first().click({ timeout: 1000 });
    await expect(cellField(page).locator(".cm-content")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await expect(cellField(page).locator(".cm-content")).toBeFocused();
  await expect.poll(() => fieldReady(cellField(page))).toBe(true);
  return cellField(page);
}

/** Fix login's peek opened with its body in the editor, the caret in it (a peek opened before the editor loads keeps a
 * plain field while it is open: opened again until its field is the editor) */
async function peekOpened(page: Page): Promise<Locator> {
  await expect(async () => {
    if (await page.locator(".swd-peek").count()) await page.keyboard.press("Escape");
    await expect(page.locator(".swd-peek")).toHaveCount(0, { timeout: 1000 });
    await page.locator(".swd-list-name", { hasText: "Fix login" }).click({ timeout: 1000 });
    await expect(peekField(page).locator(".cm-content")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  const field = peekField(page);
  await expect.poll(() => fieldReady(field)).toBe(true);
  await field.locator(".cm-content").click();
  return field;
}

/** The field's text as its editor holds it */
const fieldText = (field: Locator) => field.locator(".cm-content").evaluate((content) => [...content.querySelectorAll(".cm-line")].map((line) => line.textContent).join("\n"));

/** " more" typed at the text's end, undone by Ctrl+Z, done again by Ctrl+Y: the field's text after each */
async function undoRedo(page: Page, field: Locator): Promise<string[]> {
  await page.keyboard.press("Control+End");
  // (One input, one step of the editor's history: keys typed one by one are joined only within 500 ms, which a loaded
  // machine may pass)
  await page.keyboard.insertText(" more");
  await expect.poll(() => fieldText(field)).toMatch(/ more$/);
  const texts = [await fieldText(field)];
  await page.keyboard.press("Control+z");
  await expect.poll(() => fieldText(field)).not.toBe(texts[0]);
  texts.push(await fieldText(field));
  await page.keyboard.press("Control+y");
  await expect.poll(() => fieldText(field)).not.toBe(texts[1]);
  texts.push(await fieldText(field));
  return texts;
}

const GRID = "# Page\n\n<grid>\n<cell>\n\nOld\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n";
const PEEK = { Page: "# Page\n\n```silverware-database\nid: tasks\nview: list\n```\n", "Page/db-tasks": root("tasks", "Tasks"), "Page/db-tasks/Fix login": `${item("Todo", "a0")}Old\n` };

test("in a grid's cell: a list continued and ended by Enter, written as typed once the cell is left", async ({ page, space }) => {
  await space.open({ Page: GRID }, "Page");
  await typeList(page, await cellOpened(page));
  await page.keyboard.press("Escape");
  await expect(cellField(page)).toHaveCount(0);
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n<grid>\n<cell>\n\n${TYPED}\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n\nAfter\n`);
});

test("in a database's peek: the same keys write the same markdown into the item's page once the peek is left", async ({ page, space }) => {
  await space.open(PEEK, "Page");
  await typeList(page, await peekOpened(page));
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-peek")).toHaveCount(0);
  // (Ctrl+A took the field's text whole, its last line's end too: written as typed, without one)
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toBe(`${item("Todo", "a0")}${TYPED}`);
});

test("the reference: the same keys in the page's own editor write the same list", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nOld\n" }, "Page");
  await page.locator("#sb-main .cm-line", { hasText: "Old" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+Home");
  await page.keyboard.type("- one");
  await page.keyboard.press("Enter");
  await page.keyboard.type("two");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Text");
  await expect.poll(() => space.saved("Page")).toBe(`# Page\n\n${TYPED}\n`);
});

test("in a grid's cell: Ctrl+Z and Ctrl+Y undo and redo the typing, Ctrl+Enter leaves it written, Ctrl+K kept and said", async ({ page, space }) => {
  await space.open({ Page: GRID }, "Page");
  const field = await cellOpened(page);
  expect(await undoRedo(page, field)).toEqual(["Old more", "Old", "Old more"]);
  await page.keyboard.press("Control+k");
  await expect(page.locator(".sb-notifications")).toContainText("Navigate: Page Picker doesn't work here");
  await page.keyboard.press("Control+Enter");
  await expect(cellField(page)).toHaveCount(0);
  await expect.poll(() => space.saved("Page")).toBe(GRID.replace("\nOld\n", "\nOld more\n"));
});

test("in a database's peek: Ctrl+Z and Ctrl+Y undo and redo the typing, Ctrl+Enter a line more (none of its own), Ctrl+K kept and said", async ({ page, space }) => {
  await space.open(PEEK, "Page");
  const field = await peekOpened(page);
  // (Its body "Old\n": its end on the empty line after)
  expect(await undoRedo(page, field)).toEqual(["Old\n more", "Old\n", "Old\n more"]);
  await page.keyboard.press("Control+k");
  await expect(page.locator(".sb-notifications")).toContainText("Navigate: Page Picker doesn't work here");
  await page.keyboard.press("Control+Enter");
  // (As today: the peek binds no Ctrl+Enter, the editor's own runs, a line more indented as the last, the peek kept)
  await expect.poll(() => fieldText(field)).toBe("Old\n more\n ");
  await expect(page.locator(".swd-peek")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".swd-peek")).toHaveCount(0);
  await expect.poll(() => space.saved("Page/db-tasks/Fix login")).toBe(`${item("Todo", "a0")}Old\n more\n `);
});
