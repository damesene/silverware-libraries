import type { Page } from "@playwright/test";
import { boxOf, expect, gridsDrawn, LAYOUT_SETTINGS, runCommand, test } from "./helpers.ts";

// Where the page's text stands (docs/silverware-layout-text-align.md): centred, at the left, or at the left while a side
// panel is open. A side panel is any element marked so (shared/sidepanel.ts): Silverware Assets' file panel and
// Silverware Database's peek mark theirs; here one is put in the page by hand.

/** Where the text, its lines and the page's title start (x in the window), and the pane's left */
function edges(page: Page): Promise<{ readonly text: number; readonly title: number; readonly pane: number }> {
  return page.evaluate(() => {
    const left = (selector: string) => Math.round(document.querySelector(selector)?.getBoundingClientRect().left ?? NaN);
    return { text: left("#sb-main .cm-content"), title: left("#sb-top .main .inner"), pane: left("#sb-editor") };
  });
}

/** Whether the text stands at the pane's left (its box at the pane's edge, a scrollbar's width at most off) */
const atLeft = async (page: Page) => {
  const { text, pane } = await edges(page);
  return text - pane < 20;
};

/** The text centred: its box as far from the pane's left as the pane's right is from its right (a scrollbar's width off) */
const centred = (page: Page) =>
  page.evaluate(() => {
    const text = document.querySelector("#sb-main .cm-content")!.getBoundingClientRect();
    const pane = document.querySelector("#sb-editor")!.getBoundingClientRect();
    return Math.abs(text.left - pane.left - (pane.right - text.right)) < 24 && text.left - pane.left > 100;
  });

/** A side panel opened (an element marked as one), or closed */
const panel = (page: Page, open: boolean) =>
  page.evaluate((on) => {
    if (on) {
      const aside = document.createElement("aside");
      aside.id = "test-side-panel";
      aside.setAttribute("data-silverware-side-panel", "");
      document.body.append(aside);
    } else document.getElementById("test-side-panel")?.remove();
  }, open);

test("a page's own alignment in its frontmatter: at the left, its title with it; a page without centred", async ({ page, space }) => {
  await space.open({ Left: "---\n_layout:\n  align: left\n---\n# Left\n\nSome text.\n" }, "Left");
  await expect.poll(() => atLeft(page)).toBe(true);
  // (The title over the page where the text starts: SilverBullet lines them up, Silverware Layout moves both)
  await expect.poll(async () => {
    const { text, title } = await edges(page);
    return Math.abs(text - title);
  }).toBeLessThan(2);
  // A panel opened changes nothing: only "left while a panel is open" follows one
  await panel(page, true);
  await panel(page, false);
  expect(await atLeft(page)).toBe(true);
});

test("left while a panel is open: centred, at the left while a side panel is open, its title with it; centred again as it closes", async ({ page, space }) => {
  await space.open({ Page: "---\n_layout:\n  align: left-with-panel\n---\n# Page\n\nSome text.\n" }, "Page");
  await expect.poll(() => centred(page)).toBe(true);
  await panel(page, true);
  await expect.poll(() => atLeft(page)).toBe(true);
  await expect.poll(async () => {
    const { text, title } = await edges(page);
    return Math.abs(text - title);
  }).toBeLessThan(2);
  await panel(page, false);
  await expect.poll(() => centred(page)).toBe(true);
});

test("a page centred by its own alignment stays centred where all pages' is at the left", async ({ page, space }) => {
  await space.open({ Page: "# Page\n\nSome text.\n" }, "Page");
  await runCommand(page, LAYOUT_SETTINGS);
  const dialog = page.locator(".swl-dialog");
  await dialog.getByRole("combobox", { name: "All pages: where the text stands" }).selectOption("left");
  await expect.poll(() => atLeft(page)).toBe(true);
  await dialog.getByRole("combobox", { name: "This page: where the text stands" }).selectOption("center");
  await expect.poll(() => centred(page)).toBe(true);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await space.config()) ?? "").toContain('"silverware.layout.textAlign"');
  expect(await space.config()).toContain('"left"');
  await expect.poll(() => space.saved("Page")).toBe("---\n_layout:\n  align: center\n---\n# Page\n\nSome text.\n");
  expect(await centred(page)).toBe(true);
});

test("the dialog: this page's alignment shown at once, saved into the frontmatter beside its width; Cancel puts it back", async ({ page, space }) => {
  await space.open({ Page: "---\n_layout:\n  width: 700\n---\n# Page\n\nSome text.\n" }, "Page");
  await expect.poll(() => centred(page)).toBe(true);
  await runCommand(page, LAYOUT_SETTINGS);
  const dialog = page.locator(".swl-dialog");
  const own = dialog.getByRole("combobox", { name: "This page: where the text stands" });
  // (What it follows named: all pages', centred)
  await expect(own.locator("option").first()).toHaveText("Same as all pages (Centred)");
  await own.selectOption("left");
  await expect.poll(() => atLeft(page)).toBe(true);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => centred(page)).toBe(true);
  expect(await space.saved("Page")).toBe("---\n_layout:\n  width: 700\n---\n# Page\n\nSome text.\n");

  await runCommand(page, LAYOUT_SETTINGS);
  await dialog.getByRole("combobox", { name: "This page: where the text stands" }).selectOption("left");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => space.saved("Page")).toBe("---\n_layout:\n  width: 700\n  align: left\n---\n# Page\n\nSome text.\n");
  expect(await atLeft(page)).toBe(true);
});

