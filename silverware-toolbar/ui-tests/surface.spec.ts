// The toolbar over an editing surface (shared/editor.ts): Silverware Editor's editor in Silverware Layout's grid cell,
// against SilverBullet alone (the test spaces have every plugin). Its selection read in the editor's shadow root, its
// actions written there, the popup's search focused not leaving the cell.
import type { Page } from "@playwright/test";
import { barButton, expect, onSilverBullet, popup, test, text } from "./helpers.ts";

const GRID = "# Grid\n\n<grid>\n<cell>\n\nLeft text\n\n</cell>\n<cell>\n\nRight\n\n</cell>\n</grid>\n";

/** The cell's editor, once it is Silverware Editor's (loaded when the browser is idle: a cell opened before has a plain field) */
const cellEditor = (page: Page) => page.locator("#sb-main .swl-grid-editor");

/** The cell's editor's text, read from its state (its lines show the markdown as rendered) */
const cellText = (page: Page): Promise<string> =>
  cellEditor(page).evaluate((root: HTMLElement) => {
    const content = root.shadowRoot?.querySelector(".cm-content") as (Element & { cmTile?: { view?: { state: { doc: { toString(): string } } } } }) | null;
    return content?.cmTile?.view?.state.doc.toString() ?? "";
  });

test("over a grid's cell edited in Silverware Editor's editor: a selection there shows it, its actions written in the cell, the popup's search keeping the cell open", async ({ page }) => {
  test.skip(!onSilverBullet, "the grid and the editor are SilverBullet's plugins");
  // The page made a grid (written through the page's editor, as typed)
  await page.evaluate((grid) => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { length: number } }; dispatch(spec: unknown): void } } }).client.editorView;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: grid } });
  }, GRID);
  // (Drawn once SilverBullet's custom syntax is active; the editor loaded once the browser is idle)
  await expect(async () => {
    if (await cellEditor(page).count()) await page.keyboard.press("Escape");
    await page.locator("#sb-main .swl-grid-cell").first().click({ timeout: 1000 });
    await expect(cellEditor(page).locator(".cm-content")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+End");
  await barButton(page, "formats.bold").click();
  await expect.poll(() => cellText(page)).toBe("**Left text**");
  // The popup's search takes the focus: the cell stays edited, the action written there
  await barButton(page, "actions.more").click();
  await expect(popup(page)).toBeVisible();
  await popup(page).locator(".swb-search-field").fill("italic");
  await popup(page).locator('[data-swb-action="formats.italic"]').click();
  await expect(cellEditor(page)).toHaveCount(1);
  await expect.poll(() => cellText(page)).toBe("**_Left text_**");
  // Nothing of it in the page until the cell is left; then written there
  expect(await text(page)).toBe(GRID);
  // The command's key in the cell's editor: the popup by it (SilverBullet runs its commands in its own editor alone)
  await page.keyboard.press("Control+Shift+Q");
  await expect(popup(page)).toBeVisible();
  await expect(cellEditor(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect.poll(() => text(page)).toContain("<cell>\n\n**_Left text_**\n\n</cell>");
});

test("other plugins' actions in a grid's cell: Upload file puts the file into the cell, the grid's own actions are off there", async ({ page }) => {
  test.skip(!onSilverBullet, "the grid, the editor and the files' dialog are SilverBullet's plugins");
  await page.evaluate((grid) => {
    const view = (window as unknown as { client: { editorView: { state: { doc: { length: number } }; dispatch(spec: unknown): void } } }).client.editorView;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: grid } });
  }, GRID);
  await expect(async () => {
    if (await cellEditor(page).count()) await page.keyboard.press("Escape");
    await page.locator("#sb-main .swl-grid-cell").first().click({ timeout: 1000 });
    await expect(cellEditor(page).locator(".cm-content")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await page.keyboard.press("Control+End");
  // The grid's actions off in a cell (a cell holds no grid)
  await page.keyboard.press("Control+Shift+Q");
  await expect(popup(page)).toBeVisible();
  await popup(page).locator(".swb-search-field").fill("grid");
  await expect(popup(page).locator('[data-swb-action="actions.layoutWrapInGrid"]')).toHaveAttribute("aria-disabled", "true");
  await expect(popup(page).locator('[data-swb-action="actions.layoutMoveToGrid"]')).toHaveAttribute("aria-disabled", "true");
  // Upload file: the files' dialog, the file picked put into the cell
  await popup(page).locator(".swb-search-field").fill("upload file");
  const chooser = page.waitForEvent("filechooser");
  await popup(page).locator('[data-swb-action="actions.assetsUploadFile"]').click();
  const dialog = page.locator(".swa-dialog.swa-insert-window");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Files…" }).click();
  await (await chooser).setFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
  const path = await dialog.locator(".swa-insert-path").inputValue();
  await dialog.getByRole("button", { name: "Insert" }).click();
  await expect.poll(() => cellText(page)).toContain(`![[${path}`);
  // (Written into the cell once it is left, not elsewhere in the page)
  await page.keyboard.press("Escape");
  await expect.poll(async () => {
    const written = await text(page);
    const cell = written.slice(written.indexOf("<cell>"), written.indexOf("</cell>"));
    return cell.includes("Left text") && cell.includes(`![[${path}`);
  }).toBe(true);
});
