// A click on a link SilverBullet shows as its markdown (src/host/silverbullet/links.ts): the cursor's alone, a link
// drawn as a link followed as ever; while all the markdown is shown as written (shared/syntaxmode.ts), an embed's line
// too; the Markdown tab of the Page layout dialog turning it off.
import { cursorAt, expect, PAGE_LAYOUT, PIXEL_PNG, runCommand, test } from "./helpers.ts";

test("a click on a link shown as its markdown (the cursor in it) places the cursor, the text pointer over it; drawn as a link, a click opens it", async ({ page, space }) => {
  const text = "# Page\n\nSee [[Other]] here\n\nAfter\n";
  await space.open({ Page: text, Other: "# Other\n" }, "Page");
  const url = page.url();
  // (The cursor into the link: its markdown shown)
  const inLink = text.indexOf("Other") + 2;
  await page.evaluate((at) => (window as unknown as { client: { editorView: { dispatch(spec: unknown): void } } }).client.editorView.dispatch({ selection: { anchor: at } }), inLink);
  const shown = page.locator("#sb-main .cm-line span.sb-wiki-link", { hasText: "Other" });
  await expect(shown).toBeVisible();
  const box = (await shown.boundingBox())!;
  await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);
  // (The cursor in the link's name, where it was clicked)
  await expect.poll(() => cursorAt(page)).toBeGreaterThan(text.indexOf("Other") + 2);
  expect(await cursorAt(page)).toBeLessThanOrEqual(text.indexOf("Other") + "Other".length);
  // (The text's pointer over it, not a hand)
  await page.mouse.move(box.x + 3, box.y + box.height / 2);
  await expect.poll(() => shown.evaluate((element) => getComputedStyle(element).cursor)).toBe("text");
  // The cursor away: drawn as a link, a click opens it
  await page.locator("#sb-main .cm-line", { hasText: "After" }).click();
  const drawn = page.locator("#sb-main .cm-line a.sb-wiki-link", { hasText: "Other" });
  await expect(drawn).toBeVisible();
  await drawn.click();
  await expect.poll(() => page.url()).toContain("/Other");
});

test("SilverBullet's markdown shown as written: a click on an embed's `![[` places the cursor, SilverBullet not told of it; the Markdown tab's box off, SilverBullet's click again", async ({ page, space }) => {
  const image = `![[${space.folder}/photo.png|Photo|120]]`;
  await space.open({ Page: `# Page\n\n${image}\n\nAfter\n` }, "Page", { "photo.png": PIXEL_PNG });
  const url = page.url();
  const clickAtStart = async () => {
    const line = page.locator("#sb-main .cm-line", { hasText: "photo.png" });
    const box = (await line.boundingBox())!;
    await page.mouse.click(box.x + 3, box.y + 8);
  };
  // The clicks SilverBullet is told of (its editor's listener is under `#sb-main`): counted there
  await page.evaluate(() => {
    const seen = window as unknown as { swlClicks: number };
    seen.swlClicks = 0;
    document.querySelector("#sb-main")!.addEventListener("click", () => void seen.swlClicks++);
  });
  const told = () => page.evaluate(() => (window as unknown as { swlClicks: number }).swlClicks);
  await runCommand(page, "Editor: Toggle Markdown Syntax Rendering");
  await expect(page.locator("#sb-main .cm-content")).toContainText(image);
  // (SilverBullet follows an embed's line on a click anywhere on it, its `!` too: held back, the cursor at the click)
  await clickAtStart();
  const start = "# Page\n\n".length;
  await expect.poll(() => cursorAt(page)).toBeGreaterThanOrEqual(start);
  expect(await cursorAt(page)).toBeLessThanOrEqual(start + image.length);
  expect(await told()).toBe(0);
  await page.waitForTimeout(500);
  expect(page.url()).toBe(url);
  // The box off in the Page layout dialog's Markdown tab: the click SilverBullet's again (what it does with it, its own)
  await runCommand(page, PAGE_LAYOUT);
  const dialog = page.locator(".swl-dialog");
  await dialog.getByRole("tab", { name: "Markdown" }).click();
  await dialog.getByLabel("A click on a link shown as its markdown only places the cursor").uncheck();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => space.config()).toContain('config.set("silverware.layout.links.clickPlacesCursor", false)');
  await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute("data-swl-syntax-clicks")), { timeout: 15_000 }).toBe(false);
  await clickAtStart();
  await expect.poll(told).toBe(1);
  if (page.url() !== url) await page.goBack();
  await runCommand(page, "Editor: Toggle Markdown Syntax Rendering");
});