test("a grid wider than the text, the text at the left: from the text's start to the right, within the pane; centred again with the text", async ({ page, space }) => {
  const grid = '<grid width="1000">\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n';
  await space.open({ Page: `---\n_layout:\n  align: left-with-panel\n---\n# Page\n\nAbove\n\n${grid}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  const drawn = page.locator("#sb-main .swl-grid");
  const lineStart = () => page.evaluate(() => Math.round(document.querySelector("#sb-main .cm-line")!.getBoundingClientRect().left));
  // Centred: on the text's middle, wider than it both ways
  await expect.poll(async () => Math.round((await boxOf(drawn)).width)).toBe(1000);
  expect((await boxOf(drawn)).x).toBeLessThan(await lineStart());
  await panel(page, true);
  await expect.poll(() => atLeft(page)).toBe(true);
  // At the left: from the text's start, as wide, its right edge within the pane
  await expect.poll(async () => Math.round((await boxOf(drawn)).x) - (await lineStart())).toBe(0);
  const pane = await page.evaluate(() => document.querySelector("#sb-editor")!.getBoundingClientRect().right);
  const box = await boxOf(drawn);
  expect(box.x + box.width).toBeLessThanOrEqual(pane);
  expect(Math.round(box.width)).toBe(1000);
  await panel(page, false);
  await expect.poll(async () => (await boxOf(drawn)).x < (await lineStart())).toBe(true);
  // Nothing written
  expect(await space.saved("Page")).toContain('<grid width="1000">');
});

test("a centred grid's handle dragged with the text at the left: past the text's width it grows to the right alone, by the move; the guides from the text's start", async ({ page, space }) => {
  const grid = '<grid width="900">\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n';
  await space.open({ Page: `---\n_layout:\n  align: left\n---\n# Page\n\nAbove\n\n${grid}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  await expect.poll(() => atLeft(page)).toBe(true);
  const drawn = page.locator("#sb-main .swl-grid");
  const start = (await boxOf(drawn)).x;
  await drawn.hover();
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  const handle = await boxOf(bar);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 60, handle.y + handle.height / 2, { steps: 12 });
  // (Wider by the move, its left edge where it was: not by twice the move, as a centred one in centred text)
  await expect.poll(async () => Math.round((await boxOf(drawn)).width)).toBe(960);
  expect(Math.round((await boxOf(drawn)).x)).toBe(Math.round(start));
  // The guide of the text's width drawn where the text ends
  const textEnd = await page.evaluate(() => {
    const content = document.querySelector("#sb-main .cm-content")!;
    return content.getBoundingClientRect().right - parseFloat(getComputedStyle(content).paddingRight);
  });
  const guides = await page.locator(".swl-handle-guide").evaluateAll((lines) => lines.map((line) => Math.round(line.getBoundingClientRect().left)));
  expect(guides.some((x) => Math.abs(x - textEnd) <= 2)).toBe(true);
  await page.mouse.up();
  await expect.poll(() => space.saved("Page")).toContain('<grid width="960">');
});

test("a grid at the right wider than the text, the text at the left: dragged narrower than the text, its width follows the pointer and stays (it grew from the text's start as the drag began)", async ({ page, space }) => {
  const grid = '<grid width="1000" align="right">\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight text\n\n</cell>\n</grid>\n';
  await space.open({ Page: `---\n_layout:\n  align: left\n---\n# Page\n\nAbove\n\n${grid}\nBelow\n` }, "Page");
  await gridsDrawn(page);
  await expect.poll(() => atLeft(page)).toBe(true);
  const drawn = page.locator("#sb-main .swl-grid");
  await drawn.hover();
  const bar = page.locator(".swl-handle-bar");
  await expect(bar).toBeVisible();
  // (Wider than the text, it stands at the text's start: its handle at its right edge)
  const handle = await boxOf(bar);
  const box = await boxOf(drawn);
  expect(handle.x).toBeGreaterThan(box.x + box.width / 2);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 300, handle.y + handle.height / 2, { steps: 12 });
  await expect.poll(async () => Math.round((await boxOf(drawn)).width)).toBe(700);
  // (Moved on by 10 px, narrower by as much: not flipped to its end, where a move to the left would widen it)
  await page.mouse.move(handle.x + handle.width / 2 - 310, handle.y + handle.height / 2);
  await expect.poll(async () => Math.round((await boxOf(drawn)).width)).toBe(690);
  await page.mouse.up();
  await expect.poll(() => space.saved("Page")).toContain('<grid width="690" align="right">');
});
